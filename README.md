# TradeCase OS

TradeCase OS is a focused workspace for the "external-trade email and attachment structuring" opportunity.

This first version contains:

- a concrete plan from research to MVP
- a public-source research map and pain taxonomy
- a local MVP that turns email threads and attachments into:
  - document classifications
  - extracted business fields
  - workflow status
  - missing data
  - next-step recommendations
  - a draft reply
- a concrete architecture for OpenClaw, mailbox auth, and dashboard operations
- a template-first workspace flow so users choose a workflow template instead of editing rules

## Why this exists

Foreign-trade teams still run critical work inside shared inboxes, PDFs, spreadsheets, and carrier portals.
The goal is not to replace email. The goal is to transform inbox chaos into a structured trade case that can be searched, tracked, and advanced.

## Product shape now

TradeCase now exposes workflow templates at the workspace level.

The current live templates are:

- `External Trade Order`
- `SaaS Revenue Order`

Each workspace selects one template.
That template then drives:

- mailbox filtering
- case qualification
- workflow-status labels
- assistant prompts
- sample data before a mailbox is connected

Users do not need to configure rule packs directly.
They now follow a simpler flow:

1. Create or switch to a workspace.
2. Choose a workflow template.
3. Connect Gmail.
4. Review matching cases on the board.
5. Push structured rows into Feishu or Notion.

## Project layout

- `PLAN.md`: thesis, scope, and milestone plan
- `OPPORTUNITY_MAP.md`: upstream opportunity map and parallel product tracks
- `PARALLEL_BUILD_ROADMAP.md`: execution order across platform, wedges, and tool lines
- `COMPETITOR_MATRIX.md`: competitor landscape around the mail-case-engine position
- `MAIL_BIG_DB.md`: mailbox-as-database architecture and rule-pack model
- `MAIL_CASE_ENGINE_PRD.md`: first-page product definition for the engine-first wedge
- `MAIL_CASE_ENGINE_SPEC.md`: service boundary, API, and OpenClaw contract for the engine
- `OPENCLAW_LOCAL_MVP_TECH_DESIGN.md`: gog adapter + local state + case engine + OpenClaw plugin architecture
- `CLOUDFLARE_STACK.md`: Workers, D1, R2, Queues, and migration plan
- `SCENARIO_PORTFOLIO.md`: case-pack expansion strategy beyond external trade
- `SAAS_MULTITENANCY.md`: public SaaS auth, workspace, and connector model
- `POSITIONING.md`: product definition and interaction model
- `ARCHITECTURE.md`: service boundaries and system design
- `OPENCLAW_INTEGRATION.md`: skill entry flow and mailbox-connect model
- `API_CONTRACT.md`: backend endpoints and skill boundary
- `TASKS.md`: execution checklist
- `.env.example`: Gmail OAuth placeholders for the backend
- `.dev.vars.example`: local Wrangler secret template
- `wrangler.jsonc.example`: sample Cloudflare Worker binding config
- `cloudflare/README.md`: Cloudflare resource bring-up commands
- `cloudflare/d1/0001_initial.sql`: first D1 schema draft
- `server/repository/*`: repository boundary, local-file adapter, and D1 scaffold
- `server/services/mail-case-engine.ts`: case-first engine service for classification, listing, summaries, and assistant queries
- `server/services/mailbox-connector.ts`: mailbox sync and connection-status service for Gmail-first connectors
- `data/source-manifest.json`: public web sources to mine for pain signals and schemas
- `openclaw/SKILL.md`: ClawHub-ready skill body for the engine MVP
- `openclaw/_meta.json`: ClawHub publish metadata stub
- `openclaw/skill-manifest.json`: legacy draft manifest kept only for reference
- `packages/openclaw-flowmail/*`: installable local OpenClaw plugin MVP
- `src/data/*`: seed research records and synthetic sample cases
- `src/lib/*`: classification, extraction, workflow, and recommendation logic
- `src/App.tsx`: local MVP UI
- `server/app.ts`: app factory shared by Node and Cloudflare runtimes
- `server/index.ts`: TradeCase API with local Gmail OAuth and sync flow
- `cloudflare/worker.ts`: Worker entry that injects D1 into the shared app factory
- `server/feishu.ts`: Feishu Bitable export adapter
- `server/notion.ts`: Notion export adapter
- `src/lib/case-packs.ts`: case-pack registry for future Mail Big DB modes

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3017`.

Run the API locally:

```bash
npm run dev:api
```

The API will listen on `http://localhost:3027`.

The current build now exposes two compatible API shapes:

- UI-first routes such as `/api/workspaces/:id/cases`
- engine-first aliases such as `/api/workspaces/:id/engine/cases`

The engine aliases are intended for OpenClaw, SDKs, and future non-UI consumers.
Workspace API tokens are intended for ClawHub/OpenClaw distribution and should call engine routes only.

To package the current skill assets for ClawHub:

```bash
npm run pack:clawhub-skill
```

This writes:

`artifacts/flowmail-skill.zip`

To package the local OpenClaw plugin MVP:

```bash
npm run pack:openclaw-plugin
```

This writes:

- `artifacts/flowmail-openclaw-flowmail-0.1.0.tgz`
- `artifacts/openclaw-flowmail-plugin.zip`

## OpenClaw local plugin MVP

The current repo now also contains a local-first OpenClaw plugin MVP under:

`packages/openclaw-flowmail`

This is the recommended path if you want:

- `gog` as the Gmail adapter
- persistent local state across sessions
- business-case materialization
- direct OpenClaw tools without a hosted backend

Install from the repo root on a machine that already has OpenClaw and `gog`:

```bash
openclaw plugins install ./packages/openclaw-flowmail
```

For a local dev link:

```bash
openclaw plugins install -l ./packages/openclaw-flowmail
```

Then configure `plugins.entries.openclaw-flowmail.config` in `~/.openclaw/openclaw.json`.
See:

- [`packages/openclaw-flowmail/README.md`](/Users/yuxh-mac/Desktop/yu/flowmail/packages/openclaw-flowmail/README.md)
- [`OPENCLAW_LOCAL_MVP_TECH_DESIGN.md`](/Users/yuxh-mac/Desktop/yu/flowmail/OPENCLAW_LOCAL_MVP_TECH_DESIGN.md)

### Local SaaS auth

This build now includes a minimal local auth and workspace model:

- create account
- sign in
- continue with Google
- create additional workspaces
- scope Gmail, Notion, and Feishu actions to the selected workspace

The current build now uses an `HttpOnly` cookie session for browser auth.
Passwords are hashed in the local runtime store, but this is still a prototype, not a production auth stack.
Browser writes now also use a matching CSRF token:

- `tradecase_session`: `HttpOnly` session cookie
- `tradecase_csrf`: readable CSRF cookie mirrored into `X-TradeCase-CSRF` on write requests

The server will automatically mint a CSRF cookie for any API request that already has a session cookie.
Invalid session cookies are cleared on `/api/auth/session`.

Google sign-in reuses the same OAuth client and callback path as Gmail mailbox connect:

```text
http://localhost:3027/api/oauth/google/callback
```

The callback now branches by OAuth `state`:

- `login:*` for Google sign-in
- `mailbox:*` for Gmail mailbox connect

Local browser requests to the API use `credentials: include`, so the session cookie is sent automatically.
When `VITE_API_BASE_URL` is not set, the frontend now derives the API host from the current page host.
That keeps local cookies same-site for both `http://localhost:3017` and `http://127.0.0.1:3017`.

### Workspace API tokens for OpenClaw

This build now supports workspace-scoped API tokens for the engine layer.

They are intended for:

- ClawHub-distributed skills
- OpenClaw tool calls
- SDK or server-to-server integrations

They are not intended for:

- browser sign-in
- workspace configuration
- export-target admin

Current admin endpoints:

- `GET /api/workspaces/:id/access-tokens`
- `POST /api/workspaces/:id/access-tokens`
- `DELETE /api/workspaces/:id/access-tokens/:tokenId`

Current engine endpoints that accept workspace API tokens:

- `GET /api/workspaces/:id/engine/cases`
- `GET /api/workspaces/:id/engine/cases/:caseId`
- `GET /api/workspaces/:id/engine/stuck-cases`
- `GET /api/workspaces/:id/engine/missing-documents`
- `POST /api/workspaces/:id/engine/cases/:caseId/summarize`
- `POST /api/workspaces/:id/engine/cases/:caseId/draft-reply`
- `POST /api/workspaces/:id/engine/query`
- `GET /api/workspaces/:id/engine/mailbox-connections`
- `POST /api/workspaces/:id/engine/mailbox-connections/initiate`
- `POST /api/workspaces/:id/engine/mailbox-connections/:connectionId/sync`

### Local Gmail test

1. Copy `.env.example` to `.env.local`.
2. Create a Google OAuth web app in Google Cloud.
3. Set the redirect URI to:

```text
http://localhost:3027/api/oauth/google/callback
```

4. Fill these values in `.env.local`:

```bash
APP_BASE_URL=http://localhost:3027
FRONTEND_BASE_URL=http://localhost:3017
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3027/api/oauth/google/callback
DATA_BACKEND=local-file
COOKIE_SECURE=false
GMAIL_SYNC_QUERY=newer_than:180d
GMAIL_SYNC_MAX_THREADS=25
```

5. Start both servers:

```bash
npm run dev
npm run dev:api
```

6. Open `http://localhost:3017`.
7. Click `Connect Gmail`.
8. Complete Google OAuth.
9. After the callback redirects back to the frontend, use `Sync mailbox now` if you want to rerun the Gmail backfill.

### Cookie settings

Local development should keep:

```bash
COOKIE_SECURE=false
```

For production behind HTTPS, set:

```bash
COOKIE_SECURE=true
```

The current cookie model is:

- `SameSite=Lax`
- `HttpOnly` for session
- CSRF header required on `POST`, `PUT`, `PATCH`, and `DELETE` when a session cookie is present

### Agent outputs

TradeCase can export the current visible cases into collaboration tools:

- Feishu Bitable
- Notion data source

The current local build now supports workspace-scoped export targets.

- Feishu: the workspace stores its own `appToken` and `tableId`
- Notion: the workspace stores its own `accessToken` and `dataSourceId`
- server env values are treated as fallback only

That is still a local bridge, not the final public OAuth install flow.

Fill these env vars if you want to test exports:

```bash
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_BITABLE_APP_TOKEN=
FEISHU_BITABLE_TABLE_ID=

NOTION_API_KEY=
NOTION_DATA_SOURCE_ID=
NOTION_TITLE_PROPERTY=Name
NOTION_VERSION=2025-09-03
```

Or configure the current workspace directly in the UI:

- `Workspace Feishu target`
- `Workspace Notion target`

For local Feishu exports you still need `FEISHU_APP_ID` and `FEISHU_APP_SECRET` on the server.
For local Notion exports you can avoid env fallback by saving a workspace access token in the UI.

The current export shape is a flattened agent-friendly row:

- Case Title
- Case ID
- Case Pack
- Account
- Region
- Status
- Latest Subject
- Latest Message At
- Thread Count
- Attachment Count
- Next Action
- Missing Data
- Matched Keywords
- Matched Doc Types
- Qualification Rule
- Qualification Score

### Current Gmail integration behavior

- OAuth is read-only and local-development only.
- Tokens and synced cases are stored in `data/runtime/store.json`.
- The dashboard uses synced Gmail-derived cases when available, and falls back to sample cases otherwise.
- Thread-to-case mapping is heuristic and optimized for local validation, not production reliability yet.

### Current trade-case filter

TradeCase does not show the whole inbox. It keeps only threads that look like trade workflow cases.

Current inclusion rules:

- recognized trade document attachment such as PO, PI, invoice, BL, or packing list
- one trade keyword plus at least one attachment
- two or more trade workflow keywords in the subject or body

Current trade keywords include terms like `quote`, `purchase order`, `invoice`, `bill of lading`, `shipment`, `FOB`, `deposit`, and `lead time`.

Current default Gmail candidate query:

```text
newer_than:180d -category:promotions -category:social -category:forums -category:updates
```

That query only narrows the candidate pool. The final trade-case filter still runs after sync.

## MVP boundaries

This is a read-first MVP.

It currently supports:

- sample and Gmail-synced email threads
- attachment text snippets
- deterministic parsing with explicit evidence
- workflow suggestions without direct email sending
- local Gmail OAuth token persistence and backfill

It does not yet support:

- Outlook OAuth
- OCR
- vector search
- auto-send
- approval queues
- persistent API storage

## Cloudflare migration

The intended production stack is:

- Workers + Hono
- D1 for normalized app data
- R2 for attachments and large raw payloads
- Queues for async sync and export jobs
- Durable Objects only for workspace-level coordination

See:

- [CLOUDFLARE_STACK.md](/Users/yuxh-mac/Desktop/yu/flowmail/CLOUDFLARE_STACK.md)
- [wrangler.jsonc.example](/Users/yuxh-mac/Desktop/yu/flowmail/wrangler.jsonc.example)
- [cloudflare/d1/0001_initial.sql](/Users/yuxh-mac/Desktop/yu/flowmail/cloudflare/d1/0001_initial.sql)

The server now also has a repository boundary:

- `local-file` keeps the current JSON-backed runtime working
- `d1` is scaffolded as the next adapter
- `server/app.ts` now lets both runtimes share the same API surface
- `server/index.ts` is the Node launcher
- `cloudflare/worker.ts` is the Worker launcher

Use `DATA_BACKEND=local-file` for the current prototype.
Do not enable `DATA_BACKEND=d1` yet unless you finish the Worker-side D1 binding work.

## Suggested next build steps

1. Improve Gmail thread relevance filtering and attachment parsing.
2. Add Microsoft Graph read-only sync.
3. Store threads and extracted entities in a database instead of local JSON.
4. Add review actions for field corrections.
5. Add approval before generating outbound drafts.
