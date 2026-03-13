import type { TradeCase } from '../types';

export const sampleSaasCases: TradeCase[] = [
  {
    id: 'saas-case-renewal-risk',
    label: 'Northstar renewal blocked on card update',
    account: 'Northstar Analytics',
    region: 'US',
    messages: [
      {
        id: 'saas-msg-1',
        sender: 'billing@stripe.com',
        recipients: ['finance@northstar.ai', 'revops@tradecase.dev'],
        sentAt: '2026-03-11T08:20:00Z',
        subject: 'Payment failed for invoice INV-4421',
        body:
          'Payment failed for invoice INV-4421. Customer: Northstar Analytics. Amount due: USD 2,400. Plan: Growth Annual. Renewal date: 2026-03-18. Card declined.',
      },
      {
        id: 'saas-msg-2',
        sender: 'finance@northstar.ai',
        recipients: ['revops@tradecase.dev'],
        sentAt: '2026-03-11T09:12:00Z',
        subject: 'Re: Payment failed for invoice INV-4421',
        body:
          'We are updating the card with our AP team. Please keep the workspace active through Friday while we sort out the billing issue.',
      },
    ],
    attachments: [
      {
        id: 'saas-att-1',
        fileName: 'INV-4421.pdf',
        mimeType: 'application/pdf',
        text:
          'Subscription Invoice Invoice ID: INV-4421 Customer: Northstar Analytics Plan: Growth Annual Amount Due: USD 2400 Renewal Date: 2026-03-18',
      },
    ],
  },
  {
    id: 'saas-case-order-form',
    label: 'Acme signed enterprise order form',
    account: 'Acme Security',
    region: 'US',
    messages: [
      {
        id: 'saas-msg-3',
        sender: 'contracts@acme.io',
        recipients: ['sales@tradecase.dev'],
        sentAt: '2026-03-10T17:45:00Z',
        subject: 'Signed order form for Enterprise plan',
        body:
          'Attached is the signed order form for Enterprise. Customer: Acme Security. Plan: Enterprise Annual. Amount due: USD 18,000. Please confirm provisioning timeline.',
      },
      {
        id: 'saas-msg-4',
        sender: 'sales@tradecase.dev',
        recipients: ['contracts@acme.io'],
        sentAt: '2026-03-10T18:22:00Z',
        subject: 'Re: Signed order form for Enterprise plan',
        body:
          'Received. We will move this to provisioning and send kickoff details after finance approval.',
      },
    ],
    attachments: [
      {
        id: 'saas-att-2',
        fileName: 'Acme-Enterprise-Order-Form.pdf',
        mimeType: 'application/pdf',
        text:
          'Order Form Contract ID: ACME-ENT-2026 Customer: Acme Security Plan: Enterprise Annual Amount Due: USD 18000 Workspace: acme-prod',
      },
    ],
  },
  {
    id: 'saas-case-active',
    label: 'Bluebird activation complete after payment',
    account: 'Bluebird Ops',
    region: 'EU',
    messages: [
      {
        id: 'saas-msg-5',
        sender: 'billing@paddle.com',
        recipients: ['ops@bluebird.eu', 'finance@tradecase.dev'],
        sentAt: '2026-03-09T07:05:00Z',
        subject: 'Invoice paid for Bluebird Ops',
        body:
          'Invoice INV-9188 charged successfully. Customer: Bluebird Ops. Plan: Team Monthly. Amount due: EUR 980. Workspace created: bluebird-eu.',
      },
      {
        id: 'saas-msg-6',
        sender: 'success@tradecase.dev',
        recipients: ['ops@bluebird.eu'],
        sentAt: '2026-03-09T09:40:00Z',
        subject: 'Workspace created and ready to use',
        body:
          'Your workspace bluebird-eu is provisioned. Seats enabled: 12. Renewal date: 2026-04-09.',
      },
    ],
    attachments: [
      {
        id: 'saas-att-3',
        fileName: 'Bluebird-Invoice-INV-9188.pdf',
        mimeType: 'application/pdf',
        text:
          'Subscription Invoice Invoice ID: INV-9188 Customer: Bluebird Ops Plan: Team Monthly Amount Due: EUR 980 Renewal Date: 2026-04-09',
      },
    ],
  },
];
