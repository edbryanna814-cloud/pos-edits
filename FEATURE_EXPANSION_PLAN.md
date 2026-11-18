# FEATURE_EXPANSION_PLAN

Date: 2026-11-18  
Basis: `MASTER_PROMPT.md`, `CONTINUE_STATEMENT.md`, `SAFE_EXPANSION_AUDIT.md`, repository inspection. Implementation not started in this step.

## Principles (apply to every phase)
- Additive, backward-compatible changes only; no rebuild, no destructive DB ops, no renames/removal of working features without verified compatibility.
- Reuse existing modules/components/patterns (`src/main` services, `src/shared` types/IPC, preload bridge, renderer pages/i18n/styles).
- Backend permission checks + auditable admin/financial actions; integer-cents financial math; traceable movements/transactions.
- Small phases: implement, test (unit/integration as applicable + Playwright visual on running app), fix regressions, then write `PHASE_X_COMPLETION_REPORT.md`.

## Feature mapping (11 requested features)

| # | Feature | Integration approach (safe) | Primary areas (expected) |
|---|---|---|---|
| 01 | Financial Treasury / Cashbox | Evolve existing cashbox/shift/payment concepts into a dedicated treasury view/service tracking money movements only; derive/link movements from actual sales payments, purchase payments, expenses, refunds/void handling; support partial/credit rules (no cash counted until paid), opening/closing, history/refs/user/time/method/notes; prevent unauthorized edits of history. | `pos.ts`/cashbox, new treasury service/types, `reports`, IPC/schema/preload, renderer Treasury page/nav, audit |
| 02 | Suppliers & Customers | Extend existing `inv_suppliers` and `customers` models/UI (add optional fields, totals/balances/history views computed from linked transactions) without creating parallel systems; search/filter/edit, archive/deactivate instead of deleting referenced records. | `inventory.ts`, `customers.ts`, shared types, procurement/customers UI, reports |
| 03 | Purchasing: Purchase Orders vs Supply Orders | Separate authorization (PO) from goods receipt (supply/receipt) with statuses, partial/multi receipts, remaining quantities, receiver/notes/damages; PO creation must not change stock, receipts update stock by accepted qty only, prevent over-receipt except authorized exception; link to supplier/invoices; avoid duplicate stock additions. | `inventory.ts`, shared inventory/PO types, procurement UI, stock movements, IPC |
| 04 | Reports Center | Unified center for sales & purchasing reports with required breakdowns/filters/sort/pagination/totals and print/PDF/Excel/CSV export using real records and accurate calcs. | `reports.ts`, `exports.ts`, shared report types, Reports UI/downloads |
| 05 | Invoices & Returns improvements | Add short unique human-readable invoice numbers for new invoices while preserving internal IDs and old invoice access; add scannable invoice barcode (lookup/open) on screen/print; configurable ANUBIS footer (company name/phones/address/contact via settings, no hardcoded fictitious data); verify/fix partial item returns to be per-selected-item/qty with traceable return tx, correct inventory/financial updates, no full-invoice reset, no over-return, idempotent/safe. | `pos.ts`, `returns.ts` shared/main, `InvoicePrint.tsx`, POS/return UI, settings, barcode scan/lookup hooks |
| 06 | Admin Data Reset | Admin-only, authenticated, explicit confirmation phrase + preview of classified scope; verified backup before reset; audit who/when; reset selected operational/business data only; never delete config/licensing/admin creds/company/system essentials or unrelated collections. | new reset service/IPC/UI, backup integration, auth/permissions, audit |
| 07 | Optional Barcode Generator | Setting `Enable Automatic Barcode Generation` (on/off, persisted); when on generate/print/lookup without duplicates per rules; when off accept manual/existing barcodes and scanning continues; never auto-replace existing barcodes. | settings, product/inventory flows, UI, import/validation |
| 08 | Flexible Expenses | Dedicated expenses (custom title/category, amount/date/method/desc/optional attachment if feasible/notes/responsible, history/search/filter/print/export); paid expenses create linked outgoing treasury movement and update balance once (no duplicates); unpaid do not affect cash balance. | new expense collection/service/types/IPC/UI, treasury, reports/dashboard |
| 09 | Flexible Printing & Paper Sizes | Support A5/A4/A6/80mm/58mm/custom (where supported) with printer/paper/orientation selection, preview, correct margins/scaling, no clipping/missing barcode/unnecessary blanks; reuse existing printing approach where possible. | print components/CSS, POS/invoice/report print flows, settings/UI |
| 10 | Automatic Backup System | Configurable interval (1/2/4/6/8/12/24h + custom hours) stored in settings but execution independent of open UI page (lightweight worker/service or scheduled mechanism consistent with architecture); auto by interval + backup on logout (dedupe), safe shutdown handling, selectable destination, last success/status/errors, manual backup, safe restore, integrity verification, retention/no overwrite-only/no false success, protect contents, non-blocking to POS, safe logout policy on failure. | `backup.ts`, scheduler/worker/task, settings/UI/status, auth/logout hooks, integrity checks |
| 11 | Keyboard Shortcuts F1–F12 | Configurable persistent mappings (admin/user-appropriate), permission-safe navigation, no duplicates unless supported, UI labels where useful; ignore while typing in inputs/editables, avoid reserved combos/multi-trigger, consistent across pages. | renderer App/global key handling, settings persistence, permissions |

## Database & compatibility notes
- Inspect/reuse existing collections; add only needed fields/collections with backward-compatible defaults; preserve all existing documents and invoice accessibility.
- Add indexes only where justified and safe; keep referential/application-level integrity and auditable financial records.
- Treasury balance must be derived from actual financial movements, never by summing invoice totals alone.

## Implementation roadmap (phased)
- **Phase 0 — Audit/Baseline (current):** `SAFE_EXPANSION_AUDIT.md`, `FEATURE_EXPANSION_PLAN.md`, record baseline tests/checks; identify env blockers. *No feature code changes.*
- **Phase 1 — Suppliers, Customers, Purchasing:** extend supplier/customer data & history/balances; implement PO vs Supply Order workflows, partial/multi receipts, inventory integration and validations.
- **Phase 2 — Invoices & Returns:** short invoice numbers + barcode + configurable ANUBIS footer; harden/complete partial item returns; preserve old invoices/lookups.
- **Phase 3 — Treasury & Expenses:** treasury movements/balances/open-close/history linked to real transactions; flexible expenses with treasury integration.
- **Phase 4 — Dashboard & Reports:** unified Reports Center (sales/purchases, filters, exports/print) + enhanced dashboard widgets/charts from real data.
- **Phase 5 — Printing & Barcode Settings:** multi-format printing/preview; optional automatic barcode generation setting and behavior.
- **Phase 6 — Backup System:** configurable independent scheduled backups, logout backup, status/integrity/retention/restore UX.
- **Phase 7 — Shortcuts & Admin Reset:** configurable F1–F12 (permission-safe) and protected operational data reset flow.
- **Phase 8 — Full Regression:** run full relevant automated tests + Playwright visual verification of all new/affected existing flows; fix regressions; final confirmation.

## Testing/verification plan (per phase)
- Run/record available automated checks (`typecheck`, `test:unit`, targeted tests) and Playwright E2E on the **actual running app** (visible browser/Electron window per environment capability) covering required scenarios; check console/API/DB results.
- Never test destructive operations against production data; use `pharmacy_pos_test`/safe targets as configured.
- Document executed vs not-executed tests and actual results in each `PHASE_X_COMPLETION_REPORT.md`.

## Known baseline blockers (to resolve before claiming green)
- Toolchain/deps not ready here: `tsc` missing, unit tests failing due to absent `fflate`/`hash-wasm` and other environment issues; Playwright requires build + MongoDB replica set.
