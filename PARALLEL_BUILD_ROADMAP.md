# Parallel Build Roadmap

This document turns the opportunity map into an execution map.

The goal is:

- keep one coherent platform
- allow multiple tools to be built in parallel
- avoid mixing core, wedge, and side projects

## 1. The stack

There are four layers.

### Layer A: platform core

This is the reusable system every product lane should share.

- identity and workspace model
- connector auth
- mailbox sync
- Mail Big DB
- case normalization
- rule packs
- agent query layer
- export layer
- audit layer

### Layer B: product wedges

These are customer-facing products with a clear story.

- external trade order
- accounts payable intake
- recruiting pipeline
- customer support escalation

### Layer C: tool lines

These can be sold standalone or used to strengthen wedges.

- long-tail MCP
- Reverse API
- vertical intelligence
- agent approval / QA / replay

### Layer D: collaboration and distribution

These are outputs and growth surfaces.

- Feishu Bitable
- Notion
- future sheets or CRM sync
- programmatic SEO
- content distribution

## 2. What is the core and what is not

### Must be core

- Mail Big DB
- case pack engine
- connector account model
- agent query interface
- export destinations

### Should not be the core

- one specific OpenClaw skill
- one specific Feishu table
- one niche Reverse API wrapper
- one intelligence dashboard

Those are products or tools built on top.

## 3. Parallel lanes

These are the lanes you can run at the same time.

## 3.1 Lane A: Mail Big DB flagship

### Product

`External Trade Order`

### Why it stays first

- strongest story
- already prototyped
- easiest to demo
- uses attachments and workflow state heavily

### Main build items

- better extraction
- better qualification
- reviewer correction queue
- per-workspace SaaS auth
- Feishu / Notion workspace outputs

## 3.2 Lane B: second proof for the platform

### Product

`Accounts Payable Intake`

### Why it matters

- proves Mail Big DB is not trade-only
- finance inboxes are naturally queue-based
- good fit for Feishu and Notion tables

### Main build items

- invoice classification
- payment proof detection
- approval state model
- finance row schema

## 3.3 Lane C: broad horizontal proof

### Product

`Recruiting Pipeline`

### Why it matters

- easier to explain outside trade
- resumes and interview threads are strong email-native cases
- expands addressable market

### Main build items

- resume and scheduling extraction
- candidate state model
- owner and interview next action logic

## 3.4 Lane D: long-tail MCP

### Role

Standalone tool line and infrastructure feeder.

### Best first MCPs

- Gmail case query MCP
- seller backend MCP
- logistics status MCP
- tender search MCP
- policy archive MCP

### How it connects back

- feeds Mail Big DB with more tools
- can be distributed separately to agent users
- can later become a connector catalog

## 3.5 Lane E: Reverse API

### Role

Execution layer where no useful API exists.

### Best first Reverse API tools

- seller dashboard wrapper
- shipping portal wrapper
- quote portal wrapper
- bank or reconciliation wrapper

### How it connects back

- powers write or fetch actions for wedges
- creates technical moat around ugly workflows

## 3.6 Lane F: vertical intelligence

### Role

Read-first tool line with lower operational risk.

### Best first intelligence products

- tender watch
- policy watch
- competitor pricing watch
- supplier lead-time watch
- B2B signal radar

### How it connects back

- acquisition channel
- standalone subscription product
- can feed leads or context into Mail Big DB or CRM outputs

## 3.7 Lane G: agent sidecar

### Role

Horizontal trust and control layer.

### Best first tools

- approval inbox
- draft QA
- workflow replay debugger
- connector failure monitor

### How it connects back

- sits above Mail Big DB, MCP, and Reverse API
- increases enterprise readiness

## 4. Priority matrix

Use this when deciding what to build next.

### Priority 1

Build now because they strengthen the current flagship and the platform core.

- Mail Big DB core
- External Trade Order
- Feishu workspace output
- Notion workspace output
- reviewer correction queue

### Priority 2

Build next because they prove the platform is horizontal.

- Accounts Payable Intake
- Recruiting Pipeline
- approval inbox

### Priority 3

Build when the platform basics are stable.

- long-tail MCP set
- Reverse API wrappers
- first vertical intelligence product

### Priority 4

Build after workspace auth and review controls are mature.

- procurement request
- accounts receivable collection
- vendor onboarding compliance
- contract review approval

## 5. Reusable assets

These are the assets every lane should reuse.

### Shared ingestion

- Gmail sync
- Outlook sync
- thread normalization
- attachment extraction

### Shared case layer

- rule pack registry
- qualification engine
- evidence model
- state machine engine
- next-action engine

### Shared workspace layer

- user auth
- workspace membership
- connector accounts
- connector targets
- token storage
- audit logs

### Shared output layer

- Feishu exporter
- Notion exporter
- future Sheets exporter

## 6. What can be built independently

These can be built as separate repos or internal modules without breaking the platform story.

### Standalone tools

- tender watch
- policy watch
- seller backend MCP
- logistics tracking MCP
- workflow replay debugger

### Platform-bound features

- Gmail auth
- workspace model
- case pack switching
- case review queue
- Feishu and Notion sync

## 7. Suggested execution order

If you want the cleanest portfolio:

1. Stabilize `Mail Big DB` as the shared platform.
2. Finish SaaS-grade auth and workspace boundaries.
3. Keep `External Trade Order` as the demo and flagship.
4. Add `Accounts Payable Intake` as the second real case pack.
5. Add `Recruiting Pipeline` as the third case pack.
6. Start one standalone `Vertical Intelligence` product.
7. Start one standalone `Long-tail MCP` product.
8. Add `Agent approval / QA / replay` as the control layer.

## 8. Portfolio summary

The portfolio should be understood as:

- one core platform: `Mail Big DB`
- one flagship wedge: `External Trade Order`
- two horizontal proof wedges: `AP Intake`, `Recruiting`
- three standalone tool lines: `Vertical Intelligence`, `Long-tail MCP`, `Reverse API`
- one horizontal trust layer: `Agent approval / QA / replay`

That is the structure that lets you build many tools in parallel without losing coherence.
