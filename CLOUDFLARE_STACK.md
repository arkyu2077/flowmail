# Cloudflare Stack Plan

TradeCase OS is already structured like a good Cloudflare app:

- API layer: Hono
- browser UI: static SPA
- current persistence: local JSON store
- current async work: mailbox sync and export jobs

The right migration target is not `D1 only`.
It is:

- `Workers + Hono` for the API
- `D1` for normalized app data
- `R2` for attachments and large raw payloads
- `Queues` for mailbox sync, extraction, and export jobs
- `Durable Objects` only where workspace-level coordination is required
- `Secrets / Secrets Store` for platform secrets and encryption keys

## Why this shape

`D1` is good for structured product state:

- users
- workspaces
- memberships
- sessions
- mailbox connections
- normalized threads
- cases
- exports

`D1` is not where raw attachments should live.
Cloudflare documents D1 as serverless SQL built on SQLite, with per-database limits and a single-writer execution model per database. That fits TradeCase metadata well, but not large blobs or attachment archives.

`R2` is where TradeCase should store:

- raw attachment files
- full OCR text blobs
- raw Gmail thread snapshots
- large extraction payloads

`Queues` should own async side effects:

- Gmail sync
- attachment extraction
- case materialization
- Feishu export
- Notion export

`Durable Objects` should be introduced only when one workspace needs strict serialized execution:

- one active Gmail sync at a time
- deduping repeated sync triggers
- workspace-level rate limiting

## Resource map

### Worker

One Worker is enough for phase 1:

- serves `/api/*`
- optionally serves the built SPA assets from the same domain
- holds cookie auth, OAuth callbacks, and export APIs

Keep same-origin between UI and API if possible.
That keeps session cookies simple.

### D1

Use D1 for normalized records only.

Recommended first tables:

- `users`
- `workspaces`
- `workspace_memberships`
- `user_sessions`
- `oauth_states`
- `mailbox_connections`
- `mail_threads`
- `mail_messages`
- `mail_attachments`
- `cases`
- `case_events`
- `export_targets`
- `sync_jobs`

### R2

Use R2 for:

- attachment binaries
- extracted attachment text
- raw provider payloads
- replay/debug archives

Recommended key shape:

- `workspaces/<workspaceId>/threads/<threadId>/raw.json`
- `workspaces/<workspaceId>/messages/<messageId>/body.txt`
- `workspaces/<workspaceId>/attachments/<attachmentId>/file`
- `workspaces/<workspaceId>/attachments/<attachmentId>/ocr.txt`

### Queues

Start with three queues:

- `mail-sync`
- `case-extract`
- `exports`

Typical flow:

1. API enqueues Gmail sync
2. sync worker pulls thread metadata and stores normalized rows
3. extraction worker creates or updates cases
4. export worker writes rows to Feishu or Notion

### Durable Objects

Do not make Durable Objects the system of record.
Use them for coordination only.

Good first object:

- `WorkspaceSyncCoordinator`

Responsibilities:

- prevent concurrent syncs for the same workspace
- collapse duplicate sync requests
- expose simple lock status to the UI

### Secrets

Store these as Worker secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NOTION_CLIENT_ID`
- `NOTION_CLIENT_SECRET`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `TOKEN_ENCRYPTION_KEY`

Important boundary:

- platform secrets go into Worker secrets
- per-customer OAuth tokens go into `D1`, encrypted with `TOKEN_ENCRYPTION_KEY`

Do not try to store every customer token as a Cloudflare secret.

## D1 schema design rules

### What belongs in D1

- ids
- timestamps
- workflow status
- labels
- normalized extracted fields
- destination references
- encrypted token blobs
- small excerpts

### What should not stay in D1

- large attachments
- full PDF binaries
- full OCR results when they become large
- huge raw Gmail JSON payloads

### Recommended normalization

- `mail_threads` is the mailbox-native layer
- `cases` is the agent-facing layer
- `case_events` is the audit layer

That mirrors the product model:

- Mail Big DB as internal source of truth
- case packs as materialized business views

## Session and auth model on Cloudflare

Keep the same browser model you already built:

- `tradecase_session`: `HttpOnly`
- `tradecase_csrf`: readable CSRF cookie

Recommended production upgrade:

- store hashed session tokens in `user_sessions`
- rotate sessions on login and sensitive connector changes
- keep Google login and Gmail connect as separate OAuth purposes in `oauth_states`

## Connector model

Each workspace should own its own connector rows.

Examples:

- one workspace Gmail connector
- one workspace Notion connector
- one workspace Feishu connector

Suggested storage:

- `mailbox_connections`: Gmail or Outlook
- `export_targets`: Notion or Feishu destinations

Each target row should include:

- `workspace_id`
- `provider`
- `auth_mode`
- destination metadata
- encrypted credentials or refresh token

## Suggested migration sequence

### Phase 1

Replace only the local JSON store.

- keep current UI
- keep current Hono handlers
- replace `server/store.ts` calls with repository functions backed by D1

### Phase 2

Move binary and large text payloads to R2.

- raw Gmail thread snapshots
- attachment files
- OCR text

### Phase 3

Move async tasks to Queues.

- manual sync button enqueues a sync job
- exports enqueue export jobs
- UI reads `sync_jobs` for status

### Phase 4

Add Durable Object coordination if duplicate syncs become a problem.

### Phase 5

Add public SaaS OAuth for Notion and Feishu.

## First production milestone

For the first Cloudflare-backed release, the success condition should be:

- one Worker
- one D1 database
- one R2 bucket
- three queues
- same-origin SPA + API
- encrypted customer OAuth tokens in D1
- Gmail sync writing normalized mail rows and cases

That is enough to replace the local JSON prototype.

## References

- Cloudflare D1 overview: https://developers.cloudflare.com/d1/
- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare R2 overview: https://developers.cloudflare.com/r2/
- Cloudflare Queues overview: https://developers.cloudflare.com/queues/
- Cloudflare Durable Objects overview: https://developers.cloudflare.com/durable-objects/
- Cloudflare Workers secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Secrets Store: https://developers.cloudflare.com/secrets-store/
- Cloudflare Vectorize: https://developers.cloudflare.com/vectorize/
- Wrangler configuration: https://developers.cloudflare.com/workers/wrangler/configuration/
- Workers static assets: https://developers.cloudflare.com/workers/static-assets/
