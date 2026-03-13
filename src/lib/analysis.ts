import { painSignals } from '../data/painSignals';
import type { CasePackId } from './case-packs';
import type {
  AnalysisResult,
  Attachment,
  ClassifiedDocument,
  DocType,
  ExtractedField,
  SuggestedAction,
  TradeCase,
  WorkflowStatus,
} from '../types';

const docTypeMap: Array<{ docType: DocType; patterns: RegExp[]; evidence: string }> = [
  {
    docType: 'purchase_order',
    patterns: [/purchase order/i, /\bpo no\b/i, /\bpo[:\s-]/i],
    evidence: 'PO markers detected.',
  },
  {
    docType: 'proforma_invoice',
    patterns: [/proforma invoice/i, /\bpi no\b/i],
    evidence: 'PI markers detected.',
  },
  {
    docType: 'commercial_invoice',
    patterns: [/commercial invoice/i, /\binvoice no\b/i],
    evidence: 'Commercial invoice markers detected.',
  },
  {
    docType: 'bill_of_lading',
    patterns: [/bill of lading/i, /\bbl no\b/i],
    evidence: 'BL markers detected.',
  },
  {
    docType: 'packing_list',
    patterns: [/packing list/i, /carton count/i],
    evidence: 'Packing list markers detected.',
  },
  {
    docType: 'shipping_instruction',
    patterns: [/shipping instruction/i, /consignee/i, /notify party/i],
    evidence: 'Shipping instruction markers detected.',
  },
  {
    docType: 'payment_proof',
    patterns: [/payment proof/i, /swift copy/i, /bank slip/i, /deposit/i],
    evidence: 'Payment proof markers detected.',
  },
  {
    docType: 'quote',
    patterns: [/quotation/i, /\bquote\b/i, /unit price/i],
    evidence: 'Quote markers detected.',
  },
  {
    docType: 'subscription_invoice',
    patterns: [/\bsubscription invoice\b/i, /\bcharged successfully\b/i, /\bbilling statement\b/i],
    evidence: 'Subscription invoice markers detected.',
  },
  {
    docType: 'order_form',
    patterns: [/\border form\b/i, /\bquote accepted\b/i, /\bbooking form\b/i],
    evidence: 'Order-form markers detected.',
  },
  {
    docType: 'contract',
    patterns: [/\bmsa\b/i, /\bmaster service agreement\b/i, /\bcontract signed\b/i],
    evidence: 'Contract markers detected.',
  },
  {
    docType: 'payment_failure_notice',
    patterns: [/\bpayment failed\b/i, /\bcard declined\b/i, /\bpast due\b/i],
    evidence: 'Payment-failure markers detected.',
  },
];

const fieldPatterns: Array<{ key: string; label: string; pattern: RegExp }> = [
  {
    key: 'buyer',
    label: 'Buyer',
    pattern:
      /buyer[:\s]+(.+?)(?=\s(?:supplier|product|sku|quantity|unit price|total amount|currency|incoterm|delivery date|port|deposit|$))/i,
  },
  {
    key: 'supplier',
    label: 'Supplier',
    pattern:
      /supplier[:\s]+(.+?)(?=\s(?:buyer|product|sku|quantity|unit price|total amount|currency|incoterm|delivery date|port|deposit|$))/i,
  },
  {
    key: 'product',
    label: 'Product',
    pattern:
      /product[:\s]+(.+?)(?=\s(?:buyer|supplier|sku|quantity|unit price|total amount|currency|incoterm|delivery date|port|deposit|$))/i,
  },
  { key: 'sku', label: 'SKU', pattern: /\bsku[:\s]+([A-Za-z0-9-]+)/i },
  { key: 'quantity', label: 'Quantity', pattern: /quantity[:\s]+([0-9,]+(?:\s*(?:pcs|sets|ctns))?)/i },
  { key: 'unitPrice', label: 'Unit price', pattern: /unit price[:\s]+([A-Z]{3}\s?[0-9.,]+)/i },
  { key: 'totalAmount', label: 'Total amount', pattern: /total amount[:\s]+([A-Z]{3}\s?[0-9.,]+)/i },
  { key: 'currency', label: 'Currency', pattern: /currency[:\s]+([A-Z]{3})/i },
  { key: 'incoterm', label: 'Incoterm', pattern: /(?:incoterm|port)[:\s]+([A-Z]{3}\s?[A-Za-z]+)/i },
  { key: 'deliveryDate', label: 'Delivery date', pattern: /(?:delivery date|ship date|etd)[:\s]+([0-9-]{10})/i },
  { key: 'poNumber', label: 'PO number', pattern: /\bpo(?:\s*no)?\s*(?::|#|-)?\s*([A-Z0-9-]{5,})/i },
  { key: 'piNumber', label: 'PI number', pattern: /\bpi(?:\s*no)?\s*(?::|#|-)\s*([A-Z0-9-]{5,})/i },
  { key: 'invoiceNumber', label: 'Invoice number', pattern: /\binvoice(?:\s*no)?\s*(?::|#|-)\s*([A-Z0-9-]{5,})/i },
  { key: 'blNumber', label: 'BL number', pattern: /\bbl(?:\s*no)?\s*(?::|#|-)\s*([A-Z0-9-]{5,})/i },
  { key: 'deposit', label: 'Deposit', pattern: /\bdeposit[:\s]+([0-9]{1,2}\s?percent)/i },
  { key: 'vessel', label: 'Vessel', pattern: /\bvessel[:\s]+([A-Za-z0-9 .-]+)/i },
];

const saasFieldPatterns: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: 'customer', label: 'Customer', pattern: /\b(?:customer|account|company)[:\s]+(.+?)(?=\s(?:plan|amount|invoice|renewal|status|workspace|$))/i },
  { key: 'plan', label: 'Plan', pattern: /\bplan[:\s]+([A-Za-z0-9 .+-]+)/i },
  { key: 'mrr', label: 'MRR', pattern: /\b(?:mrr|monthly recurring revenue)[:\s]+([A-Z]{3}\s?[0-9.,]+)/i },
  { key: 'amount', label: 'Amount', pattern: /\b(?:amount due|amount|invoice total)[:\s]+([A-Z]{3}\s?[0-9.,]+)/i },
  { key: 'invoiceId', label: 'Invoice ID', pattern: /\binvoice(?:\s*id|\s*no)?\s*(?::|#|-)?\s*([A-Z0-9-]{4,})/i },
  { key: 'contractId', label: 'Contract ID', pattern: /\b(?:contract|order form)(?:\s*id|\s*no)?\s*(?::|#|-)?\s*([A-Z0-9-]{4,})/i },
  { key: 'renewalDate', label: 'Renewal date', pattern: /\brenewal date[:\s]+([0-9-]{10})/i },
  { key: 'workspaceName', label: 'Workspace', pattern: /\bworkspace[:\s]+([A-Za-z0-9 .-]+)/i },
];

const statusLabels: Record<WorkflowStatus, string> = {
  inquiry_received: 'Inquiry received',
  quote_prepared: 'Quote prepared',
  quote_sent: 'Quote sent',
  purchase_order_received: 'Purchase order received',
  awaiting_payment: 'Awaiting payment',
  shipment_preparation: 'Shipment preparation',
  shipment_in_progress: 'Shipment in progress',
  documentation_exception: 'Documentation exception',
};

const parseSnippet = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, 110);

const uniqueByKey = <T extends { key: string }>(items: T[]): T[] => {
  const map = new Map<string, T>();
  items.forEach((item) => {
    if (!map.has(item.key)) {
      map.set(item.key, item);
    }
  });
  return [...map.values()];
};

export const classifyAttachment = (attachment: Attachment): ClassifiedDocument => {
  const haystack = `${attachment.fileName} ${attachment.text}`;
  for (const rule of docTypeMap) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      return {
        attachmentId: attachment.id,
        fileName: attachment.fileName,
        docType: rule.docType,
        confidence: 0.88,
        evidence: parseSnippet(haystack.match(rule.patterns.find((pattern) => pattern.test(haystack))!)?.[0] ?? rule.evidence),
      };
    }
  }

  return {
    attachmentId: attachment.id,
    fileName: attachment.fileName,
    docType: 'unknown',
    confidence: 0.35,
    evidence: 'No high-confidence document markers detected.',
  };
};

export const extractFields = (tradeCase: TradeCase): ExtractedField[] => {
  const corpus = [
    ...tradeCase.messages.map((message) => message.body),
    ...tradeCase.attachments.map((attachment) => attachment.text),
  ].join('\n');

  const fields = fieldPatterns
    .map((definition) => {
      const match = corpus.match(definition.pattern);
      if (!match) {
        return null;
      }

      return {
        key: definition.key,
        label: definition.label,
        value: match[1].trim(),
        confidence: definition.key === 'buyer' || definition.key === 'product' ? 0.84 : 0.9,
        evidence: parseSnippet(match[0]),
      } satisfies ExtractedField;
    })
    .filter(Boolean) as ExtractedField[];

  return uniqueByKey(fields);
};

export const extractSaasFields = (tradeCase: TradeCase): ExtractedField[] => {
  const corpus = [
    ...tradeCase.messages.map((message) => message.body),
    ...tradeCase.attachments.map((attachment) => attachment.text),
  ].join('\n');

  const fields = saasFieldPatterns
    .map((definition) => {
      const match = corpus.match(definition.pattern);
      if (!match) {
        return null;
      }

      return {
        key: definition.key,
        label: definition.label,
        value: match[1].trim(),
        confidence: 0.88,
        evidence: parseSnippet(match[0]),
      } satisfies ExtractedField;
    })
    .filter(Boolean) as ExtractedField[];

  return uniqueByKey(fields);
};

const hasDocType = (docs: ClassifiedDocument[], target: DocType): boolean =>
  docs.some((doc) => doc.docType === target);

export const inferStatus = (
  tradeCase: TradeCase,
  docs: ClassifiedDocument[],
  fields: ExtractedField[],
): WorkflowStatus => {
  const corpus = [
    ...tradeCase.messages.map((message) => message.body),
    ...tradeCase.attachments.map((attachment) => attachment.text),
  ].join(' ');

  const hasPaymentLanguage = /deposit|payment proof|swift/i.test(corpus);
  const hasPendingLanguage = /pending|still pending|need|missing/i.test(corpus);
  const hasShipmentLanguage = /etd|vessel|shipment|bill of lading|bl draft/i.test(corpus);

  if (
    (hasDocType(docs, 'bill_of_lading') || hasShipmentLanguage) &&
    (!hasDocType(docs, 'packing_list') || hasPendingLanguage)
  ) {
    return 'documentation_exception';
  }

  if (hasDocType(docs, 'bill_of_lading') || /goods are moving|vessel/i.test(corpus)) {
    return 'shipment_in_progress';
  }

  if (
    hasDocType(docs, 'commercial_invoice') ||
    hasDocType(docs, 'packing_list') ||
    hasDocType(docs, 'shipping_instruction')
  ) {
    return 'shipment_preparation';
  }

  if (
    hasDocType(docs, 'payment_proof') ||
    (hasDocType(docs, 'proforma_invoice') && hasPaymentLanguage)
  ) {
    return 'awaiting_payment';
  }

  if (hasDocType(docs, 'purchase_order')) {
    return 'purchase_order_received';
  }

  if (hasDocType(docs, 'quote') || hasDocType(docs, 'proforma_invoice')) {
    return 'quote_sent';
  }

  if (fields.some((field) => field.key === 'product') && fields.some((field) => field.key === 'quantity')) {
    return 'quote_prepared';
  }

  return 'inquiry_received';
};

export const getMissingData = (
  status: WorkflowStatus,
  docs: ClassifiedDocument[],
  fields: ExtractedField[],
): string[] => {
  const missing: string[] = [];

  const has = (key: string) => fields.some((field) => field.key === key);

  if (!has('buyer')) {
    missing.push('Buyer name');
  }
  if (!has('product')) {
    missing.push('Product name');
  }
  if (!has('quantity')) {
    missing.push('Quantity');
  }

  if (status === 'quote_sent' || status === 'purchase_order_received') {
    if (!has('incoterm')) {
      missing.push('Incoterm');
    }
    if (!has('deliveryDate')) {
      missing.push('Delivery date or ETD');
    }
  }

  if (status === 'awaiting_payment' && !has('deposit')) {
    missing.push('Deposit or payment proof');
  }

  if (status === 'shipment_preparation' || status === 'documentation_exception') {
    if (!hasDocType(docs, 'packing_list')) {
      missing.push('Packing list');
    }
    if (!hasDocType(docs, 'commercial_invoice')) {
      missing.push('Commercial invoice');
    }
  }

  if (status === 'shipment_in_progress' && !has('blNumber')) {
    missing.push('BL number');
  }

  return missing;
};

export const getNextActions = (
  status: WorkflowStatus,
  missingData: string[],
  fields: ExtractedField[],
): SuggestedAction[] => {
  const has = (key: string) => fields.some((field) => field.key === key);
  const actions: SuggestedAction[] = [];

  if (missingData.length > 0) {
    actions.push({
      label: `Collect missing data: ${missingData.join(', ')}`,
      reason: 'The trade case cannot advance cleanly until the missing fields or documents are filled.',
      priority: 'high',
    });
  }

  if (status === 'inquiry_received' || status === 'quote_prepared') {
    actions.push({
      label: 'Send quote or PI draft',
      reason: 'The buyer request is present and the next commercial step is to formalize pricing.',
      priority: 'high',
    });
  }

  if (status === 'quote_sent') {
    actions.push({
      label: 'Follow up for commercial confirmation',
      reason: 'The customer has quote context but has not yet committed with a purchase order.',
      priority: 'medium',
    });
  }

  if (status === 'purchase_order_received') {
    actions.push({
      label: 'Issue PI and confirm deposit terms',
      reason: 'The order is in hand and the next blocker is commercial confirmation or payment.',
      priority: 'high',
    });
  }

  if (status === 'awaiting_payment') {
    actions.push({
      label: 'Request payment proof and approval to book production',
      reason: 'The process is blocked on payment confirmation.',
      priority: 'high',
    });
  }

  if (status === 'shipment_preparation' || status === 'documentation_exception') {
    actions.push({
      label: 'Complete shipping document set',
      reason: 'Carrier and customs handoff depends on a full, consistent document package.',
      priority: 'high',
    });
  }

  if (status === 'shipment_in_progress') {
    actions.push({
      label: 'Send shipment update with vessel and document references',
      reason: 'Customers need active transport visibility once shipment is moving.',
      priority: 'medium',
    });
  }

  if (!has('currency')) {
    actions.push({
      label: 'Normalize pricing currency',
      reason: 'Commercial discussions often break when currency is implied but not explicit.',
      priority: 'low',
    });
  }

  return actions.slice(0, 4);
};

export const getDraftReply = (
  tradeCase: TradeCase,
  status: WorkflowStatus,
  fields: ExtractedField[],
  missingData: string[],
): string => {
  const account = fields.find((field) => field.key === 'buyer')?.value ?? tradeCase.account;
  const product = fields.find((field) => field.key === 'product')?.value ?? 'the requested items';
  const quantity = fields.find((field) => field.key === 'quantity')?.value;
  const incoterm = fields.find((field) => field.key === 'incoterm')?.value;
  const deliveryDate = fields.find((field) => field.key === 'deliveryDate')?.value;

  const intro =
    status === 'shipment_in_progress'
      ? `Hi ${account}, here is the latest shipment update for ${product}.`
      : `Hi ${account}, here is the current update for ${product}.`;

  const details = [
    quantity ? `Quantity on record: ${quantity}.` : null,
    incoterm ? `Commercial terms: ${incoterm}.` : null,
    deliveryDate ? `Current ship or delivery target: ${deliveryDate}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const blocker =
    missingData.length > 0
      ? `We still need the following to advance the case: ${missingData.join(', ')}.`
      : 'The core document set looks complete for the current stage.';

  const close =
    status === 'purchase_order_received' || status === 'awaiting_payment'
      ? 'Please confirm once the payment or approval step is completed so we can proceed immediately.'
      : 'Please confirm if you want us to proceed with the next step.';

  return [intro, details, blocker, close].filter(Boolean).join(' ');
};

const inferSaasStatus = (
  tradeCase: TradeCase,
  docs: ClassifiedDocument[],
  fields: ExtractedField[],
): WorkflowStatus => {
  const corpus = [
    ...tradeCase.messages.map((message) => `${message.subject} ${message.body}`),
    ...tradeCase.attachments.map((attachment) => attachment.text),
  ].join(' ');

  if (/payment failed|card declined|past due|refund requested|charge dispute/i.test(corpus)) {
    return 'documentation_exception';
  }

  if (
    docs.some((doc) => doc.docType === 'subscription_invoice') &&
    /paid|charged successfully|payment received/i.test(corpus)
  ) {
    return 'shipment_in_progress';
  }

  if (/workspace created|account activated|provisioning scheduled|seats enabled/i.test(corpus)) {
    return 'shipment_preparation';
  }

  if (docs.some((doc) => doc.docType === 'contract' || doc.docType === 'order_form')) {
    return 'purchase_order_received';
  }

  if (/invoice|payment link|checkout/i.test(corpus)) {
    return 'awaiting_payment';
  }

  if (fields.some((field) => field.key === 'plan') || /quote|proposal|pricing/i.test(corpus)) {
    return 'quote_sent';
  }

  return 'inquiry_received';
};

const getSaasMissingData = (
  status: WorkflowStatus,
  docs: ClassifiedDocument[],
  fields: ExtractedField[],
): string[] => {
  const missing: string[] = [];
  const has = (key: string) => fields.some((field) => field.key === key);

  if (!has('customer')) {
    missing.push('Customer name');
  }

  if (!has('plan')) {
    missing.push('Plan name');
  }

  if ((status === 'awaiting_payment' || status === 'documentation_exception') && !has('amount')) {
    missing.push('Amount due');
  }

  if (status === 'purchase_order_received' && !has('contractId')) {
    missing.push('Contract or order form ID');
  }

  if (status === 'shipment_in_progress' && !has('renewalDate')) {
    missing.push('Renewal date');
  }

  if (
    status === 'documentation_exception' &&
    !docs.some((doc) => doc.docType === 'payment_failure_notice')
  ) {
    missing.push('Payment failure evidence');
  }

  return missing;
};

const getSaasNextActions = (
  status: WorkflowStatus,
  missingData: string[],
): SuggestedAction[] => {
  const actions: SuggestedAction[] = [];

  if (missingData.length > 0) {
    actions.push({
      label: `Collect missing data: ${missingData.join(', ')}`,
      reason: 'The revenue case still needs the missing fields before finance or success can act cleanly.',
      priority: 'high',
    });
  }

  if (status === 'inquiry_received' || status === 'quote_sent') {
    actions.push({
      label: 'Send pricing or checkout follow-up',
      reason: 'The buyer has shown revenue intent but still needs a clear next commercial step.',
      priority: 'high',
    });
  }

  if (status === 'awaiting_payment') {
    actions.push({
      label: 'Follow up on invoice and payment method',
      reason: 'Revenue is currently blocked on payment completion.',
      priority: 'high',
    });
  }

  if (status === 'purchase_order_received') {
    actions.push({
      label: 'Start provisioning and confirm activation timeline',
      reason: 'The contract is signed and the next step is enablement.',
      priority: 'medium',
    });
  }

  if (status === 'documentation_exception') {
    actions.push({
      label: 'Escalate billing issue and propose recovery path',
      reason: 'The case has a revenue blocker such as payment failure, refund risk, or dispute.',
      priority: 'high',
    });
  }

  if (status === 'shipment_in_progress') {
    actions.push({
      label: 'Confirm healthy active account and renewal plan',
      reason: 'Once billing is healthy, the next risk is future retention or expansion.',
      priority: 'medium',
    });
  }

  return actions.slice(0, 4);
};

const getSaasDraftReply = (
  tradeCase: TradeCase,
  status: WorkflowStatus,
  fields: ExtractedField[],
  missingData: string[],
): string => {
  const account = fields.find((field) => field.key === 'customer')?.value ?? tradeCase.account;
  const plan = fields.find((field) => field.key === 'plan')?.value ?? 'your current plan';
  const amount = fields.find((field) => field.key === 'amount')?.value;
  const renewalDate = fields.find((field) => field.key === 'renewalDate')?.value;

  const intro =
    status === 'documentation_exception'
      ? `Hi ${account}, we noticed a billing issue tied to ${plan}.`
      : `Hi ${account}, here is the latest update for ${plan}.`;

  const details = [
    amount ? `Current amount on record: ${amount}.` : null,
    renewalDate ? `Renewal date on file: ${renewalDate}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const blocker =
    missingData.length > 0
      ? `We still need the following to close the loop: ${missingData.join(', ')}.`
      : 'The core billing and contract details are now visible in the case.';

  const close =
    status === 'awaiting_payment' || status === 'documentation_exception'
      ? 'Please reply once the payment or billing step is confirmed so we can update the account immediately.'
      : 'Please confirm if you want us to proceed with the next revenue step.';

  return [intro, details, blocker, close].filter(Boolean).join(' ');
};

export const analyzeTradeCase = (tradeCase: TradeCase): AnalysisResult => {
  const classifiedDocuments = tradeCase.attachments.map(classifyAttachment);
  const extractedFields = extractFields(tradeCase);
  const status = inferStatus(tradeCase, classifiedDocuments, extractedFields);
  const missingData = getMissingData(status, classifiedDocuments, extractedFields);
  const nextActions = getNextActions(status, missingData, extractedFields);
  const draftReply = getDraftReply(tradeCase, status, extractedFields, missingData);

  const matchedPainSignals = painSignals.filter(
    (signal) => signal.stage === 'cross_stage' || signal.stage === status,
  );

  const summary = `Status: ${statusLabels[status]}. ${tradeCase.attachments.length} attachment(s) were analyzed, ${extractedFields.length} fields were extracted, and ${missingData.length} missing item(s) remain.`;

  return {
    classifiedDocuments,
    extractedFields,
    status,
    summary,
    nextActions,
    draftReply,
    missingData,
    matchedPainSignals,
  };
};

export const analyzeCase = (
  tradeCase: TradeCase,
  casePackId: CasePackId = 'external_trade_order',
): AnalysisResult => {
  if (casePackId === 'saas_revenue_order') {
    const classifiedDocuments = tradeCase.attachments.map(classifyAttachment);
    const extractedFields = extractSaasFields(tradeCase);
    const status = inferSaasStatus(tradeCase, classifiedDocuments, extractedFields);
    const missingData = getSaasMissingData(status, classifiedDocuments, extractedFields);
    const nextActions = getSaasNextActions(status, missingData);
    const draftReply = getSaasDraftReply(tradeCase, status, extractedFields, missingData);
    const summary = `Status: ${status}. ${tradeCase.attachments.length} attachment(s) were analyzed, ${extractedFields.length} fields were extracted, and ${missingData.length} missing item(s) remain.`;

    return {
      classifiedDocuments,
      extractedFields,
      status,
      summary,
      nextActions,
      draftReply,
      missingData,
      matchedPainSignals: [],
    };
  }

  return analyzeTradeCase(tradeCase);
};
