# Tasks

## Phase 1: foundation

- [x] Define the wedge and MVP boundary.
- [x] Create project workspace and docs.
- [x] Create public-source manifest.
- [x] Create pain-signal dataset.
- [x] Create sample trade cases.

## Phase 2: local MVP

- [x] Build a single-screen UI.
- [x] Implement attachment classification.
- [x] Implement field extraction.
- [x] Implement workflow inference.
- [x] Implement next-action recommendations.
- [x] Implement draft reply generation.
- [x] Support custom pasted threads.
- [x] Define OpenClaw skill API contract.
- [x] Create a mock backend for case queries and draft generation.

## Phase 3: next execution steps

- [x] Finish Gmail read-only connector token exchange and persistence.
- [ ] Add Microsoft Graph read-only connector.
- [x] Persist threads and extracted entities.
- [ ] Add a reviewer correction queue.
- [ ] Add OCR ingestion.
- [ ] Add seed-user evaluation report.

## Connector groundwork

- [x] Add Gmail OAuth URL builder and callback skeleton.
- [x] Exchange Google auth code for tokens.
- [x] Persist mailbox connection records.
- [x] Trigger first backfill job after mailbox auth.

## Validation metrics for seed users

- Field extraction accuracy by document type
- Workflow-state accuracy by thread
- Time saved per handled thread
- Number of missing-data interventions
- Percentage of draft replies accepted with small edits
