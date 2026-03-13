import type { SourceEntry } from '../types';

export const sourceCatalog: SourceEntry[] = [
  {
    id: 'src-1',
    name: 'G2 / Missive reviews',
    category: 'pain-signals',
    note: 'Shared inbox friction and retrieval pain.',
    url: 'https://www.g2.com/products/missive/reviews',
  },
  {
    id: 'src-2',
    name: 'Reddit / r/xero',
    category: 'pain-signals',
    note: 'Gap between quote, order, and invoice handling.',
    url: 'https://www.reddit.com/r/xero/comments/1kxv81p',
  },
  {
    id: 'src-3',
    name: 'Reddit / r/Odoo',
    category: 'pain-signals',
    note: 'Attachment ingestion and reply threading problems.',
    url: 'https://www.reddit.com/r/Odoo/comments/1b378bz',
  },
  {
    id: 'src-4',
    name: 'DHL commercial invoice',
    category: 'document-schema',
    note: 'Commercial invoice field expectations.',
    url: 'https://www.dhl.com/discover/en-us/global-logistics-advice/import-export-advice/commercial-invoice',
  },
  {
    id: 'src-5',
    name: 'FedEx commercial invoice reference',
    category: 'document-schema',
    note: 'Template and field structure for invoice documents.',
    url: 'https://images.fedex.com/il/tools/invoice.html',
  },
  {
    id: 'src-6',
    name: 'Maersk transport documentation guide',
    category: 'workflow',
    note: 'Document sequencing and handoff logic.',
    url: 'https://www.maersk.com/support/website-guide/final-transport-documents',
  },
  {
    id: 'src-7',
    name: 'Gmail threads API',
    category: 'integration',
    note: 'Thread and message model for future connectors.',
    url: 'https://developers.google.com/gmail/api/guides/threads',
  },
  {
    id: 'src-8',
    name: 'Microsoft Graph delta query',
    category: 'integration',
    note: 'Incremental inbox sync for Outlook.',
    url: 'https://learn.microsoft.com/en-us/graph/delta-query-messages',
  },
];
