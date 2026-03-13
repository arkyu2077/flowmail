# Mail Big DB

Mail Big DB is the next abstraction above a shared inbox.

Instead of treating Gmail as an inbox UI, TradeCase treats Gmail as:

- an event source
- a document store
- a thread graph
- a case materialization layer

## Architecture

1. `Mailbox sync`
   Gmail is connected in read-only mode and recent candidate threads are synchronized.

2. `Mail Big DB`
   Threads, messages, attachments, and extracted evidence are normalized into a single internal store.

3. `Rule packs`
   A rule pack decides which mailbox threads become cases.

4. `Agent outputs`
   The resulting cases can be exported into:
   - Feishu Bitable
   - Notion data sources

## Current active rule pack

- `external_trade_order`

This turns mailbox threads into external-trade order cases.

## Additional rule packs worth supporting

- `accounts_payable_intake`
- `accounts_receivable_collection`
- `recruiting_pipeline`
- `customer_support_escalation`
- `procurement_request`
- `inbound_sales_rfq`
- `partnership_lead`
- `vendor_onboarding_compliance`
- `contract_review_approval`
- `agency_client_delivery`

## Why this matters for agents

Agents should not read a raw mailbox every time.

They should read:

- canonical cases
- normalized fields
- evidence
- state
- next actions

That makes Notion and Feishu the collaboration surfaces, while Mail Big DB remains the operational source of truth.
