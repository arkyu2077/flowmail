# Architecture

## System overview

The recommended architecture is:

`OpenClaw skill / chat entry`
-> `TradeCase API`
-> `Mailbox connectors + ingestion`
-> `Trade case engine`
-> `Dashboard + query services`

OpenClaw is an interface layer.
TradeCase OS is the system of record.

## User flow

1. User installs the TradeCase skill in OpenClaw.
2. User clicks "Connect mailbox".
3. User completes Gmail or Outlook OAuth against TradeCase OS.
4. TradeCase OS backfills recent inbox history.
5. Threads and attachments are normalized into trade cases.
6. The dashboard starts showing:
   - active cases
   - workflow state
   - missing documents
   - next actions
7. The user can ask OpenClaw questions against the TradeCase workspace.

## Service boundaries

### 1. Identity and workspace service

Responsibilities:

- user accounts
- workspace creation
- role-based access
- OpenClaw workspace linkage
- session management

Suggested responsibilities for v1:

- single workspace per customer
- owner/admin/member roles

### 2. Connector service

Responsibilities:

- Gmail OAuth
- Outlook OAuth
- token refresh
- webhook or polling setup
- mailbox scope management

Recommended Gmail scopes for v1:

- `gmail.readonly`

Recommended Outlook scopes for v1:

- `Mail.Read`

Do not request send scopes in v1.

### 3. Ingestion service

Responsibilities:

- receive message sync events
- fetch thread and attachment content
- normalize provider-specific formats
- enqueue parsing jobs

Inputs:

- Gmail history events or backfill sync
- Graph delta sync

Outputs:

- canonical thread record
- canonical attachment record

### 4. Document processing service

Responsibilities:

- attachment text extraction
- OCR
- doc-type classification
- field extraction with evidence

Outputs:

- document type
- extracted fields
- extraction confidence
- evidence spans

### 5. Trade case engine

Responsibilities:

- entity resolution
- merge threads into cases
- state machine inference
- missing-data detection
- risk detection

Primary output:

- one trade case per business flow

This is the core moat.

### 6. Action engine

Responsibilities:

- next-step recommendation
- draft reply generation
- stuck-case detection
- SLA reminders

v1 behavior:

- suggestions only
- no autonomous sending

### 7. Query and assistant API

Responsibilities:

- support dashboard filters
- support OpenClaw skill calls
- support chat queries
- support case summaries

Typical methods:

- `list_cases`
- `get_case`
- `search_cases`
- `get_stuck_cases`
- `summarize_case`
- `draft_reply`

### 8. Dashboard app

Responsibilities:

- active case list
- state columns
- missing-data alerts
- case detail timeline
- draft and recommendation review

This should be usable without OpenClaw.

### 9. Audit and approvals service

Responsibilities:

- log generated drafts
- log user approvals
- log state changes
- log connector events

For v1 this can be simple, but it should exist from day one.

## Data model

### Core tables

- `workspaces`
- `users`
- `mailbox_connections`
- `threads`
- `messages`
- `attachments`
- `documents`
- `trade_cases`
- `trade_case_events`
- `extracted_fields`
- `drafts`
- `audit_logs`

### Key relationships

- one workspace has many mailbox connections
- one thread has many messages
- one message has many attachments
- many threads can map to one trade case
- one trade case has many events and drafts

## Storage

### Relational database

Use Postgres for:

- workspaces
- users
- cases
- fields
- workflow states
- audits

### Object storage

Use S3-compatible storage for:

- raw attachments
- OCR outputs
- optional normalized text blobs

### Queue

Use a job queue for:

- backfills
- OCR
- extraction
- reprocessing

### Search

For v1, Postgres full-text is enough.
Vector search is optional and should not block launch.

## Suggested v1 stack

- frontend: React + Vite
- API: Node.js with Hono, Fastify, or Express
- DB: Postgres
- queue: Redis-backed queue or a managed task queue
- storage: local disk in dev, S3-compatible in prod
- auth: simple email auth or Clerk/Auth0 later

## Security principles

- mailbox OAuth happens against TradeCase OS, not inside OpenClaw logic
- store provider tokens server-side only
- read-only scopes by default
- draft creation should be separate from send permission
- every generated action should be auditable

## OpenClaw integration pattern

The best pattern is:

`OpenClaw skill -> TradeCase query API`

not:

`OpenClaw skill -> direct Gmail calls with raw mailbox tokens`

This keeps:

- security cleaner
- product ownership on your side
- dashboard and chat consistent
- future portability beyond OpenClaw

## Recommended v1 architecture cut

Implement in this order:

1. dashboard with local sample data
2. canonical trade case schema
3. mailbox read-only connector
4. parsing and state engine
5. query API
6. OpenClaw skill integration
7. draft generation
8. approvals
