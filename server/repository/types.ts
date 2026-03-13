import type { CasePackId } from '../../src/lib/case-packs';
import type { TradeCase } from '../../src/types';
import type {
  ExportTargetProvider,
  MailProvider,
  StoredAuthSession,
  StoredExportTarget,
  StoredGoogleLoginSession,
  StoredMailboxConnection,
  StoredUser,
  StoredUserSession,
  StoredWorkspaceAccessToken,
  StoredWorkspaceMembership,
  StoredWorkspaceMeta,
  WorkspaceRole,
} from '../store';

export interface CreateUserWithWorkspaceOptions {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
}

export interface LoginUserOptions {
  email: string;
  password: string;
}

export interface LoginOrCreateGoogleUserOptions {
  googleSub: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface CreateWorkspaceForUserOptions {
  userId: string;
  name: string;
}

export interface CreateOrUpdatePendingConnectionOptions {
  workspaceId: string;
  provider: MailProvider;
  scopes: string[];
  returnUrl?: string | null;
  connectionId: string;
  authSessionId: string;
}

export interface UpsertExportTargetOptions {
  workspaceId: string;
  provider: ExportTargetProvider;
  config: Partial<StoredExportTarget['config']>;
}

export interface CreateWorkspaceAccessTokenOptions {
  workspaceId: string;
  name: string;
  createdByUserId: string;
  scopes?: string[];
}

export interface TradeCaseRepository {
  listUserWorkspaces(userId: string): Promise<Array<StoredWorkspaceMeta & { role: WorkspaceRole }>>;
  getUserBySessionToken(token: string): Promise<{ user: StoredUser; session: StoredUserSession } | null>;
  getWorkspaceAccessTokenByToken(token: string): Promise<StoredWorkspaceAccessToken | null>;
  getWorkspaceMembership(workspaceId: string, userId: string): Promise<StoredWorkspaceMembership | null>;
  createUserWithWorkspace(options: CreateUserWithWorkspaceOptions): Promise<{
    user: StoredUser;
    workspace: StoredWorkspaceMeta;
    role: WorkspaceRole;
    sessionToken: string;
  }>;
  loginUser(options: LoginUserOptions): Promise<{
    user: StoredUser;
    sessionToken: string;
  }>;
  createGoogleLoginSession(returnUrl?: string | null): Promise<StoredGoogleLoginSession>;
  getGoogleLoginSession(sessionId: string): Promise<StoredGoogleLoginSession | null>;
  completeGoogleLoginSession(sessionId: string): Promise<StoredGoogleLoginSession | null>;
  loginOrCreateGoogleUser(profile: LoginOrCreateGoogleUserOptions): Promise<{
    user: StoredUser;
    sessionToken: string;
  }>;
  deleteUserSession(token: string): Promise<void>;
  getWorkspaceMeta(workspaceId: string): Promise<StoredWorkspaceMeta | null>;
  createWorkspaceForUser(options: CreateWorkspaceForUserOptions): Promise<{
    workspace: StoredWorkspaceMeta;
    role: WorkspaceRole;
  }>;
  updateWorkspaceCasePack(
    workspaceId: string,
    casePackId: CasePackId,
  ): Promise<StoredWorkspaceMeta | null>;
  listMailboxConnections(workspaceId: string): Promise<StoredMailboxConnection[]>;
  getMailboxConnection(connectionId: string): Promise<StoredMailboxConnection | null>;
  getMailboxConnectionByProvider(
    workspaceId: string,
    provider: MailProvider,
  ): Promise<StoredMailboxConnection | null>;
  createOrUpdatePendingConnection(
    options: CreateOrUpdatePendingConnectionOptions,
  ): Promise<StoredMailboxConnection>;
  completeAuthSession(authSessionId: string): Promise<StoredAuthSession | null>;
  getAuthSession(authSessionId: string): Promise<StoredAuthSession | null>;
  updateMailboxConnection(
    connectionId: string,
    patch: Partial<StoredMailboxConnection>,
  ): Promise<StoredMailboxConnection | null>;
  saveWorkspaceCases(workspaceId: string, cases: TradeCase[]): Promise<void>;
  getWorkspaceCases(workspaceId: string): Promise<TradeCase[]>;
  listExportTargets(workspaceId: string): Promise<StoredExportTarget[]>;
  getExportTarget(
    workspaceId: string,
    provider: ExportTargetProvider,
  ): Promise<StoredExportTarget | null>;
  listWorkspaceAccessTokens(workspaceId: string): Promise<StoredWorkspaceAccessToken[]>;
  createWorkspaceAccessToken(options: CreateWorkspaceAccessTokenOptions): Promise<{
    accessToken: StoredWorkspaceAccessToken;
    plainTextToken: string;
  }>;
  revokeWorkspaceAccessToken(
    workspaceId: string,
    accessTokenId: string,
  ): Promise<StoredWorkspaceAccessToken | null>;
  upsertExportTarget(options: UpsertExportTargetOptions): Promise<StoredExportTarget>;
}
