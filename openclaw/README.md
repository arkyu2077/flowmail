# OpenClaw and ClawHub package

This folder now contains the first ClawHub-distributable package shape for the
FlowMail MVP.

Main files:

- `SKILL.md`: the real ClawHub skill body
- `_meta.json`: publish metadata stub that should be updated before release
- `skill-manifest.json`: legacy draft manifest kept only for reference

The intended runtime pattern is still:

1. user installs the skill in OpenClaw or ClawHub
2. the skill calls the FlowMail engine API with a workspace API token
3. mailbox OAuth is completed against FlowMail
4. the skill uses engine routes for listing cases, querying blockers, and drafting replies

Important:

- the skill does not store Gmail or Outlook tokens
- the skill authenticates with a workspace-scoped API token
- the FlowMail dashboard remains the operational source of truth
- OpenClaw remains the conversational entry point
