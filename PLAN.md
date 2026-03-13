# Plan

## Thesis

External-trade operations are still managed across inboxes, attachments, spreadsheets, and portal logins.
The product wedge is to convert those fragmented signals into a structured "trade case" with explicit state, owners, evidence, and next actions.

## Deliverables for v1

1. Public research map:
   - pain signal taxonomy
   - source manifest
   - workflow blueprint
   - document schema assumptions
2. Local MVP:
   - sample trade cases
   - attachment classification
   - field extraction with evidence
   - workflow inference
   - suggested actions and draft reply
3. Execution plan:
   - 30-day build path
   - seed-user validation sequence

## Product principles

- Read before write.
- Show evidence for every extracted field.
- Keep humans in control for outbound communication.
- Make status explicit.
- Make missing data visible.

## 30-day sequence

### Week 1

- Finalize pain taxonomy.
- Finalize core document types.
- Finalize workflow states.
- Build synthetic sample set.

### Week 2

- Ship read-only parser MVP.
- Validate extraction rules against sample cases.
- Add confidence and evidence UI.

### Week 3

- Add custom thread playground.
- Add draft generation and missing-data logic.
- Prepare Gmail and Outlook integration interfaces.

### Week 4

- Run 3 to 5 seed-user validations.
- Collect corrected fields.
- Rank failure modes and exceptions.
- Lock v2 priorities.

## Core workflow states

- Inquiry received
- Quote prepared
- Quote sent
- Purchase order received
- Awaiting payment or confirmation
- Shipment preparation
- Shipment in progress
- Documentation exception

## Core document types

- Inquiry notes
- Quote
- Proforma invoice
- Purchase order
- Commercial invoice
- Packing list
- Bill of lading
- Shipping instruction
- Payment proof
