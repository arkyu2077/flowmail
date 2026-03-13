import type { CasePackId, WorkflowStatus } from '../types';

export interface CasePackDefinition {
  id: CasePackId;
  name: string;
  statusLabels: Record<WorkflowStatus, string>;
}

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

export const casePacks: Record<CasePackId, CasePackDefinition> = {
  external_trade_order: {
    id: 'external_trade_order',
    name: 'External Trade Order',
    statusLabels: defaultStatusLabels,
  },
  saas_revenue_order: {
    id: 'saas_revenue_order',
    name: 'SaaS Revenue Order',
    statusLabels: {
      ...defaultStatusLabels,
      inquiry_received: 'Revenue event received',
      quote_prepared: 'Offer prepared',
      quote_sent: 'Invoice issued',
      purchase_order_received: 'Contract signed',
      shipment_preparation: 'Provisioning scheduled',
      shipment_in_progress: 'Subscription active',
      documentation_exception: 'Revenue issue',
    },
  },
};

export const getCasePack = (casePackId: CasePackId): CasePackDefinition => casePacks[casePackId];
