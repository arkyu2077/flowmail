export type CasePackId = 'external_trade_order' | 'saas_revenue_order';

export type WorkflowStatus =
  | 'inquiry_received'
  | 'quote_prepared'
  | 'quote_sent'
  | 'purchase_order_received'
  | 'awaiting_payment'
  | 'shipment_preparation'
  | 'shipment_in_progress'
  | 'documentation_exception';

export type HandledState = 'open' | 'deferred' | 'handled' | 'dismissed';

export interface PluginConfig {
  gmailAccount: string;
  gogPath: string;
  listCommandTemplate: string;
  threadCommandTemplate: string;
  syncQuery: string;
  casePackId: CasePackId;
  maxThreads: number;
  pollIntervalMinutes: number;
  autoPoll: boolean;
  stateDir: string;
}

export interface NormalizedAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  text: string;
}

export interface NormalizedMessage {
  id: string;
  sender: string;
  recipients: string[];
  sentAt: string;
  subject: string;
  body: string;
}

export interface NormalizedThread {
  threadId: string;
  subject: string;
  account: string;
  region: string;
  latestMessageAt: string;
  messages: NormalizedMessage[];
  attachments: NormalizedAttachment[];
  fingerprint: string;
}

export interface QualificationResult {
  qualified: boolean;
  score: number;
  rule: 'doc_match' | 'keyword_attachment' | 'keyword_density' | 'provider_signal' | 'rejected';
  explanation: string;
  matchedKeywords: string[];
  matchedDocTypes: string[];
}

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
}

export interface SuggestedAction {
  label: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AnalysisResult {
  summary: string;
  status: WorkflowStatus;
  missingData: string[];
  nextActions: SuggestedAction[];
  draftReply: string;
  extractedFields: ExtractedField[];
  classifiedDocuments: Array<{
    attachmentId: string;
    fileName: string;
    docType: string;
    confidence: number;
  }>;
}

export interface StoredThreadState {
  threadId: string;
  fingerprint: string;
  subject: string;
  latestMessageAt: string;
  caseId: string | null;
  handledState: HandledState;
  deferUntil: string | null;
  lastSeenAt: string;
}

export interface StoredCase {
  id: string;
  casePackId: CasePackId;
  title: string;
  account: string;
  region: string;
  latestSubject: string;
  latestMessageAt: string;
  handledState: HandledState;
  deferUntil: string | null;
  qualification: QualificationResult;
  analysis: AnalysisResult;
  thread: NormalizedThread;
  createdAt: string;
  updatedAt: string;
}

export interface StoredActionEvent {
  id: string;
  targetType: 'case' | 'thread';
  targetId: string;
  action: string;
  reason: string | null;
  actor: 'plugin' | 'agent' | 'user' | 'system';
  createdAt: string;
}

export interface PluginState {
  version: number;
  casePackId: CasePackId;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastSyncThreadCount: number;
  lastSyncQualifiedCount: number;
  threads: Record<string, StoredThreadState>;
  cases: Record<string, StoredCase>;
  actions: StoredActionEvent[];
}

export interface SyncReport {
  mailbox: string;
  syncedThreadCount: number;
  changedCaseCount: number;
  qualifiedCaseCount: number;
  dismissedCaseCount: number;
  storePath: string;
  lastSyncAt: string;
}

export interface FlowMailPluginApi {
  config?: {
    plugins?: {
      entries?: Record<string, { config?: Record<string, unknown> }>;
    };
  };
  pluginConfig?: Record<string, unknown>;
  registerTool?: (tool: {
    name: string;
    label: string;
    description: string;
    optional?: boolean;
    parameters: Record<string, unknown>;
    execute: (
      callId: string,
      params: Record<string, unknown>,
      signal?: AbortSignal,
      onUpdate?: (partialResult: {
        content: Array<{ type: 'text'; text: string }>;
        details: unknown;
      }) => void,
    ) => Promise<{
      content: Array<{ type: 'text'; text: string }>;
      details: unknown;
    }>;
  }) => void;
  logger?: {
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
  log?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
}
