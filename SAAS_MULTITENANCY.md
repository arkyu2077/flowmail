# SaaS Multitenancy

TradeCase is currently a local single-tenant prototype.

The current Gmail path is already workspace-aware, but the Feishu and Notion exporters still rely on global environment variables. That is acceptable for local validation and incorrect for a public SaaS.

This document defines the production shape.

## Product boundary

TradeCase is the system of record.

The bot is only a client.

The correct flow is:

`user signs in to TradeCase`
-> `user creates or joins a workspace`
-> `workspace admin installs connectors`
-> `bot asks TradeCase API to act within that workspace`
-> `TradeCase reads or writes through workspace-scoped connectors`

That means:

- Gmail tokens belong to a workspace connection
- Notion tokens belong to a workspace connection
- Feishu tokens and target tables belong to a workspace connection
- the bot never owns the downstream credentials
- no provider credential should live only in `.env` except the app-level client secrets needed to start OAuth

## Identity layers

There are three separate identity problems.

### 1. TradeCase user identity

This is your own SaaS login.

Use it for:

- signup and login
- workspace membership
- role-based access
- audit attribution

Suggested roles:

- `owner`
- `admin`
- `member`
- `viewer`

### 2. Connector identity

This is the customer's authorization to an external system.

Examples:

- Gmail OAuth grant for a mailbox
- Notion OAuth grant for a workspace
- Feishu app installation and user or tenant grant for a Bitable target

These grants must be stored per workspace, not globally.

### 3. Bot identity

The bot is not a source of truth and should not be a credential vault for customer SaaS tools.

The bot should send:

- `workspace_id`
- `user_id`
- requested action
- optional target connector id

TradeCase then evaluates policy and uses the correct workspace connector.

## Why the current prototype is not SaaS-ready

The current Feishu adapter reads:

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_BITABLE_APP_TOKEN`
- `FEISHU_BITABLE_TABLE_ID`

from process environment in [server/feishu.ts](/Users/yuxh-mac/Desktop/yu/flowmail/server/feishu.ts#L5).

The current Notion adapter reads:

- `NOTION_API_KEY`
- `NOTION_DATA_SOURCE_ID`

from process environment in [server/notion.ts](/Users/yuxh-mac/Desktop/yu/flowmail/server/notion.ts#L5).

The export endpoints call those global adapters directly in [server/index.ts](/Users/yuxh-mac/Desktop/yu/flowmail/server/index.ts#L704) and [server/index.ts](/Users/yuxh-mac/Desktop/yu/flowmail/server/index.ts#L732).

That means every customer would write into the same Feishu table or the same Notion data source, which is not acceptable for a public product.

## Production connector model

Each workspace should own its own connector records.

Suggested tables:

- `users`
- `workspaces`
- `workspace_memberships`
- `connector_accounts`
- `connector_targets`
- `connector_tokens`
- `cases`
- `case_events`
- `export_jobs`
- `audit_logs`

### `connector_accounts`

One record per installed external integration.

Suggested columns:

- `id`
- `workspace_id`
- `provider`
- `external_workspace_id`
- `external_user_id`
- `status`
- `granted_scopes`
- `connected_by_user_id`
- `connected_at`
- `last_refreshed_at`
- `last_error`

### `connector_tokens`

Store tokens encrypted at rest.

Suggested columns:

- `connector_account_id`
- `access_token_encrypted`
- `refresh_token_encrypted`
- `token_type`
- `expires_at`
- `metadata_json`

### `connector_targets`

Store the destination selected by the customer.

Examples:

- a Feishu Bitable app and table
- a Notion data source
- a future Slack channel or CRM board

Suggested columns:

- `id`
- `workspace_id`
- `connector_account_id`
- `target_type`
- `external_target_id`
- `display_name`
- `config_json`

## Correct OAuth and installation flows

### Gmail

One Google OAuth app can serve many customers.

Each customer still grants access individually.

TradeCase stores one mailbox connection per workspace and refreshes tokens per connection.

### Notion

TradeCase should use a public Notion integration with OAuth, not a single global internal secret.

The customer flow should be:

1. Admin clicks `Connect Notion`
2. TradeCase redirects to Notion OAuth
3. Customer authorizes the integration to a Notion workspace
4. TradeCase stores the returned access token against that TradeCase workspace
5. Customer chooses the destination data source

### Feishu

TradeCase should not rely on `tenant_access_token/internal` for public SaaS usage.

That flow is for an internal self-built app and is fine for local testing, but not as the only production model for unrelated customer tenants.

Production Feishu support should look like this:

1. Customer installs or authorizes your Feishu app
2. TradeCase stores the resulting tenant-scoped or user-scoped grant per workspace
3. Customer picks a Bitable target
4. TradeCase writes to that selected target only for that workspace

The exact Feishu token type depends on the target:

- shared tenant resource: usually tenant-scoped app access is enough
- user-owned or user-protected resource: user authorization is required

That last distinction is an implementation detail, not a product decision.

Product-wise, the rule is simple:

`each customer authorizes their own Feishu environment`

## UX

The customer-facing setup should be:

1. Sign up to TradeCase
2. Create a workspace
3. Connect Gmail
4. Choose or create a case pack
5. Connect Feishu or Notion
6. Select a destination table or data source
7. Turn on sync

After that, the bot can answer:

- `show me orders missing PI`
- `push current cases to Feishu`
- `sync Gmail again`
- `draft a follow-up for the delayed cases`

The important point is that the bot is invoking actions inside TradeCase. The bot is not directly holding the customer's Google, Notion, or Feishu credentials.

## Security requirements

- Encrypt all access and refresh tokens at rest
- Keep app-level client secrets only in server env or secret manager
- Store provider grants per workspace
- Require `owner` or `admin` to connect or disconnect destinations
- Log every export and every write action
- Support revocation and reconnect

## Migration plan from current prototype

### Phase 1

- Keep Gmail as-is
- replace Feishu env-based target with database-backed workspace targets
- replace Notion env-based target with database-backed workspace targets
- add TradeCase auth and workspace membership

### Phase 2

- add real Notion OAuth install flow
- add real Feishu install or authorization flow
- add destination picker UI

### Phase 3

- add connector policies
- add per-case export automations
- add approval rules for bot-triggered writes

## Product rule

If a customer asks TradeCase to write into Gmail, Notion, or Feishu, the answer should always be:

`only after that customer's workspace has installed and authorized that connector`

That is the SaaS shape.
