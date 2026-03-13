# OpenClaw Local MVP Technical Design

Last updated: 2026-03-13

This document defines the first OpenClaw-installable MVP for FlowMail.

The target shape is:

```text
gog adapter -> persistent local state -> business case engine -> OpenClaw plugin tools
```

## 1. Product goal

The first MVP is not a SaaS control plane.

It is a local-first OpenClaw plugin that:

- reads business email through `gog`
- persists mailbox and case state across sessions
- classifies emails into business cases
- lets OpenClaw query and act on those cases without re-reading raw mail every time

This avoids the main failure mode seen in stateless cron triage:

- repeated notifications for the same thread
- re-processing the same mailbox history
- unnecessary model and command overhead
- no distinction between `user read` and `agent handled`

## 2. Why this architecture

### Why `gog`

`gog` already has acceptance inside the OpenClaw ecosystem.
It lowers integration friction because users who already have Gmail working in OpenClaw can reuse that setup.

### Why local persistence

For an OpenClaw-first MVP, local persistence is the shortest path:

- no hosted backend required
- easier privacy story
- easier install and experimentation
- fewer moving parts than webhook or Pub/Sub infrastructure

### Why business cases instead of digest-only triage

Digest triage solves "is there something new".
Case state solves "what business workflow exists and what is the next action".

The MVP should store:

- mail state
- case state
- agent actions
- defer / dismiss / handled history

## 3. Scope of v1

### In scope

- Gmail via `gog`
- local persistent state
- one active case pack at a time
- background polling
- deduplication across runs
- case materialization
- OpenClaw tools for querying and updating case state

### Out of scope

- multi-provider mailbox support
- hosted SaaS
- multi-user RBAC
- webhook / Pub/Sub infrastructure
- heavy UI
- native binary dependencies

## 4. Core implementation choice: JSON state for v1

The ideal long-term local store is SQLite.

The first plugin MVP should still use a JSON state store because:

- OpenClaw plugin installation is simplest when the package has no native build step
- `better-sqlite3` and similar native modules complicate install portability
- JSON is enough for the first case volume and tool surface

The state layer should still be implemented behind a storage interface so SQLite can replace it later without changing tools.

## 5. Package layout

```text
packages/openclaw-flowmail/
  package.json
  openclaw.plugin.json
  README.md
  tsconfig.json
  skills/
    flowmail/
      SKILL.md
  src/
    index.ts
    config.ts
    types.ts
    adapters/
      gog.ts
    engine/
      case-packs.ts
      qualify.ts
      analyze.ts
      materialize.ts
    state/
      store.ts
    services/
      sync.ts
      actions.ts
      query.ts
```

## 6. Runtime architecture

### 6.1 `gog adapter`

Responsibilities:

- execute configured `gog` commands
- fetch thread summaries
- optionally fetch full thread detail
- normalize output into internal mail objects

Design note:

The plugin should not hardcode one fragile `gog` command format.
It should accept configurable command templates and provide good defaults.

### 6.2 persistent state

Responsibilities:

- store seen thread fingerprints
- store message-level state
- store case-level state
- store deferred / dismissed / handled actions
- store sync metadata and last poll results

### 6.3 business case engine

Responsibilities:

- qualify threads into a case pack
- extract structured business fields
- infer workflow state
- compute missing data and next actions
- create and update persistent cases

### 6.4 OpenClaw plugin tools

Responsibilities:

- expose engine state to agents
- trigger sync on demand
- mutate case state safely
- avoid direct raw mailbox traversal by default

## 7. Configuration model

The plugin should expose a config schema with these fields:

- `gmailAccount`
- `gogPath`
- `listCommandTemplate`
- `threadCommandTemplate`
- `syncQuery`
- `casePackId`
- `maxThreads`
- `pollIntervalMinutes`
- `autoPoll`
- `stateDir`

Recommended defaults:

- `gogPath = "gog"`
- `syncQuery = "newer_than:30d -category:promotions -category:social -category:forums -category:updates"`
- `casePackId = "external_trade_order"`
- `maxThreads = 25`
- `pollIntervalMinutes = 10`
- `autoPoll = true`

## 8. State model

### 8.1 top-level plugin state

- plugin version
- last sync time
- last sync error
- current case pack
- last poll cursor

### 8.2 thread state

- `threadId`
- `fingerprint`
- `subject`
- `latestMessageAt`
- `participants`
- `mailState`
  - `new`
  - `seen`
  - `dismissed`
  - `deferred`
  - `handled`
- `lastNotifiedAt`

### 8.3 case state

- `caseId`
- `casePackId`
- `threadIds`
- `title`
- `account`
- `status`
- `priority`
- `missingData`
- `nextActions`
- `draftReply`
- `handledState`
  - `open`
  - `deferred`
  - `handled`
  - `dismissed`
- `deferUntil`
- `updatedAt`

### 8.4 action history

- `id`
- `targetType`
- `targetId`
- `action`
- `reason`
- `actor`
- `createdAt`

## 9. Case-pack model

Each case pack includes:

- `id`
- `name`
- `qualification rules`
- `field extractors`
- `document-type heuristics`
- `status machine`
- `draft template logic`

The first live packs are:

- `external_trade_order`
- `saas_revenue_order`

## 10. Sync flow

```text
poller
  -> run gog list command
  -> normalize candidate threads
  -> deduplicate by fingerprint and update timestamp
  -> optionally fetch per-thread detail
  -> run case qualification
  -> materialize or update cases
  -> mark changed cases
  -> store sync result
```

If polling fails:

- keep the old state
- store the error
- expose the error through `flowmail_status`

## 11. Tool surface

The MVP should expose these tools:

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

These tools operate on persistent case state, not raw Gmail state.

## 12. Operational rules

- polling should never notify OpenClaw main session for every message
- only changed or actionable cases should surface
- dismissed cases should remain archived until a user explicitly reopens them
- deferred cases should stay snoozed until their resume time
- handled cases should survive restarts and future sync cycles
- Gmail labels may be mirrored later, but local state is the source of truth

## 13. UX model inside OpenClaw

The plugin should feel simple from the agent side:

- sync the mailbox
- ask for open or stuck cases
- inspect a case
- defer, dismiss, or mark handled
- ask for a reply draft

It should not require the user to reason about raw threads every time.

## 14. Install and packaging target

The package should be installable from a local path or packed tarball:

```bash
openclaw plugins install /path/to/openclaw-flowmail
```

or:

```bash
openclaw plugins install /path/to/flowmail-openclaw-flowmail-0.1.0.tgz
```

The package should contain:

- plugin manifest
- extension entrypoint
- config schema
- a skill prompt bundle for agent guidance
- no native build step

## 15. Validation criteria for v1

The MVP is successful if:

- the plugin installs in OpenClaw
- sync can run without any hosted service
- state survives restart
- duplicate processing is avoided across runs
- at least one case pack can produce stable cases
- OpenClaw can query cases and change case state through tools

## 16. Post-v1 upgrades

- replace JSON store with SQLite
- add Gmail label mirroring
- add richer background scheduling
- add more case packs
- add optional hosted control plane
