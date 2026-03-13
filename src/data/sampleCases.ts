import type { TradeCase } from '../types';

export const sampleCases: TradeCase[] = [
  {
    id: 'case-eu-quote',
    label: 'EU buyer asking for first quote',
    account: 'Nordic Home Retail',
    region: 'EU',
    messages: [
      {
        id: 'msg-1',
        sender: 'anna@nordichome.eu',
        recipients: ['sales@sunstream-trade.com'],
        sentAt: '2026-03-10T09:15:00Z',
        subject: 'Need quotation for bamboo tray set',
        body:
          'Hi team, we need a quote for bamboo tray set BT-441. Quantity 1200 pcs. Please include FOB Ningbo price, lead time, and packing details. Target ship date is 2026-04-25.',
      },
      {
        id: 'msg-2',
        sender: 'sales@sunstream-trade.com',
        recipients: ['anna@nordichome.eu'],
        sentAt: '2026-03-10T12:08:00Z',
        subject: 'Re: Need quotation for bamboo tray set',
        body:
          'Please find our quote attached. Unit price USD 8.40 / pc, MOQ 1200 pcs, Incoterm FOB Ningbo, lead time 28 days. We can also issue PI after confirmation.',
      },
    ],
    attachments: [
      {
        id: 'att-1',
        fileName: 'BT-441-Quote-v1.pdf',
        mimeType: 'application/pdf',
        text:
          'Quotation Buyer: Nordic Home Retail Product: Bamboo Tray Set BT-441 Quantity: 1200 pcs Unit Price: USD 8.40 Incoterm: FOB Ningbo Lead Time: 28 days Valid Until: 2026-03-20',
      },
    ],
  },
  {
    id: 'case-us-po',
    label: 'US buyer sends PO and asks for PI',
    account: 'Lakefront Living Inc.',
    region: 'US',
    messages: [
      {
        id: 'msg-3',
        sender: 'ops@lakefrontliving.com',
        recipients: ['sales@sunstream-trade.com'],
        sentAt: '2026-03-11T06:40:00Z',
        subject: 'PO attached for kitchen rack order',
        body:
          'Team, please find PO 45007821 attached for KR-220 order. Quantity 600 pcs, target ETD 2026-04-18. Please issue PI with 30 percent deposit and confirm carton size.',
      },
      {
        id: 'msg-4',
        sender: 'sales@sunstream-trade.com',
        recipients: ['ops@lakefrontliving.com'],
        sentAt: '2026-03-11T09:20:00Z',
        subject: 'Re: PO attached for kitchen rack order',
        body:
          'Received your PO. We are checking packaging details and will send PI today. Current price remains USD 22.50 per set under FOB Shanghai.',
      },
    ],
    attachments: [
      {
        id: 'att-2',
        fileName: 'PO_45007821.pdf',
        mimeType: 'application/pdf',
        text:
          'Purchase Order PO No: 45007821 Buyer: Lakefront Living Inc. Supplier: Sunstream Trade SKU: KR-220 Quantity: 600 pcs Unit Price: USD 22.50 Delivery Date: 2026-04-18 Port: FOB Shanghai',
      },
      {
        id: 'att-3',
        fileName: 'PI_KR220_v2.pdf',
        mimeType: 'application/pdf',
        text:
          'Proforma Invoice PI No: PI-2026-119 Buyer: Lakefront Living Inc. Product: KR-220 Quantity: 600 pcs Total Amount: USD 13500 Deposit: 30 percent Currency: USD Incoterm: FOB Shanghai',
      },
    ],
  },
  {
    id: 'case-au-shipment',
    label: 'Shipment moving but document package is incomplete',
    account: 'Harbor Supply AU',
    region: 'AU',
    messages: [
      {
        id: 'msg-5',
        sender: 'docs@harborsupply.au',
        recipients: ['shipping@sunstream-trade.com'],
        sentAt: '2026-03-09T03:04:00Z',
        subject: 'Need shipping docs for HS-990',
        body:
          'Can you send final commercial invoice, packing list, and bill of lading draft for HS-990? Customer asks for vessel info and carton count today.',
      },
      {
        id: 'msg-6',
        sender: 'shipping@sunstream-trade.com',
        recipients: ['docs@harborsupply.au'],
        sentAt: '2026-03-09T06:58:00Z',
        subject: 'Re: Need shipping docs for HS-990',
        body:
          'BL draft attached. Commercial invoice is attached as PDF. Packing list is still pending carton count confirmation from warehouse. ETD 2026-03-14 from Shenzhen.',
      },
    ],
    attachments: [
      {
        id: 'att-4',
        fileName: 'BL_DRAFT_HS990.pdf',
        mimeType: 'application/pdf',
        text:
          'Bill of Lading Draft BL No: SZX-77881 Shipper: Sunstream Trade Consignee: Harbor Supply AU Vessel: Pacific Aurora ETD: 2026-03-14 Port of Loading: Shenzhen',
      },
      {
        id: 'att-5',
        fileName: 'Commercial_Invoice_HS990.pdf',
        mimeType: 'application/pdf',
        text:
          'Commercial Invoice Invoice No: CI-88031 Buyer: Harbor Supply AU Product: HS-990 Quantity: 420 pcs Total Amount: USD 17640 Currency: USD Incoterm: FOB Shenzhen',
      },
    ],
  },
];
