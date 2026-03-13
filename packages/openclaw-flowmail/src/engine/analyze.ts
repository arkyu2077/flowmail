import type {
  AnalysisResult,
  CasePackId,
  ExtractedField,
  NormalizedAttachment,
  NormalizedThread,
  SuggestedAction,
  WorkflowStatus,
} from '../types';

const classifyAttachment = (attachment: NormalizedAttachment) => {
  const haystack = `${attachment.fileName} ${attachment.text}`;
  const rules: Array<{ docType: string; pattern: RegExp }> = [
    { docType: 'purchase_order', pattern: /\bpurchase order\b|\bpo no\b/i },
    { docType: 'proforma_invoice', pattern: /\bproforma invoice\b|\bpi no\b/i },
    { docType: 'commercial_invoice', pattern: /\bcommercial invoice\b|\binvoice no\b/i },
    { docType: 'bill_of_lading', pattern: /\bbill of lading\b|\bbl no\b/i },
    { docType: 'packing_list', pattern: /\bpacking list\b/i },
    { docType: 'shipping_instruction', pattern: /\bshipping instruction\b/i },
    { docType: 'payment_proof', pattern: /\bpayment proof\b|\bswift copy\b|\bbank slip\b/i },
    { docType: 'subscription_invoice', pattern: /\binvoice\b|\bbilling statement\b/i },
    { docType: 'order_form', pattern: /\border form\b|\bquote accepted\b/i },
    { docType: 'contract', pattern: /\bmsa\b|\bcontract signed\b/i },
    { docType: 'payment_failure_notice', pattern: /\bpayment failed\b|\bcard declined\b|\bpast due\b/i },
  ];

  const match = rules.find((rule) => rule.pattern.test(haystack));
  return {
    attachmentId: attachment.id,
    fileName: attachment.fileName,
    docType: match?.docType ?? 'unknown',
    confidence: match ? 0.88 : 0.35,
  };
};

const uniqueFields = (items: ExtractedField[]): ExtractedField[] => {
  const seen = new Map<string, ExtractedField>();
  for (const item of items) {
    if (!seen.has(item.key)) {
      seen.set(item.key, item);
    }
  }
  return [...seen.values()];
};

const extractByPatterns = (
  corpus: string,
  patterns: Array<{ key: string; label: string; pattern: RegExp }>,
): ExtractedField[] =>
  uniqueFields(
    patterns
      .map((definition) => {
        const match = corpus.match(definition.pattern);
        if (!match) {
          return null;
        }
        return {
          key: definition.key,
          label: definition.label,
          value: match[1].trim(),
        } satisfies ExtractedField;
      })
      .filter(Boolean) as ExtractedField[],
  );

const tradeFieldPatterns = [
  { key: 'buyer', label: 'Buyer', pattern: /\bbuyer[:\s]+(.+?)(?=\s(?:supplier|product|sku|quantity|unit price|currency|$))/i },
  { key: 'supplier', label: 'Supplier', pattern: /\bsupplier[:\s]+(.+?)(?=\s(?:buyer|product|sku|quantity|unit price|currency|$))/i },
  { key: 'product', label: 'Product', pattern: /\bproduct[:\s]+(.+?)(?=\s(?:buyer|supplier|sku|quantity|unit price|currency|$))/i },
  { key: 'sku', label: 'SKU', pattern: /\bsku[:\s]+([A-Za-z0-9-]+)/i },
  { key: 'quantity', label: 'Quantity', pattern: /\bquantity[:\s]+([0-9,]+(?:\s*(?:pcs|sets|ctns))?)/i },
  { key: 'currency', label: 'Currency', pattern: /\bcurrency[:\s]+([A-Z]{3})/i },
  { key: 'poNumber', label: 'PO number', pattern: /\bpo(?:\s*no)?\s*(?::|#|-)?\s*([A-Z0-9-]{4,})/i },
  { key: 'piNumber', label: 'PI number', pattern: /\bpi(?:\s*no)?\s*(?::|#|-)?\s*([A-Z0-9-]{4,})/i },
  { key: 'invoiceNumber', label: 'Invoice number', pattern: /\binvoice(?:\s*no)?\s*(?::|#|-)?\s*([A-Z0-9-]{4,})/i },
  { key: 'blNumber', label: 'BL number', pattern: /\bbl(?:\s*no)?\s*(?::|#|-)?\s*([A-Z0-9-]{4,})/i },
  { key: 'deliveryDate', label: 'Delivery date', pattern: /\b(?:delivery date|ship date|etd)[:\s]+([0-9-]{8,10})/i },
];

const saasFieldPatterns = [
  { key: 'customer', label: 'Customer', pattern: /\b(?:customer|account|company)[:\s]+(.+?)(?=\s(?:plan|amount|invoice|renewal|workspace|$))/i },
  { key: 'plan', label: 'Plan', pattern: /\bplan[:\s]+([A-Za-z0-9 .+-]+)/i },
  { key: 'amount', label: 'Amount', pattern: /\b(?:amount due|amount|invoice total)[:\s]+([A-Z]{3}\s?[0-9.,]+)/i },
  { key: 'invoiceId', label: 'Invoice ID', pattern: /\binvoice(?:\s*id|\s*no)?\s*(?::|#|-)?\s*([A-Z0-9-]{4,})/i },
  { key: 'contractId', label: 'Contract ID', pattern: /\b(?:contract|order form)(?:\s*id|\s*no)?\s*(?::|#|-)?\s*([A-Z0-9-]{4,})/i },
  { key: 'renewalDate', label: 'Renewal date', pattern: /\brenewal date[:\s]+([0-9-]{8,10})/i },
  { key: 'workspaceName', label: 'Workspace', pattern: /\bworkspace[:\s]+([A-Za-z0-9 .-]+)/i },
];

const hasDocType = (docs: AnalysisResult['classifiedDocuments'], target: string) =>
  docs.some((doc) => doc.docType === target);

const inferTradeStatus = (
  thread: NormalizedThread,
  docs: AnalysisResult['classifiedDocuments'],
): WorkflowStatus => {
  const corpus = [thread.subject, ...thread.messages.map((message) => message.body), ...thread.attachments.map((attachment) => attachment.text)].join(' ');

  if ((hasDocType(docs, 'bill_of_lading') || /\bvessel\b|\bshipment\b/i.test(corpus)) && !hasDocType(docs, 'packing_list')) {
    return 'documentation_exception';
  }
  if (hasDocType(docs, 'bill_of_lading')) {
    return 'shipment_in_progress';
  }
  if (hasDocType(docs, 'commercial_invoice') || hasDocType(docs, 'packing_list') || hasDocType(docs, 'shipping_instruction')) {
    return 'shipment_preparation';
  }
  if (hasDocType(docs, 'payment_proof') || /\bdeposit\b|\bswift copy\b/i.test(corpus)) {
    return 'awaiting_payment';
  }
  if (hasDocType(docs, 'purchase_order')) {
    return 'purchase_order_received';
  }
  if (hasDocType(docs, 'proforma_invoice')) {
    return 'quote_sent';
  }
  if (/\bquote\b|\bquotation\b|\brfq\b/i.test(corpus)) {
    return 'quote_prepared';
  }
  return 'inquiry_received';
};

const inferSaasStatus = (
  thread: NormalizedThread,
  docs: AnalysisResult['classifiedDocuments'],
): WorkflowStatus => {
  const corpus = [thread.subject, ...thread.messages.map((message) => message.body), ...thread.attachments.map((attachment) => attachment.text)].join(' ');

  if (hasDocType(docs, 'payment_failure_notice') || /\bpayment failed\b|\bpast due\b/i.test(corpus)) {
    return 'documentation_exception';
  }
  if (/\bworkspace created\b|\baccount activated\b|\bsubscription active\b/i.test(corpus)) {
    return 'shipment_in_progress';
  }
  if (hasDocType(docs, 'contract') || hasDocType(docs, 'order_form')) {
    return 'purchase_order_received';
  }
  if (hasDocType(docs, 'subscription_invoice') || /\binvoice\b|\bbilling statement\b/i.test(corpus)) {
    return 'quote_sent';
  }
  if (/\bpayment pending\b|\bawaiting payment\b/i.test(corpus)) {
    return 'awaiting_payment';
  }
  if (/\brenewal\b|\bsubscription\b|\bplan\b/i.test(corpus)) {
    return 'quote_prepared';
  }
  return 'inquiry_received';
};

const getTradeMissingData = (
  status: WorkflowStatus,
  docs: AnalysisResult['classifiedDocuments'],
  fields: ExtractedField[],
): string[] => {
  const missing: string[] = [];
  const hasField = (key: string) => fields.some((field) => field.key === key);
  if ((status === 'quote_sent' || status === 'purchase_order_received') && !hasField('poNumber')) {
    missing.push('PO number');
  }
  if (status === 'purchase_order_received' && !hasDocType(docs, 'payment_proof')) {
    missing.push('Payment proof');
  }
  if (status === 'shipment_preparation' && !hasDocType(docs, 'packing_list')) {
    missing.push('Packing list');
  }
  if (status === 'documentation_exception' && !hasDocType(docs, 'bill_of_lading')) {
    missing.push('Bill of lading');
  }
  if (!hasField('deliveryDate')) {
    missing.push('Delivery date');
  }
  return [...new Set(missing)];
};

const getSaasMissingData = (
  status: WorkflowStatus,
  docs: AnalysisResult['classifiedDocuments'],
  fields: ExtractedField[],
): string[] => {
  const missing: string[] = [];
  const hasField = (key: string) => fields.some((field) => field.key === key);
  if (status === 'quote_sent' && !hasField('invoiceId')) {
    missing.push('Invoice ID');
  }
  if (status === 'purchase_order_received' && !hasField('contractId')) {
    missing.push('Contract ID');
  }
  if ((status === 'quote_sent' || status === 'awaiting_payment') && !hasField('amount')) {
    missing.push('Amount');
  }
  if (status === 'documentation_exception' && !hasDocType(docs, 'payment_failure_notice')) {
    missing.push('Failure reason');
  }
  return [...new Set(missing)];
};

const buildActions = (status: WorkflowStatus, missingData: string[], casePackId: CasePackId): SuggestedAction[] => {
  if (missingData.length > 0) {
    return missingData.map((item) => ({
      label: `Resolve ${item}`,
      reason: `The case is missing ${item}.`,
      priority: status === 'documentation_exception' ? 'high' : 'medium',
    }));
  }

  if (casePackId === 'saas_revenue_order') {
    if (status === 'quote_sent') {
      return [{ label: 'Follow up on payment', reason: 'Invoice has been issued but no completion signal is visible.', priority: 'medium' }];
    }
    if (status === 'purchase_order_received') {
      return [{ label: 'Confirm provisioning', reason: 'A signed order exists and the account should be activated.', priority: 'medium' }];
    }
  } else {
    if (status === 'quote_prepared') {
      return [{ label: 'Send quotation', reason: 'The inquiry looks qualified but no sent quote is visible.', priority: 'medium' }];
    }
    if (status === 'purchase_order_received') {
      return [{ label: 'Confirm payment timing', reason: 'The PO is visible and payment proof is the next checkpoint.', priority: 'medium' }];
    }
  }

  return [{ label: 'Monitor for updates', reason: 'No urgent blocker is visible right now.', priority: 'low' }];
};

const buildDraftReply = (
  thread: NormalizedThread,
  status: WorkflowStatus,
  missingData: string[],
  casePackId: CasePackId,
): string => {
  if (casePackId === 'saas_revenue_order') {
    if (missingData.length) {
      return `Hi ${thread.account},\n\nWe reviewed the latest billing thread. Before we can move this forward, we still need: ${missingData.join(', ')}.\n\nPlease reply with the missing details and we will update the account state right away.\n\nBest,\nOperations`;
    }
    return `Hi ${thread.account},\n\nWe reviewed the latest billing thread and the current status is ${status}. Please confirm if you would like us to proceed with the next revenue step.\n\nBest,\nOperations`;
  }

  if (missingData.length) {
    return `Hi ${thread.account},\n\nWe reviewed the latest order thread. Before we can move this shipment forward, we still need: ${missingData.join(', ')}.\n\nPlease send the missing details when ready and we will update the order state immediately.\n\nBest,\nTrade team`;
  }
  return `Hi ${thread.account},\n\nWe reviewed the latest order thread and the current status is ${status}. Please confirm if you would like us to proceed with the next step.\n\nBest,\nTrade team`;
};

export const analyzeThread = (
  thread: NormalizedThread,
  casePackId: CasePackId,
): AnalysisResult => {
  const corpus = [thread.subject, ...thread.messages.map((message) => message.body), ...thread.attachments.map((attachment) => attachment.text)].join('\n');
  const classifiedDocuments = thread.attachments.map(classifyAttachment);
  const extractedFields =
    casePackId === 'saas_revenue_order'
      ? extractByPatterns(corpus, saasFieldPatterns)
      : extractByPatterns(corpus, tradeFieldPatterns);
  const status =
    casePackId === 'saas_revenue_order'
      ? inferSaasStatus(thread, classifiedDocuments)
      : inferTradeStatus(thread, classifiedDocuments);
  const missingData =
    casePackId === 'saas_revenue_order'
      ? getSaasMissingData(status, classifiedDocuments, extractedFields)
      : getTradeMissingData(status, classifiedDocuments, extractedFields);
  const nextActions = buildActions(status, missingData, casePackId);
  const draftReply = buildDraftReply(thread, status, missingData, casePackId);

  return {
    summary: `Status: ${status}. ${thread.attachments.length} attachment(s) were analyzed, ${extractedFields.length} field(s) were extracted, and ${missingData.length} missing item(s) remain.`,
    status,
    missingData,
    nextActions,
    draftReply,
    extractedFields,
    classifiedDocuments,
  };
};
