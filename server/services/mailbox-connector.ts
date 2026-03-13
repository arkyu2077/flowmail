import type {
  ListMailboxConnectionsResponse,
  MailboxConnectionStatus,
  MailboxRefreshResponse,
} from '../../src/api/contracts';
import type { CasePackId } from '../../src/lib/case-packs';
import {
  getGmailSyncQuery,
  refreshGoogleAccessToken,
  syncGmailMailbox,
} from '../gmail';
import type { TradeCaseRepository } from '../repository';
import type { StoredMailboxConnection } from '../store';

const mapConnectionStatus = (
  workspaceId: string,
  connection: StoredMailboxConnection,
  visibleCaseCount: number,
): MailboxConnectionStatus => ({
  workspaceId,
  connectionId: connection.id,
  provider: connection.provider,
  mode: connection.mode,
  status: connection.status,
  scopes: connection.scopes,
  emailAddress: connection.emailAddress,
  connectedAt: connection.connectedAt,
  lastSyncedAt: connection.lastSyncedAt,
  syncedCaseCount: visibleCaseCount,
  syncedThreadCount: connection.syncedThreadCount,
  filteredOutThreadCount: Math.max(0, connection.syncedThreadCount - visibleCaseCount),
  lastError: connection.lastError,
  syncQuery: connection.provider === 'gmail' ? getGmailSyncQuery() : undefined,
});

export class MailboxConnectorService {
  constructor(
    private readonly repository: TradeCaseRepository,
    private readonly getWorkspaceCasePackId: (workspaceId: string) => Promise<CasePackId>,
    private readonly getVisibleCaseCount: (workspaceId: string) => Promise<number>,
  ) {}

  async listConnectionStatuses(
    workspaceId: string,
  ): Promise<ListMailboxConnectionsResponse> {
    const visibleCaseCount = await this.getVisibleCaseCount(workspaceId);
    const items = (await this.repository.listMailboxConnections(workspaceId))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((connection) => mapConnectionStatus(workspaceId, connection, visibleCaseCount));

    return {
      workspaceId,
      items,
    };
  }

  async getActiveGoogleConnection(
    workspaceId: string,
  ): Promise<StoredMailboxConnection | null> {
    return this.repository.getMailboxConnectionByProvider(workspaceId, 'gmail');
  }

  async syncMailboxConnection(
    connectionId: string,
  ): Promise<{
    connection: StoredMailboxConnection;
    syncedCaseCount: number;
    syncedThreadCount: number;
    syncedAt: string;
  }> {
    const initialConnection = await this.repository.getMailboxConnection(connectionId);
    if (!initialConnection) {
      throw new Error('Mailbox connection not found.');
    }
    if (initialConnection.provider !== 'gmail') {
      throw new Error('Only Gmail is implemented in this local build.');
    }

    const connection = await this.ensureFreshGoogleAccessToken(initialConnection);
    const casePackId = await this.getWorkspaceCasePackId(connection.workspaceId);
    const result = await syncGmailMailbox(connection, casePackId);
    await this.repository.saveWorkspaceCases(connection.workspaceId, result.cases);

    const updatedConnection = await this.repository.updateMailboxConnection(connection.id, {
      status: 'connected',
      emailAddress: result.emailAddress,
      connectedAt: connection.connectedAt ?? result.syncedAt,
      lastSyncedAt: result.syncedAt,
      syncedCaseCount: result.syncedCaseCount,
      syncedThreadCount: result.syncedThreadCount,
      lastError: null,
    });

    if (!updatedConnection) {
      throw new Error('Mailbox connection disappeared during sync.');
    }

    return {
      connection: updatedConnection,
      syncedCaseCount: result.syncedCaseCount,
      syncedThreadCount: result.syncedThreadCount,
      syncedAt: result.syncedAt,
    };
  }

  buildRefreshResponse(
    workspaceId: string,
    connectionId: string,
    result: {
      syncedCaseCount: number;
      syncedThreadCount: number;
      syncedAt: string;
    },
  ): MailboxRefreshResponse {
    return {
      workspaceId,
      connectionId,
      queued: false,
      mode: 'incremental',
      syncedCaseCount: result.syncedCaseCount,
      syncedThreadCount: result.syncedThreadCount,
      lastSyncedAt: result.syncedAt,
    };
  }

  private async ensureFreshGoogleAccessToken(
    connection: StoredMailboxConnection,
  ): Promise<StoredMailboxConnection> {
    const expiryDate = connection.tokens.expiryDate
      ? new Date(connection.tokens.expiryDate).getTime()
      : null;
    const refreshThreshold = Date.now() + 60_000;
    if (!expiryDate || expiryDate > refreshThreshold) {
      return connection;
    }

    if (!connection.tokens.refreshToken) {
      return connection;
    }

    const refreshed = await refreshGoogleAccessToken(connection.tokens.refreshToken);
    const updated = await this.repository.updateMailboxConnection(connection.id, {
      tokens: {
        accessToken: refreshed.access_token,
        refreshToken: connection.tokens.refreshToken,
        scope: refreshed.scope ?? connection.tokens.scope,
        tokenType: refreshed.token_type ?? connection.tokens.tokenType,
        expiryDate: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      },
    });

    return updated ?? connection;
  }
}
