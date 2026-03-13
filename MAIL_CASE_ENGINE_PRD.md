# Mail Case Engine PRD

Last updated: 2026-03-13

## Product name

Working name:

- `Mail Case Engine`

User-facing alternatives:

- `Email Operations Engine`
- `Mailbox Case Layer`

## One-line definition

Turn existing business mailboxes into stateful cases that agents, teams, and downstream systems can act on.

## Product thesis

Most teams still run critical business workflows inside shared inboxes.
They do not need a new email client.
They need a middle layer that:

- reads existing Gmail / Outlook accounts
- identifies business intent
- turns threads into structured cases
- stores state
- notifies the right system or person
- exposes those cases to agent runtimes such as OpenClaw

## What this is not

This is not:

- a generic Email API
- a parser-only product
- a shared inbox replacement
- a CRM inside Gmail
- a new inbox provider for agents

## Target users

Primary buyer profile:

- ops-heavy teams whose work still lives in email

Primary operator profile:

- coordinator
- revops / finops operator
- founder or operations lead

Initial high-fit scenarios:

- `external_trade_order`
- `saas_revenue_order`

Next likely scenarios:

- `accounts_payable_intake`
- `recruiting_pipeline`

## Core product promise

From the user's point of view:

1. Connect the mailbox once.
2. Choose a workflow template.
3. Let the engine keep only matching business cases.
4. Review or query those cases.
5. Push them into Feishu, Notion, OpenClaw, or another system.

## Product principles

### 1. Existing mailbox first

The product connects to the mailbox the team already uses.

### 2. Case-first abstraction

The core object is not the message.
The core object is the case.

### 3. Headless-first

The engine should be usable through:

- SDK
- REST API
- MCP / OpenClaw tools
- webhooks

UI is a client, not the core product.

### 4. Template-first

Users should not configure raw rules first.
They choose a workflow template.

### 5. Notification built in

The engine should not stop at classification.
It should support:

- stuck case detection
- missing data alerts
- downstream sync triggers

## MVP boundary

### In scope

- Gmail connect
- mailbox sync
- thread normalization
- template-based classification
- case materialization
- status labels
- extracted fields
- missing data detection
- next actions
- notifications
- OpenClaw tool access
- Feishu / Notion export

### Out of scope

- full email sending automation by default
- multi-channel inbox beyond email in v1
- full CRM
- full helpdesk
- end-user rule builder
- provider-level mailbox infrastructure

## Core entities

- `Workspace`
- `MailboxConnection`
- `CasePack`
- `MailThread`
- `MailMessage`
- `MailAttachment`
- `Case`
- `CaseEvent`
- `ExportTarget`
- `NotificationRule`

## First two case packs

### External Trade Order

Goal:

- turn quote / PI / PO / shipment threads into order-state cases

### SaaS Revenue Order

Goal:

- turn invoice / contract / renewal / payment issue threads into revenue-state cases

## Why this can win

The engine sits in a gap between:

- generic mailbox infrastructure
- parser tools
- shared inbox UI products
- Gmail-native CRM tools
- agent-native inbox providers

The wedge is not raw access.
The wedge is:

- business intent classification
- stateful case materialization
- headless consumption by agents and systems

## Success criteria

Short-term:

- mailbox connected in under 5 minutes
- useful cases visible after first sync
- operators can identify blockers without scanning inbox history
- OpenClaw can query and summarize cases

Medium-term:

- downstream tools consume cases as structured rows
- more than one case pack proves the engine is reusable

## Recommended initial pitch

`Connect an existing business mailbox, turn matching threads into stateful cases, and expose them to agents and downstream tools.`
