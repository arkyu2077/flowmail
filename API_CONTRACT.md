# API Contract

This contract defines the current boundary between:

- the TradeCase web app
- ClawHub / OpenClaw skills
- the Mail Case Engine backend

The backend is the source of truth.
OpenClaw is a thin client of the engine.

## Base URL

Local development:

`http://localhost:3027/api`

## Auth model

TradeCase now has two auth modes.

### 1. Browser session

Used for:

- user sign-in
- workspace creation
- case-pack changes
- export-target setup
- workspace API token creation and revocation

Browser sessions use:

- `tradecase_session` cookie
- CSRF header for writes

### 2. Workspace API token

Used for:

- OpenClaw
- ClawHub-distributed skills
- SDK or server-to-server engine calls

Workspace API tokens are accepted only on engine routes.

They are sent as:

`Authorization: Bearer <workspace_api_token>`

## Workspace model

Every engine endpoint is workspace-scoped.

Example:

`/workspaces/<workspaceId>/engine/cases`

## Workspace token admin endpoints

These require a browser session with owner or admin access.

| Function | HTTP endpoint | Purpose |
|---|---|---|
| `list_workspace_tokens` | `GET /workspaces/:workspaceId/access-tokens` | List skill and integration tokens |
| `create_workspace_token` | `POST /workspaces/:workspaceId/access-tokens` | Mint a new token for OpenClaw or SDK use |
| `revoke_workspace_token` | `DELETE /workspaces/:workspaceId/access-tokens/:accessTokenId` | Revoke a token |

## Engine skill-to-endpoint mapping

| Skill function | HTTP endpoint | Purpose |
|---|---|---|
| `list_cases` | `GET /workspaces/:workspaceId/engine/cases` | List cases, optionally filtered |
| `get_case` | `GET /workspaces/:workspaceId/engine/cases/:caseId` | Fetch one case and analysis |
| `list_stuck_cases` | `GET /workspaces/:workspaceId/engine/stuck-cases` | Cases needing intervention |
| `list_missing_documents` | `GET /workspaces/:workspaceId/engine/missing-documents` | Cases with missing items |
| `summarize_case` | `POST /workspaces/:workspaceId/engine/cases/:caseId/summarize` | Return summary and next actions |
| `draft_reply` | `POST /workspaces/:workspaceId/engine/cases/:caseId/draft-reply` | Return a reply draft |
| `query_cases` | `POST /workspaces/:workspaceId/engine/query` | Natural-language query over cases |
| `list_mailbox_connections` | `GET /workspaces/:workspaceId/engine/mailbox-connections` | Inspect mailbox connection state |
| `connect_mailbox` | `POST /workspaces/:workspaceId/engine/mailbox-connections/initiate` | Start Gmail OAuth |
| `sync_mailbox` | `POST /workspaces/:workspaceId/engine/mailbox-connections/:connectionId/sync` | Trigger mailbox sync |

## Engine endpoints

### List cases

`GET /workspaces/:workspaceId/engine/cases`

Query params:

- `status`
- `q`
- `missingOnly`
- `limit`

Example:

```bash
curl -s \
  -H "Authorization: Bearer $TRADECASE_WORKSPACE_TOKEN" \
  "http://localhost:3027/api/workspaces/$TRADECASE_WORKSPACE_ID/engine/cases?missingOnly=true"
```

### Get case

`GET /workspaces/:workspaceId/engine/cases/:caseId`

Returns:

- raw case object
- analysis block
- qualification block

### List stuck cases

`GET /workspaces/:workspaceId/engine/stuck-cases`

### List missing documents

`GET /workspaces/:workspaceId/engine/missing-documents`

### Summarize case

`POST /workspaces/:workspaceId/engine/cases/:caseId/summarize`

### Draft reply

`POST /workspaces/:workspaceId/engine/cases/:caseId/draft-reply`

### Natural-language query

`POST /workspaces/:workspaceId/engine/query`

Request:

```json
{
  "query": "Which cases are blocked on customer confirmation?"
}
```

### List mailbox connections

`GET /workspaces/:workspaceId/engine/mailbox-connections`

### Initiate mailbox connection

`POST /workspaces/:workspaceId/engine/mailbox-connections/initiate`

Request:

```json
{
  "provider": "gmail"
}
```

Response:

```json
{
  "workspaceId": "ws_123",
  "provider": "gmail",
  "connectionId": "gmail-conn-123",
  "oauthUrl": "https://accounts.google.com/...",
  "scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
  "mode": "read_only"
}
```

### Sync mailbox

`POST /workspaces/:workspaceId/engine/mailbox-connections/:connectionId/sync`

Response:

```json
{
  "workspaceId": "ws_123",
  "connectionId": "gmail-conn-123",
  "queued": false,
  "mode": "incremental",
  "syncedCaseCount": 12,
  "syncedThreadCount": 18,
  "lastSyncedAt": "2026-03-13T10:00:00.000Z"
}
```

## Design rules

- The skill never stores raw Gmail or Outlook credentials.
- OAuth is always initiated against TradeCase OS.
- Workspace API tokens should only hit engine routes.
- The dashboard and the skill both read from the same case model.
- Reply drafting is allowed before send permissions exist.
- Send permissions should remain out of scope for v1.
