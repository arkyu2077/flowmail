# Positioning

## Product definition

TradeCase OS is not another email client and not another CRM.

It is an `email-native operating layer` for external-trade workflows.

Its job is to convert:

- inbox threads
- replies
- attachments
- quote and shipping documents

into:

- a trade case
- a workflow state
- missing-data alerts
- next actions
- draft replies

## Core abstraction

The product does not manage email as the primary object.
It manages a `Trade Case`.

A trade case is the business object behind a cluster of messages and documents.

### Trade Case fields

- account
- buyer contact
- product or SKU
- price and currency
- incoterm
- required documents
- current workflow state
- missing data
- owner
- next action
- thread history

## The wedge

Do not position this as:

- AI email assistant
- shared inbox for trade teams
- trade CRM
- document OCR platform

Position it as:

`Turn Quote / PI / PO / Invoice / BL email threads into visible order status.`

## ICP

The first ideal customer profile is:

- China-based export team
- 5 to 30 people
- Gmail or Outlook as the operational system of record
- heavy use of PDF or Excel attachments
- no strong front-office order workflow software

Typical users:

- sales coordinator
- merchandiser
- export documentation specialist
- founder or sales manager

## Job to be done

When trade emails keep moving across a shared inbox, I need every thread to become a visible order state so my team does not lose context, miss follow-up, or manually reconstruct what happened from attachments.

## Product promise

The promise is:

- fewer missed follow-ups
- less manual attachment reading
- faster handoffs
- clearer order state
- safer reply drafting

## Interaction model

The best interaction model is hybrid:

1. `OpenClaw` is the conversational and execution entry point.
2. `TradeCase OS dashboard` is the operational source of truth.

This split is important.

### Why chat alone is not enough

Trade operations require:

- queue views
- stuck-case visibility
- ownership visibility
- exception management
- auditability

Those need a dashboard.

### Why dashboard alone is not enough

Frontline users often want quick answers such as:

- Which orders are waiting on PI confirmation?
- What is missing for Harbor Supply?
- Draft a follow-up for PO 45007821.

Those fit a chatbot or agent entry point well.

## Correct platform position

OpenClaw should be treated as:

- an entry point
- a command surface
- a workflow execution interface

It should not be treated as:

- the primary database
- the only UI
- the sole security boundary

TradeCase OS should own:

- OAuth connections
- case storage
- state machine
- attachment storage
- extraction results
- dashboard
- approval and audit trail

## MVP statement

`Connect mailbox -> classify attachments -> infer order state -> show missing data -> suggest next action -> draft reply`

That is the first real product.

## Non-goals for v1

- full CRM replacement
- ERP replacement
- automatic email sending
- direct purchase execution
- multi-channel communication orchestration
