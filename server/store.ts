import { createHash, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { activeCasePackId, type CasePackId } from '../src/lib/case-packs';
import type { TradeCase } from '../src/types';
import { projectRoot } from './env';

export type MailProvider = 'gmail' | 'outlook';
export type ConnectionStatus = 'pending' | 'connected' | 'error';
export type ExportTargetProvider = 'feishu_bitable' | 'notion';
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface StoredMailboxConnection {
  id: string;
  workspaceId: string;
  provider: MailProvider;
  mode: 'read_only';
  status: ConnectionStatus;
  scopes: string[];
  emailAddress: string | null;
  createdAt: string;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  syncedCaseCount: number;
  syncedThreadCount: number;
  lastError: string | null;
  returnUrl: string | null;
  authSessionId: string | null;
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
    scope: string | null;
    tokenType: string | null;
    expiryDate: string | null;
  };
}

export interface StoredAuthSession {
  id: string;
  workspaceId: string;
  provider: MailProvider;
  connectionId: string;
  returnUrl: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface StoredGoogleLoginSession {
  id: string;
  returnUrl: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  googleSub: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface StoredUserSession {
  token: string;
  userId: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface StoredWorkspaceMeta {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  selectedCasePackId: CasePackId;
  createdAt: string;
}

export interface StoredWorkspaceMembership {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface StoredWorkspaceAccessToken {
  id: string;
  workspaceId: string;
  name: string;
  createdByUserId: string;
  tokenHash: string;
  tokenPreview: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface StoredExportTarget {
  id: ExportTargetProvider;
  workspaceId: string;
  provider: ExportTargetProvider;
  configuredAt: string | null;
  updatedAt: string;
  config: {
    displayName: string | null;
    feishuAppToken: string | null;
    feishuTableId: string | null;
    notionAccessToken: string | null;
    notionDataSourceId: string | null;
    notionTitleProperty: string | null;
    notionVersion: string | null;
  };
}

interface WorkspaceState {
  cases: TradeCase[];
  exportTargets?: Partial<Record<ExportTargetProvider, StoredExportTarget>>;
}

interface StoreData {
  authSessions: Record<string, StoredAuthSession>;
  connections: Record<string, StoredMailboxConnection>;
  googleLoginSessions: Record<string, StoredGoogleLoginSession>;
  workspaceAccessTokens: Record<string, StoredWorkspaceAccessToken>;
  userSessions: Record<string, StoredUserSession>;
  users: Record<string, StoredUser>;
  workspaceMeta: Record<string, StoredWorkspaceMeta>;
  workspaceMemberships: Record<string, StoredWorkspaceMembership>;
  workspaces: Record<string, WorkspaceState>;
}

const runtimeDir = path.join(projectRoot, 'data', 'runtime');
const storeFilePath = path.join(runtimeDir, 'store.json');

const createEmptyStore = (): StoreData => ({
  authSessions: {},
  connections: {},
  googleLoginSessions: {},
  workspaceAccessTokens: {},
  userSessions: {},
  users: {},
  workspaceMeta: {},
  workspaceMemberships: {},
  workspaces: {},
});

const defaultCasePackId: CasePackId = activeCasePackId;

const emptyExportTargetConfig = () => ({
  displayName: null,
  feishuAppToken: null,
  feishuTableId: null,
  notionAccessToken: null,
  notionDataSourceId: null,
  notionTitleProperty: null,
  notionVersion: null,
});

const getWorkspaceState = (
  store: StoreData,
  workspaceId: string,
): WorkspaceState => {
  const current = store.workspaces[workspaceId];
  if (current) {
    return {
      cases: current.cases ?? [],
      exportTargets: current.exportTargets ?? {},
    };
  }

  return {
    cases: [],
    exportTargets: {},
  };
};

const ensureStoreFile = async () => {
  await mkdir(runtimeDir, { recursive: true });
  try {
    await readFile(storeFilePath, 'utf8');
  } catch {
    await writeFile(storeFilePath, JSON.stringify(createEmptyStore(), null, 2), 'utf8');
  }
};

const readStore = async (): Promise<StoreData> => {
  await ensureStoreFile();
  try {
    const raw = await readFile(storeFilePath, 'utf8');
    const parsed = JSON.parse(raw) as StoreData;
    return {
      authSessions: parsed.authSessions ?? {},
      connections: parsed.connections ?? {},
      googleLoginSessions: parsed.googleLoginSessions ?? {},
      workspaceAccessTokens: parsed.workspaceAccessTokens ?? {},
      userSessions: parsed.userSessions ?? {},
      users: parsed.users ?? {},
      workspaceMeta: Object.fromEntries(
        Object.entries(parsed.workspaceMeta ?? {}).map(([workspaceId, workspace]) => [
          workspaceId,
          {
            ...workspace,
            selectedCasePackId: workspace.selectedCasePackId ?? defaultCasePackId,
          },
        ]),
      ),
      workspaceMemberships: parsed.workspaceMemberships ?? {},
      workspaces: Object.fromEntries(
        Object.entries(parsed.workspaces ?? {}).map(([workspaceId, state]) => [
          workspaceId,
          getWorkspaceState(
            {
              authSessions: parsed.authSessions ?? {},
              connections: parsed.connections ?? {},
              googleLoginSessions: parsed.googleLoginSessions ?? {},
              workspaceAccessTokens: parsed.workspaceAccessTokens ?? {},
              userSessions: parsed.userSessions ?? {},
              users: parsed.users ?? {},
              workspaceMeta: parsed.workspaceMeta ?? {},
              workspaceMemberships: parsed.workspaceMemberships ?? {},
              workspaces: { [workspaceId]: state },
            },
            workspaceId,
          ),
        ]),
      ),
    };
  } catch {
    return createEmptyStore();
  }
};

const writeStore = async (data: StoreData) => {
  await ensureStoreFile();
  await writeFile(storeFilePath, JSON.stringify(data, null, 2), 'utf8');
};

const makeMembershipKey = (workspaceId: string, userId: string) => `${workspaceId}:${userId}`;
const hashOpaqueToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
const buildWorkspaceTokenPreview = (token: string): string =>
  token.length <= 12 ? token : `${token.slice(0, 8)}...${token.slice(-4)}`;

const slugifyWorkspaceName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace';

const hashPassword = (password: string): string => {
  const salt = randomUUID();
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, passwordHash: string): boolean => {
  const [salt, storedHash] = passwordHash.split(':');
  if (!salt || !storedHash) {
    return false;
  }
  const computedHash = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, 'hex');
  if (storedBuffer.length !== computedHash.length) {
    return false;
  }
  return timingSafeEqual(storedBuffer, computedHash);
};

const buildUniqueWorkspaceSlug = (store: StoreData, desiredName: string): string => {
  const base = slugifyWorkspaceName(desiredName);
  const existing = new Set(Object.values(store.workspaceMeta).map((workspace) => workspace.slug));
  if (!existing.has(base)) {
    return base;
  }

  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
};

export const listUserWorkspaces = async (userId: string) => {
  const store = await readStore();
  return Object.values(store.workspaceMemberships)
    .filter((membership) => membership.userId === userId)
    .map((membership) => {
      const workspace = store.workspaceMeta[membership.workspaceId];
      if (!workspace) {
        return null;
      }
      return {
        ...workspace,
        role: membership.role,
      };
    })
    .filter(Boolean) as Array<StoredWorkspaceMeta & { role: WorkspaceRole }>;
};

export const getUserBySessionToken = async (token: string) => {
  const store = await readStore();
  const session = store.userSessions[token];
  if (!session) {
    return null;
  }

  const user = store.users[session.userId];
  if (!user) {
    return null;
  }

  store.userSessions[token] = {
    ...session,
    lastUsedAt: new Date().toISOString(),
  };
  await writeStore(store);

  return {
    user,
    session: store.userSessions[token],
  };
};

export const getWorkspaceMembership = async (workspaceId: string, userId: string) => {
  const store = await readStore();
  return store.workspaceMemberships[makeMembershipKey(workspaceId, userId)] ?? null;
};

export const createUserWithWorkspace = async (options: {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
}) => {
  const store = await readStore();
  const email = options.email.trim().toLowerCase();
  if (!email) {
    throw new Error('Email is required.');
  }
  if (options.password.trim().length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
  if (Object.values(store.users).some((user) => user.email === email)) {
    throw new Error('An account with that email already exists.');
  }

  const now = new Date().toISOString();
  const userId = `user-${randomUUID()}`;
  const workspaceId = `ws-${randomUUID()}`;
  const user: StoredUser = {
    id: userId,
    email,
    name: options.name.trim() || email.split('@')[0] || 'Owner',
    passwordHash: hashPassword(options.password),
    googleSub: null,
    avatarUrl: null,
    createdAt: now,
  };
  const workspace: StoredWorkspaceMeta = {
    id: workspaceId,
    name: options.workspaceName.trim() || `${user.name}'s workspace`,
    slug: buildUniqueWorkspaceSlug(store, options.workspaceName || `${user.name}-workspace`),
    ownerUserId: userId,
    selectedCasePackId: defaultCasePackId,
    createdAt: now,
  };
  const membership: StoredWorkspaceMembership = {
    workspaceId,
    userId,
    role: 'owner',
    createdAt: now,
  };
  const sessionToken = `sess_${randomUUID()}`;

  store.users[userId] = user;
  store.workspaceMeta[workspaceId] = workspace;
  store.workspaceMemberships[makeMembershipKey(workspaceId, userId)] = membership;
  store.userSessions[sessionToken] = {
    token: sessionToken,
    userId,
    createdAt: now,
    lastUsedAt: now,
  };
  store.workspaces[workspaceId] = getWorkspaceState(store, workspaceId);
  await writeStore(store);

  return {
    user,
    workspace,
    role: membership.role,
    sessionToken,
  };
};

export const loginUser = async (options: { email: string; password: string }) => {
  const store = await readStore();
  const email = options.email.trim().toLowerCase();
  const user = Object.values(store.users).find((candidate) => candidate.email === email);
  if (!user || !user.passwordHash || !verifyPassword(options.password, user.passwordHash)) {
    throw new Error('Invalid email or password.');
  }

  const sessionToken = `sess_${randomUUID()}`;
  const now = new Date().toISOString();
  store.userSessions[sessionToken] = {
    token: sessionToken,
    userId: user.id,
    createdAt: now,
    lastUsedAt: now,
  };
  await writeStore(store);

  return {
    user,
    sessionToken,
  };
};

export const createGoogleLoginSession = async (returnUrl?: string | null) => {
  const store = await readStore();
  const sessionId = randomUUID();
  store.googleLoginSessions[sessionId] = {
    id: sessionId,
    returnUrl: returnUrl ?? null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  await writeStore(store);
  return store.googleLoginSessions[sessionId];
};

export const getGoogleLoginSession = async (
  sessionId: string,
): Promise<StoredGoogleLoginSession | null> => {
  const store = await readStore();
  return store.googleLoginSessions[sessionId] ?? null;
};

export const completeGoogleLoginSession = async (
  sessionId: string,
): Promise<StoredGoogleLoginSession | null> => {
  const store = await readStore();
  const session = store.googleLoginSessions[sessionId];
  if (!session) {
    return null;
  }

  const updated: StoredGoogleLoginSession = {
    ...session,
    completedAt: new Date().toISOString(),
  };
  store.googleLoginSessions[sessionId] = updated;
  await writeStore(store);
  return updated;
};

export const loginOrCreateGoogleUser = async (profile: {
  googleSub: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}) => {
  const store = await readStore();
  const normalizedEmail = profile.email.trim().toLowerCase();
  let user =
    Object.values(store.users).find((candidate) => candidate.googleSub === profile.googleSub) ??
    Object.values(store.users).find((candidate) => candidate.email === normalizedEmail) ??
    null;

  const now = new Date().toISOString();

  if (user) {
    const nextUser: StoredUser = {
      ...user,
      email: normalizedEmail,
      name: profile.name.trim() || user.name,
      googleSub: profile.googleSub,
      avatarUrl: profile.avatarUrl ?? user.avatarUrl,
    };
    store.users[user.id] = nextUser;
    user = nextUser;
  } else {
    const userId = `user-${randomUUID()}`;
    user = {
      id: userId,
      email: normalizedEmail,
      name: profile.name.trim() || normalizedEmail.split('@')[0] || 'Google user',
      passwordHash: null,
      googleSub: profile.googleSub,
      avatarUrl: profile.avatarUrl ?? null,
      createdAt: now,
    };
    store.users[userId] = user;

    const workspaceId = `ws-${randomUUID()}`;
    const workspace: StoredWorkspaceMeta = {
      id: workspaceId,
      name: `${user.name}'s workspace`,
      slug: buildUniqueWorkspaceSlug(store, `${user.name}-workspace`),
      ownerUserId: user.id,
      selectedCasePackId: defaultCasePackId,
      createdAt: now,
    };
    const membership: StoredWorkspaceMembership = {
      workspaceId,
      userId: user.id,
      role: 'owner',
      createdAt: now,
    };
    store.workspaceMeta[workspaceId] = workspace;
    store.workspaceMemberships[makeMembershipKey(workspaceId, user.id)] = membership;
    store.workspaces[workspaceId] = getWorkspaceState(store, workspaceId);
  }

  const sessionToken = `sess_${randomUUID()}`;
  store.userSessions[sessionToken] = {
    token: sessionToken,
    userId: user.id,
    createdAt: now,
    lastUsedAt: now,
  };
  await writeStore(store);

  return {
    user,
    sessionToken,
  };
};

export const deleteUserSession = async (token: string): Promise<void> => {
  const store = await readStore();
  delete store.userSessions[token];
  await writeStore(store);
};

export const createWorkspaceForUser = async (options: {
  userId: string;
  name: string;
}) => {
  const store = await readStore();
  const user = store.users[options.userId];
  if (!user) {
    throw new Error('User not found.');
  }
  const now = new Date().toISOString();
  const workspaceId = `ws-${randomUUID()}`;
  const workspace: StoredWorkspaceMeta = {
    id: workspaceId,
    name: options.name.trim() || `${user.name}'s workspace`,
    slug: buildUniqueWorkspaceSlug(store, options.name || `${user.name}-workspace`),
    ownerUserId: options.userId,
    selectedCasePackId: defaultCasePackId,
    createdAt: now,
  };
  const membership: StoredWorkspaceMembership = {
    workspaceId,
    userId: options.userId,
    role: 'owner',
    createdAt: now,
  };

  store.workspaceMeta[workspaceId] = workspace;
  store.workspaceMemberships[makeMembershipKey(workspaceId, options.userId)] = membership;
  store.workspaces[workspaceId] = getWorkspaceState(store, workspaceId);
  await writeStore(store);

  return {
    workspace,
    role: membership.role,
  };
};

export const listMailboxConnections = async (
  workspaceId: string,
): Promise<StoredMailboxConnection[]> => {
  const store = await readStore();
  return Object.values(store.connections).filter((connection) => connection.workspaceId === workspaceId);
};

export const getMailboxConnection = async (
  connectionId: string,
): Promise<StoredMailboxConnection | null> => {
  const store = await readStore();
  return store.connections[connectionId] ?? null;
};

export const getMailboxConnectionByProvider = async (
  workspaceId: string,
  provider: MailProvider,
): Promise<StoredMailboxConnection | null> => {
  const store = await readStore();
  return (
    Object.values(store.connections).find(
      (connection) => connection.workspaceId === workspaceId && connection.provider === provider,
    ) ?? null
  );
};

export const createOrUpdatePendingConnection = async (options: {
  workspaceId: string;
  provider: MailProvider;
  scopes: string[];
  returnUrl?: string | null;
  connectionId: string;
  authSessionId: string;
}): Promise<StoredMailboxConnection> => {
  const store = await readStore();
  const current = store.connections[options.connectionId];
  const createdAt = current?.createdAt ?? new Date().toISOString();

  const connection: StoredMailboxConnection = {
    id: options.connectionId,
    workspaceId: options.workspaceId,
    provider: options.provider,
    mode: 'read_only',
    status: 'pending',
    scopes: options.scopes,
    emailAddress: current?.emailAddress ?? null,
    createdAt,
    connectedAt: current?.connectedAt ?? null,
    lastSyncedAt: current?.lastSyncedAt ?? null,
    syncedCaseCount: current?.syncedCaseCount ?? 0,
    syncedThreadCount: current?.syncedThreadCount ?? 0,
    lastError: null,
    returnUrl: options.returnUrl ?? current?.returnUrl ?? null,
    authSessionId: options.authSessionId,
    tokens: current?.tokens ?? {
      accessToken: null,
      refreshToken: null,
      scope: null,
      tokenType: null,
      expiryDate: null,
    },
  };

  store.connections[options.connectionId] = connection;
  store.authSessions[options.authSessionId] = {
    id: options.authSessionId,
    workspaceId: options.workspaceId,
    provider: options.provider,
    connectionId: options.connectionId,
    returnUrl: options.returnUrl ?? null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  await writeStore(store);
  return connection;
};

export const completeAuthSession = async (
  authSessionId: string,
): Promise<StoredAuthSession | null> => {
  const store = await readStore();
  const session = store.authSessions[authSessionId];
  if (!session) {
    return null;
  }

  const updated: StoredAuthSession = {
    ...session,
    completedAt: new Date().toISOString(),
  };
  store.authSessions[authSessionId] = updated;
  await writeStore(store);
  return updated;
};

export const getAuthSession = async (authSessionId: string): Promise<StoredAuthSession | null> => {
  const store = await readStore();
  return store.authSessions[authSessionId] ?? null;
};

export const updateMailboxConnection = async (
  connectionId: string,
  patch: Partial<StoredMailboxConnection>,
): Promise<StoredMailboxConnection | null> => {
  const store = await readStore();
  const current = store.connections[connectionId];
  if (!current) {
    return null;
  }

  const next: StoredMailboxConnection = {
    ...current,
    ...patch,
    tokens: {
      ...current.tokens,
      ...(patch.tokens ?? {}),
    },
  };

  store.connections[connectionId] = next;
  await writeStore(store);
  return next;
};

export const saveWorkspaceCases = async (
  workspaceId: string,
  cases: TradeCase[],
): Promise<void> => {
  const store = await readStore();
  const workspaceState = getWorkspaceState(store, workspaceId);
  store.workspaces[workspaceId] = {
    ...workspaceState,
    cases,
  };
  await writeStore(store);
};

export const getWorkspaceCases = async (workspaceId: string): Promise<TradeCase[]> => {
  const store = await readStore();
  return getWorkspaceState(store, workspaceId).cases;
};

export const getWorkspaceMeta = async (
  workspaceId: string,
): Promise<StoredWorkspaceMeta | null> => {
  const store = await readStore();
  const workspace = store.workspaceMeta[workspaceId];
  if (!workspace) {
    return null;
  }
  return {
    ...workspace,
    selectedCasePackId: workspace.selectedCasePackId ?? defaultCasePackId,
  };
};

export const updateWorkspaceCasePack = async (
  workspaceId: string,
  casePackId: CasePackId,
): Promise<StoredWorkspaceMeta | null> => {
  const store = await readStore();
  const workspace = store.workspaceMeta[workspaceId];
  if (!workspace) {
    return null;
  }

  const nextWorkspace: StoredWorkspaceMeta = {
    ...workspace,
    selectedCasePackId: casePackId,
  };
  store.workspaceMeta[workspaceId] = nextWorkspace;
  await writeStore(store);
  return nextWorkspace;
};

export const listWorkspaceAccessTokens = async (
  workspaceId: string,
): Promise<StoredWorkspaceAccessToken[]> => {
  const store = await readStore();
  return Object.values(store.workspaceAccessTokens)
    .filter((token) => token.workspaceId === workspaceId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const getWorkspaceAccessTokenByToken = async (
  token: string,
): Promise<StoredWorkspaceAccessToken | null> => {
  const store = await readStore();
  const tokenHash = hashOpaqueToken(token);
  const current =
    Object.values(store.workspaceAccessTokens).find(
      (candidate) => candidate.tokenHash === tokenHash && candidate.revokedAt === null,
    ) ?? null;

  if (!current) {
    return null;
  }

  const next: StoredWorkspaceAccessToken = {
    ...current,
    lastUsedAt: new Date().toISOString(),
  };
  store.workspaceAccessTokens[current.id] = next;
  await writeStore(store);
  return next;
};

export const createWorkspaceAccessToken = async (options: {
  workspaceId: string;
  name: string;
  createdByUserId: string;
  scopes?: string[];
}): Promise<{ accessToken: StoredWorkspaceAccessToken; plainTextToken: string }> => {
  const store = await readStore();
  const workspace = store.workspaceMeta[options.workspaceId];
  if (!workspace) {
    throw new Error('Workspace not found.');
  }

  const createdBy = store.users[options.createdByUserId];
  if (!createdBy) {
    throw new Error('User not found.');
  }

  const now = new Date().toISOString();
  const plainTextToken = `tce_${randomUUID().replace(/-/g, '')}`;
  const accessToken: StoredWorkspaceAccessToken = {
    id: `wsat_${randomUUID()}`,
    workspaceId: options.workspaceId,
    name: options.name.trim() || 'OpenClaw skill',
    createdByUserId: options.createdByUserId,
    tokenHash: hashOpaqueToken(plainTextToken),
    tokenPreview: buildWorkspaceTokenPreview(plainTextToken),
    scopes: options.scopes?.length ? options.scopes : ['engine'],
    createdAt: now,
    lastUsedAt: null,
    revokedAt: null,
  };

  store.workspaceAccessTokens[accessToken.id] = accessToken;
  await writeStore(store);

  return {
    accessToken,
    plainTextToken,
  };
};

export const revokeWorkspaceAccessToken = async (
  workspaceId: string,
  accessTokenId: string,
): Promise<StoredWorkspaceAccessToken | null> => {
  const store = await readStore();
  const current = store.workspaceAccessTokens[accessTokenId];
  if (!current || current.workspaceId !== workspaceId) {
    return null;
  }

  const next: StoredWorkspaceAccessToken = {
    ...current,
    revokedAt: current.revokedAt ?? new Date().toISOString(),
  };
  store.workspaceAccessTokens[accessTokenId] = next;
  await writeStore(store);
  return next;
};

export const listExportTargets = async (
  workspaceId: string,
): Promise<StoredExportTarget[]> => {
  const store = await readStore();
  const workspaceState = getWorkspaceState(store, workspaceId);
  return Object.values(workspaceState.exportTargets ?? {});
};

export const getExportTarget = async (
  workspaceId: string,
  provider: ExportTargetProvider,
): Promise<StoredExportTarget | null> => {
  const store = await readStore();
  const workspaceState = getWorkspaceState(store, workspaceId);
  return workspaceState.exportTargets?.[provider] ?? null;
};

export const upsertExportTarget = async (options: {
  workspaceId: string;
  provider: ExportTargetProvider;
  config: Partial<StoredExportTarget['config']>;
}): Promise<StoredExportTarget> => {
  const store = await readStore();
  const workspaceState = getWorkspaceState(store, options.workspaceId);
  const current = workspaceState.exportTargets?.[options.provider];
  const next: StoredExportTarget = {
    id: options.provider,
    workspaceId: options.workspaceId,
    provider: options.provider,
    configuredAt: current?.configuredAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: {
      ...(current?.config ?? emptyExportTargetConfig()),
      ...options.config,
    },
  };

  store.workspaces[options.workspaceId] = {
    ...workspaceState,
    exportTargets: {
      ...(workspaceState.exportTargets ?? {}),
      [options.provider]: next,
    },
  };
  await writeStore(store);
  return next;
};
