# SAFE_EXPANSION_AUDIT

Date: 2026-11-18 (local session)  
Scope: Read-only inspection before implementation. No application code, schema, or data modified.

## 1. Existing project architecture
- **App:** Electron + React + TypeScript + Vite (`electron-vite`), MongoDB driver 7.8, packaged with `electron-builder` (NSIS). Version `0.3.4` (`package.json`).
- **Layers:** `src/main/*` (main process, DB, business/services, IPC handlers, exports/backup), `src/preload/index.ts` (contextBridge `window.api`), `src/shared/*` (IPC channel constants, domain types, validators/rules), `src/renderer/src/*` (React UI, i18n, pages/panels).
- **IPC:** Channels declared in `src/shared/ipc.ts`; arg validation in `src/main/ipcSchema.ts`; handlers registered/guarded in `src/main/index.ts` (`handle` enforces trusted sender, schema validation, session/permission guards, license re-check for business channels). Preload exposes typed `api` methods only.
- **DB:** `src/main/db.ts` default URI `mongodb://127.0.0.1:27017/?replicaSet=rs0`, DB name `process.env.MONGODB_DB ?? 'pharmacy_pos'`; health/topology/transaction-support probing. Additional db config/connection helpers: `dbConfig.ts`, `dbConnection.ts`, `localDb.ts`, `lanTls.ts`, `mongoAuth.ts`.
- **Auth/licensing/audit:** `src/main/auth.ts`, `src/shared/auth.ts` (roles/permissions, sessions, audit, setup/recovery/change-password, audit chain verification); licensing/gate modules (`license.ts`, `licenseGate.ts`) restrict business operations.

## 2. Existing modules and features
- **Auth/users:** login/logout/state/setup/recovery, users/roles CRUD/list, audit list/export-adjacent permissions.
- **Settings:** company name/phone, currency/precision, tax basis points, default language (en/ar), backup directory (`src/main/settings.ts`, `src/shared/settings.ts`, `src/renderer/src/SettingsPage.tsx`, `DatabaseLocation.tsx`).
- **Inventory/procurement:** categories, units, products (packaging/pricing/stock/expiry/returnDays/barcode fields exist in types/flows), stock movements/adjust/receive carton, suppliers, purchase orders, purchase receipts, product import preview/confirm, section export (`src/main/inventory.ts`, `src/shared/inventory.ts`, `ProcurementPanel.tsx`, `InventoryPage.tsx`).
- **Customers:** list/create/update/delete with name/nationalId/phone/discountBasisPoints (`src/main/customers.ts`, `src/shared/customers.ts`, `CustomersPage.tsx`).
- **POS/cash/returns:** checkout (server-side pricing/tax/stock checks, clientRequestId idempotency index), sales/payments, cashbox movements (in/out/sale/refund), cashier shifts open/close/list, returns and returnable lines/partial-return support, invoice print (`src/main/pos.ts`, `src/shared/pos.ts`, `src/shared/returns.ts`, `PosPage.tsx`, `InvoicePrint.tsx`, `ReturnablePanel.tsx`, `ShiftPanel.tsx`).
- **Reports/exports:** aggregated sales/cashbox/inventory reports, report export (sales/purchasing) and section exports (`src/main/reports.ts`, `src/shared/reports.ts`, `src/main/exports.ts`, `ReportsPage.tsx`, `ReportDownloads.tsx`).
- **Backup:** manual encrypted export/import with passphrase, dialog-based path, confirmation on import, replaces collections except preserved/skipped (`audit`, `sessions` skipped on export) (`src/main/backup.ts`, `backupCrypto.ts`).
- **Dashboard/UI shell:** navigation/sidebar, dashboard widgets, Arabic/English i18n and RTL handling in parts of UI (`App.tsx`, `DashboardPage.tsx`, `i18n.ts`, `styles.css`).
- **Attendance/KPI:** attendance import/days and seller KPIs exist (separate existing capability).

## 3. Existing database collections and relationships (observed)
- **Core/ops:** `settings` (`_id:'company'`), `users`, `sessions`, `audit` (append-only chain semantics), `customers`.
- **Inventory:** `inv_categories`, `inv_units`, `inv_products`, `inv_stock_movements`, `inv_suppliers`, `inv_purchase_orders`, `inv_purchase_receipts`.
- **POS/finance-adjacent:** `pos_sales` (unique `invoiceNo`, partial unique `clientRequestId`), `pos_payments`, `pos_returns`, `pos_cashbox` (indexed `createdAt`), `pos_shifts` (indexed `status`).
- **Relationships:** sales/returns reference products/customers/users context via stored fields/ids; stock movements reference products and sale/receipt refs; PO/receipts reference suppliers/products; cashbox movements reference sale/shift/user context. (No destructive migration planned; new fields/collections must be additive and backward-compatible.)

## 4. Existing POS and invoice workflows
- Checkout builds server-authoritative sale lines/pricing/tax from settings, decrements stock, records sale/payment/stock movements and cashbox sale entry (cash only to drawer) in transactional-capable flow patterns; invoice number generated as ``INV-${Date.now()}-${randomUUID().slice(0,6).toUpperCase()}``.
- Returns/returnable logic exists with deadlines/partial quantities/refund tracking (`src/shared/returns.ts`, `posReturn`/`listReturnable` in main/renderer panels).
- Invoice print (`src/renderer/src/pos/InvoicePrint.tsx`): Arabic RTL receipt template, logo/title/meta/items/totals, shows customer/seller/payment amounts; **no scannable invoice barcode element** and **no configurable ANUBIS company footer block** currently.

## 5. Existing authentication and authorization
- Role/permission model in `src/shared/auth.ts` and enforcement in `src/main/auth.ts` + `channelGuards` in `src/main/index.ts`; backend checks on guarded IPC channels (not UI-only). Session required for guarded actions; license gate re-validated per business call.

## 6. Existing financial calculations
- Monetary values handled in integer cents across POS/reports (`*Cents` fields). Tax recomputed server-side from stored settings during checkout; discounts and line totals computed in cents; cashbox report aggregates movements; sales report aggregates totals/discounts/tax/returns/COGS/profit from stored records.

## 7. Existing printing implementation
- Renderer-driven invoice print component/template (`InvoicePrint.tsx`) invoked from POS flows; styling in `styles.css`. No evidence of multi-format paper/printer/preview settings infrastructure yet (to be verified during Phase 5).

## 8. Existing backup implementation
- Manual `exportBackup`/`importBackup` via Electron dialogs; encrypted envelope (passphrase >= 12), EJSON payload v2 readable (v1 legacy readable), audit logged; import confirms replacement, skips/preserves designated collections (`sessions` skipped, `audit` preserved behavior per implementation intent). **No configurable automatic scheduler, no logout-trigger policy integration, no independent worker/service, no retention/status UI beyond basic messages** found in current implementation.

## 9. Existing testing setup
- **Unit:** Vitest (`npm run test:unit`, `tests/unit/*.test.ts`). **E2E:** Playwright Electron (`playwright.config.ts`, `tests/electron.spec.ts`, serial, expects built `out/` and MongoDB replica set, uses `pharmacy_pos_test`).
- **Baseline (recorded, not passing in this environment):**
  - `npm run typecheck` (2026-11-18): **failed** — `tsc` not recognized (dependencies/tooling not installed/available in PATH).
  - `npm run test:unit` (2026-11-18): **failed to fully pass** — 8 failed suites largely due to missing packages (`fflate`, `hash-wasm`) / environment/module resolution and DB-dependent teardown issues; 1 failed test `scanSigning.test.ts` timeout (5s) on tracked repo scan; summary observed: 8 failed | 14 passed files, 1 failed | 70 passed | 18 skipped tests (duration ~32s). Not a clean baseline.
  - Playwright E2E: **not executed** (requires `npm run build` artifacts and reachable MongoDB replica set per config).

## 10. Files likely affected per requested feature (initial map)
- **F01 Treasury:** `src/main/pos.ts`, new `src/main/treasury.ts` (or extend safely), `src/shared/pos.ts`/new shared treasury types, `src/main/index.ts`, `src/main/ipcSchema.ts`, `src/shared/ipc.ts`, `src/preload/index.ts`, new/extended renderer treasury UI + nav/i18n/styles, reports integration.
- **F02 Suppliers/Customers:** `src/main/customers.ts`, `src/main/inventory.ts` (suppliers), `src/shared/customers.ts`, `src/shared/inventory.ts`, `CustomersPage.tsx`, `ProcurementPanel.tsx`, IPC/shared/preload as needed.
- **F03 Purchasing (PO vs Supply/receipts):** `src/main/inventory.ts`, `src/shared/inventory.ts`, `ProcurementPanel.tsx`, inventory/stock movement logic, validators/IPC.
- **F04 Reports Center:** `src/main/reports.ts`, `src/shared/reports.ts`, `src/main/exports.ts`, `ReportsPage.tsx`, `ReportDownloads.tsx`, filters/pagination/export wiring.
- **F05 Invoices/returns/barcode/footer:** `src/main/pos.ts`, `src/shared/pos.ts`, `src/shared/returns.ts`, `InvoicePrint.tsx`, `PosPage.tsx`, `ReturnablePanel.tsx`, settings/types for footer, barcode generation/scanning integration points.
- **F06 Admin data reset:** new main service + IPC + guarded UI (settings/admin area), backup verification hooks, audit logging; strict scope classification.
- **F07 Optional barcode generator:** `src/main/settings.ts`, `src/shared/settings.ts`, settings UI, product/inventory flows, `src/main/productImport.ts`/barcode utils if any.
- **F08 Expenses:** new collections/types/service/IPC/UI, treasury linkage, reports/dashboard integration.
- **F09 Printing/paper sizes:** `InvoicePrint.tsx`, print invocation paths, settings/UI, CSS/layout variants.
- **F10 Backup system:** `src/main/backup.ts`, `backupCrypto.ts`, settings, scheduler/worker or task integration, UI/status/restore flows, logout hook.
- **F11 Shortcuts F1–F12:** `src/renderer/src/App.tsx` (+ keyboard handling), settings persistence, permission-aware navigation, UI labels.
- **Dashboard:** `DashboardPage.tsx`, reports/data aggregation endpoints as needed.

## 11. Potential risks and compatibility requirements
- **Data safety:** must not drop/truncate/overwrite existing MongoDB data or collections; additive schema changes only; preserve existing invoices/records and internal IDs/references.
- **Financial integrity:** all money in integer cents; no double-counting; actual payments only affect cash/treasury; refunds/voids/expenses/purchases must create traceable, auditable movements; transaction-safe or safe compensating logic consistent with deployment.
- **Permissions:** backend-enforced for all new/destructive/admin operations; no UI-only gating.
- **Invoice compatibility:** keep existing invoice documents readable/searchable; new numbering/barcode must not break old lookups or references.
- **Printing:** changes must not break existing receipt printing; add formats/preview without forcing new deps unnecessarily.
- **Backup/reset:** high-risk; require verified backup before reset, explicit confirmations, audit trail, scoped operational data only.
- **Environment:** current workspace cannot run `tsc`/full unit suite as-is (missing deps); Playwright requires built app + MongoDB replica set — baseline must be re-established in a working env before claiming regressions.
