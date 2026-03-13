import type { CasePackId, NormalizedThread, QualificationResult } from '../types';

type SignalDefinition = {
  label: string;
  pattern: RegExp;
  weight: number;
  strong?: boolean;
};

const tradeSignals: SignalDefinition[] = [
  { label: 'purchase order', pattern: /\bpurchase order\b|\bpo no\b/i, weight: 3, strong: true },
  { label: 'proforma invoice', pattern: /\bproforma invoice\b|\bpi no\b/i, weight: 3, strong: true },
  { label: 'commercial invoice', pattern: /\bcommercial invoice\b|\binvoice no\b/i, weight: 3, strong: true },
  { label: 'bill of lading', pattern: /\bbill of lading\b|\bbl no\b/i, weight: 3, strong: true },
  { label: 'packing list', pattern: /\bpacking list\b/i, weight: 3, strong: true },
  { label: 'shipment', pattern: /\bshipment\b|\bship date\b|\betd\b/i, weight: 2, strong: true },
  { label: 'quote', pattern: /\bquotation\b|\bquote\b|\brfq\b/i, weight: 1 },
  { label: 'incoterm', pattern: /\bfob\b|\bcif\b|\bincoterm\b/i, weight: 2, strong: true },
  { label: 'deposit', pattern: /\bdeposit\b|\bswift copy\b|\bpayment proof\b/i, weight: 2, strong: true },
];

const saasSignals: SignalDefinition[] = [
  { label: 'invoice', pattern: /\binvoice\b|\bbilling statement\b/i, weight: 2, strong: true },
  { label: 'payment failed', pattern: /\bpayment failed\b|\bcard declined\b|\bpast due\b/i, weight: 3, strong: true },
  { label: 'subscription', pattern: /\bsubscription\b|\bplan\b|\bseat\b/i, weight: 2, strong: true },
  { label: 'renewal', pattern: /\brenewal\b|\bauto-renew\b/i, weight: 2, strong: true },
  { label: 'refund', pattern: /\brefund\b|\bcredit memo\b/i, weight: 2, strong: true },
  { label: 'contract', pattern: /\bmsa\b|\border form\b|\bcontract signed\b/i, weight: 3, strong: true },
  { label: 'stripe', pattern: /\bstripe\b/i, weight: 2, strong: true },
  { label: 'chargebee', pattern: /\bchargebee\b/i, weight: 2, strong: true },
  { label: 'lemonsqueezy', pattern: /\blemonsqueezy\b/i, weight: 2, strong: true },
];

const docTypePatterns: Array<{ docType: string; pattern: RegExp }> = [
  { docType: 'purchase_order', pattern: /\bpurchase order\b|\bpo no\b/i },
  { docType: 'proforma_invoice', pattern: /\bproforma invoice\b|\bpi no\b/i },
  { docType: 'commercial_invoice', pattern: /\bcommercial invoice\b|\binvoice no\b/i },
  { docType: 'bill_of_lading', pattern: /\bbill of lading\b|\bbl no\b/i },
  { docType: 'packing_list', pattern: /\bpacking list\b/i },
  { docType: 'subscription_invoice', pattern: /\bsubscription invoice\b|\bbilling statement\b/i },
  { docType: 'order_form', pattern: /\border form\b|\bquote accepted\b/i },
  { docType: 'contract', pattern: /\bmsa\b|\bcontract signed\b/i },
  { docType: 'payment_failure_notice', pattern: /\bpayment failed\b|\bcard declined\b|\bpast due\b/i },
];

const buildCorpus = (thread: NormalizedThread): string =>
  [
    thread.subject,
    thread.account,
    ...thread.messages.map((message) => `${message.sender} ${message.subject} ${message.body}`),
    ...thread.attachments.map((attachment) => `${attachment.fileName} ${attachment.text}`),
  ]
    .join(' ')
    .toLowerCase();

const collectMatchedDocTypes = (thread: NormalizedThread): string[] => {
  const matched = new Set<string>();

  for (const attachment of thread.attachments) {
    const haystack = `${attachment.fileName} ${attachment.text}`;
    for (const pattern of docTypePatterns) {
      if (pattern.pattern.test(haystack)) {
        matched.add(pattern.docType);
      }
    }
  }

  return [...matched];
};

const analyzeSignals = (
  thread: NormalizedThread,
  signals: SignalDefinition[],
): Pick<QualificationResult, 'matchedKeywords' | 'matchedDocTypes'> & {
  signalScore: number;
  strongSignalCount: number;
  attachmentCount: number;
} => {
  const corpus = buildCorpus(thread);
  const matchedSignals = signals.filter((signal) => signal.pattern.test(corpus));

  return {
    matchedKeywords: matchedSignals.map((signal) => signal.label),
    matchedDocTypes: collectMatchedDocTypes(thread),
    signalScore: matchedSignals.reduce((sum, signal) => sum + signal.weight, 0),
    strongSignalCount: matchedSignals.filter((signal) => signal.strong).length,
    attachmentCount: thread.attachments.length,
  };
};

const qualifyTrade = (thread: NormalizedThread): QualificationResult => {
  const analysis = analyzeSignals(thread, tradeSignals);
  const score = analysis.matchedDocTypes.length * 4 + analysis.signalScore + (analysis.attachmentCount > 0 ? 1 : 0);

  if (analysis.matchedDocTypes.length > 0) {
    return {
      qualified: true,
      score,
      rule: 'doc_match',
      explanation: 'Recognizable trade documents were found in the thread.',
      matchedKeywords: analysis.matchedKeywords,
      matchedDocTypes: analysis.matchedDocTypes,
    };
  }

  if (analysis.signalScore >= 2 && analysis.attachmentCount > 0) {
    return {
      qualified: true,
      score,
      rule: 'keyword_attachment',
      explanation: 'Trade workflow language plus at least one attachment was found.',
      matchedKeywords: analysis.matchedKeywords,
      matchedDocTypes: analysis.matchedDocTypes,
    };
  }

  if (analysis.signalScore >= 4 && analysis.strongSignalCount >= 1) {
    return {
      qualified: true,
      score,
      rule: 'keyword_density',
      explanation: 'Multiple trade workflow signals were found in the thread.',
      matchedKeywords: analysis.matchedKeywords,
      matchedDocTypes: analysis.matchedDocTypes,
    };
  }

  return {
    qualified: false,
    score,
    rule: 'rejected',
    explanation: 'The thread does not look like a trade workflow case.',
    matchedKeywords: analysis.matchedKeywords,
    matchedDocTypes: analysis.matchedDocTypes,
  };
};

const qualifySaasRevenue = (thread: NormalizedThread): QualificationResult => {
  const analysis = analyzeSignals(thread, saasSignals);
  const providerSignalCount = analysis.matchedKeywords.filter((keyword) =>
    ['stripe', 'chargebee', 'lemonsqueezy'].includes(keyword),
  ).length;
  const score =
    analysis.matchedDocTypes.length * 4 +
    analysis.signalScore +
    providerSignalCount * 2 +
    (analysis.attachmentCount > 0 ? 1 : 0);

  if (analysis.matchedDocTypes.some((docType) =>
    ['subscription_invoice', 'order_form', 'contract', 'payment_failure_notice'].includes(docType),
  )) {
    return {
      qualified: true,
      score,
      rule: 'doc_match',
      explanation: 'Recognizable revenue or contract documents were found in the thread.',
      matchedKeywords: analysis.matchedKeywords,
      matchedDocTypes: analysis.matchedDocTypes,
    };
  }

  if (providerSignalCount > 0 && analysis.signalScore >= 4) {
    return {
      qualified: true,
      score,
      rule: 'provider_signal',
      explanation: 'Billing-provider signals and revenue workflow language were found.',
      matchedKeywords: analysis.matchedKeywords,
      matchedDocTypes: analysis.matchedDocTypes,
    };
  }

  if (analysis.signalScore >= 5 && analysis.strongSignalCount >= 2) {
    return {
      qualified: true,
      score,
      rule: analysis.attachmentCount > 0 ? 'keyword_attachment' : 'keyword_density',
      explanation: 'Multiple revenue workflow signals were found in the thread.',
      matchedKeywords: analysis.matchedKeywords,
      matchedDocTypes: analysis.matchedDocTypes,
    };
  }

  return {
    qualified: false,
    score,
    rule: 'rejected',
    explanation: 'The thread does not look like a revenue workflow case.',
    matchedKeywords: analysis.matchedKeywords,
    matchedDocTypes: analysis.matchedDocTypes,
  };
};

export const qualifyThread = (
  thread: NormalizedThread,
  casePackId: CasePackId,
): QualificationResult =>
  casePackId === 'saas_revenue_order' ? qualifySaasRevenue(thread) : qualifyTrade(thread);
