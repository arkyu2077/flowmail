export type DocType =
  | 'inquiry_note'
  | 'quote'
  | 'proforma_invoice'
  | 'purchase_order'
  | 'commercial_invoice'
  | 'packing_list'
  | 'bill_of_lading'
  | 'shipping_instruction'
  | 'payment_proof'
  | 'subscription_invoice'
  | 'order_form'
  | 'contract'
  | 'payment_failure_notice'
  | 'unknown';

export type WorkflowStatus =
  | 'inquiry_received'
  | 'quote_prepared'
  | 'quote_sent'
  | 'purchase_order_received'
  | 'awaiting_payment'
  | 'shipment_preparation'
  | 'shipment_in_progress'
  | 'documentation_exception';

export type Priority = 'high' | 'medium' | 'low';

export interface EmailMessage {
  id: string;
  sender: string;
  recipients: string[];
  sentAt: string;
  subject: string;
  body: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  text: string;
}

export interface TradeCase {
  id: string;
  label: string;
  account: string;
  region: string;
  messages: EmailMessage[];
  attachments: Attachment[];
}

export interface ClassifiedDocument {
  attachmentId: string;
  fileName: string;
  docType: DocType;
  confidence: number;
  evidence: string;
}

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  evidence: string;
}

export interface SuggestedAction {
  label: string;
  reason: string;
  priority: Priority;
}

export interface PainSignal {
  id: string;
  source: string;
  role: string;
  stage: WorkflowStatus | 'cross_stage';
  category: string;
  severity: Priority;
  summary: string;
  evidence: string;
}

export interface SourceEntry {
  id: string;
  name: string;
  category: string;
  note: string;
  url: string;
}

export interface WorkflowStep {
  status: WorkflowStatus;
  title: string;
  outcome: string;
  keyDocs: DocType[];
}

export interface AnalysisResult {
  classifiedDocuments: ClassifiedDocument[];
  extractedFields: ExtractedField[];
  status: WorkflowStatus;
  summary: string;
  nextActions: SuggestedAction[];
  draftReply: string;
  missingData: string[];
  matchedPainSignals: PainSignal[];
}
