import { randomUUID } from 'node:crypto';
import { activeCasePackId, type CasePackId } from '../../src/lib/case-packs';
import type {
  CreateWorkspaceAccessTokenOptions,
  CreateOrUpdatePendingConnectionOptions,
  CreateUserWithWorkspaceOptions,
  CreateWorkspaceForUserOptions,
  LoginOrCreateGoogleUserOptions,
  LoginUserOptions,
  TradeCaseRepository,
  UpsertExportTargetOptions,
} from './types';
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
import type { TradeCase } from '../../src/types';
import {
  buildUniqueWorkspaceSlug,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  nowIso,
  parseJson,
  serializeJson,
  verifyPassword,
} from './shared';

type D1PreparedStatementLike = {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};

export type D1DatabaseLike = {
  prepare(query: string): D1PreparedStatementLike;
};

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  selected_case_pack_id: CasePackId | null;
  created_at: string;
  role: WorkspaceRole;
};

type UserRow = {
  id: string;
  email: string;
  normalized_email: string;
  name: string;
  password_hash: string | null;
  google_sub: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type UserSessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  revoked_at: string | null;
};

type WorkspaceAccessTokenRow = {
  id: string;
  workspace_id: string;
  name: string;
  created_by_user_id: string;
  token_hash: string;
  token_preview: string;
  scopes_json: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type OAuthStateRow = {
  id: string;
  purpose: string;
  provider: string;
  workspace_id: string | null;
  user_id: string | null;
  connection_id: string | null;
  return_url: string | null;
  pkce_verifier: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string;
};

type MailboxConnectionRow = {
  id: string;
  workspace_id: string;
  provider: MailProvider;
  mode: 'read_only';
  status: 'pending' | 'connected' | 'error';
  email_address: string | null;
  scopes_json: string;
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  token_type: string | null;
  token_scope: string | null;
  token_expires_at: string | null;
  auth_session_id: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  synced_case_count: number;
  synced_thread_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type ExportTargetRow = {
  id: string;
  workspace_id: string;
  provider: ExportTargetProvider;
  auth_mode: 'workspace' | 'env_fallback' | 'missing';
  display_name: string | null;
  destination_ref_json: string;
  credential_ciphertext: string | null;
  configured_at: string | null;
  updated_at: string;
};

type CaseRow = {
  id: string;
  workspace_id: string;
  case_pack_id: string;
  source_thread_id: string | null;
  status: string;
  label: string;
  account: string | null;
  region: string | null;
  owner_user_id: string | null;
  latest_subject: string | null;
  latest_message_at: string;
  created_at: string;
  updated_at: string;
};

type ThreadRow = {
  id: string;
  workspace_id: string;
  provider_thread_id: string;
  subject: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_email: string | null;
  sender_name: string | null;
  to_json: string;
  sent_at: string;
  subject: string | null;
  body_text_excerpt: string | null;
  created_at: string;
};

type AttachmentRow = {
  id: string;
  message_id: string;
  file_name: string;
  mime_type: string | null;
  text_excerpt: string | null;
};

const sessionExpiryMs = 1000 * 60 * 60 * 24 * 30;
const oauthSessionExpiryMs = 1000 * 60 * 15;
const defaultCasePackId: CasePackId = activeCasePackId;

const toStoredUser = (row: UserRow): StoredUser => ({
  id: row.id,
  email: row.email,
  name: row.name,
  passwordHash: row.password_hash,
  googleSub: row.google_sub,
  avatarUrl: row.avatar_url,
  createdAt: row.created_at,
});

const toStoredSession = (row: UserSessionRow, rawToken: string): StoredUserSession => ({
  token: rawToken,
  userId: row.user_id,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
});

const toStoredWorkspaceAccessToken = (
  row: WorkspaceAccessTokenRow,
): StoredWorkspaceAccessToken => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  createdByUserId: row.created_by_user_id,
  tokenHash: row.token_hash,
  tokenPreview: row.token_preview,
  scopes: parseJson<string[]>(row.scopes_json, ['engine']),
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
  revokedAt: row.revoked_at,
});

const toStoredMailboxConnection = (
  row: MailboxConnectionRow,
): StoredMailboxConnection => ({
  id: row.id,
  workspaceId: row.workspace_id,
  provider: row.provider,
  mode: row.mode,
  status: row.status,
  scopes: parseJson<string[]>(row.scopes_json, []),
  emailAddress: row.email_address,
  createdAt: row.created_at,
  connectedAt: row.connected_at,
  lastSyncedAt: row.last_synced_at,
  syncedCaseCount: row.synced_case_count,
  syncedThreadCount: row.synced_thread_count,
  lastError: row.last_error,
  returnUrl: null,
  authSessionId: row.auth_session_id,
  tokens: {
    accessToken: row.access_token_ciphertext,
    refreshToken: row.refresh_token_ciphertext,
    scope: row.token_scope,
    tokenType: row.token_type,
    expiryDate: row.token_expires_at,
  },
});

const toStoredExportTarget = (row: ExportTargetRow): StoredExportTarget => {
  const destination = parseJson<Record<string, string | null>>(row.destination_ref_json, {});
  return {
    id: row.provider,
    workspaceId: row.workspace_id,
    provider: row.provider,
    configuredAt: row.configured_at,
    updatedAt: row.updated_at,
    config: {
      displayName: row.display_name,
      feishuAppToken: destination.feishuAppToken ?? null,
      feishuTableId: destination.feishuTableId ?? null,
      notionAccessToken: row.provider === 'notion' ? row.credential_ciphertext : null,
      notionDataSourceId: destination.notionDataSourceId ?? null,
      notionTitleProperty: destination.notionTitleProperty ?? null,
      notionVersion: destination.notionVersion ?? null,
    },
  };
};

const toStoredGoogleLoginSession = (row: OAuthStateRow): StoredGoogleLoginSession => ({
  id: row.id,
  returnUrl: row.return_url,
  createdAt: row.created_at,
  completedAt: row.completed_at,
});

const toStoredAuthSession = (row: OAuthStateRow): StoredAuthSession => ({
  id: row.id,
  workspaceId: row.workspace_id ?? '',
  provider: row.provider as MailProvider,
  connectionId: row.connection_id ?? '',
  returnUrl: row.return_url,
  createdAt: row.created_at,
  completedAt: row.completed_at,
});

export class D1TradeCaseRepository implements TradeCaseRepository {
  constructor(private readonly db?: D1DatabaseLike) {}

  private getDb(): D1DatabaseLike {
    if (!this.db) {
      throw new Error(
        'D1TradeCaseRepository requires a D1 binding. Wire the Worker DB binding before enabling DATA_BACKEND=d1.',
      );
    }
    return this.db;
  }

  private async getWorkspaceRow(workspaceId: string): Promise<StoredWorkspaceMeta | null> {
    const db = this.getDb();
    const row = await db
      .prepare(
        'SELECT id, name, slug, owner_user_id, selected_case_pack_id, created_at FROM workspaces WHERE id = ? LIMIT 1',
      )
      .bind(workspaceId)
      .first<{
        id: string;
        name: string;
        slug: string;
        owner_user_id: string;
        selected_case_pack_id: CasePackId | null;
        created_at: string;
      }>();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerUserId: row.owner_user_id,
      selectedCasePackId: row.selected_case_pack_id ?? defaultCasePackId,
      createdAt: row.created_at,
    };
  }

  private async workspaceSlugExists(slug: string): Promise<boolean> {
    const db = this.getDb();
    const row = await db
      .prepare('SELECT id FROM workspaces WHERE slug = ? LIMIT 1')
      .bind(slug)
      .first<{ id: string }>();
    return Boolean(row);
  }

  async listUserWorkspaces(
    userId: string,
  ): Promise<Array<StoredWorkspaceMeta & { role: WorkspaceRole }>> {
    const db = this.getDb();
    const rows = await db
      .prepare(
        `SELECT w.id, w.name, w.slug, w.owner_user_id, w.selected_case_pack_id, w.created_at, m.role
         FROM workspace_memberships m
         JOIN workspaces w ON w.id = m.workspace_id
         WHERE m.user_id = ?
         ORDER BY w.created_at ASC`,
      )
      .bind(userId)
      .all<WorkspaceRow>();

    return rows.results.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerUserId: row.owner_user_id,
      selectedCasePackId: row.selected_case_pack_id ?? defaultCasePackId,
      createdAt: row.created_at,
      role: row.role,
    }));
  }

  async getUserBySessionToken(token: string): Promise<{ user: StoredUser; session: StoredUserSession } | null> {
    const db = this.getDb();
    const tokenHash = hashSessionToken(token);
    const row = await db
      .prepare(
        `SELECT s.id, s.user_id, s.token_hash, s.created_at, s.last_used_at, s.expires_at, s.revoked_at,
                u.id as user_id_ref, u.email, u.normalized_email, u.name, u.password_hash, u.google_sub, u.avatar_url, u.created_at as user_created_at, u.updated_at
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
         LIMIT 1`,
      )
      .bind(tokenHash, nowIso())
      .first<{
        id: string;
        user_id: string;
        token_hash: string;
        created_at: string;
        last_used_at: string;
        expires_at: string;
        revoked_at: string | null;
        user_id_ref: string;
        email: string;
        normalized_email: string;
        name: string;
        password_hash: string | null;
        google_sub: string | null;
        avatar_url: string | null;
        user_created_at: string;
        updated_at: string;
      }>();

    if (!row) {
      return null;
    }

    const nextLastUsedAt = nowIso();
    await db
      .prepare('UPDATE user_sessions SET last_used_at = ? WHERE id = ?')
      .bind(nextLastUsedAt, row.id)
      .run();

    return {
      user: {
        id: row.user_id_ref,
        email: row.email,
        name: row.name,
        passwordHash: row.password_hash,
        googleSub: row.google_sub,
        avatarUrl: row.avatar_url,
        createdAt: row.user_created_at,
      },
      session: {
        token,
        userId: row.user_id,
        createdAt: row.created_at,
        lastUsedAt: nextLastUsedAt,
      },
    };
  }

  async getWorkspaceAccessTokenByToken(
    token: string,
  ): Promise<StoredWorkspaceAccessToken | null> {
    const db = this.getDb();
    const tokenHash = hashSessionToken(token);
    const row = await db
      .prepare(
        `SELECT id, workspace_id, name, created_by_user_id, token_hash, token_preview, scopes_json,
                created_at, last_used_at, revoked_at
         FROM workspace_access_tokens
         WHERE token_hash = ? AND revoked_at IS NULL
         LIMIT 1`,
      )
      .bind(tokenHash)
      .first<WorkspaceAccessTokenRow>();

    if (!row) {
      return null;
    }

    const nextLastUsedAt = nowIso();
    await db
      .prepare('UPDATE workspace_access_tokens SET last_used_at = ? WHERE id = ?')
      .bind(nextLastUsedAt, row.id)
      .run();

    return {
      ...toStoredWorkspaceAccessToken(row),
      lastUsedAt: nextLastUsedAt,
    };
  }

  async getWorkspaceMembership(
    workspaceId: string,
    userId: string,
  ): Promise<StoredWorkspaceMembership | null> {
    const db = this.getDb();
    const row = await db
      .prepare(
        'SELECT workspace_id, user_id, role, created_at FROM workspace_memberships WHERE workspace_id = ? AND user_id = ? LIMIT 1',
      )
      .bind(workspaceId, userId)
      .first<{
        workspace_id: string;
        user_id: string;
        role: WorkspaceRole;
        created_at: string;
      }>();

    if (!row) {
      return null;
    }

    return {
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
    };
  }

  async createUserWithWorkspace(
    options: CreateUserWithWorkspaceOptions,
  ): Promise<{
    user: StoredUser;
    workspace: StoredWorkspaceMeta;
    role: WorkspaceRole;
    sessionToken: string;
  }> {
    const db = this.getDb();
    const email = normalizeEmail(options.email);
    if (!email) {
      throw new Error('Email is required.');
    }
    if (options.password.trim().length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const existing = await db
      .prepare('SELECT id FROM users WHERE normalized_email = ? LIMIT 1')
      .bind(email)
      .first<{ id: string }>();
    if (existing) {
      throw new Error('An account with that email already exists.');
    }

    const timestamp = nowIso();
    const userId = `user-${randomUUID()}`;
    const workspaceId = `ws-${randomUUID()}`;
    const sessionToken = `sess_${randomUUID()}`;
    const role: WorkspaceRole = 'owner';
    const userName = options.name.trim() || email.split('@')[0] || 'Owner';
    const workspaceName = options.workspaceName.trim() || `${userName}'s workspace`;
    const slug = await buildUniqueWorkspaceSlug(workspaceName, (candidate) =>
      this.workspaceSlugExists(candidate),
    );
    const passwordHash = hashPassword(options.password);

    await db
      .prepare(
        `INSERT INTO users (id, email, normalized_email, name, password_hash, google_sub, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      )
      .bind(userId, email, email, userName, passwordHash, timestamp, timestamp)
      .run();

    await db
      .prepare(
        `INSERT INTO workspaces (id, name, slug, owner_user_id, selected_case_pack_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(workspaceId, workspaceName, slug, userId, defaultCasePackId, timestamp, timestamp)
      .run();

    await db
      .prepare(
        'INSERT INTO workspace_memberships (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
      )
      .bind(workspaceId, userId, role, timestamp)
      .run();

    await db
      .prepare(
        `INSERT INTO user_sessions (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        `session-${randomUUID()}`,
        userId,
        hashSessionToken(sessionToken),
        timestamp,
        timestamp,
        new Date(Date.now() + sessionExpiryMs).toISOString(),
      )
      .run();

    return {
      user: {
        id: userId,
        email,
        name: userName,
        passwordHash,
        googleSub: null,
        avatarUrl: null,
        createdAt: timestamp,
      },
      workspace: {
        id: workspaceId,
        name: workspaceName,
        slug,
        ownerUserId: userId,
        selectedCasePackId: defaultCasePackId,
        createdAt: timestamp,
      },
      role,
      sessionToken,
    };
  }

  async loginUser(options: LoginUserOptions): Promise<{
    user: StoredUser;
    sessionToken: string;
  }> {
    const db = this.getDb();
    const email = normalizeEmail(options.email);
    const row = await db
      .prepare(
        'SELECT id, email, normalized_email, name, password_hash, google_sub, avatar_url, created_at, updated_at FROM users WHERE normalized_email = ? LIMIT 1',
      )
      .bind(email)
      .first<UserRow>();

    if (!row?.password_hash || !verifyPassword(options.password, row.password_hash)) {
      throw new Error('Invalid email or password.');
    }

    const timestamp = nowIso();
    const sessionToken = `sess_${randomUUID()}`;
    await db
      .prepare(
        `INSERT INTO user_sessions (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        `session-${randomUUID()}`,
        row.id,
        hashSessionToken(sessionToken),
        timestamp,
        timestamp,
        new Date(Date.now() + sessionExpiryMs).toISOString(),
      )
      .run();

    return {
      user: toStoredUser(row),
      sessionToken,
    };
  }

  async createGoogleLoginSession(
    returnUrl?: string | null,
  ): Promise<StoredGoogleLoginSession> {
    const db = this.getDb();
    const sessionId = randomUUID();
    const timestamp = nowIso();
    await db
      .prepare(
        `INSERT INTO oauth_states (id, purpose, provider, workspace_id, user_id, connection_id, return_url, pkce_verifier, created_at, completed_at, expires_at)
         VALUES (?, 'login', 'google', NULL, NULL, NULL, ?, NULL, ?, NULL, ?)`,
      )
      .bind(
        sessionId,
        returnUrl ?? null,
        timestamp,
        new Date(Date.now() + oauthSessionExpiryMs).toISOString(),
      )
      .run();

    return {
      id: sessionId,
      returnUrl: returnUrl ?? null,
      createdAt: timestamp,
      completedAt: null,
    };
  }

  async getGoogleLoginSession(
    sessionId: string,
  ): Promise<StoredGoogleLoginSession | null> {
    const db = this.getDb();
    const row = await db
      .prepare(
        `SELECT id, purpose, provider, workspace_id, user_id, connection_id, return_url, pkce_verifier, created_at, completed_at, expires_at
         FROM oauth_states
         WHERE id = ? AND purpose = 'login' LIMIT 1`,
      )
      .bind(sessionId)
      .first<OAuthStateRow>();
    return row ? toStoredGoogleLoginSession(row) : null;
  }

  async completeGoogleLoginSession(
    sessionId: string,
  ): Promise<StoredGoogleLoginSession | null> {
    const db = this.getDb();
    const row = await db
      .prepare(
        `SELECT id, purpose, provider, workspace_id, user_id, connection_id, return_url, pkce_verifier, created_at, completed_at, expires_at
         FROM oauth_states
         WHERE id = ? AND purpose = 'login' LIMIT 1`,
      )
      .bind(sessionId)
      .first<OAuthStateRow>();
    if (!row) {
      return null;
    }

    const completedAt = nowIso();
    await db
      .prepare('UPDATE oauth_states SET completed_at = ? WHERE id = ?')
      .bind(completedAt, sessionId)
      .run();

    return {
      ...toStoredGoogleLoginSession(row),
      completedAt,
    };
  }

  async loginOrCreateGoogleUser(
    profile: LoginOrCreateGoogleUserOptions,
  ): Promise<{
    user: StoredUser;
    sessionToken: string;
  }> {
    const db = this.getDb();
    const email = normalizeEmail(profile.email);
    const timestamp = nowIso();
    const existing = await db
      .prepare(
        `SELECT id, email, normalized_email, name, password_hash, google_sub, avatar_url, created_at, updated_at
         FROM users
         WHERE google_sub = ? OR normalized_email = ?
         LIMIT 1`,
      )
      .bind(profile.googleSub, email)
      .first<UserRow>();

    let user: StoredUser;
    if (existing) {
      const nextName = profile.name.trim() || existing.name;
      const nextAvatar = profile.avatarUrl ?? existing.avatar_url;
      await db
        .prepare(
          `UPDATE users
           SET email = ?, normalized_email = ?, name = ?, google_sub = ?, avatar_url = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(email, email, nextName, profile.googleSub, nextAvatar, timestamp, existing.id)
        .run();

      user = {
        id: existing.id,
        email,
        name: nextName,
        passwordHash: existing.password_hash,
        googleSub: profile.googleSub,
        avatarUrl: nextAvatar,
        createdAt: existing.created_at,
      };
    } else {
      const userId = `user-${randomUUID()}`;
      const userName = profile.name.trim() || email.split('@')[0] || 'Google user';
      const workspaceId = `ws-${randomUUID()}`;
      const workspaceName = `${userName}'s workspace`;
      const slug = await buildUniqueWorkspaceSlug(workspaceName, (candidate) =>
        this.workspaceSlugExists(candidate),
      );

      await db
        .prepare(
          `INSERT INTO users (id, email, normalized_email, name, password_hash, google_sub, avatar_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
        )
        .bind(
          userId,
          email,
          email,
          userName,
          profile.googleSub,
          profile.avatarUrl ?? null,
          timestamp,
          timestamp,
        )
        .run();

      await db
        .prepare(
          `INSERT INTO workspaces (id, name, slug, owner_user_id, selected_case_pack_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(workspaceId, workspaceName, slug, userId, defaultCasePackId, timestamp, timestamp)
        .run();

      await db
        .prepare(
          'INSERT INTO workspace_memberships (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
        )
        .bind(workspaceId, userId, 'owner', timestamp)
        .run();

      user = {
        id: userId,
        email,
        name: userName,
        passwordHash: null,
        googleSub: profile.googleSub,
        avatarUrl: profile.avatarUrl ?? null,
        createdAt: timestamp,
      };
    }

    const sessionToken = `sess_${randomUUID()}`;
    await db
      .prepare(
        `INSERT INTO user_sessions (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        `session-${randomUUID()}`,
        user.id,
        hashSessionToken(sessionToken),
        timestamp,
        timestamp,
        new Date(Date.now() + sessionExpiryMs).toISOString(),
      )
      .run();

    return {
      user,
      sessionToken,
    };
  }

  async deleteUserSession(token: string): Promise<void> {
    const db = this.getDb();
    await db
      .prepare('DELETE FROM user_sessions WHERE token_hash = ?')
      .bind(hashSessionToken(token))
      .run();
  }

  async getWorkspaceMeta(workspaceId: string): Promise<StoredWorkspaceMeta | null> {
    return this.getWorkspaceRow(workspaceId);
  }

  async createWorkspaceForUser(
    options: CreateWorkspaceForUserOptions,
  ): Promise<{
    workspace: StoredWorkspaceMeta;
    role: WorkspaceRole;
  }> {
    const db = this.getDb();
    const user = await db
      .prepare(
        'SELECT id, email, normalized_email, name, password_hash, google_sub, avatar_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      )
      .bind(options.userId)
      .first<UserRow>();
    if (!user) {
      throw new Error('User not found.');
    }

    const timestamp = nowIso();
    const workspaceId = `ws-${randomUUID()}`;
    const workspaceName = options.name.trim() || `${user.name}'s workspace`;
    const slug = await buildUniqueWorkspaceSlug(workspaceName, (candidate) =>
      this.workspaceSlugExists(candidate),
    );

    await db
      .prepare(
        `INSERT INTO workspaces (id, name, slug, owner_user_id, selected_case_pack_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(workspaceId, workspaceName, slug, options.userId, defaultCasePackId, timestamp, timestamp)
      .run();

    await db
      .prepare(
        'INSERT INTO workspace_memberships (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
      )
      .bind(workspaceId, options.userId, 'owner', timestamp)
      .run();

    return {
      workspace: {
        id: workspaceId,
        name: workspaceName,
        slug,
        ownerUserId: options.userId,
        selectedCasePackId: defaultCasePackId,
        createdAt: timestamp,
      },
      role: 'owner',
    };
  }

  async updateWorkspaceCasePack(
    workspaceId: string,
    casePackId: CasePackId,
  ): Promise<StoredWorkspaceMeta | null> {
    const db = this.getDb();
    await db
      .prepare('UPDATE workspaces SET selected_case_pack_id = ?, updated_at = ? WHERE id = ?')
      .bind(casePackId, nowIso(), workspaceId)
      .run();
    return this.getWorkspaceRow(workspaceId);
  }

  async listWorkspaceAccessTokens(
    workspaceId: string,
  ): Promise<StoredWorkspaceAccessToken[]> {
    const db = this.getDb();
    const rows = await db
      .prepare(
        `SELECT id, workspace_id, name, created_by_user_id, token_hash, token_preview, scopes_json,
                created_at, last_used_at, revoked_at
         FROM workspace_access_tokens
         WHERE workspace_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(workspaceId)
      .all<WorkspaceAccessTokenRow>();

    return rows.results.map(toStoredWorkspaceAccessToken);
  }

  async createWorkspaceAccessToken(
    options: CreateWorkspaceAccessTokenOptions,
  ): Promise<{ accessToken: StoredWorkspaceAccessToken; plainTextToken: string }> {
    const db = this.getDb();
    const workspace = await this.getWorkspaceRow(options.workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found.');
    }

    const creator = await db
      .prepare('SELECT id FROM users WHERE id = ? LIMIT 1')
      .bind(options.createdByUserId)
      .first<{ id: string }>();
    if (!creator) {
      throw new Error('User not found.');
    }

    const timestamp = nowIso();
    const plainTextToken = `tce_${randomUUID().replace(/-/g, '')}`;
    const accessToken: StoredWorkspaceAccessToken = {
      id: `wsat_${randomUUID()}`,
      workspaceId: options.workspaceId,
      name: options.name.trim() || 'OpenClaw skill',
      createdByUserId: options.createdByUserId,
      tokenHash: hashSessionToken(plainTextToken),
      tokenPreview:
        plainTextToken.length <= 12
          ? plainTextToken
          : `${plainTextToken.slice(0, 8)}...${plainTextToken.slice(-4)}`,
      scopes: options.scopes?.length ? options.scopes : ['engine'],
      createdAt: timestamp,
      lastUsedAt: null,
      revokedAt: null,
    };

    await db
      .prepare(
        `INSERT INTO workspace_access_tokens (
           id, workspace_id, name, created_by_user_id, token_hash, token_preview, scopes_json,
           created_at, last_used_at, revoked_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      )
      .bind(
        accessToken.id,
        accessToken.workspaceId,
        accessToken.name,
        accessToken.createdByUserId,
        accessToken.tokenHash,
        accessToken.tokenPreview,
        serializeJson(accessToken.scopes),
        accessToken.createdAt,
      )
      .run();

    return {
      accessToken,
      plainTextToken,
    };
  }

  async revokeWorkspaceAccessToken(
    workspaceId: string,
    accessTokenId: string,
  ): Promise<StoredWorkspaceAccessToken | null> {
    const db = this.getDb();
    const row = await db
      .prepare(
        `SELECT id, workspace_id, name, created_by_user_id, token_hash, token_preview, scopes_json,
                created_at, last_used_at, revoked_at
         FROM workspace_access_tokens
         WHERE id = ? AND workspace_id = ?
         LIMIT 1`,
      )
      .bind(accessTokenId, workspaceId)
      .first<WorkspaceAccessTokenRow>();

    if (!row) {
      return null;
    }

    const revokedAt = row.revoked_at ?? nowIso();
    await db
      .prepare('UPDATE workspace_access_tokens SET revoked_at = ? WHERE id = ?')
      .bind(revokedAt, accessTokenId)
      .run();

    return {
      ...toStoredWorkspaceAccessToken(row),
      revokedAt,
    };
  }

  async listMailboxConnections(
    workspaceId: string,
  ): Promise<StoredMailboxConnection[]> {
    const db = this.getDb();
    const rows = await db
      .prepare(
        `SELECT id, workspace_id, provider, mode, status, email_address, scopes_json, access_token_ciphertext, refresh_token_ciphertext,
                token_type, token_scope, token_expires_at, auth_session_id, connected_at, last_synced_at, synced_case_count,
                synced_thread_count, last_error, created_at, updated_at
         FROM mailbox_connections
         WHERE workspace_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(workspaceId)
      .all<MailboxConnectionRow>();
    return rows.results.map(toStoredMailboxConnection);
  }

  async getMailboxConnection(
    connectionId: string,
  ): Promise<StoredMailboxConnection | null> {
    const db = this.getDb();
    const row = await db
      .prepare(
        `SELECT id, workspace_id, provider, mode, status, email_address, scopes_json, access_token_ciphertext, refresh_token_ciphertext,
                token_type, token_scope, token_expires_at, auth_session_id, connected_at, last_synced_at, synced_case_count,
                synced_thread_count, last_error, created_at, updated_at
         FROM mailbox_connections
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(connectionId)
      .first<MailboxConnectionRow>();
    return row ? toStoredMailboxConnection(row) : null;
  }

  async getMailboxConnectionByProvider(
    workspaceId: string,
    provider: MailProvider,
  ): Promise<StoredMailboxConnection | null> {
    const db = this.getDb();
    const row = await db
      .prepare(
        `SELECT id, workspace_id, provider, mode, status, email_address, scopes_json, access_token_ciphertext, refresh_token_ciphertext,
                token_type, token_scope, token_expires_at, auth_session_id, connected_at, last_synced_at, synced_case_count,
                synced_thread_count, last_error, created_at, updated_at
         FROM mailbox_connections
         WHERE workspace_id = ? AND provider = ?
         LIMIT 1`,
      )
      .bind(workspaceId, provider)
      .first<MailboxConnectionRow>();
    return row ? toStoredMailboxConnection(row) : null;
  }

  async createOrUpdatePendingConnection(
    options: CreateOrUpdatePendingConnectionOptions,
  ): Promise<StoredMailboxConnection> {
    const db = this.getDb();
    const existing = await this.getMailboxConnection(options.connectionId);
    const timestamp = nowIso();
    const connection: StoredMailboxConnection = {
      id: options.connectionId,
      workspaceId: options.workspaceId,
      provider: options.provider,
      mode: 'read_only',
      status: 'pending',
      scopes: options.scopes,
      emailAddress: existing?.emailAddress ?? null,
      createdAt: existing?.createdAt ?? timestamp,
      connectedAt: existing?.connectedAt ?? null,
      lastSyncedAt: existing?.lastSyncedAt ?? null,
      syncedCaseCount: existing?.syncedCaseCount ?? 0,
      syncedThreadCount: existing?.syncedThreadCount ?? 0,
      lastError: null,
      returnUrl: options.returnUrl ?? existing?.returnUrl ?? null,
      authSessionId: options.authSessionId,
      tokens: existing?.tokens ?? {
        accessToken: null,
        refreshToken: null,
        scope: null,
        tokenType: null,
        expiryDate: null,
      },
    };

    await db
      .prepare(
        `INSERT INTO mailbox_connections (
           id, workspace_id, provider, mode, status, email_address, scopes_json, access_token_ciphertext,
           refresh_token_ciphertext, token_type, token_scope, token_expires_at, auth_session_id, connected_at,
           last_synced_at, synced_case_count, synced_thread_count, last_error, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           workspace_id = excluded.workspace_id,
           provider = excluded.provider,
           mode = excluded.mode,
           status = excluded.status,
           email_address = excluded.email_address,
           scopes_json = excluded.scopes_json,
           auth_session_id = excluded.auth_session_id,
           last_error = excluded.last_error,
           updated_at = excluded.updated_at`,
      )
      .bind(
        connection.id,
        connection.workspaceId,
        connection.provider,
        connection.mode,
        connection.status,
        connection.emailAddress,
        serializeJson(connection.scopes),
        connection.tokens.accessToken,
        connection.tokens.refreshToken,
        connection.tokens.tokenType,
        connection.tokens.scope,
        connection.tokens.expiryDate,
        connection.authSessionId,
        connection.connectedAt,
        connection.lastSyncedAt,
        connection.syncedCaseCount,
        connection.syncedThreadCount,
        connection.lastError,
        connection.createdAt,
        timestamp,
      )
      .run();

    await db
      .prepare(
        `INSERT INTO oauth_states (id, purpose, provider, workspace_id, user_id, connection_id, return_url, pkce_verifier, created_at, completed_at, expires_at)
         VALUES (?, 'mailbox', ?, ?, NULL, ?, ?, NULL, ?, NULL, ?)
         ON CONFLICT(id) DO UPDATE SET
           provider = excluded.provider,
           workspace_id = excluded.workspace_id,
           connection_id = excluded.connection_id,
           return_url = excluded.return_url,
           completed_at = NULL,
           expires_at = excluded.expires_at`,
      )
      .bind(
        options.authSessionId,
        options.provider,
        options.workspaceId,
        options.connectionId,
        options.returnUrl ?? null,
        timestamp,
        new Date(Date.now() + oauthSessionExpiryMs).toISOString(),
      )
      .run();

    return {
      ...connection,
      returnUrl: options.returnUrl ?? null,
    };
  }

  async completeAuthSession(
    authSessionId: string,
  ): Promise<StoredAuthSession | null> {
    const row = await this.getAuthSession(authSessionId);
    if (!row) {
      return null;
    }
    await this.getDb()
      .prepare('UPDATE oauth_states SET completed_at = ? WHERE id = ?')
      .bind(nowIso(), authSessionId)
      .run();
    return {
      ...row,
      completedAt: nowIso(),
    };
  }

  async getAuthSession(
    authSessionId: string,
  ): Promise<StoredAuthSession | null> {
    const db = this.getDb();
    const row = await db
      .prepare(
        `SELECT id, purpose, provider, workspace_id, user_id, connection_id, return_url, pkce_verifier, created_at, completed_at, expires_at
         FROM oauth_states
         WHERE id = ? AND purpose = 'mailbox'
         LIMIT 1`,
      )
      .bind(authSessionId)
      .first<OAuthStateRow>();
    return row ? toStoredAuthSession(row) : null;
  }

  async updateMailboxConnection(
    connectionId: string,
    patch: Partial<StoredMailboxConnection>,
  ): Promise<StoredMailboxConnection | null> {
    const current = await this.getMailboxConnection(connectionId);
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

    await this.getDb()
      .prepare(
        `UPDATE mailbox_connections
         SET workspace_id = ?, provider = ?, mode = ?, status = ?, email_address = ?, scopes_json = ?, access_token_ciphertext = ?,
             refresh_token_ciphertext = ?, token_type = ?, token_scope = ?, token_expires_at = ?, auth_session_id = ?, connected_at = ?,
             last_synced_at = ?, synced_case_count = ?, synced_thread_count = ?, last_error = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        next.workspaceId,
        next.provider,
        next.mode,
        next.status,
        next.emailAddress,
        serializeJson(next.scopes),
        next.tokens.accessToken,
        next.tokens.refreshToken,
        next.tokens.tokenType,
        next.tokens.scope,
        next.tokens.expiryDate,
        next.authSessionId,
        next.connectedAt,
        next.lastSyncedAt,
        next.syncedCaseCount,
        next.syncedThreadCount,
        next.lastError,
        nowIso(),
        connectionId,
      )
      .run();

    return next;
  }

  async saveWorkspaceCases(workspaceId: string, cases: TradeCase[]): Promise<void> {
    const db = this.getDb();
    let connectionId = (
      await db
        .prepare(
          'SELECT id FROM mailbox_connections WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 1',
        )
        .bind(workspaceId)
        .first<{ id: string }>()
    )?.id;

    if (!connectionId) {
      connectionId = `mailbox-${workspaceId}-import`;
      const timestamp = nowIso();
      await db
        .prepare(
          `INSERT INTO mailbox_connections (
             id, workspace_id, provider, mode, status, email_address, scopes_json, access_token_ciphertext,
             refresh_token_ciphertext, token_type, token_scope, token_expires_at, auth_session_id, connected_at,
             last_synced_at, synced_case_count, synced_thread_count, last_error, created_at, updated_at
           ) VALUES (?, ?, 'gmail', 'read_only', 'connected', NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL, 0, 0, NULL, ?, ?)`,
        )
        .bind(connectionId, workspaceId, timestamp, timestamp, timestamp)
        .run();
    }

    await db.prepare('DELETE FROM mail_attachments WHERE workspace_id = ?').bind(workspaceId).run();
    await db.prepare('DELETE FROM mail_messages WHERE workspace_id = ?').bind(workspaceId).run();
    await db.prepare('DELETE FROM cases WHERE workspace_id = ?').bind(workspaceId).run();
    await db.prepare('DELETE FROM mail_threads WHERE workspace_id = ?').bind(workspaceId).run();

    for (const tradeCase of cases) {
      const timestamp = nowIso();
      const latestMessage = [...tradeCase.messages].sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
      const threadId = `thread-${tradeCase.id}`;
      await db
        .prepare(
          `INSERT INTO mail_threads (
             id, workspace_id, connection_id, provider_thread_id, subject, normalized_subject, participants_json,
             first_message_at, last_message_at, message_count, attachment_count, snippet, qualification_rule,
             qualification_score, matched_keywords_json, matched_doc_types_json, raw_thread_r2_key, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, '[]', '[]', NULL, ?, ?)`,
        )
        .bind(
          threadId,
          workspaceId,
          connectionId,
          tradeCase.id,
          latestMessage?.subject ?? tradeCase.label,
          (latestMessage?.subject ?? tradeCase.label).toLowerCase(),
          serializeJson(
            Array.from(
              new Set([
                ...tradeCase.messages.map((message) => message.sender),
                ...tradeCase.messages.flatMap((message) => message.recipients),
              ]),
            ),
          ),
          tradeCase.messages[0]?.sentAt ?? timestamp,
          latestMessage?.sentAt ?? timestamp,
          tradeCase.messages.length,
          tradeCase.attachments.length,
          latestMessage?.body.slice(0, 280) ?? '',
          timestamp,
          timestamp,
        )
        .run();

      let primaryMessageId: string | null = null;
      for (const message of tradeCase.messages) {
        const messageId = message.id;
        if (!primaryMessageId) {
          primaryMessageId = messageId;
        }
        await db
          .prepare(
            `INSERT INTO mail_messages (
               id, workspace_id, thread_id, provider_message_id, sender_email, sender_name, to_json, cc_json, bcc_json,
               sent_at, subject, snippet, body_text_excerpt, body_r2_key, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, ?, ?, ?, NULL, ?)`,
          )
          .bind(
            messageId,
            workspaceId,
            threadId,
            message.id,
            null,
            message.sender,
            serializeJson(message.recipients),
            message.sentAt,
            message.subject,
            message.body.slice(0, 280),
            message.body,
            timestamp,
          )
          .run();
      }

      if (!primaryMessageId) {
        primaryMessageId = `message-${tradeCase.id}-system`;
        await db
          .prepare(
            `INSERT INTO mail_messages (
               id, workspace_id, thread_id, provider_message_id, sender_email, sender_name, to_json, cc_json, bcc_json,
               sent_at, subject, snippet, body_text_excerpt, body_r2_key, created_at
             ) VALUES (?, ?, ?, ?, NULL, 'TradeCase', '[]', '[]', '[]', ?, ?, ?, ?, NULL, ?)`,
          )
          .bind(
            primaryMessageId,
            workspaceId,
            threadId,
            primaryMessageId,
            timestamp,
            tradeCase.label,
            tradeCase.label,
            tradeCase.label,
            timestamp,
          )
          .run();
      }

      for (const attachment of tradeCase.attachments) {
        await db
          .prepare(
            `INSERT INTO mail_attachments (
               id, workspace_id, message_id, provider_attachment_id, file_name, mime_type, size_bytes,
               r2_object_key, extracted_text_r2_key, text_excerpt, doc_type, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, NULL, ?)`,
          )
          .bind(
            attachment.id,
            workspaceId,
            primaryMessageId,
            attachment.id,
            attachment.fileName,
            attachment.mimeType,
            `pending://${workspaceId}/${attachment.id}`,
            attachment.text,
            timestamp,
          )
          .run();
      }

      await db
        .prepare(
          `INSERT INTO cases (
             id, workspace_id, case_pack_id, source_thread_id, status, label, account, region, owner_user_id,
             latest_subject, latest_message_at, next_action_json, missing_data_json, matched_keywords_json,
             matched_doc_types_json, qualification_rule, qualification_score, summary_text, created_at, updated_at
           ) VALUES (?, ?, 'external_trade_order', ?, 'inquiry_received', ?, ?, ?, NULL, ?, ?, '[]', '[]', '[]', '[]', NULL, 0, NULL, ?, ?)`,
        )
        .bind(
          tradeCase.id,
          workspaceId,
          threadId,
          tradeCase.label,
          tradeCase.account,
          tradeCase.region,
          latestMessage?.subject ?? tradeCase.label,
          latestMessage?.sentAt ?? timestamp,
          timestamp,
          timestamp,
        )
        .run();
    }
  }

  async getWorkspaceCases(workspaceId: string): Promise<TradeCase[]> {
    const db = this.getDb();
    const caseRows = await db
      .prepare(
        `SELECT id, workspace_id, case_pack_id, source_thread_id, status, label, account, region, owner_user_id,
                latest_subject, latest_message_at, created_at, updated_at
         FROM cases
         WHERE workspace_id = ?
         ORDER BY latest_message_at DESC`,
      )
      .bind(workspaceId)
      .all<CaseRow>();

    const results: TradeCase[] = [];
    for (const caseRow of caseRows.results) {
      const sourceThreadId = caseRow.source_thread_id ?? `thread-${caseRow.id}`;
      const threadRow = await db
        .prepare(
          `SELECT id, workspace_id, provider_thread_id, subject, created_at, updated_at
           FROM mail_threads
           WHERE id = ?
           LIMIT 1`,
        )
        .bind(sourceThreadId)
        .first<ThreadRow>();

      const messageRows = await db
        .prepare(
          `SELECT id, thread_id, sender_email, sender_name, to_json, sent_at, subject, body_text_excerpt, created_at
           FROM mail_messages
           WHERE thread_id = ?
           ORDER BY sent_at ASC`,
        )
        .bind(sourceThreadId)
        .all<MessageRow>();

      const attachmentRows = await db
        .prepare(
          `SELECT a.id, a.message_id, a.file_name, a.mime_type, a.text_excerpt
           FROM mail_attachments a
           JOIN mail_messages m ON m.id = a.message_id
           WHERE m.thread_id = ?
           ORDER BY a.created_at ASC`,
        )
        .bind(sourceThreadId)
        .all<AttachmentRow>();

      results.push({
        id: caseRow.id,
        label: caseRow.label,
        account: caseRow.account ?? 'Unknown account',
        region: caseRow.region ?? 'Unknown region',
        messages: messageRows.results.map((row) => ({
          id: row.id,
          sender: row.sender_name ?? row.sender_email ?? 'Unknown sender',
          recipients: parseJson<string[]>(row.to_json, []),
          sentAt: row.sent_at,
          subject: row.subject ?? threadRow?.subject ?? caseRow.latest_subject ?? caseRow.label,
          body: row.body_text_excerpt ?? '',
        })),
        attachments: attachmentRows.results.map((row) => ({
          id: row.id,
          fileName: row.file_name,
          mimeType: row.mime_type ?? 'application/octet-stream',
          text: row.text_excerpt ?? '',
        })),
      });
    }

    return results;
  }

  async listExportTargets(workspaceId: string): Promise<StoredExportTarget[]> {
    const db = this.getDb();
    const rows = await db
      .prepare(
        `SELECT id, workspace_id, provider, auth_mode, display_name, destination_ref_json, credential_ciphertext, configured_at, updated_at
         FROM export_targets
         WHERE workspace_id = ?
         ORDER BY updated_at DESC`,
      )
      .bind(workspaceId)
      .all<ExportTargetRow>();
    return rows.results.map(toStoredExportTarget);
  }

  async getExportTarget(
    workspaceId: string,
    provider: ExportTargetProvider,
  ): Promise<StoredExportTarget | null> {
    const db = this.getDb();
    const row = await db
      .prepare(
        `SELECT id, workspace_id, provider, auth_mode, display_name, destination_ref_json, credential_ciphertext, configured_at, updated_at
         FROM export_targets
         WHERE workspace_id = ? AND provider = ?
         LIMIT 1`,
      )
      .bind(workspaceId, provider)
      .first<ExportTargetRow>();
    return row ? toStoredExportTarget(row) : null;
  }

  async upsertExportTarget(
    options: UpsertExportTargetOptions,
  ): Promise<StoredExportTarget> {
    const current = await this.getExportTarget(options.workspaceId, options.provider);
    const timestamp = nowIso();
    const nextConfig = {
      ...(current?.config ?? {
        displayName: null,
        feishuAppToken: null,
        feishuTableId: null,
        notionAccessToken: null,
        notionDataSourceId: null,
        notionTitleProperty: null,
        notionVersion: null,
      }),
      ...options.config,
    };

    const destination =
      options.provider === 'feishu_bitable'
        ? {
            feishuAppToken: nextConfig.feishuAppToken,
            feishuTableId: nextConfig.feishuTableId,
          }
        : {
            notionDataSourceId: nextConfig.notionDataSourceId,
            notionTitleProperty: nextConfig.notionTitleProperty,
            notionVersion: nextConfig.notionVersion,
          };

    const credential =
      options.provider === 'notion' ? nextConfig.notionAccessToken : null;

    await this.getDb()
      .prepare(
        `INSERT INTO export_targets (
           id, workspace_id, provider, auth_mode, display_name, destination_ref_json, credential_ciphertext, configured_at, updated_at
         ) VALUES (?, ?, ?, 'workspace', ?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id, provider) DO UPDATE SET
           display_name = excluded.display_name,
           destination_ref_json = excluded.destination_ref_json,
           credential_ciphertext = excluded.credential_ciphertext,
           updated_at = excluded.updated_at`,
      )
      .bind(
        `${options.workspaceId}:${options.provider}`,
        options.workspaceId,
        options.provider,
        nextConfig.displayName,
        serializeJson(destination),
        credential,
        current?.configuredAt ?? timestamp,
        timestamp,
      )
      .run();

    return {
      id: options.provider,
      workspaceId: options.workspaceId,
      provider: options.provider,
      configuredAt: current?.configuredAt ?? timestamp,
      updatedAt: timestamp,
      config: nextConfig,
    };
  }
}
