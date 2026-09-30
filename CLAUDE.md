# invoice-matching

An SAP CAP (Cloud Application Programming) service that matches supplier invoices
against open purchase orders, with a human-in-the-loop approve/reject/escalate
workflow recorded as `MatchDecisions`.

## Stack

- Node.js, ESM (`"type": "module"` in package.json)
- `@sap/cds` v10 (CAP framework)
- `@cap-js/sqlite` for local persistence (`db/matching.sqlite`)
- No build step, no test suite, no CI configured yet.

## Layout (standard CAP convention)

- `db/schema.cds` — domain model (entities, associations, enums)
- `db/data/*.csv` — seed/sample data, one file per entity, named `<namespace>-<Entity>.csv`
- `srv/service.cds` — service definition (projections + custom actions)
- `srv/service.js` — service implementation (handlers for the actions/events declared in service.cds)
- `app/` — plain HTML frontends (no framework/build tooling)

## Domain model

- `Suppliers` — has many `Invoices` and `PurchaseOrders`
- `Invoices` — belongs to a `Supplier`, has a `status` (`open` / `matched` / `escalated`) and an optional `matchedPO`
- `PurchaseOrders` — belongs to a `Supplier`, has an `isOpen` flag
- `MatchDecisions` — links one `Invoice` to one `PurchaseOrder`, with an `outcome`
  (`proposed` / `approved` / `rejected` / `escalated`), `confidence`, `rationale`, `decidedBy`, `decidedAt`

## Match decision workflow (`srv/service.js`)

This is the core business rule of the app — respect it when touching decision logic:

- Allowed transitions: `proposed → approved | rejected | escalated`, `approved → escalated`.
  `rejected` and `escalated` are terminal.
- Creating a `MatchDecisions` row (`before CREATE`) validates the invoice/PO exist and
  that the PO is still `isOpen`, then defaults `outcome: 'proposed'`.
- After creation (`after CREATE`), the linked `Invoice.status` is set to `matched` and the
  `PurchaseOrder.isOpen` is set to `false` — a decision is provisionally "locked in" the moment it's proposed.
- The `approveMatch` / `rejectMatch` / `escalateMatch` actions each go through
  `assertTransition` before mutating anything, and each has its own side effects on the
  linked Invoice/PO (e.g. `rejected` reopens the PO and resets the invoice to `open`).
- When adding a new outcome or action, update `ALLOWED_TRANSITIONS` *and* the side-effect
  branch in `handleTransition` — they're easy to get out of sync.

## Running locally

```
npm start        # or: cds watch
```

`cds watch` picks up changes to `.cds` files and service handlers automatically.

## Conventions

- CDS namespace: `ap.matching`. Entities use the `cuid` (UUID `ID`) and `managed`
  (createdAt/createdBy/modifiedAt/modifiedBy) mixins from `@sap/cds/common`.
- Monetary amounts are `Decimal(15,2)`; `MatchDecisions.confidence` is `Decimal(3,2)` (0.00–1.00).
- `db/matching.sqlite*` (including `-shm`/`-wal`) is a real local dev database checked into
  the repo — be careful not to silently discard data in it when regenerating seed data.
