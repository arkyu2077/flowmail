import type { Attachment, EmailMessage, TradeCase } from '../src/types';
import { analyzeCaseQualification } from '../src/lib/qualification';
import type { CasePackId } from '../src/lib/case-packs';
import { getGoogleOAuthConfig } from './oauth';
import type { StoredMailboxConnection } from './store';

const gmailBaseUrl = 'https://gmail.googleapis.com/gmail/v1';
const googleUserInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

type GoogleUserInfoResponse = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

type GmailProfileResponse = {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
};

type GmailListThreadsResponse = {
  threads?: Array<{ id: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailHeader = {
  name: string;
  value: string;
};

type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    size?: number;
    data?: string;
    attachmentId?: string;
  };
  parts?: GmailMessagePart[];
};

type GmailMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailMessagePart;
};

type GmailThread = {
  id: string;
  messages?: GmailMessage[];
};

type GmailAttachmentResponse = {
  data?: string;
  size?: number;
};

const defaultGmailSyncQuery =
  'newer_than:180d -category:promotions -category:social -category:forums -category:updates';
const gmailSyncQuery = process.env.GMAIL_SYNC_QUERY ?? defaultGmailSyncQuery;
const gmailSyncMaxThreads = Number.parseInt(process.env.GMAIL_SYNC_MAX_THREADS ?? '25', 10);

export const getGmailSyncQuery = (): string => gmailSyncQuery;

const normalizeBase64Url = (value: string): string => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding === 0) {
    return base64;
  }
  return `${base64}${'='.repeat(4 - padding)}`;
};

const decodeBase64Url = (value?: string): string => {
  if (!value) {
    return '';
  }
  return Buffer.from(normalizeBase64Url(value), 'base64').toString('utf8');
};

const stripHtml = (value: string): string =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();

const getHeader = (headers: GmailHeader[] | undefined, name: string): string => {
  return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? '';
};

const splitAddresses = (rawValue: string): string[] =>
  rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

const parseMailbox = (value: string): { name: string; email: string } | null => {
  const angleMatch = value.match(/^(.*)<([^>]+)>$/);
  if (angleMatch) {
    return {
      name: angleMatch[1].replace(/"/g, '').trim() || angleMatch[2].trim(),
      email: angleMatch[2].trim().toLowerCase(),
    };
  }

  const emailMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!emailMatch) {
    return null;
  }

  return {
    name: value.replace(emailMatch[0], '').replace(/[<>"]/g, '').trim() || emailMatch[0],
    email: emailMatch[0].toLowerCase(),
  };
};

const isTextLikeMime = (mimeType: string): boolean =>
  mimeType.startsWith('text/') ||
  mimeType === 'application/json' ||
  mimeType === 'application/xml' ||
  mimeType === 'message/rfc822';

const collectTextBodies = (part: GmailMessagePart | undefined): { plain: string[]; html: string[] } => {
  const buckets = {
    plain: [] as string[],
    html: [] as string[],
  };

  const walk = (node: GmailMessagePart | undefined) => {
    if (!node) {
      return;
    }

    const mimeType = node.mimeType ?? '';
    if (node.body?.data) {
      const decoded = decodeBase64Url(node.body.data);
      if (mimeType === 'text/plain') {
        buckets.plain.push(decoded);
      } else if (mimeType === 'text/html') {
        buckets.html.push(decoded);
      }
    }

    node.parts?.forEach(walk);
  };

  walk(part);
  return buckets;
};

const apiRequest = async <T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${gmailBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Gmail API ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
};

const exchangeTokens = async (params: URLSearchParams): Promise<GoogleTokenResponse> => {
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${await response.text()}`);
  }

  return (await response.json()) as GoogleTokenResponse;
};

export const exchangeGoogleCodeForTokens = async (code: string): Promise<GoogleTokenResponse> => {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth configuration.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  return exchangeTokens(params);
};

export const refreshGoogleAccessToken = async (
  refreshToken: string,
): Promise<GoogleTokenResponse> => {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth configuration.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  return exchangeTokens(params);
};

export const fetchGoogleUserInfo = async (
  accessToken: string,
): Promise<GoogleUserInfoResponse> => {
  const response = await fetch(googleUserInfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Google userinfo failed: ${await response.text()}`);
  }

  return (await response.json()) as GoogleUserInfoResponse;
};

export const fetchGmailProfile = async (accessToken: string): Promise<GmailProfileResponse> => {
  return apiRequest<GmailProfileResponse>(accessToken, '/users/me/profile');
};

const listRecentThreadIds = async (accessToken: string): Promise<string[]> => {
  const searchParams = new URLSearchParams({
    maxResults: String(Number.isNaN(gmailSyncMaxThreads) ? 25 : gmailSyncMaxThreads),
    q: gmailSyncQuery,
  });

  const response = await apiRequest<GmailListThreadsResponse>(
    accessToken,
    `/users/me/threads?${searchParams.toString()}`,
  );

  return response.threads?.map((thread) => thread.id) ?? [];
};

const fetchThread = async (accessToken: string, threadId: string): Promise<GmailThread> => {
  return apiRequest<GmailThread>(
    accessToken,
    `/users/me/threads/${threadId}?format=full`,
  );
};

const fetchTextAttachment = async (
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<string> => {
  const attachment = await apiRequest<GmailAttachmentResponse>(
    accessToken,
    `/users/me/messages/${messageId}/attachments/${attachmentId}`,
  );
  return decodeBase64Url(attachment.data);
};

const collectAttachments = async (
  accessToken: string,
  message: GmailMessage,
): Promise<Attachment[]> => {
  const attachments: Attachment[] = [];

  const walk = async (part: GmailMessagePart | undefined) => {
    if (!part) {
      return;
    }

    if (part.filename) {
      let text = part.filename;
      const mimeType = part.mimeType ?? 'application/octet-stream';
      if (isTextLikeMime(mimeType) && part.body?.attachmentId) {
        try {
          text = `${part.filename}\n${await fetchTextAttachment(
            accessToken,
            message.id,
            part.body.attachmentId,
          )}`.trim();
        } catch {
          text = part.filename;
        }
      } else if (isTextLikeMime(mimeType) && part.body?.data) {
        text = `${part.filename}\n${decodeBase64Url(part.body.data)}`.trim();
      }

      attachments.push({
        id: `${message.id}:${part.body?.attachmentId ?? part.filename}`,
        fileName: part.filename,
        mimeType,
        text,
      });
    }

    if (part.parts?.length) {
      for (const child of part.parts) {
        await walk(child);
      }
    }
  };

  await walk(message.payload);
  return attachments;
};

const buildEmailMessage = (message: GmailMessage): EmailMessage => {
  const headers = message.payload?.headers ?? [];
  const textBodies = collectTextBodies(message.payload);
  const plain = textBodies.plain.join('\n').trim();
  const html = stripHtml(textBodies.html.join('\n'));
  const body = plain || html || message.snippet || '';

  return {
    id: message.id,
    sender: getHeader(headers, 'From') || 'unknown',
    recipients: [
      ...splitAddresses(getHeader(headers, 'To')),
      ...splitAddresses(getHeader(headers, 'Cc')),
    ],
    sentAt: message.internalDate
      ? new Date(Number.parseInt(message.internalDate, 10)).toISOString()
      : new Date().toISOString(),
    subject: getHeader(headers, 'Subject') || '(no subject)',
    body,
  };
};

const inferExternalCounterparty = (
  messages: EmailMessage[],
  mailboxAddress: string,
): { account: string; email: string } => {
  const ownAddress = mailboxAddress.toLowerCase();
  const ownDomain = ownAddress.split('@')[1] ?? '';
  const candidates = new Map<string, { name: string; email: string; count: number }>();

  const pushCandidate = (rawValue: string) => {
    const parsed = parseMailbox(rawValue);
    if (!parsed) {
      return;
    }

    const domain = parsed.email.split('@')[1] ?? '';
    if (parsed.email === ownAddress || (ownDomain && domain === ownDomain)) {
      return;
    }

    const current = candidates.get(parsed.email);
    candidates.set(parsed.email, {
      name: parsed.name || parsed.email,
      email: parsed.email,
      count: (current?.count ?? 0) + 1,
    });
  };

  messages.forEach((message) => {
    pushCandidate(message.sender);
    message.recipients.forEach(pushCandidate);
  });

  const best =
    [...candidates.values()].sort((left, right) => right.count - left.count)[0] ?? null;

  if (best) {
    return {
      account: best.name,
      email: best.email,
    };
  }

  return {
    account: 'Unknown counterparty',
    email: '',
  };
};

const inferRegionFromEmail = (email: string): string => {
  const domain = email.split('@')[1] ?? '';
  if (domain.endsWith('.au')) {
    return 'AU';
  }
  if (domain.endsWith('.uk')) {
    return 'UK';
  }
  if (domain.endsWith('.de') || domain.endsWith('.fr') || domain.endsWith('.eu')) {
    return 'EU';
  }
  if (domain.endsWith('.jp')) {
    return 'JP';
  }
  if (domain.endsWith('.sg')) {
    return 'SG';
  }
  if (domain.endsWith('.us') || domain.endsWith('.com')) {
    return 'US';
  }
  return 'Global';
};

const buildTradeCaseLabel = (subject: string, account: string): string => {
  const normalizedSubject = subject.replace(/^(re|fw|fwd):\s*/gi, '').trim();
  return normalizedSubject ? `${account} / ${normalizedSubject}` : account;
};

const isRelevantTradeCase = (
  tradeCase: TradeCase,
  casePackId: CasePackId,
): boolean => analyzeCaseQualification(tradeCase, casePackId).qualified;

const threadToTradeCase = async (
  accessToken: string,
  mailboxAddress: string,
  thread: GmailThread,
  casePackId: CasePackId,
): Promise<TradeCase | null> => {
  const messages = [...(thread.messages ?? [])].sort((left, right) => {
    const leftTime = Number.parseInt(left.internalDate ?? '0', 10);
    const rightTime = Number.parseInt(right.internalDate ?? '0', 10);
    return leftTime - rightTime;
  });

  if (messages.length === 0) {
    return null;
  }

  const tradeMessages = messages.map(buildEmailMessage);
  const attachmentGroups = await Promise.all(
    messages.map((message) => collectAttachments(accessToken, message)),
  );
  const attachments = attachmentGroups.flat();
  const latestSubject = tradeMessages[tradeMessages.length - 1]?.subject ?? '(no subject)';
  const counterparty = inferExternalCounterparty(tradeMessages, mailboxAddress);
  const tradeCase: TradeCase = {
    id: `gmail-thread-${thread.id}`,
    label: buildTradeCaseLabel(latestSubject, counterparty.account),
    account: counterparty.account,
    region: inferRegionFromEmail(counterparty.email),
    messages: tradeMessages,
    attachments,
  };

  if (!isRelevantTradeCase(tradeCase, casePackId)) {
    return null;
  }

  return tradeCase;
};

export interface GmailSyncResult {
  emailAddress: string;
  cases: TradeCase[];
  syncedThreadCount: number;
  syncedCaseCount: number;
  syncedAt: string;
}

export const syncGmailMailbox = async (
  connection: StoredMailboxConnection,
  casePackId: CasePackId = 'external_trade_order',
): Promise<GmailSyncResult> => {
  if (!connection.tokens.accessToken) {
    throw new Error('Missing Gmail access token.');
  }

  const profile = await fetchGmailProfile(connection.tokens.accessToken);
  const threadIds = await listRecentThreadIds(connection.tokens.accessToken);
  const threads = await Promise.all(
    threadIds.map((threadId) => fetchThread(connection.tokens.accessToken!, threadId)),
  );

  const cases = (
    await Promise.all(
      threads.map((thread) =>
        threadToTradeCase(connection.tokens.accessToken!, profile.emailAddress, thread, casePackId),
      ),
    )
  )
    .filter(Boolean)
    .sort((left, right) => {
      const leftLatest = [...left!.messages].sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0]?.sentAt ?? '';
      const rightLatest = [...right!.messages].sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0]?.sentAt ?? '';
      return rightLatest.localeCompare(leftLatest);
    }) as TradeCase[];

  return {
    emailAddress: profile.emailAddress,
    cases,
    syncedThreadCount: threadIds.length,
    syncedCaseCount: cases.length,
    syncedAt: new Date().toISOString(),
  };
};
