import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { interpolateTemplate } from '../config';
import type { NormalizedAttachment, NormalizedMessage, NormalizedThread, PluginConfig } from '../types';

const execFileAsync = promisify(execFile);

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const pickString = (record: Record<string, unknown> | null, keys: string[]): string => {
  if (!record) {
    return '';
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

const pickArray = (record: Record<string, unknown> | null, keys: string[]): unknown[] => {
  if (!record) {
    return [];
  }
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
};

const decodeMaybeJson = (value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  return JSON.parse(trimmed);
};

const getItems = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const directItems = pickArray(record, ['items', 'threads', 'messages', 'results', 'data']);
  if (directItems.length) {
    return directItems.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
  }

  return [record];
};

const toIsoDate = (value: string): string => {
  const millis = Number.parseInt(value, 10);
  if (Number.isFinite(millis) && String(millis).length >= 11) {
    return new Date(millis).toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
};

const splitAddresses = (rawValue: string): string[] =>
  rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

const parseParticipant = (raw: string): { displayName: string; email: string } | null => {
  const angleMatch = raw.match(/^(.*)<([^>]+)>$/);
  if (angleMatch) {
    const email = angleMatch[2].trim();
    return {
      displayName: angleMatch[1].replace(/"/g, '').trim() || email,
      email,
    };
  }
  const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!emailMatch) {
    return null;
  }
  return {
    displayName: raw.replace(emailMatch[0], '').replace(/[<>"]/g, '').trim() || emailMatch[0],
    email: emailMatch[0],
  };
};

const inferCounterparty = (messages: NormalizedMessage[], ownAddress: string): { account: string; region: string } => {
  const ownLower = ownAddress.toLowerCase();
  const ownDomain = ownLower.split('@')[1] ?? '';
  const candidates = new Map<string, { account: string; email: string; count: number }>();

  const push = (raw: string) => {
    const parsed = parseParticipant(raw);
    if (!parsed) {
      return;
    }
    const lower = parsed.email.toLowerCase();
    const domain = lower.split('@')[1] ?? '';
    if (lower === ownLower || (ownDomain && domain === ownDomain)) {
      return;
    }
    const current = candidates.get(lower);
    candidates.set(lower, {
      account: parsed.displayName,
      email: parsed.email,
      count: (current?.count ?? 0) + 1,
    });
  };

  for (const message of messages) {
    push(message.sender);
    for (const recipient of message.recipients) {
      push(recipient);
    }
  }

  const best = [...candidates.values()].sort((left, right) => right.count - left.count)[0];
  const domain = best?.email.split('@')[1] ?? '';
  const region =
    domain.endsWith('.au')
      ? 'AU'
      : domain.endsWith('.uk')
        ? 'UK'
        : domain.endsWith('.jp')
          ? 'JP'
          : domain.endsWith('.de') || domain.endsWith('.fr') || domain.endsWith('.eu')
            ? 'EU'
            : domain.endsWith('.sg')
              ? 'SG'
              : domain
                ? 'US'
                : 'Global';

  return {
    account: best?.account || 'Unknown counterparty',
    region,
  };
};

const hashThread = (parts: string[]): string =>
  crypto.createHash('sha1').update(parts.join('|')).digest('hex');

const normalizeAttachments = (messageRecord: Record<string, unknown>, messageId: string): NormalizedAttachment[] => {
  const attachments = pickArray(messageRecord, ['attachments', 'files']);
  return attachments
    .map((item, index) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const fileName = pickString(record, ['fileName', 'filename', 'name']) || `attachment-${index + 1}`;
      const mimeType = pickString(record, ['mimeType', 'mime_type', 'contentType']) || 'application/octet-stream';
      const text = [
        fileName,
        pickString(record, ['text', 'content', 'excerpt', 'snippet']),
      ]
        .filter(Boolean)
        .join('\n')
        .trim();

      return {
        id: pickString(record, ['id', 'attachmentId']) || `${messageId}:${fileName}`,
        fileName,
        mimeType,
        text,
      } satisfies NormalizedAttachment;
    })
    .filter(Boolean) as NormalizedAttachment[];
};

const normalizeMessage = (record: Record<string, unknown>, fallbackThreadId: string): NormalizedMessage => {
  const sender = pickString(record, ['from', 'sender', 'author']) || 'unknown';
  const recipientsRaw =
    pickString(record, ['to']) ||
    pickString(record, ['recipients']) ||
    pickString(record, ['cc']);
  const body =
    pickString(record, ['bodyPlain', 'body', 'text', 'snippet', 'excerpt']) ||
    pickString(record, ['bodyText']);
  const subject = pickString(record, ['subject']) || '(no subject)';
  const sentAt = toIsoDate(
    pickString(record, ['sentAt', 'internalDate', 'date', 'timestamp']) || new Date().toISOString(),
  );

  return {
    id: pickString(record, ['id', 'messageId']) || `${fallbackThreadId}:${sentAt}`,
    sender,
    recipients: splitAddresses(recipientsRaw),
    sentAt,
    subject,
    body,
  };
};

const normalizeThreadRecord = (
  record: Record<string, unknown>,
  ownAddress: string,
  fallbackThreadId?: string,
): NormalizedThread => {
  const threadId = pickString(record, ['threadId', 'id']) || fallbackThreadId || crypto.randomUUID();
  const messageRecords = pickArray(record, ['messages']).map(asRecord).filter(Boolean) as Record<string, unknown>[];
  const messages =
    messageRecords.length > 0
      ? messageRecords.map((message) => normalizeMessage(message, threadId))
      : [normalizeMessage(record, threadId)];
  const attachments = messageRecords.length > 0
    ? messageRecords.flatMap((message) => normalizeAttachments(message, pickString(message, ['id', 'messageId']) || threadId))
    : normalizeAttachments(record, threadId);
  const latestMessage = [...messages].sort((left, right) => right.sentAt.localeCompare(left.sentAt))[0];
  const subject = latestMessage?.subject || pickString(record, ['subject']) || '(no subject)';
  const counterparty = inferCounterparty(messages, ownAddress);

  return {
    threadId,
    subject,
    account: counterparty.account,
    region: counterparty.region,
    latestMessageAt: latestMessage?.sentAt || new Date().toISOString(),
    messages,
    attachments,
    fingerprint: hashThread([
      threadId,
      subject,
      latestMessage?.sentAt || '',
      latestMessage?.body?.slice(0, 240) || '',
      attachments.map((attachment) => `${attachment.fileName}:${attachment.text.slice(0, 120)}`).join('|'),
    ]),
  };
};

const runCommandTemplate = async (
  commandTemplate: string,
  config: PluginConfig,
  extraVars: Record<string, string | number> = {},
): Promise<unknown> => {
  const rendered = interpolateTemplate(commandTemplate, {
    gmailAccount: config.gmailAccount,
    syncQuery: config.syncQuery,
    maxThreads: config.maxThreads,
    gogPath: config.gogPath,
    ...extraVars,
  });

  const { stdout } = await execFileAsync('/bin/sh', ['-lc', rendered], {
    maxBuffer: 10 * 1024 * 1024,
  });

  return decodeMaybeJson(stdout);
};

export const listMailboxThreads = async (config: PluginConfig): Promise<NormalizedThread[]> => {
  const payload = await runCommandTemplate(config.listCommandTemplate, config);
  return getItems(payload).map((item) => normalizeThreadRecord(item, config.gmailAccount));
};

export const getThreadDetail = async (
  config: PluginConfig,
  threadId: string,
): Promise<NormalizedThread | null> => {
  if (!config.threadCommandTemplate.trim()) {
    return null;
  }
  const payload = await runCommandTemplate(config.threadCommandTemplate, config, { threadId });
  const items = getItems(payload);
  const record = items[0];
  if (!record) {
    return null;
  }
  return normalizeThreadRecord(record, config.gmailAccount, threadId);
};
