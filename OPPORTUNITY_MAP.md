# Opportunity Map

This document reconstructs the discussion path from the top-level opportunity map to the current product map.

The key point is:

`Mail Big DB is not the whole thesis.`

It is the current platform abstraction that emerged from a broader agent-native opportunity map.

## 1. How the discussion evolved

The path was:

1. `Agent-native infrastructure`
2. `Best solo-builder wedges`
3. `Concrete tool families`
4. `Mail Big DB as the current platform`
5. `External trade order as the flagship wedge`

So the platform should be understood in layers.

## 2. Upstream opportunity map

These were the original larger opportunity areas.

### 2.1 Agent-native infrastructure

These are the big categories that large platforms will partially cover:

- agent identity and authorization
- delegated credential vaults
- agent payments and procurement execution
- trust, anti-abuse, and risk scoring
- browser runtime and session execution
- communications infrastructure for agents
- observability, audit, and compliance
- MCP distribution and governance

These are real markets, but most of them are not ideal direct attack points for a solo founder.

### 2.2 Best solo-builder wedges

These were the most builder-fit directions for:

- one person
- strong AI capability
- large token budget
- willingness to do long-tail operational work

The most suitable families were:

- `long-tail MCP / connector products`
- `reverse API / ugly workflow operators`
- `vertical intelligence products`
- `agent QA / approval / replay sidecars`
- `Mail Big DB / email-native case systems`
- `programmatic SEO + data service` as an optional acquisition channel

## 3. Current product map

The current product is one branch of that broader map.

### 3.1 Platform

`Mail Big DB`

Meaning:

- email is not the final UI
- email is an event source and document source
- threads become canonical cases
- agents read normalized state instead of raw mailbox content

### 3.2 Flagship wedge

`External Trade Order`

Meaning:

- Quote / PI / PO / Invoice / BL email threads
- become visible order state
- with missing data, next actions, and draft replies

### 3.3 Interaction model

Current interaction model:

- OpenClaw or bot is the entry surface
- TradeCase OS is the system of record
- dashboard is the operational surface
- Feishu and Notion are collaboration outputs

### 3.4 SaaS boundary

The public SaaS model should be:

- your own user auth
- your own workspace model
- per-workspace Gmail grant
- per-workspace Feishu grant
- per-workspace Notion grant
- bot as a client, not a credential vault

## 4. Product families you can develop in parallel

These are the actual product tracks that can coexist.

## 4.1 Mail Big DB

This is the platform for case-based work that still lives in email.

### Definition

Turn mailbox threads and attachments into structured operational cases.

### Why it fits

- email is still the source of truth in many teams
- state lives inside threads and files
- agents need normalized case state
- Feishu and Notion are natural outputs

### Example products

- external trade order tracker
- AP intake inbox
- recruiting pipeline inbox
- support escalation inbox
- procurement approval inbox

## 4.2 Long-tail MCP

This is the connector layer for agent tools and SaaS systems.

### Definition

Turn a vertical system into a callable tool surface for agents.

### Why it fits

- giant companies do not build every niche integration
- token-heavy agents benefit from better tool access
- connectors can be sold standalone or embedded into Mail Big DB

### Example products

- seller backend MCP
- logistics portal MCP
- carrier tracking MCP
- customs data MCP
- ERP attachment MCP
- policy database MCP
- tender search MCP

## 4.3 Reverse API

This is the no-API execution layer.

Note:
If "Rewards API" was intended as "Reverse API", this is that category.

### Definition

Wrap a site or old workflow that has no useful API into a stable machine interface.

### Why it fits

- many valuable systems still require browsers, forms, PDFs, and downloads
- giant platforms will not go deep on fragmented, ugly workflows
- one good workflow wrapper can be a real product

### Example products

- seller dashboard to API
- quote portal to API
- shipping status puller
- government filing operator
- tax or customs site operator
- bank portal reconciliation operator

## 4.4 Vertical intelligence

This is the read-first information product line.

### Definition

Continuously collect, clean, rank, and explain external signals for one narrow job.

### Why it fits

- token budget directly improves quality
- no heavy write-side risk
- easy to validate with content or subscription

### Example products

- tender watch
- policy and regulation monitor
- competitor pricing radar
- supplier price and lead-time radar
- B2B company signal tracker
- startup and funding radar
- ad creative watch

## 4.5 Agent approval / QA / replay sidecar

This is the control plane around agent behavior.

### Definition

Watch what the agent is about to do, score it, block risky actions, and replay failures.

### Why it fits

- useful across Mail Big DB, MCP, and Reverse API products
- aligned with enterprise trust and audit needs
- more likely to be acquired than generic chat wrappers

### Example products

- approval inbox
- reply QA before send
- tool-call audit log
- browser workflow replay debugger
- policy engine for write actions

## 4.6 Collaboration outputs

These are not the core database.
They are the human collaboration destinations.

### Current outputs

- Feishu Bitable
- Notion

### Future outputs

- Google Sheets
- Airtable
- HubSpot
- Slack channels
- CRM stages
- ERP queues

## 5. Scenario inventory

These are the concrete scenarios that came out of the discussion.

## 5.1 Mail Big DB scenarios

These are the strongest case-pack scenarios.

- `external_trade_order`
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

Additional good candidates:

- logistics exception desk
- claims and refund operations
- customer success renewal risk
- PR and media inquiry inbox
- investor inbound pipeline
- distributor onboarding
- marketplace seller issue desk

## 5.2 Long-tail MCP scenarios

- Gmail and Outlook case queries
- seller backend MCP
- Shopify admin MCP
- Amazon seller central MCP
- carrier tracking MCP
- freight quote MCP
- customs tariff lookup MCP
- tender database MCP
- policy archive MCP
- supplier catalog MCP

## 5.3 Reverse API scenarios

- order portal operator
- government procurement site operator
- shipping document portal operator
- banking reconciliation operator
- tax filing operator
- legacy ERP export operator
- warehouse dashboard puller
- vendor portal sync operator

## 5.4 Vertical intelligence scenarios

- tender watch
- policy watch
- industry regulation watch
- competitor pricing watch
- supplier risk watch
- customer signal radar
- startup radar
- ad creative radar
- marketplace assortment radar

## 5.5 Agent sidecar scenarios

- approval inbox
- risky reply checker
- workflow replay debugger
- connector failure monitor
- audit export
- policy and permission engine

## 6. Best portfolio structure

If the goal is parallel building without losing focus:

### Core platform

- `Mail Big DB`

### Current flagship product

- `External Trade Order`

### Parallel build lanes

- `Long-tail MCP`
- `Reverse API`
- `Vertical intelligence`
- `Agent approval / QA / replay`

### Shared collaboration layer

- `Feishu`
- `Notion`

## 7. Recommended build order

If you want one coherent portfolio, not random tools:

1. Keep `Mail Big DB` as the core abstraction.
2. Keep `External Trade Order` as the flagship story.
3. Add `Accounts Payable Intake` as the first non-trade proof.
4. Add one `Vertical Intelligence` product as the read-first acquisition line.
5. Add `Long-tail MCP` and `Reverse API` where the flagship product needs them.
6. Add `Agent approval / QA / replay` as the horizontal control layer.

That gives one platform, multiple wedges, and a reusable technical core.
