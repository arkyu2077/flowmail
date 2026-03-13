import { randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import type {
  AssistantQueryRequest,
  AssistantQueryResponse,
  AuthSessionResponse,
  CreateWorkspaceAccessTokenRequest,
  CreateWorkspaceAccessTokenResponse,
  CreateWorkspaceRequest,
  ConfigureFeishuBitableTargetRequest,
  ConfigureNotionTargetRequest,
  DraftReplyResponse,
  ExportCasesResponse,
  GetTradeCaseResponse,
  GoogleAuthInitiateRequest,
  GoogleAuthInitiateResponse,
  ListWorkspacesResponse,
  LoginRequest,
  ListCasePacksResponse,
  ListExportTargetsResponse,
  ListMailboxConnectionsResponse,
  ListTradeCasesResponse,
  MailboxConnectionRequest,
  MailboxConnectionResponse,
  MailboxConnectionStatus,
  MailboxRefreshResponse,
  MissingDocumentsResponse,
  ListWorkspaceAccessTokensResponse,
  RegisterRequest,
  TradeCaseRecord,
  UpdateWorkspaceCasePackRequest,
  WorkspaceCasePackResponse,
} from '../src/api/contracts';
import { activeCasePackId, casePacks, getCasePackById, type CasePackId } from '../src/lib/case-packs';
import { getSampleCasesForPack } from '../src/data/sampleCaseRegistry';
import { analyzeCase } from '../src/lib/analysis';
import { analyzeCaseQualification } from '../src/lib/qualification';
import type { TradeCase, WorkflowStatus } from '../src/types';
import {
  exportRowsToFeishuBitable,
  getEnvFeishuBitableTarget,
  hasFeishuAppConfig,
  hasEnvFeishuBitableConfig,
} from './feishu';
import {
  exchangeGoogleCodeForTokens,
  fetchGoogleUserInfo,
  getGmailSyncQuery,
  refreshGoogleAccessToken,
  syncGmailMailbox,
} from './gmail';
import { flattenCasesForAgentOutputs } from './exports';
import { exportRowsToNotion, getEnvNotionTarget, hasEnvNotionConfig } from './notion';
import {
  buildGoogleOAuthUrl,
  buildGoogleLoginOAuthUrl,
  getGoogleScopes,
  hasGoogleOAuthConfig,
} from './oauth';
import {
  type StoredMailboxConnection,
  type StoredWorkspaceAccessToken,
  type WorkspaceRole,
} from './store';
import type { TradeCaseRepository } from './repository';
import { MailCaseEngineService } from './services/mail-case-engine';
import { MailboxConnectorService } from './services/mailbox-connector';

type AppVariables = {
  authMethod: 'user_session' | 'workspace_token';
  authAccessTokenId: string | null;
  authUserId: string | null;
  authUserName: string | null;
  authUserEmail: string | null;
  authWorkspaceId: string;
  authWorkspaceRole: WorkspaceRole;
  authToken: string;
};

const sessionCookieName = 'tradecase_session';
const csrfCookieName = 'tradecase_csrf';
let frontendBaseUrl = process.env.FRONTEND_BASE_URL ?? 'http://localhost:3017';
let secureCookies =
  process.env.COOKIE_SECURE === 'true' ||
  process.env.NODE_ENV === 'production' ||
  (process.env.APP_BASE_URL?.startsWith('https://') ?? false) ||
  (process.env.FRONTEND_BASE_URL?.startsWith('https://') ?? false);
let activeRepository: TradeCaseRepository | null = null;

export interface CreateTradeCaseAppOptions {
  repository: TradeCaseRepository;
  frontendBaseUrl?: string;
  secureCookies?: boolean;
}

const resolveSecureCookies = (
  override?: boolean,
  resolvedFrontendBaseUrl?: string,
): boolean => {
  if (typeof override === 'boolean') {
    return override;
  }

  return (
    process.env.COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production' ||
    (process.env.APP_BASE_URL?.startsWith('https://') ?? false) ||
    (resolvedFrontendBaseUrl?.startsWith('https://') ?? false) ||
    (process.env.FRONTEND_BASE_URL?.startsWith('https://') ?? false)
  );
};

const getRepository = (): TradeCaseRepository => {
  if (!activeRepository) {
    throw new Error('TradeCase app repository has not been configured.');
  }
  return activeRepository;
};

const completeAuthSession = (...args: Parameters<TradeCaseRepository['completeAuthSession']>) =>
  getRepository().completeAuthSession(...args);
const completeGoogleLoginSession = (
  ...args: Parameters<TradeCaseRepository['completeGoogleLoginSession']>
) => getRepository().completeGoogleLoginSession(...args);
const createUserWithWorkspace = (
  ...args: Parameters<TradeCaseRepository['createUserWithWorkspace']>
) => getRepository().createUserWithWorkspace(...args);
const createWorkspaceForUser = (
  ...args: Parameters<TradeCaseRepository['createWorkspaceForUser']>
) => getRepository().createWorkspaceForUser(...args);
const createOrUpdatePendingConnection = (
  ...args: Parameters<TradeCaseRepository['createOrUpdatePendingConnection']>
) => getRepository().createOrUpdatePendingConnection(...args);
const createGoogleLoginSession = (
  ...args: Parameters<TradeCaseRepository['createGoogleLoginSession']>
) => getRepository().createGoogleLoginSession(...args);
const deleteUserSession = (...args: Parameters<TradeCaseRepository['deleteUserSession']>) =>
  getRepository().deleteUserSession(...args);
const getExportTarget = (...args: Parameters<TradeCaseRepository['getExportTarget']>) =>
  getRepository().getExportTarget(...args);
const getAuthSession = (...args: Parameters<TradeCaseRepository['getAuthSession']>) =>
  getRepository().getAuthSession(...args);
const getGoogleLoginSession = (
  ...args: Parameters<TradeCaseRepository['getGoogleLoginSession']>
) => getRepository().getGoogleLoginSession(...args);
const getMailboxConnection = (
  ...args: Parameters<TradeCaseRepository['getMailboxConnection']>
) => getRepository().getMailboxConnection(...args);
const getMailboxConnectionByProvider = (
  ...args: Parameters<TradeCaseRepository['getMailboxConnectionByProvider']>
) => getRepository().getMailboxConnectionByProvider(...args);
const getWorkspaceMeta = (...args: Parameters<TradeCaseRepository['getWorkspaceMeta']>) =>
  getRepository().getWorkspaceMeta(...args);
const getUserBySessionToken = (
  ...args: Parameters<TradeCaseRepository['getUserBySessionToken']>
) => getRepository().getUserBySessionToken(...args);
const getWorkspaceMembership = (
  ...args: Parameters<TradeCaseRepository['getWorkspaceMembership']>
) => getRepository().getWorkspaceMembership(...args);
const getWorkspaceAccessTokenByToken = (
  ...args: Parameters<TradeCaseRepository['getWorkspaceAccessTokenByToken']>
) => getRepository().getWorkspaceAccessTokenByToken(...args);
const getWorkspaceCases = (...args: Parameters<TradeCaseRepository['getWorkspaceCases']>) =>
  getRepository().getWorkspaceCases(...args);
const listExportTargets = (...args: Parameters<TradeCaseRepository['listExportTargets']>) =>
  getRepository().listExportTargets(...args);
const listMailboxConnections = (
  ...args: Parameters<TradeCaseRepository['listMailboxConnections']>
) => getRepository().listMailboxConnections(...args);
const listUserWorkspaces = (
  ...args: Parameters<TradeCaseRepository['listUserWorkspaces']>
) => getRepository().listUserWorkspaces(...args);
const loginOrCreateGoogleUser = (
  ...args: Parameters<TradeCaseRepository['loginOrCreateGoogleUser']>
) => getRepository().loginOrCreateGoogleUser(...args);
const loginUser = (...args: Parameters<TradeCaseRepository['loginUser']>) =>
  getRepository().loginUser(...args);
const saveWorkspaceCases = (...args: Parameters<TradeCaseRepository['saveWorkspaceCases']>) =>
  getRepository().saveWorkspaceCases(...args);
const listWorkspaceAccessTokens = (
  ...args: Parameters<TradeCaseRepository['listWorkspaceAccessTokens']>
) => getRepository().listWorkspaceAccessTokens(...args);
const createWorkspaceAccessToken = (
  ...args: Parameters<TradeCaseRepository['createWorkspaceAccessToken']>
) => getRepository().createWorkspaceAccessToken(...args);
const revokeWorkspaceAccessToken = (
  ...args: Parameters<TradeCaseRepository['revokeWorkspaceAccessToken']>
) => getRepository().revokeWorkspaceAccessToken(...args);
const upsertExportTarget = (
  ...args: Parameters<TradeCaseRepository['upsertExportTarget']>
) => getRepository().upsertExportTarget(...args);
const updateMailboxConnection = (
  ...args: Parameters<TradeCaseRepository['updateMailboxConnection']>
) => getRepository().updateMailboxConnection(...args);
const updateWorkspaceCasePack = (
  ...args: Parameters<TradeCaseRepository['updateWorkspaceCasePack']>
) => getRepository().updateWorkspaceCasePack(...args);

const buildAllowedOrigins = (origin: string): string[] => {
  const allowed = new Set<string>([origin]);

  try {
    const url = new URL(origin);
    if (url.hostname === 'localhost') {
      allowed.add(`${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ''}`);
    } else if (url.hostname === '127.0.0.1') {
      allowed.add(`${url.protocol}//localhost${url.port ? `:${url.port}` : ''}`);
    }
  } catch {
    return [origin];
  }

  return [...allowed];
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getBearerToken = (authorizationHeader?: string | null): string | null => {
  if (!authorizationHeader) {
    return null;
  }
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token.trim() || null;
};

const getSessionTokenFromRequest = (context: Context): string | null => {
  const cookieToken = getCookie(context, sessionCookieName);
  if (cookieToken) {
    return cookieToken;
  }
  return getBearerToken(context.req.header('Authorization'));
};

const setSessionCookie = (context: Context, token: string) => {
  setCookie(context, sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: secureCookies,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
};

const establishBrowserSession = (context: Context, token: string) => {
  setSessionCookie(context, token);
  ensureCsrfCookie(context);
};

const clearSessionCookie = (context: Context) => {
  deleteCookie(context, sessionCookieName, {
    path: '/',
  });
};

const setCsrfCookie = (context: Context, token: string) => {
  setCookie(context, csrfCookieName, token, {
    httpOnly: false,
    sameSite: 'Lax',
    secure: secureCookies,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
};

const ensureCsrfCookie = (context: Context): string => {
  const existing = getCookie(context, csrfCookieName);
  if (existing) {
    return existing;
  }
  const token = randomUUID();
  setCsrfCookie(context, token);
  return token;
};

const clearCsrfCookie = (context: Context) => {
  deleteCookie(context, csrfCookieName, {
    path: '/',
  });
};

const isInteractiveSession = (context: Context<{ Variables: AppVariables }>): boolean =>
  context.get('authMethod') === 'user_session';

const requireInteractiveSession = (
  context: Context<{ Variables: AppVariables }>,
): Response | null => {
  if (!isInteractiveSession(context)) {
    return context.json(
      {
        error:
          'This endpoint requires an interactive TradeCase session. Workspace API tokens are only allowed on engine routes.',
      },
      403,
    );
  }

  return null;
};

const requireWorkspaceAdmin = (
  context: Context<{ Variables: AppVariables }>,
): Response | null => {
  const interactiveError = requireInteractiveSession(context);
  if (interactiveError) {
    return interactiveError;
  }

  const role = context.get('authWorkspaceRole');
  if (!['owner', 'admin'].includes(role)) {
    return context.json({ error: 'Owner or admin access is required.' }, 403);
  }

  return null;
};

const canUseWorkspaceToken = (context: Context): boolean => {
  const path = context.req.path;
  const method = context.req.method.toUpperCase();

  if (path.endsWith('/engine/cases') && method === 'GET') {
    return true;
  }
  if (/\/api\/workspaces\/[^/]+\/engine\/cases\/[^/]+$/.test(path) && method === 'GET') {
    return true;
  }
  if (path.endsWith('/engine/stuck-cases') && method === 'GET') {
    return true;
  }
  if (path.endsWith('/engine/missing-documents') && method === 'GET') {
    return true;
  }
  if (/\/api\/workspaces\/[^/]+\/engine\/cases\/[^/]+\/summarize$/.test(path) && method === 'POST') {
    return true;
  }
  if (/\/api\/workspaces\/[^/]+\/engine\/cases\/[^/]+\/draft-reply$/.test(path) && method === 'POST') {
    return true;
  }
  if (path.endsWith('/engine/query') && method === 'POST') {
    return true;
  }
  if (path.endsWith('/engine/mailbox-connections') && method === 'GET') {
    return true;
  }
  if (path.endsWith('/engine/mailbox-connections/initiate') && method === 'POST') {
    return true;
  }
  if (/\/api\/workspaces\/[^/]+\/engine\/mailbox-connections\/[^/]+\/sync$/.test(path) && method === 'POST') {
    return true;
  }

  return false;
};

const mapWorkspaceAccessTokenRecord = (accessToken: StoredWorkspaceAccessToken) => ({
  id: accessToken.id,
  name: accessToken.name,
  tokenPreview: accessToken.tokenPreview,
  scopes: accessToken.scopes,
  createdByUserId: accessToken.createdByUserId,
  createdAt: accessToken.createdAt,
  lastUsedAt: accessToken.lastUsedAt,
  revokedAt: accessToken.revokedAt,
});

export const createTradeCaseApp = (options: CreateTradeCaseAppOptions) => {
  activeRepository = options.repository;
  frontendBaseUrl = options.frontendBaseUrl ?? process.env.FRONTEND_BASE_URL ?? 'http://localhost:3017';
  secureCookies = resolveSecureCookies(options.secureCookies, frontendBaseUrl);

  const allowedFrontendOrigins = buildAllowedOrigins(frontendBaseUrl);
  const app = new Hono<{ Variables: AppVariables }>();
  const mailCaseEngine = new MailCaseEngineService(options.repository);
  const mailboxConnector = new MailboxConnectorService(
    options.repository,
    (workspaceId) => mailCaseEngine.getWorkspaceCasePackId(workspaceId),
    async (workspaceId) => (await mailCaseEngine.getVisibleWorkspaceCases(workspaceId)).length,
  );

  app.use(
    '/api/*',
    cors({
      origin: (requestOrigin) => {
        if (!requestOrigin) {
          return frontendBaseUrl;
        }
        return allowedFrontendOrigins.includes(requestOrigin) ? requestOrigin : frontendBaseUrl;
      },
      allowHeaders: ['Content-Type', 'Authorization', 'X-TradeCase-CSRF'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    }),
  );

  app.use('/api/*', async (context, next) => {
    if (getCookie(context, sessionCookieName)) {
      ensureCsrfCookie(context);
    }
    await next();
  });

app.use('/api/*', async (context, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(context.req.method.toUpperCase())) {
    await next();
    return;
  }

  const sessionCookie = getCookie(context, sessionCookieName);
  if (!sessionCookie) {
    await next();
    return;
  }

  const csrfCookie = getCookie(context, csrfCookieName);
  const csrfHeader = context.req.header('X-TradeCase-CSRF');
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return context.json({ error: 'CSRF validation failed.' }, 403);
  }

  await next();
});

const presentSession = async (token: string): Promise<AuthSessionResponse> => {
  const auth = await getUserBySessionToken(token);
  if (!auth) {
    throw new Error('Invalid session.');
  }

  const workspaces = await listUserWorkspaces(auth.user.id);
  return {
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name,
    },
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: workspace.role,
      selectedCasePackId: workspace.selectedCasePackId,
      createdAt: workspace.createdAt,
    })),
  };
};

app.use('/api/workspaces/:workspaceId/*', async (context, next) => {
  const workspaceId = context.req.param('workspaceId');
  const sessionToken = getSessionTokenFromRequest(context);
  if (sessionToken) {
    const auth = await getUserBySessionToken(sessionToken);
    if (auth) {
      const membership = await getWorkspaceMembership(workspaceId, auth.user.id);
      if (!membership) {
        return context.json({ error: 'You do not have access to this workspace.' }, 403);
      }

      context.set('authMethod', 'user_session');
      context.set('authAccessTokenId', null);
      context.set('authUserId', auth.user.id);
      context.set('authUserName', auth.user.name);
      context.set('authUserEmail', auth.user.email);
      context.set('authWorkspaceId', workspaceId);
      context.set('authWorkspaceRole', membership.role);
      context.set('authToken', sessionToken);
      await next();
      return;
    }
  }

  const bearerToken = getBearerToken(context.req.header('Authorization'));
  if (!bearerToken) {
    return context.json({ error: 'Authentication required.' }, 401);
  }

  const workspaceAccessToken = await getWorkspaceAccessTokenByToken(bearerToken);
  if (!workspaceAccessToken) {
    return context.json({ error: 'Invalid or expired session.' }, 401);
  }

  if (workspaceAccessToken.workspaceId !== workspaceId) {
    return context.json({ error: 'This workspace token does not belong to the requested workspace.' }, 403);
  }

  if (!canUseWorkspaceToken(context)) {
    return context.json(
      {
        error: 'This endpoint is not available to workspace API tokens.',
      },
      403,
    );
  }

  context.set('authMethod', 'workspace_token');
  context.set('authAccessTokenId', workspaceAccessToken.id);
  context.set('authUserId', null);
  context.set('authUserName', null);
  context.set('authUserEmail', null);
  context.set('authWorkspaceId', workspaceId);
  context.set('authWorkspaceRole', 'member');
  context.set('authToken', bearerToken);
  await next();
});

const getWorkspaceCasePackId = async (workspaceId: string): Promise<CasePackId> => {
  const workspace = await getWorkspaceMeta(workspaceId);
  return workspace?.selectedCasePackId ?? activeCasePackId;
};

const getWorkspaceTradeCases = async (workspaceId: string): Promise<TradeCase[]> => {
  const casePackId = await getWorkspaceCasePackId(workspaceId);
  const storedCases = await getWorkspaceCases(workspaceId);
  const mailboxConnections = await listMailboxConnections(workspaceId);
  const hasConnectedMailbox = mailboxConnections.some((connection) => connection.status === 'connected');
  const sourceCases =
    storedCases.length > 0 ? storedCases : hasConnectedMailbox ? [] : getSampleCasesForPack(casePackId);
  return sourceCases.filter((tradeCase) => analyzeCaseQualification(tradeCase, casePackId).qualified);
};

const resolveFeishuTarget = async (workspaceId: string) => {
  const stored = await getExportTarget(workspaceId, 'feishu_bitable');
  if (stored?.config.feishuAppToken && stored.config.feishuTableId) {
    return {
      mode: 'workspace' as const,
      target: {
        appToken: stored.config.feishuAppToken,
        tableId: stored.config.feishuTableId,
        displayName: stored.config.displayName,
      },
    };
  }

  const envTarget = getEnvFeishuBitableTarget();
  if (envTarget && hasEnvFeishuBitableConfig()) {
    return {
      mode: 'env_fallback' as const,
      target: envTarget,
    };
  }

  return {
    mode: 'missing' as const,
    target: null,
  };
};

const resolveNotionTarget = async (workspaceId: string) => {
  const stored = await getExportTarget(workspaceId, 'notion');
  if (stored?.config.notionAccessToken && stored.config.notionDataSourceId) {
    return {
      mode: 'workspace' as const,
      target: {
        apiKey: stored.config.notionAccessToken,
        dataSourceId: stored.config.notionDataSourceId,
        notionVersion: stored.config.notionVersion ?? '2025-09-03',
        titleProperty: stored.config.notionTitleProperty ?? 'Name',
        displayName: stored.config.displayName,
      },
    };
  }

  const envTarget = getEnvNotionTarget();
  if (envTarget && hasEnvNotionConfig()) {
    return {
      mode: 'env_fallback' as const,
      target: envTarget,
    };
  }

  return {
    mode: 'missing' as const,
    target: null,
  };
};

const buildExportTargetsResponse = async (
  workspaceId: string,
): Promise<ListExportTargetsResponse> => {
  const storedTargets = await listExportTargets(workspaceId);
  const storedTargetMap = Object.fromEntries(storedTargets.map((target) => [target.provider, target]));
  const feishu = await resolveFeishuTarget(workspaceId);
  const notion = await resolveNotionTarget(workspaceId);
  const feishuReady = Boolean(feishu.target) && hasFeishuAppConfig();

  return {
    workspaceId,
    items: [
      {
        id: 'feishu_bitable',
        name: 'Feishu Bitable',
        configured: feishuReady,
        authMode: feishu.mode,
        displayName: storedTargetMap.feishu_bitable?.config.displayName ?? null,
        locationHint: feishu.target
          ? `table ${feishu.target.tableId}`
          : 'No workspace table selected yet',
        setupHint:
          feishu.target && !hasFeishuAppConfig()
            ? 'Workspace target is saved, but the server is still missing Feishu app credentials.'
            : feishu.mode === 'workspace'
            ? 'This workspace will export to its own Feishu table.'
            : feishu.mode === 'env_fallback'
              ? 'Using server env fallback. Replace this with a workspace install for public SaaS.'
              : 'Save a workspace table target first. In production this should come from customer auth.',
      },
      {
        id: 'notion',
        name: 'Notion Data Source',
        configured: Boolean(notion.target),
        authMode: notion.mode,
        displayName: storedTargetMap.notion?.config.displayName ?? null,
        locationHint: notion.target
          ? `data source ${notion.target.dataSourceId}`
          : 'No workspace data source selected yet',
        setupHint:
          notion.mode === 'workspace'
            ? 'This workspace will export to its own Notion data source.'
            : notion.mode === 'env_fallback'
              ? 'Using server env fallback. Replace this with workspace OAuth before public rollout.'
              : 'Save a workspace access token and data source. In production this should come from customer OAuth.',
      },
    ],
  };
};

const buildCallbackRedirect = (
  baseUrl: string | null | undefined,
  params: Record<string, string>,
): string => {
  const url = new URL(baseUrl || frontendBaseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
};

const buildCallbackHtml = (title: string, message: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #081320;
        color: #f5f7fb;
        display: grid;
        min-height: 100vh;
        place-items: center;
      }
      .card {
        max-width: 560px;
        padding: 32px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 20px 80px rgba(0, 0, 0, 0.35);
      }
      p { line-height: 1.6; color: #b6c0d1; }
      a { color: #8dd6ff; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p>You can close this tab and return to TradeCase OS.</p>
      <p><a href="${escapeHtml(frontendBaseUrl)}">Open TradeCase dashboard</a></p>
    </div>
  </body>
</html>`;

app.post('/api/auth/register', async (context) => {
  const body = (await context.req.json().catch(() => ({}))) as Partial<RegisterRequest>;
  try {
    const result = await createUserWithWorkspace({
      name: body.name ?? '',
      email: body.email ?? '',
      password: body.password ?? '',
      workspaceName: body.workspaceName ?? '',
    });

    const response: AuthSessionResponse = {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      workspaces: [
        {
          id: result.workspace.id,
          name: result.workspace.name,
          slug: result.workspace.slug,
          role: result.role,
          selectedCasePackId: result.workspace.selectedCasePackId,
          createdAt: result.workspace.createdAt,
        },
      ],
    };

    establishBrowserSession(context, result.sessionToken);
    return context.json(response, 201);
  } catch (error) {
    return context.json(
      {
        error: error instanceof Error ? error.message : 'Unable to create account.',
      },
      400,
    );
  }
});

app.post('/api/auth/login', async (context) => {
  const body = (await context.req.json().catch(() => ({}))) as Partial<LoginRequest>;
  try {
    const result = await loginUser({
      email: body.email ?? '',
      password: body.password ?? '',
    });
    establishBrowserSession(context, result.sessionToken);
    const response = await presentSession(result.sessionToken);
    return context.json(response);
  } catch (error) {
    return context.json(
      {
        error: error instanceof Error ? error.message : 'Unable to login.',
      },
      401,
    );
  }
});

app.post('/api/auth/google/initiate', async (context) => {
  if (!hasGoogleOAuthConfig()) {
    return context.json(
      {
        error:
          'Google OAuth env vars are not configured. Fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI first.',
      },
      400,
    );
  }

  const body = (await context.req.json().catch(() => ({}))) as Partial<GoogleAuthInitiateRequest>;
  const googleLoginSession = await createGoogleLoginSession(body.returnUrl ?? frontendBaseUrl);
  const response: GoogleAuthInitiateResponse = {
    oauthUrl: buildGoogleLoginOAuthUrl(`login:${googleLoginSession.id}`),
  };
  return context.json(response, 201);
});

app.get('/api/auth/session', async (context) => {
  const token = getSessionTokenFromRequest(context);
  if (!token) {
    return context.json({ error: 'Authentication required.' }, 401);
  }

  try {
    const response = await presentSession(token);
    ensureCsrfCookie(context);
    return context.json(response);
  } catch {
    clearSessionCookie(context);
    clearCsrfCookie(context);
    return context.json({ error: 'Invalid or expired session.' }, 401);
  }
});

app.post('/api/auth/logout', async (context) => {
  const token = getSessionTokenFromRequest(context);
  if (!token) {
    return context.json({ error: 'Authentication required.' }, 401);
  }
  await deleteUserSession(token);
  clearSessionCookie(context);
  clearCsrfCookie(context);
  return context.json({ ok: true });
});

app.get('/api/workspaces', async (context) => {
  const token = getSessionTokenFromRequest(context);
  if (!token) {
    return context.json({ error: 'Authentication required.' }, 401);
  }

  const auth = await getUserBySessionToken(token);
  if (!auth) {
    return context.json({ error: 'Invalid or expired session.' }, 401);
  }

  const items = await listUserWorkspaces(auth.user.id);
  const response: ListWorkspacesResponse = {
    items: items.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: workspace.role,
      selectedCasePackId: workspace.selectedCasePackId,
      createdAt: workspace.createdAt,
    })),
  };
  return context.json(response);
});

app.post('/api/workspaces', async (context) => {
  const token = getSessionTokenFromRequest(context);
  if (!token) {
    return context.json({ error: 'Authentication required.' }, 401);
  }

  const auth = await getUserBySessionToken(token);
  if (!auth) {
    return context.json({ error: 'Invalid or expired session.' }, 401);
  }

  const body = (await context.req.json().catch(() => ({}))) as Partial<CreateWorkspaceRequest>;
  try {
    await createWorkspaceForUser({
      userId: auth.user.id,
      name: body.name ?? '',
    });
    const items = await listUserWorkspaces(auth.user.id);
    const response: ListWorkspacesResponse = {
      items: items.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: workspace.role,
        selectedCasePackId: workspace.selectedCasePackId,
        createdAt: workspace.createdAt,
      })),
    };
    return context.json(response, 201);
  } catch (error) {
    return context.json(
      {
        error: error instanceof Error ? error.message : 'Unable to create workspace.',
      },
      400,
    );
  }
});

app.get('/api/health', (context) => {
  return context.json({
    ok: true,
    service: 'tradecase-api',
    googleOAuthConfigured: hasGoogleOAuthConfig(),
  });
});

app.get('/api/workspaces/:workspaceId/cases', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const status = context.req.query('status');
  const search = context.req.query('q');
  const missingOnly = context.req.query('missingOnly') === 'true';
  const limit = Number.parseInt(context.req.query('limit') ?? '50', 10);
  const workspaceId = context.req.param('workspaceId');
  const response = await mailCaseEngine.listCases(workspaceId, {
    status: status ?? undefined,
    query: search ?? undefined,
    missingOnly,
    limit,
  });

  return context.json(response satisfies ListTradeCasesResponse);
});

app.get('/api/workspaces/:workspaceId/engine/cases', async (context) => {
  const status = context.req.query('status');
  const search = context.req.query('q');
  const missingOnly = context.req.query('missingOnly') === 'true';
  const limit = Number.parseInt(context.req.query('limit') ?? '50', 10);
  const workspaceId = context.req.param('workspaceId');
  const response = await mailCaseEngine.listCases(workspaceId, {
    status: status ?? undefined,
    query: search ?? undefined,
    missingOnly,
    limit,
  });

  return context.json(response satisfies ListTradeCasesResponse);
});

app.get('/api/workspaces/:workspaceId/cases/:caseId', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const response = await mailCaseEngine.getCase(workspaceId, context.req.param('caseId'));
  if (!response) {
    return context.json({ error: 'Trade case not found.' }, 404);
  }

  return context.json(response satisfies GetTradeCaseResponse);
});

app.get('/api/workspaces/:workspaceId/engine/cases/:caseId', async (context) => {
  const workspaceId = context.req.param('workspaceId');
  const response = await mailCaseEngine.getCase(workspaceId, context.req.param('caseId'));
  if (!response) {
    return context.json({ error: 'Trade case not found.' }, 404);
  }

  return context.json(response satisfies GetTradeCaseResponse);
});

app.get('/api/workspaces/:workspaceId/stuck-cases', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  return context.json(await mailCaseEngine.listStuckCases(workspaceId));
});

app.get('/api/workspaces/:workspaceId/engine/stuck-cases', async (context) => {
  const workspaceId = context.req.param('workspaceId');
  return context.json(await mailCaseEngine.listStuckCases(workspaceId));
});

app.get('/api/workspaces/:workspaceId/missing-documents', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const response = await mailCaseEngine.listMissingDocuments(workspaceId);
  return context.json(response satisfies MissingDocumentsResponse);
});

app.get('/api/workspaces/:workspaceId/engine/missing-documents', async (context) => {
  const workspaceId = context.req.param('workspaceId');
  const response = await mailCaseEngine.listMissingDocuments(workspaceId);
  return context.json(response satisfies MissingDocumentsResponse);
});

app.post('/api/workspaces/:workspaceId/cases/:caseId/summarize', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const response = await mailCaseEngine.summarizeCase(workspaceId, context.req.param('caseId'));
  if (!response) {
    return context.json({ error: 'Trade case not found.' }, 404);
  }
  return context.json(response);
});

app.post('/api/workspaces/:workspaceId/engine/cases/:caseId/summarize', async (context) => {
  const workspaceId = context.req.param('workspaceId');
  const response = await mailCaseEngine.summarizeCase(workspaceId, context.req.param('caseId'));
  if (!response) {
    return context.json({ error: 'Trade case not found.' }, 404);
  }
  return context.json(response);
});

app.post('/api/workspaces/:workspaceId/cases/:caseId/draft-reply', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const response = await mailCaseEngine.draftReply(workspaceId, context.req.param('caseId'));
  if (!response) {
    return context.json({ error: 'Trade case not found.' }, 404);
  }
  return context.json(response satisfies DraftReplyResponse);
});

app.post('/api/workspaces/:workspaceId/engine/cases/:caseId/draft-reply', async (context) => {
  const workspaceId = context.req.param('workspaceId');
  const response = await mailCaseEngine.draftReply(workspaceId, context.req.param('caseId'));
  if (!response) {
    return context.json({ error: 'Trade case not found.' }, 404);
  }
  return context.json(response satisfies DraftReplyResponse);
});

app.post('/api/workspaces/:workspaceId/assistant/query', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const body = (await context.req.json().catch(() => ({}))) as Partial<AssistantQueryRequest>;
  const query = body.query ?? '';
  return context.json(await mailCaseEngine.answerAssistantQuery(workspaceId, query));
});

app.post('/api/workspaces/:workspaceId/engine/query', async (context) => {
  const workspaceId = context.req.param('workspaceId');
  const body = (await context.req.json().catch(() => ({}))) as Partial<AssistantQueryRequest>;
  const query = body.query ?? '';
  return context.json(await mailCaseEngine.answerAssistantQuery(workspaceId, query));
});

app.get('/api/workspaces/:workspaceId/mailbox-connections', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const response = await mailboxConnector.listConnectionStatuses(workspaceId);
  return context.json(response satisfies ListMailboxConnectionsResponse);
});

app.get('/api/workspaces/:workspaceId/engine/mailbox-connections', async (context) => {
  const workspaceId = context.req.param('workspaceId');
  const response = await mailboxConnector.listConnectionStatuses(workspaceId);
  return context.json(response satisfies ListMailboxConnectionsResponse);
});

app.get('/api/case-packs', (context) => {
  const response: ListCasePacksResponse = {
    items: casePacks,
    activeCasePackId,
  };

  return context.json(response);
});

app.get('/api/workspaces/:workspaceId/case-pack', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const workspace = await getWorkspaceMeta(workspaceId);
  if (!workspace) {
    return context.json({ error: 'Workspace not found.' }, 404);
  }

  const response: WorkspaceCasePackResponse = {
    workspaceId,
    selectedCasePackId: workspace.selectedCasePackId,
    selectedCasePack: getCasePackById(workspace.selectedCasePackId),
  };
  return context.json(response);
});

app.put('/api/workspaces/:workspaceId/case-pack', async (context) => {
  const authError = requireWorkspaceAdmin(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const body = (await context.req.json().catch(() => ({}))) as Partial<UpdateWorkspaceCasePackRequest>;
  const casePackId = body.casePackId;

  if (!casePackId || !casePacks.some((item) => item.id === casePackId)) {
    return context.json({ error: 'Provide a valid casePackId.' }, 400);
  }

  const workspace = await updateWorkspaceCasePack(workspaceId, casePackId);
  if (!workspace) {
    return context.json({ error: 'Workspace not found.' }, 404);
  }

  const response: WorkspaceCasePackResponse = {
    workspaceId,
    selectedCasePackId: workspace.selectedCasePackId,
    selectedCasePack: getCasePackById(workspace.selectedCasePackId),
  };
  return context.json(response);
});

app.get('/api/workspaces/:workspaceId/access-tokens', async (context) => {
  const authError = requireWorkspaceAdmin(context);
  if (authError) {
    return authError;
  }

  const workspaceId = context.req.param('workspaceId');
  const response: ListWorkspaceAccessTokensResponse = {
    workspaceId,
    items: (await listWorkspaceAccessTokens(workspaceId)).map(mapWorkspaceAccessTokenRecord),
  };
  return context.json(response);
});

app.post('/api/workspaces/:workspaceId/access-tokens', async (context) => {
  const authError = requireWorkspaceAdmin(context);
  if (authError) {
    return authError;
  }

  const workspaceId = context.req.param('workspaceId');
  const body = (await context.req.json().catch(() => ({}))) as Partial<CreateWorkspaceAccessTokenRequest>;
  const createdByUserId = context.get('authUserId');
  if (!createdByUserId) {
    return context.json({ error: 'Interactive user context is required.' }, 400);
  }

  const result = await createWorkspaceAccessToken({
    workspaceId,
    name: body.name?.trim() || 'OpenClaw skill',
    createdByUserId,
    scopes: body.scopes?.length ? body.scopes : ['engine'],
  });

  const response: CreateWorkspaceAccessTokenResponse = {
    workspaceId,
    token: mapWorkspaceAccessTokenRecord(result.accessToken),
    plainTextToken: result.plainTextToken,
  };
  return context.json(response, 201);
});

app.delete('/api/workspaces/:workspaceId/access-tokens/:accessTokenId', async (context) => {
  const authError = requireWorkspaceAdmin(context);
  if (authError) {
    return authError;
  }

  const workspaceId = context.req.param('workspaceId');
  const accessTokenId = context.req.param('accessTokenId');
  const revoked = await revokeWorkspaceAccessToken(workspaceId, accessTokenId);
  if (!revoked) {
    return context.json({ error: 'Workspace access token not found.' }, 404);
  }

  const response: ListWorkspaceAccessTokensResponse = {
    workspaceId,
    items: (await listWorkspaceAccessTokens(workspaceId)).map(mapWorkspaceAccessTokenRecord),
  };
  return context.json(response);
});

app.get('/api/workspaces/:workspaceId/export-targets', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const response = await buildExportTargetsResponse(workspaceId);
  return context.json(response);
});

app.put('/api/workspaces/:workspaceId/export-targets/feishu/bitable', async (context) => {
  const authError = requireWorkspaceAdmin(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const body = (await context.req.json().catch(() => ({}))) as Partial<ConfigureFeishuBitableTargetRequest>;

  if (!body.appToken?.trim() || !body.tableId?.trim()) {
    return context.json(
      {
        error: 'Provide both appToken and tableId for the workspace Feishu target.',
      },
      400,
    );
  }

  await upsertExportTarget({
    workspaceId,
    provider: 'feishu_bitable',
    config: {
      displayName: body.displayName?.trim() || null,
      feishuAppToken: body.appToken.trim(),
      feishuTableId: body.tableId.trim(),
    },
  });

  const response = await buildExportTargetsResponse(workspaceId);
  return context.json(response);
});

app.put('/api/workspaces/:workspaceId/export-targets/notion', async (context) => {
  const authError = requireWorkspaceAdmin(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const body = (await context.req.json().catch(() => ({}))) as Partial<ConfigureNotionTargetRequest>;

  if (!body.accessToken?.trim() || !body.dataSourceId?.trim()) {
    return context.json(
      {
        error: 'Provide both accessToken and dataSourceId for the workspace Notion target.',
      },
      400,
    );
  }

  await upsertExportTarget({
    workspaceId,
    provider: 'notion',
    config: {
      displayName: body.displayName?.trim() || null,
      notionAccessToken: body.accessToken.trim(),
      notionDataSourceId: body.dataSourceId.trim(),
      notionTitleProperty: body.titleProperty?.trim() || 'Name',
      notionVersion: body.notionVersion?.trim() || '2025-09-03',
    },
  });

  const response = await buildExportTargetsResponse(workspaceId);
  return context.json(response);
});

app.post('/api/workspaces/:workspaceId/mailbox-connections/initiate', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const body = (await context.req.json().catch(() => ({}))) as Partial<MailboxConnectionRequest>;
  const provider = body.provider === 'outlook' ? 'outlook' : 'gmail';

  if (provider !== 'gmail') {
    return context.json({ error: 'Outlook is not implemented yet in this local build.' }, 501);
  }

  if (!hasGoogleOAuthConfig()) {
    return context.json(
      {
        error:
          'Google OAuth env vars are not configured. Fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI first.',
      },
      400,
    );
  }

  const existingConnection = await mailboxConnector.getActiveGoogleConnection(workspaceId);
  const connectionId = existingConnection?.id ?? `gmail-conn-${randomUUID()}`;
  const authSessionId = randomUUID();
  const returnUrl = body.returnUrl ?? frontendBaseUrl;
  const pendingConnection = await createOrUpdatePendingConnection({
    workspaceId,
    provider,
    scopes: getGoogleScopes(),
    returnUrl,
    connectionId,
    authSessionId,
  });

  const response: MailboxConnectionResponse = {
    workspaceId,
    provider,
    connectionId: pendingConnection.id,
    oauthUrl: buildGoogleOAuthUrl(`mailbox:${authSessionId}`),
    scopes: pendingConnection.scopes,
    mode: pendingConnection.mode,
  };

  return context.json(response, 201);
});

app.post('/api/workspaces/:workspaceId/engine/mailbox-connections/initiate', async (context) => {
  const workspaceId = context.req.param('workspaceId');
  const body = (await context.req.json().catch(() => ({}))) as Partial<MailboxConnectionRequest>;
  const provider = body.provider === 'outlook' ? 'outlook' : 'gmail';

  if (provider !== 'gmail') {
    return context.json({ error: 'Outlook is not implemented yet in this local build.' }, 501);
  }

  if (!hasGoogleOAuthConfig()) {
    return context.json(
      {
        error:
          'Google OAuth env vars are not configured. Fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI first.',
      },
      400,
    );
  }

  const existingConnection = await mailboxConnector.getActiveGoogleConnection(workspaceId);
  const connectionId = existingConnection?.id ?? `gmail-conn-${randomUUID()}`;
  const authSessionId = randomUUID();
  const returnUrl = body.returnUrl ?? frontendBaseUrl;
  const pendingConnection = await createOrUpdatePendingConnection({
    workspaceId,
    provider,
    scopes: getGoogleScopes(),
    returnUrl,
    connectionId,
    authSessionId,
  });

  const response: MailboxConnectionResponse = {
    workspaceId,
    provider,
    connectionId: pendingConnection.id,
    oauthUrl: buildGoogleOAuthUrl(`mailbox:${authSessionId}`),
    scopes: pendingConnection.scopes,
    mode: pendingConnection.mode,
  };

  return context.json(response, 201);
});

app.post('/api/workspaces/:workspaceId/mailbox-connections/:connectionId/refresh', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const connectionId = context.req.param('connectionId');
  try {
    const result = await mailboxConnector.syncMailboxConnection(connectionId);
    const response = mailboxConnector.buildRefreshResponse(workspaceId, connectionId, result);
    return context.json(response satisfies MailboxRefreshResponse);
  } catch (error) {
    return context.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync mailbox connection.',
      },
      400,
    );
  }
});

app.post('/api/workspaces/:workspaceId/engine/mailbox-connections/:connectionId/sync', async (context) => {
  const workspaceId = context.req.param('workspaceId');
  const connectionId = context.req.param('connectionId');
  try {
    const result = await mailboxConnector.syncMailboxConnection(connectionId);
    const response = mailboxConnector.buildRefreshResponse(workspaceId, connectionId, result);
    return context.json(response satisfies MailboxRefreshResponse);
  } catch (error) {
    return context.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync mailbox connection.',
      },
      400,
    );
  }
});

app.post('/api/workspaces/:workspaceId/exports/feishu/bitable', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const { casePackId, records } = await mailCaseEngine.listWorkspaceCaseRecords(workspaceId);
  const casePack = getCasePackById(casePackId);
  const rows = flattenCasesForAgentOutputs(records, casePack.name);
  const feishu = await resolveFeishuTarget(workspaceId);

  if (!feishu.target) {
    return context.json(
      {
        error:
          'Feishu Bitable is not configured for this workspace yet. Save a workspace table target or provide env fallback values first.',
      },
      400,
    );
  }

  const result = await exportRowsToFeishuBitable(rows, feishu.target);
  const response: ExportCasesResponse = {
    workspaceId,
    target: 'feishu_bitable',
    exportedCount: result.exportedCount,
    locationId: result.tableId,
    message: `Exported ${result.exportedCount} ${casePack.name} case(s) to Feishu Bitable.`,
  };

  return context.json(response);
});

app.post('/api/workspaces/:workspaceId/exports/notion', async (context) => {
  const authError = requireInteractiveSession(context);
  if (authError) {
    return authError;
  }
  const workspaceId = context.req.param('workspaceId');
  const { casePackId, records } = await mailCaseEngine.listWorkspaceCaseRecords(workspaceId);
  const casePack = getCasePackById(casePackId);
  const rows = flattenCasesForAgentOutputs(records, casePack.name);
  const notion = await resolveNotionTarget(workspaceId);

  if (!notion.target) {
    return context.json(
      {
        error:
          'Notion is not configured for this workspace yet. Save a workspace access token and data source first.',
      },
      400,
    );
  }

  const result = await exportRowsToNotion(rows, notion.target);
  const response: ExportCasesResponse = {
    workspaceId,
    target: 'notion',
    exportedCount: result.exportedCount,
    locationId: result.dataSourceId,
    message: `Exported ${result.exportedCount} ${casePack.name} case(s) to Notion.`,
  };

  return context.json(response);
});

app.get('/api/oauth/google/callback', async (context) => {
  const code = context.req.query('code');
  const state = context.req.query('state');
  const authError = context.req.query('error');

  if (!state) {
    return context.html(buildCallbackHtml('Missing OAuth state', 'The callback did not include a valid state parameter.'), 400);
  }
  const [purpose, rawSessionId] = state.includes(':') ? state.split(':', 2) : ['mailbox', state];

  if (purpose === 'login') {
    const session = await getGoogleLoginSession(rawSessionId);
    if (!session) {
      return context.html(buildCallbackHtml('Unknown OAuth session', 'This Google login session could not be found.'), 400);
    }

    if (authError) {
      const redirectUrl = buildCallbackRedirect(session.returnUrl, {
        auth: 'error',
        provider: 'google',
        message: authError,
      });
      return context.redirect(redirectUrl, 302);
    }

    if (!code) {
      return context.html(buildCallbackHtml('Missing OAuth code', 'Google did not return an authorization code.'), 400);
    }

    try {
      const tokenResponse = await exchangeGoogleCodeForTokens(code);
      const profile = await fetchGoogleUserInfo(tokenResponse.access_token);
      if (!profile.email || !profile.sub) {
        throw new Error('Google did not return a valid user profile.');
      }
      if (profile.email_verified === false) {
        throw new Error('Google account email is not verified.');
      }

      const loginResult = await loginOrCreateGoogleUser({
        googleSub: profile.sub,
        email: profile.email,
        name: profile.name ?? profile.email.split('@')[0] ?? 'Google user',
        avatarUrl: profile.picture ?? null,
      });
      await completeGoogleLoginSession(session.id);
      establishBrowserSession(context, loginResult.sessionToken);

      const redirectUrl = buildCallbackRedirect(session.returnUrl, {
        auth: 'connected',
        provider: 'google',
      });
      return context.redirect(redirectUrl, 302);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to finish Google login.';
      const redirectUrl = buildCallbackRedirect(session.returnUrl, {
        auth: 'error',
        provider: 'google',
        message,
      });
      return context.redirect(redirectUrl, 302);
    }
  }

  const session = await getAuthSession(rawSessionId);
  if (!session) {
    return context.html(buildCallbackHtml('Unknown OAuth session', 'This OAuth session could not be found in the local TradeCase store.'), 400);
  }

  if (authError) {
    const redirectUrl = buildCallbackRedirect(session.returnUrl, {
      mailbox: 'error',
      provider: 'gmail',
      message: authError,
    });
    return context.redirect(redirectUrl, 302);
  }

  if (!code) {
    return context.html(buildCallbackHtml('Missing OAuth code', 'Google did not return an authorization code.'), 400);
  }

  const connection = await getMailboxConnection(session.connectionId);
  if (!connection) {
    return context.html(buildCallbackHtml('Missing mailbox connection', 'The pending Gmail connection could not be found.'), 404);
  }

  try {
    const tokenResponse = await exchangeGoogleCodeForTokens(code);
    await updateMailboxConnection(connection.id, {
      status: 'connected',
      connectedAt: connection.connectedAt ?? new Date().toISOString(),
      authSessionId: session.id,
      returnUrl: session.returnUrl,
      tokens: {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token ?? connection.tokens.refreshToken,
        scope: tokenResponse.scope ?? connection.tokens.scope,
        tokenType: tokenResponse.token_type ?? connection.tokens.tokenType,
        expiryDate: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
      },
      lastError: null,
    });

    await completeAuthSession(session.id);
    const syncResult = await mailboxConnector.syncMailboxConnection(connection.id);

    const redirectUrl = buildCallbackRedirect(session.returnUrl, {
      mailbox: 'connected',
      provider: 'gmail',
      connectionId: connection.id,
      syncedCases: String(syncResult.syncedCaseCount),
      syncedThreads: String(syncResult.syncedThreadCount),
    });
    return context.redirect(redirectUrl, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to finish Gmail OAuth.';
    await updateMailboxConnection(connection.id, {
      status: 'error',
      lastError: message,
    });

    const redirectUrl = buildCallbackRedirect(session.returnUrl, {
      mailbox: 'error',
      provider: 'gmail',
      connectionId: connection.id,
      message,
    });
    return context.redirect(redirectUrl, 302);
  }
});
  return app;
};
