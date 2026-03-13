# FlowMail

FlowMail is a local-first OpenClaw plugin that turns business email into persistent workflows.

It uses:

- `gog` as the Gmail adapter
- a local JSON store for persistent state
- lightweight business case packs
- OpenClaw tools for sync, query, and case actions

## Install from a local folder

```bash
openclaw plugins install ./packages/openclaw-flowmail
```

For a dev link instead of a copy:

```bash
openclaw plugins install -l ./packages/openclaw-flowmail
```

Restart the Gateway afterwards.

## Requirements

- `gog` available on the Gateway host `PATH`
- a working Gmail account already usable from `gog`

## Configure

Add this under `plugins.entries.openclaw-flowmail` in `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "openclaw-flowmail": {
        "enabled": true,
        "config": {
          "gmailAccount": "work@example.com",
          "casePackId": "external_trade_order",
          "syncQuery": "newer_than:30d -category:promotions -category:social -category:forums -category:updates",
          "maxThreads": 25,
          "pollIntervalMinutes": 10,
          "autoPoll": true
        }
      }
    }
  }
}
```

## `gog` command templates

The plugin shells out to configurable command templates so you can adapt it to the exact `gog` syntax you use.

Available template variables:

- `{{gmailAccount}}`
- `{{syncQuery}}`
- `{{maxThreads}}`
- `{{threadId}}`
- `{{gogPath}}`

Defaults:

- list:
  - `gog gmail search --account "{{gmailAccount}}" --query "{{syncQuery}}" --limit {{maxThreads}} --json`
- thread detail:
  - `gog gmail get "{{threadId}}" --account "{{gmailAccount}}" --json`

If your local `gog` build differs, override those two templates in plugin config.

## Tools

This plugin registers these tools:

- `flowmail_status`
- `flowmail_sync`
- `flowmail_list_cases`
- `flowmail_get_case`
- `flowmail_list_stuck_cases`
- `flowmail_list_missing_documents`
- `flowmail_mark_handled`
- `flowmail_defer_case`
- `flowmail_dismiss_case`
- `flowmail_draft_reply`

## Current workflow packs

- `external_trade_order`
- `saas_revenue_order`

## Notes

- This MVP uses local JSON persistence instead of SQLite to keep install friction low.
- `gog` is the mailbox adapter. The source of truth for case state is the plugin store, not Gmail labels.
- Gmail labels can be mirrored in a later version.
