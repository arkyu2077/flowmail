---
name: flowmail
description: Query persistent business email workflows instead of re-reading raw mailbox history. Use for stuck cases, missing documents, defer/dismiss/handled actions, and reply drafts.
metadata:
  openclaw:
    requires:
      config:
        - plugin: openclaw-flowmail
---

# FlowMail

Use the FlowMail plugin when the user asks about operational email workflows.

Prefer these tools over raw `gog` calls when available:

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

Guidance:

- Treat the plugin state as the source of truth for handled, deferred, and dismissed items.
- Use `flowmail_sync` before answering if the user asks for the latest mailbox state.
- Use `flowmail_list_stuck_cases` for blockers.
- Use `flowmail_list_missing_documents` for missing paperwork or fields.
- Use `flowmail_get_case` before mutating a case.
- Confirm before dismissing or marking handled if the user did not ask explicitly.
