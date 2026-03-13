import type { WorkflowStep } from '../types';

export const workflowBlueprint: WorkflowStep[] = [
  {
    status: 'inquiry_received',
    title: 'Inquiry received',
    outcome: 'A buyer request or product ask has entered the inbox.',
    keyDocs: ['inquiry_note'],
  },
  {
    status: 'quote_prepared',
    title: 'Quote prepared',
    outcome: 'Sales has enough data to assemble a price and delivery proposal.',
    keyDocs: ['quote'],
  },
  {
    status: 'quote_sent',
    title: 'Quote sent',
    outcome: 'The customer has received pricing and commercial terms.',
    keyDocs: ['quote', 'proforma_invoice'],
  },
  {
    status: 'purchase_order_received',
    title: 'Purchase order received',
    outcome: 'The customer has confirmed purchase intent with a PO or equivalent order confirmation.',
    keyDocs: ['purchase_order', 'proforma_invoice'],
  },
  {
    status: 'awaiting_payment',
    title: 'Awaiting payment or confirmation',
    outcome: 'The trade case is blocked on payment proof, deposit, or final sign-off.',
    keyDocs: ['proforma_invoice', 'payment_proof', 'commercial_invoice'],
  },
  {
    status: 'shipment_preparation',
    title: 'Shipment preparation',
    outcome: 'The team is packaging, booking, or assembling export documents.',
    keyDocs: ['commercial_invoice', 'packing_list', 'shipping_instruction'],
  },
  {
    status: 'shipment_in_progress',
    title: 'Shipment in progress',
    outcome: 'Goods are booked or moving, and transport documents are active.',
    keyDocs: ['bill_of_lading', 'commercial_invoice', 'packing_list'],
  },
  {
    status: 'documentation_exception',
    title: 'Documentation exception',
    outcome: 'A required field or document is missing, inconsistent, or blocked.',
    keyDocs: ['commercial_invoice', 'packing_list', 'bill_of_lading'],
  },
];
