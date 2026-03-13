import type { AnalysisResult, TradeCase, WorkflowStatus } from '../types';
import type { CasePackDefinition, CasePackId } from '../lib/case-packs';
import type { TradeQualification } from '../lib/qualification';

export interface TradeCaseRecord {
  id: string;
  label: string;
  account: string;
  region: string;
  latestSubject: string;
  latestMessageAt: string;
  workflowStatus: WorkflowStatus;
  missingData: string[];
  nextAction: string | null;
  threadCount: number;
  attachmentCount: number;
  qualification: TradeQualification;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  selectedCasePackId: CasePackId;
  createdAt: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleAuthInitiateRequest {
  returnUrl?: string;
}

export interface GoogleAuthInitiateResponse {
  oauthUrl: string;
}

export interface AuthSessionResponse {
  user: AuthUser;
  workspaces: WorkspaceSummary[];
}

export interface CreateWorkspaceRequest {
  name: string;
}

export interface ListWorkspacesResponse {
  items: WorkspaceSummary[];
}

export interface DashboardSummary {
  totalCases: number;
  byStatus: Record<WorkflowStatus, number>;
  casesWithMissingData: number;
  stuckCases: number;
}

export interface ListTradeCasesResponse {
  workspaceId: string;
  summary: DashboardSummary;
  items: TradeCaseRecord[];
}

export interface GetTradeCaseResponse {
  workspaceId: string;
  tradeCase: TradeCase;
  analysis: AnalysisResult;
  qualification: TradeQualification;
}

export interface MissingDocumentsResponse {
  workspaceId: string;
  items: Array<{
    caseId: string;
    label: string;
    missingData: string[];
    workflowStatus: WorkflowStatus;
  }>;
}

export interface DraftReplyResponse {
  workspaceId: string;
  caseId: string;
  draftReply: string;
  workflowStatus: WorkflowStatus;
}

export interface MailboxConnectionRequest {
  provider: 'gmail' | 'outlook';
  returnUrl?: string;
}

export interface MailboxConnectionResponse {
  workspaceId: string;
  provider: 'gmail' | 'outlook';
  connectionId: string;
  oauthUrl: string;
  scopes: string[];
  mode: 'read_only';
}

export interface MailboxConnectionStatus {
  workspaceId: string;
  connectionId: string;
  provider: 'gmail' | 'outlook';
  mode: 'read_only';
  status: 'pending' | 'connected' | 'error';
  scopes: string[];
  emailAddress: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  syncedCaseCount: number;
  syncedThreadCount: number;
  filteredOutThreadCount: number;
  lastError: string | null;
  syncQuery?: string;
}

export interface ListMailboxConnectionsResponse {
  workspaceId: string;
  items: MailboxConnectionStatus[];
}

export interface MailboxRefreshResponse {
  workspaceId: string;
  connectionId: string;
  queued: boolean;
  mode: 'backfill' | 'incremental';
  syncedCaseCount?: number;
  syncedThreadCount?: number;
  lastSyncedAt?: string;
}

export interface AssistantQueryRequest {
  query: string;
}

export interface AssistantQueryResponse {
  workspaceId: string;
  query: string;
  answer: string;
  referencedCases: Array<{
    id: string;
    label: string;
    workflowStatus: WorkflowStatus;
  }>;
  suggestedActions: string[];
}

export interface ListCasePacksResponse {
  items: CasePackDefinition[];
  activeCasePackId: string;
}

export interface WorkspaceCasePackResponse {
  workspaceId: string;
  selectedCasePackId: CasePackId;
  selectedCasePack: CasePackDefinition;
}

export interface UpdateWorkspaceCasePackRequest {
  casePackId: CasePackId;
}

export interface ExportTargetStatus {
  id: 'feishu_bitable' | 'notion';
  name: string;
  configured: boolean;
  authMode: 'workspace' | 'env_fallback' | 'missing';
  locationHint: string;
  setupHint: string;
  displayName?: string | null;
}

export interface ListExportTargetsResponse {
  workspaceId: string;
  items: ExportTargetStatus[];
}

export interface ExportCasesResponse {
  workspaceId: string;
  target: 'feishu_bitable' | 'notion';
  exportedCount: number;
  locationId: string;
  message: string;
}

export interface ConfigureFeishuBitableTargetRequest {
  appToken: string;
  tableId: string;
  displayName?: string;
}

export interface ConfigureNotionTargetRequest {
  accessToken: string;
  dataSourceId: string;
  titleProperty?: string;
  notionVersion?: string;
  displayName?: string;
}

export interface WorkspaceAccessTokenRecord {
  id: string;
  name: string;
  tokenPreview: string;
  scopes: string[];
  createdByUserId: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ListWorkspaceAccessTokensResponse {
  workspaceId: string;
  items: WorkspaceAccessTokenRecord[];
}

export interface CreateWorkspaceAccessTokenRequest {
  name?: string;
  scopes?: string[];
}

export interface CreateWorkspaceAccessTokenResponse {
  workspaceId: string;
  token: WorkspaceAccessTokenRecord;
  plainTextToken: string;
}
