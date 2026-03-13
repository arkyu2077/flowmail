# OpenClaw Integration

## Is this a good interaction model?

Yes, with one condition:

OpenClaw should be an interface and orchestration layer, not the place where mailbox state lives.

The target user experience is strong because it matches how trade teams already work:

- they live in email
- they increasingly use AI chat interfaces
- they still need a visual operations board

So the right experience is:

`install skill -> connect mailbox -> view order state dashboard -> ask questions in chat`

That is a good external-trade operator workflow.

## Ideal user journey

### Step 1: install skill

User action:

- install the TradeCase skill inside OpenClaw

Skill purpose:

- connect to TradeCase API
- expose query and action functions

### Step 2: connect mailbox

User action:

- click `Connect Gmail` or `Connect Outlook`

System behavior:

- redirect user to TradeCase OAuth flow
- obtain read-only mailbox permissions
- create mailbox connection record

### Step 3: initial sync

System behavior:

- backfill recent 30 to 90 days
- fetch threads, messages, and attachments
- classify documents
- infer order state
- create trade cases

### Step 4: dashboard is ready

User sees:

- all active cases
- current stage
- missing docs
- recommended next actions

### Step 5: OpenClaw becomes operational assistant

User can ask:

- Show all orders waiting for PO.
- Which customers have missing packing lists?
- Summarize the Harbor Supply case.
- Draft a follow-up for Lakefront Living.

## What the skill should do

The skill should expose a small number of clear functions.

### Read functions

- `list_trade_cases`
- `get_trade_case`
- `get_cases_by_status`
- `get_missing_documents`
- `get_stuck_cases`
- `summarize_case`

### Assist functions

- `draft_reply`
- `suggest_next_action`

### Admin functions

- `connect_mailbox`
- `refresh_mailbox_sync`

## What the skill should not do in v1

- direct raw Gmail reads with unmanaged credentials
- automatic email sending
- automatic state mutation without audit
- broad destructive actions

## Security model

### Recommended

- mailbox credentials are managed by TradeCase OS
- skill authenticates to TradeCase OS using workspace-level credentials
- TradeCase OS returns case data and generated drafts

### Not recommended

- storing Gmail or Outlook tokens inside skill-local config
- letting OpenClaw act as the system of record

## UI split

### Dashboard is for

- managers
- team leads
- users reviewing many cases at once
- exception handling

### OpenClaw chat is for

- quick questions
- case summaries
- fast reply drafting
- ad hoc workflow commands

This split is healthy.
It fits real work better than forcing all activity into a dashboard or all activity into chat.

## Example interaction

### In OpenClaw

User:

`Show me all cases blocked on customer confirmation.`

Skill:

- calls `get_cases_by_status`
- returns top blocked cases
- offers next actions

User:

`Draft a follow-up for PO 45007821.`

Skill:

- calls `draft_reply`
- returns a draft based on the trade case state and missing fields

### In dashboard

User:

- reviews state columns
- opens one case
- checks extracted fields and missing docs
- approves or edits draft

## Product advantage of this model

This model is easier to adopt because the customer does not need to replace:

- Gmail or Outlook
- existing AI workflow habits
- downstream CRM or ERP

Instead, you add:

- structure
- visibility
- queryability
- operational control

## Recommended phased rollout

### v1

- mailbox read-only sync
- dashboard
- OpenClaw read queries

### v1.5

- draft reply generation
- missing-data prompts
- case summaries in chat

### v2

- approval flow
- CRM or spreadsheet sync
- Slack or WeCom alerts

### v3

- limited write actions
- send-on-approval
- multi-mailbox and team ownership rules
