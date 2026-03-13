import type { WorkflowStatus } from '../types';

export type CasePackId =
  | 'external_trade_order'
  | 'saas_revenue_order'
  | 'accounts_payable_intake'
  | 'accounts_receivable_collection'
  | 'recruiting_pipeline'
  | 'customer_support_escalation'
  | 'procurement_request'
  | 'inbound_sales_rfq'
  | 'partnership_lead'
  | 'vendor_onboarding_compliance'
  | 'contract_review_approval'
  | 'agency_client_delivery';

export interface CasePackDefinition {
  id: CasePackId;
  name: string;
  status: 'active' | 'ready' | 'planned';
  description: string;
  audience: string;
  outputTargets: Array<'notion' | 'feishu_bitable'>;
  examples: string[];
  category: string;
  heroTitle: string;
  heroCopy: string;
  boardTitle: string;
  boardCopy: string;
  filterTitle: string;
  filterCopy: string;
  qualificationRules: string[];
  assistantPrompts: string[];
  emptyStateTitle: string;
  emptyStateCopy: string;
  gmailQueryHint: string;
  modeLabel: string;
  statusLabels?: Partial<Record<WorkflowStatus, string>>;
}

export const activeCasePackId: CasePackId = 'external_trade_order';

export const casePacks: CasePackDefinition[] = [
  {
    id: 'external_trade_order',
    name: 'External Trade Order',
    status: 'active',
    description:
      'Turn Gmail threads into Quote / PI / PO / shipment cases for export sales and documentation teams.',
    audience: 'External trade sales coordinator, merchandiser, export docs',
    outputTargets: ['notion', 'feishu_bitable'],
    examples: ['Quote request', 'PO confirmation', 'PI follow-up', 'Shipping document exception'],
    category: 'Orders',
    heroTitle: 'Turn external-trade inbox threads into visible order state.',
    heroCopy:
      'Connect Gmail once, keep only order-like trade threads, and review them as cases instead of scanning raw email history.',
    boardTitle: 'Order-state board',
    boardCopy:
      'The board keeps only threads that look like RFQ, PI, PO, invoice, or shipment work.',
    filterTitle: 'External-trade inbox filter',
    filterCopy:
      'TradeCase keeps only the threads that look like quote, PI, PO, invoice, BL, packing list, or shipment coordination work.',
    qualificationRules: [
      'Recognized trade document attachment: PO, PI, invoice, BL, packing list.',
      'One trade keyword plus at least one attachment.',
      'Two or more trade workflow keywords in subject or body.',
    ],
    assistantPrompts: [
      'Show me all cases blocked on customer confirmation.',
      'Which cases are missing packing lists?',
      'Summarize Harbor Supply AU.',
      'Draft a follow-up for Lakefront Living.',
    ],
    emptyStateTitle: 'No trade-order cases are on the board yet.',
    emptyStateCopy:
      'Connect Gmail to backfill recent threads and keep only trade workflow emails like quotes, POs, invoices, and shipment exceptions.',
    gmailQueryHint:
      'Try widening Gmail scope toward quote, po, invoice, packing list, or shipping threads if your order history is older.',
    modeLabel: 'Trade order mode',
  },
  {
    id: 'saas_revenue_order',
    name: 'SaaS Revenue Order',
    status: 'active',
    description:
      'Turn revenue emails into active cases for invoicing, payment failures, renewals, contracts, and customer provisioning.',
    audience: 'Founders, revenue ops, finance ops, customer success',
    outputTargets: ['notion', 'feishu_bitable'],
    examples: ['Invoice issued', 'Payment failed', 'Order form signed', 'Renewal at risk'],
    category: 'Revenue Ops',
    heroTitle: 'Turn billing and contract emails into a revenue operations board.',
    heroCopy:
      'Connect Gmail once, keep only invoice, contract, renewal, and payment-issue threads, and review them as cases instead of losing them in the inbox.',
    boardTitle: 'Revenue-ops board',
    boardCopy:
      'The board keeps only threads that look like contracts, invoices, payment failures, renewals, refunds, and provisioning work.',
    filterTitle: 'Revenue-email inbox filter',
    filterCopy:
      'TradeCase keeps only the threads that look like customer billing, subscription, renewal, contract, or provisioning work.',
    qualificationRules: [
      'Recognized SaaS revenue document: invoice, order form, contract, payment-failure notice.',
      'Billing provider or contract signal plus lifecycle keywords such as paid, overdue, renewal, upgrade, or refund.',
      'Two or more revenue workflow signals in subject or body.',
    ],
    assistantPrompts: [
      'Show me all customers blocked on payment.',
      'Which renewals look at risk this week?',
      'Summarize the Acme contract thread.',
      'Draft a billing follow-up for Northstar.',
    ],
    emptyStateTitle: 'No revenue-operation cases are on the board yet.',
    emptyStateCopy:
      'Connect Gmail to backfill invoice, contract, payment-failure, and renewal threads into a revenue queue.',
    gmailQueryHint:
      'Try syncing billing provider, invoice, renewal, subscription, contract, or payment-failed threads if your revenue signals live in different folders.',
    modeLabel: 'Revenue order mode',
    statusLabels: {
      inquiry_received: 'Revenue event received',
      quote_prepared: 'Offer or checkout prepared',
      quote_sent: 'Invoice issued',
      purchase_order_received: 'Contract signed',
      awaiting_payment: 'Awaiting payment',
      shipment_preparation: 'Provisioning scheduled',
      shipment_in_progress: 'Subscription active',
      documentation_exception: 'Revenue issue',
    },
  },
  {
    id: 'accounts_payable_intake',
    name: 'Accounts Payable Intake',
    status: 'ready',
    description:
      'Capture vendor invoices, payment proofs, and approval requests from finance inboxes into a payable queue.',
    audience: 'AP finance team',
    outputTargets: ['notion', 'feishu_bitable'],
    examples: ['Invoice received', 'Payment proof missing', 'Approval escalation'],
    category: 'Finance',
    heroTitle: 'Turn finance inboxes into an AP exception queue.',
    heroCopy: 'Keep vendor invoices, payment proofs, and approval blockers on one board.',
    boardTitle: 'AP intake board',
    boardCopy: 'Review invoice intake, missing remittance, and approval blockers.',
    filterTitle: 'AP inbox filter',
    filterCopy: 'Keep only finance threads that look like payable work.',
    qualificationRules: ['Invoice markers', 'Vendor payable language', 'Approval and payment proof signals'],
    assistantPrompts: ['Show me unpaid vendor invoices.'],
    emptyStateTitle: 'No AP cases yet.',
    emptyStateCopy: 'Connect Gmail and start with vendor invoice threads.',
    gmailQueryHint: 'Invoice, remittance, payable, approval, vendor',
    modeLabel: 'AP mode',
  },
  {
    id: 'accounts_receivable_collection',
    name: 'Accounts Receivable Collection',
    status: 'ready',
    description:
      'Turn invoice delivery, payment reminders, remittance proofs, and overdue follow-ups into collection cases.',
    audience: 'AR finance team, founders, sales ops',
    outputTargets: ['notion', 'feishu_bitable'],
    examples: ['Invoice delivered', 'Remittance received', 'Overdue follow-up', 'Dispute pending'],
    category: 'Finance',
    heroTitle: 'Turn AR mail into a collection queue.',
    heroCopy: 'Keep overdue reminders, remittance proofs, and disputes visible.',
    boardTitle: 'AR collection board',
    boardCopy: 'Review invoice delivery, payment proof, and overdue signals.',
    filterTitle: 'AR inbox filter',
    filterCopy: 'Keep only receivable and collection threads.',
    qualificationRules: ['Invoice and remittance signals', 'Overdue reminders', 'Collection follow-ups'],
    assistantPrompts: ['Show me overdue invoices.'],
    emptyStateTitle: 'No AR cases yet.',
    emptyStateCopy: 'Connect Gmail and sync invoice delivery and collection threads.',
    gmailQueryHint: 'Invoice, payment, remittance, overdue, collection',
    modeLabel: 'AR mode',
  },
  {
    id: 'recruiting_pipeline',
    name: 'Recruiting Pipeline',
    status: 'ready',
    description:
      'Convert inbound candidate threads, resume attachments, and interview scheduling into recruiting cases.',
    audience: 'Talent acquisition, hiring managers',
    outputTargets: ['notion', 'feishu_bitable'],
    examples: ['New applicant', 'Resume review', 'Interview scheduling'],
    category: 'People Ops',
    heroTitle: 'Turn hiring emails into a recruiting board.',
    heroCopy: 'Keep applicants, resumes, interview scheduling, and offer threads in one queue.',
    boardTitle: 'Recruiting board',
    boardCopy: 'Review applicants, interview scheduling, and offer blockers.',
    filterTitle: 'Recruiting inbox filter',
    filterCopy: 'Keep only hiring threads.',
    qualificationRules: ['Resume attachments', 'Interview language', 'Applicant status markers'],
    assistantPrompts: ['Show me candidates waiting for interview feedback.'],
    emptyStateTitle: 'No recruiting cases yet.',
    emptyStateCopy: 'Connect Gmail and sync applicant threads.',
    gmailQueryHint: 'Candidate, resume, interview, applicant, offer',
    modeLabel: 'Recruiting mode',
  },
  {
    id: 'customer_support_escalation',
    name: 'Customer Support Escalation',
    status: 'ready',
    description:
      'Map support inbox threads into issue cases with SLA, owner, severity, and follow-up state.',
    audience: 'Support operations',
    outputTargets: ['notion', 'feishu_bitable'],
    examples: ['Refund request', 'Bug escalation', 'Priority customer issue'],
    category: 'Support',
    heroTitle: 'Turn support mail into an escalation queue.',
    heroCopy: 'Keep refunds, bugs, and customer issues visible and assigned.',
    boardTitle: 'Support escalation board',
    boardCopy: 'Review SLA blockers, refunds, and bugs.',
    filterTitle: 'Support inbox filter',
    filterCopy: 'Keep only issue and escalation threads.',
    qualificationRules: ['Refund or bug markers', 'Priority customer signals', 'Escalation keywords'],
    assistantPrompts: ['Show me urgent support escalations.'],
    emptyStateTitle: 'No support cases yet.',
    emptyStateCopy: 'Connect Gmail and sync support escalation threads.',
    gmailQueryHint: 'Refund, bug, issue, escalation, outage',
    modeLabel: 'Support mode',
  },
  {
    id: 'procurement_request',
    name: 'Procurement Request',
    status: 'ready',
    description:
      'Turn vendor outreach, quote comparisons, and internal approvals into sourcing cases.',
    audience: 'Procurement and operations teams',
    outputTargets: ['notion', 'feishu_bitable'],
    examples: ['Supplier quote intake', 'MOQ comparison', 'Approval blocked'],
    category: 'Operations',
    heroTitle: 'Turn sourcing mail into a procurement queue.',
    heroCopy: 'Keep supplier quotes, MOQ comparisons, and approvals visible.',
    boardTitle: 'Procurement board',
    boardCopy: 'Review sourcing requests, quotes, and approvals.',
    filterTitle: 'Procurement inbox filter',
    filterCopy: 'Keep only sourcing and supplier threads.',
    qualificationRules: ['Quote markers', 'Supplier onboarding signals', 'Approval blockers'],
    assistantPrompts: ['Show me procurement requests blocked on approval.'],
    emptyStateTitle: 'No procurement cases yet.',
    emptyStateCopy: 'Connect Gmail and sync supplier quote and approval threads.',
    gmailQueryHint: 'Supplier, quote, rfq, procurement, approval',
    modeLabel: 'Procurement mode',
  },
  {
    id: 'inbound_sales_rfq',
    name: 'Inbound Sales RFQ',
    status: 'ready',
    description:
      'Convert RFQs, quote requests, attachment specs, and follow-up chains into visible sales opportunity cases.',
    audience: 'B2B sales team, solution engineers',
    outputTargets: ['notion', 'feishu_bitable'],
    examples: ['New RFQ', 'Spec sheet attached', 'Quote pending', 'Buyer clarification'],
    category: 'Sales',
    heroTitle: 'Turn RFQ mail into visible pipeline.',
    heroCopy: 'Keep quote requests, technical specs, and buyer follow-up in one board.',
    boardTitle: 'RFQ board',
    boardCopy: 'Review quote requests, buyer clarification, and quote blockers.',
    filterTitle: 'RFQ inbox filter',
    filterCopy: 'Keep only inbound sales RFQ threads.',
    qualificationRules: ['RFQ signals', 'Spec attachments', 'Quote follow-up keywords'],
    assistantPrompts: ['Show me RFQs waiting for quote.'],
    emptyStateTitle: 'No RFQ cases yet.',
    emptyStateCopy: 'Connect Gmail and sync quote-request threads.',
    gmailQueryHint: 'RFQ, quote request, spec, proposal',
    modeLabel: 'Sales RFQ mode',
  },
  {
    id: 'partnership_lead',
    name: 'Partnership Lead',
    status: 'planned',
    description:
      'Track inbound BD requests, collab proposals, and channel partner threads as structured deal cases.',
    audience: 'Business development',
    outputTargets: ['notion', 'feishu_bitable'],
    examples: ['Inbound partnership request', 'Reseller negotiation', 'Joint campaign follow-up'],
    category: 'BD',
    heroTitle: 'Turn partner mail into a BD queue.',
    heroCopy: 'Keep reseller, collab, and channel discussions visible.',
    boardTitle: 'Partnership board',
    boardCopy: 'Review partnership opportunities and blockers.',
    filterTitle: 'Partnership inbox filter',
    filterCopy: 'Keep only partnership and channel threads.',
    qualificationRules: ['Partnership proposals', 'Reseller terms', 'BD follow-up'],
    assistantPrompts: ['Show me partner leads waiting for reply.'],
    emptyStateTitle: 'No partnership cases yet.',
    emptyStateCopy: 'Connect Gmail and sync partnership threads.',
    gmailQueryHint: 'Partner, reseller, channel, collaboration',
    modeLabel: 'Partnership mode',
  },
  {
    id: 'vendor_onboarding_compliance',
    name: 'Vendor Onboarding Compliance',
    status: 'planned',
    description:
      'Track supplier onboarding, qualification documents, bank forms, and compliance chases as structured cases.',
    audience: 'Finance ops, procurement ops, compliance',
    outputTargets: ['notion', 'feishu_bitable'],
    examples: ['Bank form missing', 'Tax document pending', 'Supplier onboarding blocked'],
    category: 'Compliance',
    heroTitle: 'Turn vendor onboarding mail into a compliance queue.',
    heroCopy: 'Keep tax, bank, and supplier qualification documents visible.',
    boardTitle: 'Vendor onboarding board',
    boardCopy: 'Review supplier onboarding blockers and missing forms.',
    filterTitle: 'Vendor onboarding inbox filter',
    filterCopy: 'Keep only onboarding and compliance threads.',
    qualificationRules: ['Tax and bank form signals', 'Supplier onboarding blockers'],
    assistantPrompts: ['Show me suppliers missing compliance docs.'],
    emptyStateTitle: 'No vendor onboarding cases yet.',
    emptyStateCopy: 'Connect Gmail and sync vendor onboarding threads.',
    gmailQueryHint: 'W-8, bank form, supplier onboarding, compliance',
    modeLabel: 'Vendor onboarding mode',
  },
  {
    id: 'contract_review_approval',
    name: 'Contract Review Approval',
    status: 'planned',
    description:
      'Map contract redlines, approval requests, signature blockers, and version exchanges into legal review cases.',
    audience: 'Legal ops, finance approvers, business owners',
    outputTargets: ['notion', 'feishu_bitable'],
    examples: ['MSA redline received', 'Approval blocked', 'Signature pending'],
    category: 'Legal',
    heroTitle: 'Turn contract mail into a review queue.',
    heroCopy: 'Keep redlines, approvals, and signature blockers in one board.',
    boardTitle: 'Contract review board',
    boardCopy: 'Review contracts, redlines, and approval blockers.',
    filterTitle: 'Contract inbox filter',
    filterCopy: 'Keep only contract and approval threads.',
    qualificationRules: ['Redline markers', 'Signature blockers', 'Approval requests'],
    assistantPrompts: ['Show me contracts waiting for approval.'],
    emptyStateTitle: 'No contract cases yet.',
    emptyStateCopy: 'Connect Gmail and sync contract-review threads.',
    gmailQueryHint: 'MSA, NDA, contract, approval, signature',
    modeLabel: 'Contract mode',
  },
  {
    id: 'agency_client_delivery',
    name: 'Agency Client Delivery',
    status: 'planned',
    description:
      'Turn client briefs, asset approvals, revision requests, and delivery confirmations into execution cases.',
    audience: 'Agency account managers, project delivery teams',
    outputTargets: ['notion', 'feishu_bitable'],
    examples: ['Creative brief intake', 'Revision round', 'Delivery approved'],
    category: 'Delivery',
    heroTitle: 'Turn client mail into a delivery queue.',
    heroCopy: 'Keep briefs, revision rounds, and approvals visible.',
    boardTitle: 'Client delivery board',
    boardCopy: 'Review project briefs, revisions, and approvals.',
    filterTitle: 'Delivery inbox filter',
    filterCopy: 'Keep only client execution and approval threads.',
    qualificationRules: ['Brief and revision markers', 'Client delivery approvals'],
    assistantPrompts: ['Show me client deliverables waiting on approval.'],
    emptyStateTitle: 'No delivery cases yet.',
    emptyStateCopy: 'Connect Gmail and sync client delivery threads.',
    gmailQueryHint: 'Brief, revision, approval, delivery',
    modeLabel: 'Delivery mode',
  },
];

export const activeCasePack =
  casePacks.find((item) => item.id === activeCasePackId) ?? casePacks[0]!;

export const getCasePackById = (casePackId?: string | null): CasePackDefinition =>
  casePacks.find((item) => item.id === casePackId) ?? activeCasePack;

export const getCasePackStatusLabel = (
  casePackId: string | null | undefined,
  status: WorkflowStatus,
): string => {
  const casePack = getCasePackById(casePackId);
  return casePack.statusLabels?.[status] ?? defaultStatusLabels[status];
};

const defaultStatusLabels: Record<WorkflowStatus, string> = {
  inquiry_received: 'Inquiry received',
  quote_prepared: 'Quote prepared',
  quote_sent: 'Quote sent',
  purchase_order_received: 'Purchase order received',
  awaiting_payment: 'Awaiting payment',
  shipment_preparation: 'Shipment preparation',
  shipment_in_progress: 'Shipment in progress',
  documentation_exception: 'Documentation exception',
};
