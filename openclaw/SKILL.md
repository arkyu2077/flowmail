---
name: flowmail
description: Connect an existing FlowMail workspace to OpenClaw. List cases, inspect blockers, summarize business email cases, draft replies, sync mailbox state, and initiate Gmail OAuth without exposing mailbox tokens to the skill.
homepage: https://flowmail.email
metadata: {"clawdbot":{"emoji":"📬","requires":{"bins":["curl"]}}}
---

# FlowMail

Use this skill to query a FlowMail workspace from OpenClaw.

FlowMail remains the system of record:
- mailbox OAuth happens in FlowMail
- raw mailbox state stays in FlowMail
- this skill only calls the FlowMail engine API

Setup (once)
- Create a workspace API token inside FlowMail.
- Export the required environment variables:
  - `FLOWMAIL_API_BASE_URL`
  - `FLOWMAIL_WORKSPACE_ID`
  - `FLOWMAIL_WORKSPACE_TOKEN`
- Optional:
  - `FLOWMAIL_CONNECTION_ID` if you want to trigger syncs without listing connections first

Recommended values
- `FLOWMAIL_API_BASE_URL=https://flowmail.email/api`
- `FLOWMAIL_WORKSPACE_ID=ws_...`
- `FLOWMAIL_WORKSPACE_TOKEN=fm_...`

Common commands
- List cases:
  - `curl -s -H "Authorization: Bearer $FLOWMAIL_WORKSPACE_TOKEN" "$FLOWMAIL_API_BASE_URL/workspaces/$FLOWMAIL_WORKSPACE_ID/engine/cases"`
- Get one case:
  - `curl -s -H "Authorization: Bearer $FLOWMAIL_WORKSPACE_TOKEN" "$FLOWMAIL_API_BASE_URL/workspaces/$FLOWMAIL_WORKSPACE_ID/engine/cases/<caseId>"`
- List stuck cases:
  - `curl -s -H "Authorization: Bearer $FLOWMAIL_WORKSPACE_TOKEN" "$FLOWMAIL_API_BASE_URL/workspaces/$FLOWMAIL_WORKSPACE_ID/engine/stuck-cases"`
- List missing documents:
  - `curl -s -H "Authorization: Bearer $FLOWMAIL_WORKSPACE_TOKEN" "$FLOWMAIL_API_BASE_URL/workspaces/$FLOWMAIL_WORKSPACE_ID/engine/missing-documents"`
- Summarize one case:
  - `curl -s -X POST -H "Authorization: Bearer $FLOWMAIL_WORKSPACE_TOKEN" "$FLOWMAIL_API_BASE_URL/workspaces/$FLOWMAIL_WORKSPACE_ID/engine/cases/<caseId>/summarize"`
- Draft a reply:
  - `curl -s -X POST -H "Authorization: Bearer $FLOWMAIL_WORKSPACE_TOKEN" "$FLOWMAIL_API_BASE_URL/workspaces/$FLOWMAIL_WORKSPACE_ID/engine/cases/<caseId>/draft-reply"`
- Ask a natural-language query:
  - `curl -s -X POST -H "Authorization: Bearer $FLOWMAIL_WORKSPACE_TOKEN" -H "Content-Type: application/json" "$FLOWMAIL_API_BASE_URL/workspaces/$FLOWMAIL_WORKSPACE_ID/engine/query" -d '{"query":"Which cases are blocked on missing documents?"}'`
- List mailbox connections:
  - `curl -s -H "Authorization: Bearer $FLOWMAIL_WORKSPACE_TOKEN" "$FLOWMAIL_API_BASE_URL/workspaces/$FLOWMAIL_WORKSPACE_ID/engine/mailbox-connections"`
- Start Gmail OAuth for the workspace:
  - `curl -s -X POST -H "Authorization: Bearer $FLOWMAIL_WORKSPACE_TOKEN" -H "Content-Type: application/json" "$FLOWMAIL_API_BASE_URL/workspaces/$FLOWMAIL_WORKSPACE_ID/engine/mailbox-connections/initiate" -d '{"provider":"gmail"}'`
- Sync a known mailbox connection:
  - `curl -s -X POST -H "Authorization: Bearer $FLOWMAIL_WORKSPACE_TOKEN" "$FLOWMAIL_API_BASE_URL/workspaces/$FLOWMAIL_WORKSPACE_ID/engine/mailbox-connections/$FLOWMAIL_CONNECTION_ID/sync"`

Operational guidance
- Prefer engine routes over UI routes.
- Do not store Gmail or Outlook tokens in the skill.
- Confirm with the user before initiating a sync or OAuth flow.
- Treat FlowMail as the source of truth for case state, missing data, and draft replies.
