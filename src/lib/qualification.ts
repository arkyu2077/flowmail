import type { DocType, TradeCase } from '../types';
import { classifyAttachment } from './analysis';
import { getCasePackById, type CasePackId } from './case-packs';

type SignalDefinition = {
  label: string;
  pattern: RegExp;
  weight: number;
  strong?: boolean;
};

const tradeKeywordPatterns: SignalDefinition[] = [
  { label: 'quote', pattern: /\b(?:quotation|quote for|price quote)\b/i, weight: 1 },
  { label: 'purchase order', pattern: /\bpurchase order\b/i, weight: 3, strong: true },
  { label: 'po number', pattern: /\bpo(?:\s*(?:no|number))\s*(?::|#|-)\s*[a-z0-9-]{3,}/i, weight: 3, strong: true },
  { label: 'proforma invoice', pattern: /\bproforma invoice\b/i, weight: 3, strong: true },
  { label: 'pi number', pattern: /\bpi(?:\s*(?:no|number))\s*(?::|#|-)\s*[a-z0-9-]{3,}/i, weight: 3, strong: true },
  { label: 'invoice', pattern: /\bcommercial invoice\b|\binvoice no\b/i, weight: 3, strong: true },
  { label: 'bill of lading', pattern: /\bbill of lading\b|\bbl no\b/i, weight: 3, strong: true },
  { label: 'packing list', pattern: /\bpacking list\b/i, weight: 3, strong: true },
  { label: 'shipment', pattern: /\bshipment\b|\bship date\b/i, weight: 1 },
  { label: 'etd', pattern: /\betd\b/i, weight: 2, strong: true },
  { label: 'fob', pattern: /\bfob\b/i, weight: 2, strong: true },
  { label: 'cif', pattern: /\bcif\b/i, weight: 2, strong: true },
  { label: 'incoterm', pattern: /\bincoterm\b/i, weight: 2, strong: true },
  { label: 'deposit', pattern: /\bdeposit\b/i, weight: 2, strong: true },
  { label: 'lead time', pattern: /\blead time\b/i, weight: 2, strong: true },
];

const saasKeywordPatterns: SignalDefinition[] = [
  { label: 'invoice issued', pattern: /\binvoice\b|\bbilling statement\b/i, weight: 2, strong: true },
  { label: 'payment failed', pattern: /\bpayment failed\b|\bcard declined\b|\bpast due\b/i, weight: 3, strong: true },
  { label: 'subscription', pattern: /\bsubscription\b|\bplan\b|\bseat count\b/i, weight: 2, strong: true },
  { label: 'renewal', pattern: /\brenewal\b|\bauto-renew\b/i, weight: 2, strong: true },
  { label: 'upgrade', pattern: /\bupgrade\b|\bdowngrade\b/i, weight: 1 },
  { label: 'refund', pattern: /\brefund\b|\bcredit memo\b/i, weight: 2, strong: true },
  { label: 'contract', pattern: /\bmsa\b|\border form\b|\bcontract signed\b|\bquote accepted\b/i, weight: 3, strong: true },
  { label: 'stripe', pattern: /\bstripe\b/i, weight: 2, strong: true },
  { label: 'paddle', pattern: /\bpaddle\b/i, weight: 2, strong: true },
  { label: 'lemonsqueezy', pattern: /\blemonsqueezy\b/i, weight: 2, strong: true },
  { label: 'chargebee', pattern: /\bchargebee\b/i, weight: 2, strong: true },
  { label: 'recurly', pattern: /\brecurly\b/i, weight: 2, strong: true },
  { label: 'provisioning', pattern: /\bprovisioning\b|\bworkspace created\b|\baccount activated\b/i, weight: 1 },
];

export interface TradeQualification {
  qualified: boolean;
  score: number;
  matchedKeywords: string[];
  matchedDocTypes: DocType[];
  attachmentCount: number;
  rule: 'doc_match' | 'keyword_attachment' | 'keyword_density' | 'provider_signal' | 'rejected';
  explanation: string;
}

const buildCorpus = (tradeCase: TradeCase): string =>
  [
    tradeCase.label,
    tradeCase.account,
    ...tradeCase.messages.map((message) => `${message.sender} ${message.subject} ${message.body}`),
    ...tradeCase.attachments.map((attachment) => `${attachment.fileName} ${attachment.text}`),
  ]
    .join(' ')
    .toLowerCase();

const analyzeSignals = (tradeCase: TradeCase, signals: SignalDefinition[]) => {
  const corpus = buildCorpus(tradeCase);
  const matchedSignals = signals.filter(({ pattern }) => pattern.test(corpus));
  const matchedKeywords = matchedSignals.map(({ label }) => label);
  const matchedDocTypes = tradeCase.attachments
    .map(classifyAttachment)
    .map((document) => document.docType)
    .filter((docType) => docType !== 'unknown');

  const uniqueDocTypes = [...new Set(matchedDocTypes)];
  const attachmentCount = tradeCase.attachments.length;
  const signalScore = matchedSignals.reduce((sum, signal) => sum + signal.weight, 0);
  const strongSignalCount = matchedSignals.filter((signal) => signal.strong).length;

  return {
    corpus,
    matchedKeywords,
    matchedDocTypes: uniqueDocTypes,
    attachmentCount,
    signalScore,
    strongSignalCount,
  };
};

const analyzeTradeCaseQualification = (tradeCase: TradeCase): TradeQualification => {
  const result = analyzeSignals(tradeCase, tradeKeywordPatterns);
  const documentHits = result.matchedDocTypes.length;
  const score = documentHits * 4 + result.signalScore + (result.attachmentCount > 0 ? 1 : 0);

  if (documentHits > 0) {
    return {
      qualified: true,
      score,
      matchedKeywords: result.matchedKeywords,
      matchedDocTypes: result.matchedDocTypes,
      attachmentCount: result.attachmentCount,
      rule: 'doc_match',
      explanation: 'Included because a recognizable trade document was found in the thread.',
    };
  }

  if (result.signalScore >= 2 && result.attachmentCount > 0) {
    return {
      qualified: true,
      score,
      matchedKeywords: result.matchedKeywords,
      matchedDocTypes: result.matchedDocTypes,
      attachmentCount: result.attachmentCount,
      rule: 'keyword_attachment',
      explanation: 'Included because the thread has a trade keyword plus at least one attachment.',
    };
  }

  if (result.signalScore >= 4 && result.strongSignalCount >= 1) {
    return {
      qualified: true,
      score,
      matchedKeywords: result.matchedKeywords,
      matchedDocTypes: result.matchedDocTypes,
      attachmentCount: result.attachmentCount,
      rule: 'keyword_density',
      explanation: 'Included because the subject and body contain multiple trade workflow signals.',
    };
  }

  return {
    qualified: false,
    score,
    matchedKeywords: result.matchedKeywords,
    matchedDocTypes: result.matchedDocTypes,
    attachmentCount: result.attachmentCount,
    rule: 'rejected',
    explanation: 'Excluded because the thread lacks enough trade workflow evidence.',
  };
};

const saasRevenueDocTypes: DocType[] = [
  'subscription_invoice',
  'order_form',
  'contract',
  'payment_failure_notice',
];

const analyzeSaasRevenueQualification = (tradeCase: TradeCase): TradeQualification => {
  const result = analyzeSignals(tradeCase, saasKeywordPatterns);
  const matchedRevenueDocs = result.matchedDocTypes.filter((docType) =>
    saasRevenueDocTypes.includes(docType),
  );
  const providerSignals = result.matchedKeywords.filter((keyword) =>
    ['stripe', 'paddle', 'lemonsqueezy', 'chargebee', 'recurly'].includes(keyword),
  );
  const score =
    matchedRevenueDocs.length * 4 +
    result.signalScore +
    providerSignals.length * 2 +
    (result.attachmentCount > 0 ? 1 : 0);

  if (matchedRevenueDocs.length > 0) {
    return {
      qualified: true,
      score,
      matchedKeywords: result.matchedKeywords,
      matchedDocTypes: result.matchedDocTypes,
      attachmentCount: result.attachmentCount,
      rule: 'doc_match',
      explanation: 'Included because the thread contains a recognizable revenue or contract document.',
    };
  }

  if (providerSignals.length > 0 && result.signalScore >= 4) {
    return {
      qualified: true,
      score,
      matchedKeywords: result.matchedKeywords,
      matchedDocTypes: result.matchedDocTypes,
      attachmentCount: result.attachmentCount,
      rule: 'provider_signal',
      explanation: 'Included because the thread contains billing-provider or contract signals plus revenue workflow language.',
    };
  }

  if (result.signalScore >= 5 && result.strongSignalCount >= 2) {
    return {
      qualified: true,
      score,
      matchedKeywords: result.matchedKeywords,
      matchedDocTypes: result.matchedDocTypes,
      attachmentCount: result.attachmentCount,
      rule: result.attachmentCount > 0 ? 'keyword_attachment' : 'keyword_density',
      explanation: 'Included because the subject and body contain multiple revenue workflow signals.',
    };
  }

  return {
    qualified: false,
    score,
    matchedKeywords: result.matchedKeywords,
    matchedDocTypes: result.matchedDocTypes,
    attachmentCount: result.attachmentCount,
    rule: 'rejected',
    explanation: 'Excluded because the thread lacks enough revenue workflow evidence.',
  };
};

export const analyzeCaseQualification = (
  tradeCase: TradeCase,
  casePackId: CasePackId = 'external_trade_order',
): TradeQualification => {
  switch (casePackId) {
    case 'saas_revenue_order':
      return analyzeSaasRevenueQualification(tradeCase);
    default:
      return analyzeTradeCaseQualification(tradeCase);
  }
};

export const analyzeTradeQualification = (tradeCase: TradeCase): TradeQualification =>
  analyzeCaseQualification(tradeCase, 'external_trade_order');

export const getCasePackQualificationRules = (casePackId: CasePackId): string[] =>
  getCasePackById(casePackId).qualificationRules;
