# Scenario Portfolio

Mail Big DB is the platform.
Case packs are the products.

The right expansion logic is not "open everything at once".
It is "reuse one ingestion core, then open a few high-fit case packs in parallel".

## Common pattern

Every good Mail Big DB scenario shares the same shape:

- email is still the system of record
- work happens through threads plus attachments
- users care about state, owner, SLA, and next action
- humans still need a board in Feishu or Notion
- an agent is useful only after the mailbox is normalized

That gives one reusable pipeline:

`mailbox sync -> Mail Big DB -> case pack -> agent actions -> collaboration surface`

## Expansion criteria

Use these filters before adding a new case pack:

1. The work still lives in email.
2. Attachments or long threads carry the real business state.
3. There is a clear status machine.
4. The output can be flattened into a table row.
5. A user would ask an agent questions such as:
   - what is blocked
   - what is missing
   - who owns this
   - what should I send next

## Recommended portfolio

### Tier 1

These are the best first portfolio because they are email-heavy, attachment-heavy, and easy to show in a dashboard.

#### `external_trade_order`

- strongest wedge
- email and attachments already are the workflow
- easy to show status, missing docs, and reply drafts

#### `accounts_payable_intake`

- finance inboxes are already queue-shaped
- invoices and payment proofs are attachment-heavy
- Feishu and Notion tables work well as review queues

#### `recruiting_pipeline`

- resumes, scheduling, feedback, and offer threads already live in email
- strong table output
- agent can summarize candidates and next steps

#### `customer_support_escalation`

- shared inboxes already exist
- pain is not parsing only, it is turning threads into issue state
- agent can summarize severity, owner, blocker, and reply draft

### Tier 2

These fit the same core, but usually need stronger rules or better destination permissions.

#### `accounts_receivable_collection`

- invoice sent
- remittance pending
- overdue follow-up
- dispute handling

#### `procurement_request`

- supplier quotes
- approvals
- missing docs
- decision comparison

#### `inbound_sales_rfq`

- inbound RFQs
- spec sheets
- quote drafting
- buyer clarification loops

#### `partnership_lead`

- inbound BD threads
- reseller requests
- channel negotiations
- joint campaign follow-ups

### Tier 3

These are valid, but should open after the permission and review model is stronger.

#### `vendor_onboarding_compliance`

- bank forms
- tax forms
- onboarding packets
- qualification blockers

#### `contract_review_approval`

- redlines
- version drift
- approval chases
- signature blockers

#### `agency_client_delivery`

- brief intake
- asset review
- revision rounds
- delivery approval

## What to open together

Do not open by industry first.
Open by workflow family.

### Family A: trade and revenue

- `external_trade_order`
- `inbound_sales_rfq`
- `accounts_receivable_collection`

Shared value:

- customer-facing threads
- quote and invoice attachments
- next-step drafting

### Family B: finance and procurement

- `accounts_payable_intake`
- `procurement_request`
- `vendor_onboarding_compliance`

Shared value:

- attachment extraction
- approvals
- missing document tracking

### Family C: people and support

- `recruiting_pipeline`
- `customer_support_escalation`
- `agency_client_delivery`

Shared value:

- shared inbox workflow
- ownership tracking
- response drafting

## Best sequence

If the goal is both product focus and platform reuse:

1. Keep `external_trade_order` as the flagship wedge.
2. Add `accounts_payable_intake` as the first non-trade validation.
3. Add `recruiting_pipeline` as the first broad horizontal use case.
4. Only after that, open `accounts_receivable_collection` and `procurement_request`.

This proves the platform without diluting the story too early.

## Product framing

Do not frame this as "AI inbox automation".

Frame it as:

- `Mail Big DB for case-based work`
- `turn email into structured operational cases`
- `one ingestion layer, many case packs`

That lets you sell:

- a flagship wedge today
- a platform story tomorrow
- an agent interface on top of both
