# Audit 0.2.0 — features, security, gaps

Date: 2026-11-12
Branch: `field-test/0.2.0` (commit `b8695f5`)
Scope: Electron main process, preload bridge, renderer, bundled MongoDB, tests and docs.

This audit is a code review, not a penetration test. Items marked *verified in code* were read in
the current source; items marked *documented* come from the Gate 1 closure plan and remain open.

## 1. What the application does

| Area | Delivered |
| --- | --- |
| Sign-in and users | First-run administrator setup, no default account, sign-in with lockout, forced password change, user create/update, static built-in roles, single active session, session expiry and cleanup |
| Audit | Append-only audit log with a hash chain and a verifier; fallback file when the database is down |
| Settings | Company name, currency and decimals, tax rate, default language, backup folder |
| Dashboard | Today's sales and count, product count, low-stock list, cashbox balance, latest sales |
| Point of sale | Barcode/SKU search, unit and box pricing, cart, discount, tax, cash/card/other payment, change due, idempotent checkout, receipt view, full-invoice return, cashier shift open/close, cash in/out |
| Inventory | Categories, units, products with cost/selling/box prices, minimum stock and expiry date, stock adjustments, suppliers, purchase orders with receiving, stock movements |
| CRM | Customers, contacts, leads, deals, activities, notes, customer purchase history |
| Reports | Sales totals, discounts, tax, cost of goods and profit, by payment method, cashier, product and customer; cashbox report; inventory report |
| Backups | Encrypted export (passphrase), import with confirmation, audit log preserved across restore, sessions excluded |
| Licensing | Signed device-bound licence, offline verification with public key only, expiry, activation screen, legacy codes accepted |
| Packaging | Bundled MongoDB with authentication and replica set, NSIS installer, English/Arabic with RTL, smoke checks |

## 2. Security controls in place

- Renderer runs with context isolation, no Node integration, sandboxed preload, strict CSP.
- Every IPC channel checks the sender frame; privileged channels require a session and permission.
- Passwords use Argon2id with per-user salt; legacy SHA-256 hashes are upgraded on sign-in and force a reset.
- Session tokens are random, stored only as SHA-256 hashes, expire and are removed by a TTL index.
- Login lockout after repeated failures; every attempt audited.
- Audit entries are hash-chained and the whole chain can be verified.
- MongoDB runs with authentication, a key file, a dedicated app user limited to its own database, and credentials encrypted with the OS keystore.
- Backups use Argon2id key derivation and AES-256-GCM with a per-file salt and IV; the passphrase is never stored.
- Licence verification uses an embedded public key; the private key never ships with the app. Expiry and device binding are checked.
- Licence activation is rate limited (5 attempts per hour) and refuses a code that shortens an existing term.
- Money is handled in integer cents throughout.

## 3. Findings

### P1 — should be fixed before selling

> Status: items 1–4 are fixed later in this branch; see section 7.

1. **Licence is checked only at sign-in and first-run setup.** A session that is already open keeps
   working after the licence expires, and nothing re-checks during the session. *Verified in code*
   (`src/main/index.ts` guards `AuthLogin`/`AuthSetup`; no periodic or per-call check).
   Fix: re-check the licence on a timer and on each privileged call, then lock the UI without
   deleting data.
2. **Tax is supplied by the renderer and trusted by the server.** A wrong or tampered client value is
   written to the sale and to every report. *Verified in code* (`createSale` takes `input.taxCents`).
   Fix: recompute tax on the server from saved settings and server-side line totals.
3. **Card and "other" sales are posted to the cashbox as cash.** Sales always add the full total to
   the cash drawer, and returns always subtract the full total, so the drawer does not match the
   physical cash. *Verified in code* (`pos.ts` cashbox insert uses `totalCents` for every method;
   return refund uses `sale.totalCents`).
   Fix: post cash sales only, record card/other as separate movements, and refund to the original method.
4. **Low-stock uses a hardcoded threshold of 6** instead of each product's minimum. The dashboard and
   the inventory report therefore disagree with what the shop configured. *Verified in code*
   (`DashboardPage.tsx` and `reports.ts` both compare against `6`).
   Fix: compare `stockQuantity <= minStock` everywhere.

### P2 — fix soon, plan before sale

5. **Returns are full-invoice only.** Partial returns are impossible and the preload type still exposes
   an unused `lines?` field. *Verified in code* (`pos.ts` return works on the whole sale; server ignores `lines`).
6. **Cash in/out is not audited.** Shift open/close and sales are audited, manual drawer movements are not.
7. **One global shift.** Only one shift can be open for the whole shop, and any POS user can close a
   shift opened by someone else.
8. **Purchasing is thin.** Purchase orders can be created and received, but not edited, cancelled, or
   returned; there is no supplier ledger or balance.
9. **Opening stock is not a stock movement.** Creating a product with a quantity writes the balance but
   leaves no movement record, so the stock history does not explain the opening figure.
10. **No batch/lot tracking.** One expiry date per product; no per-batch quantities, which matters for
    pharmacy recall and FEFO.
11. **Backup restore is not transactional** and still accepts legacy plaintext files (a deliberate
    compatibility choice). A failed restore can leave a partly replaced database.
12. **No password recovery.** With a single administrator, a lost password means manual database work.
13. **Activation rate limit is in memory** and resets on restart.
14. **No auto-update and no code-signing certificate.** Every update is a manual installer, and Windows
    SmartScreen will warn until signing is in place.

### P3 — nice to have / cleanup

15. No CSV/Excel export and no date-range filter on reports; totals cover all time.
16. No pagination: lists and reports load everything, which will slow down after a few years of sales.
17. `roles.manage` and `permissions.manage` exist but nothing uses them; roles are static built-ins.
18. No prescription/Rx capture and no receipt-printer integration.
19. No panel integration; licences are still issued out of band by hand.

## 4. Removed as unnecessary (this branch)

- MAC address display and copy button on activation; the device code alone is enough.
- Licence fields the UI never needed (price, currency, period, count, raw failure reason).
- Database panel rows that exposed internal details (database name, topology, transactions) and the raw
  database error text.
- Technical labels: "Secure shell", "Typed IPC", "MongoDB" health line, "ISO 4217", "Server version",
  "Latency".
- Unused translation keys and unreachable "foundation checks" copy.
- Machine sessions from backup export and restore (they are local state, not business data).

Kept on purpose: the legacy `PHM1` verifier (old codes must still activate), and the price fields inside
old signed codes (they are ignored, not displayed; removing them would break existing signatures).

## 5. Not verified here

- BitLocker on the second PC, support-bundle generation, clean-PC install and SmartScreen behaviour.
- No third-party penetration test.
- No load test with realistic long-term data volumes.

## 6. Recommendation

Fix P1 items 1–4 before selling. They affect money and licence control, which is exactly what a buyer
tests first. P2 items can follow in 0.2.x, except 9 and 11 which touch data integrity and are cheap to
fix now.

## 7. Fixes applied on this branch

1. **Licence re-checked on every call.** `src/main/licenseGate.ts` lists the few channels that stay open
   (activation, session state, sign-out, password change, health/version). Every other channel asks
   `hasValidLicense()` first, so an expiry mid-session cannot sell. The renderer also polls the licence
   every minute and on window focus, and locks to the activation screen. Covered by
   `tests/unit/licenseGate.test.ts`.
2. **Tax computed on the server.** `createSale` reads the saved tax rate and recomputes tax from the
   server-priced subtotal minus discount. The renderer's `taxCents` is ignored.
3. **Cashbox follows the payment method.** Only cash sales add to the drawer and only cash sales create
   a cash refund; card and other payments stay in the payments collection. Covered in the business-flow
   test (cash net 2200, card sale leaves the drawer untouched).
4. **Low stock uses each product's minimum.** Dashboard and inventory report both compare
   `stockQuantity <= minStock`.

Also removed the unused `lines?` field from the return API, since returns are full-invoice only.

