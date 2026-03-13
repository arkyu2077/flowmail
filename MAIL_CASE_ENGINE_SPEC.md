# Mail Case Engine Spec

Last updated: 2026-03-13

This document defines the service boundary for the `Mail Case Engine`.

## Core architecture

```text
Mailbox provider -> Connector -> Normalizer -> Classifier -> Case Store -> Notifications -> Adapters
```

### 1. Connector layer

Responsibilities:

- Gmail / Outlook OAuth
- initial sync
- incremental sync
- mailbox metadata retrieval

Outputs:

- normalized raw mailbox events

### 2. Normalization layer

Responsibilities:

- thread normalization
- message normalization
- attachment metadata normalization
- participant normalization
- label / mailbox metadata capture

Core output types:

- `MailThread`
- `MailMessage`
- `MailAttachment`

### 3. Classification layer

Responsibilities:

- determine candidate business threads
- apply `CasePack`
- extract structured fields
- infer workflow state
- compute confidence

Core output:

- `CaseDraft`

### 4. Case materialization layer

Responsibilities:

- create or update cases
- append case events
- attach extracted fields
- update current state
- track missing data and next actions

Core output:

- `Case`
- `CaseEvent`

### 5. Notification layer

Responsibilities:

- stuck-case detection
- missing-data detection
- destination-specific triggers
- webhook fan-out

### 6. Adapter layer

Responsibilities:

- OpenClaw tools
- REST API
- SDK
- Feishu target writer
- Notion target writer

## Core data objects

### Workspace

- `id`
- `name`
- `selected_case_pack_id`

### MailboxConnection

- `id`
- `workspace_id`
- `provider`
- `account_email`
- `status`
- `sync_cursor`
- `scope`

### CasePack

- `id`
- `name`
- `candidate_rules`
- `qualification_rules`
- `field_schema`
- `state_labels`
- `notification_defaults`

### Case

- `id`
- `workspace_id`
- `case_pack_id`
- `account`
- `label`
- `status`
- `summary`
- `latest_subject`
- `latest_message_at`
- `thread_count`
- `attachment_count`
- `qualification_score`
- `missing_data`
- `next_actions`

### CaseEvent

- `id`
- `case_id`
- `type`
- `occurred_at`
- `payload`

## API surface

### Auth and workspace

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google/initiate`
- `POST /auth/logout`
- `GET /auth/session`
- `POST /workspaces`
- `GET /workspaces`
- `PUT /workspaces/:id/case-pack`
- `GET /workspaces/:id/access-tokens`
- `POST /workspaces/:id/access-tokens`
- `DELETE /workspaces/:id/access-tokens/:tokenId`

### Mailbox connections

- `POST /workspaces/:id/mailbox-connections/initiate`
- `GET /workspaces/:id/mailbox-connections`
- `POST /workspaces/:id/mailbox-connections/:connectionId/refresh`

### Cases

- `GET /workspaces/:id/cases`
- `GET /workspaces/:id/cases/:caseId`
- `GET /workspaces/:id/case-packs`
- `GET /workspaces/:id/engine/cases`
- `GET /workspaces/:id/engine/cases/:caseId`
- `GET /workspaces/:id/engine/stuck-cases`
- `GET /workspaces/:id/engine/missing-documents`
- `POST /workspaces/:id/engine/cases/:caseId/summarize`
- `POST /workspaces/:id/engine/cases/:caseId/draft-reply`

### Agent operations

- `POST /workspaces/:id/assistant/query`
- `POST /workspaces/:id/cases/:caseId/draft-reply`
- `POST /workspaces/:id/engine/query`

### Exports and notifications

- `GET /workspaces/:id/export-targets`
- `POST /workspaces/:id/export-targets/feishu`
- `POST /workspaces/:id/export-targets/notion`
- `POST /workspaces/:id/exports/feishu`
- `POST /workspaces/:id/exports/notion`
- `POST /workspaces/:id/webhooks`
- `GET /workspaces/:id/engine/mailbox-connections`
- `POST /workspaces/:id/engine/mailbox-connections/initiate`
- `POST /workspaces/:id/engine/mailbox-connections/:connectionId/sync`

The current implementation keeps both:

- UI-compatible routes such as `/cases` and `/assistant/query`
- engine-style routes under `/engine/*`

This allows the same core service to back:

- the web app
- OpenClaw tool calls
- future SDK consumers

Current auth split:

- browser and admin routes use TradeCase user sessions
- engine routes can also use workspace API tokens
- workspace API tokens should stay scoped to engine operations

## OpenClaw tool contract

Recommended first tools:

- `connect_mailbox`
- `sync_mailbox`
- `list_cases`
- `get_case`
- `list_stuck_cases`
- `list_missing_documents`
- `summarize_case`
- `draft_reply`
- `query_cases`

OpenClaw should not own mailbox credentials or raw state.
OpenClaw is a client of the engine.

## Case-pack model

Case packs define business meaning without forcing users to write low-level rules.

Required fields:

- `id`
- `name`
- `qualification_rules`
- `status_labels`
- `assistant_prompts`
- `destination_defaults`

First live packs:

- `external_trade_order`
- `saas_revenue_order`

Next packs:

- `accounts_payable_intake`
- `recruiting_pipeline`

## MVP sequence

### Phase 1

- Gmail connect
- mailbox sync
- `external_trade_order`
- case list
- case detail
- OpenClaw query

### Phase 2

- `saas_revenue_order`
- notifications
- Feishu / Notion export
- better incremental sync

### Phase 3

- webhooks
- SDK
- more case packs
- approval flows

## Strategic boundary

The engine must avoid becoming:

- generic parser infrastructure
- generic shared inbox software
- generic CRM
- generic email API vendor

It should remain:

`a headless case engine for existing mailboxes`
