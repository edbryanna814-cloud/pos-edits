# IMPLEMENTATION ROADMAP

## Development Policy

Build the application incrementally.

Complete and test each phase before starting the next one.

After every phase:

1. Run automated tests.
2. Launch the actual application.
3. Test using Playwright.
4. Test Electron-specific behavior.
5. Show the running application to the owner.
6. Report results.
7. Wait for owner approval.

Do not skip phases.

---

## Phase 0 — Repository Discovery

Tasks:

- Inspect repository.
- Inspect package files.
- Inspect existing HTML files.
- Identify existing features.
- Identify dependencies.
- Identify current architecture.
- Run existing application.
- Run existing tests.
- Identify MongoDB requirements.

Deliverables:

- Repository map.
- Existing functionality report.
- Technical risks.
- Baseline test report.
- Phase 1 implementation plan.

Do not make destructive changes.

## Phase 1 — Electron Foundation

Implement:

- Electron Main.
- React Renderer.
- Vite.
- TypeScript.
- Secure Preload.
- Typed IPC.
- BrowserWindow configuration.
- Application startup.
- Basic navigation.
- Error handling.

Test:

- Application startup.
- Renderer loading.
- IPC communication.
- Context isolation.
- Node integration disabled.

## Phase 2 — Database and Settings

Implement:

- MongoDB connection.
- Local database strategy.
- Connection health.
- Company settings.
- Currency.
- Localization.
- Tax configuration.
- Database validation.
- Indexes.
- Backup and restore.

Test:

- Database connection.
- Persistence after restart.
- Database unavailable behavior.
- Backup and restore.

## Phase 3 — Authentication and Permissions

Implement:

- Login.
- Users.
- Roles.
- Permissions.
- Sessions.
- Audit logs.

Test:

- Valid login.
- Invalid login.
- Permission restrictions.
- Unauthorized operation rejection.
- Audit event creation.

## Phase 4 — CRM

Implement:

- Customers.
- Contacts.
- Companies.
- Leads.
- Deals.
- Activities.
- Notes.
- Timeline.
- Purchase history.

Test all create, edit, delete/disable, search and filtering workflows.

## Phase 5 — Catalog and Inventory

Implement:

- Products.
- Categories.
- Units.
- SKU.
- Barcode.
- Prices.
- Stock balances.
- Stock movements.
- Adjustments.
- Low-stock alerts.
- Suppliers.
- Purchasing.
- Receiving.

Test stock calculations and movement history.

## Phase 6 — POS and Cashbox

Implement:

- Product lookup.
- Barcode scanning.
- Cart.
- Quantity management.
- Discounts.
- Taxes.
- Customers.
- Payments.
- Invoices.
- Receipts.
- Sales history.
- Returns.
- Refunds.
- Cashbox.
- Cashier shifts.
- Opening and closing.

Test:

- Complete sale.
- Duplicate checkout prevention.
- Payment retries.
- Stock consistency.
- Cashbox consistency.
- Valid returns.
- Invalid returns.
- Shift closing.

## Phase 7 — Reports

Implement:

- Sales reports.
- Product reports.
- Customer reports.
- Returns.
- Discounts.
- Taxes.
- COGS.
- Gross profit.
- Expenses.
- Cashbox.
- Inventory.
- Cashier performance.
- Payment method reports.

Test report totals against source records.

## Phase 8 — Monthly Software Subscription

> **Status (C0, D-LIC-14): panel workstream, not app screens. Not
> implemented.** Plans, prices, renewal, and payment history live in the
> separate, owner-controlled licence panel (`docs/licensing/`). The app never
> prices or manages a subscription in any role.

Important: this is the subscription paid by the company to use the application.

Implement:

- Plans.
- Prices.
- Currency.
- Billing periods.
- Subscription records.
- Renewal.
- Payment history.
- Status management.
- Manual renewal.

Do not invent pricing or payment provider details.

Test:

- New subscription.
- Activation.
- Renewal.
- Expiration.
- Suspension.
- Payment history.
- Unauthorized status changes.

Automated recurring billing requires a trusted backend and verified payment provider webhooks.

## Phase 9 — Hardware-Based Device Licensing

> **Status (C0, D-LIC-14): panel workstream, not app screens. Not
> implemented.** No licensing backend exists. Licence management, activation
> limits, replacement approval, and the administration dashboard are the
> separate licence panel. App work is limited to the verifier, gate, and
> read-only status in `docs/licensing/BUILDER-BRIEF.md` (B1–B5).

Read DEVICE_LICENSING.md.

Implement:

### Hardware Fingerprint

- Disk serial.
- Motherboard UUID.
- BIOS serial.
- MAC address.
- OS machine identifier.
- Normalization.
- Fingerprint versioning.
- Missing identifier handling.

### License Management

- License records.
- Customer association.
- Subscription association.
- Configurable device limits.
- Active device count.
- Device activation history.

### Activation

- Activation request.
- Subscription validation.
- Device fingerprint validation.
- Backend-side device limit enforcement.
- Atomic activation.
- Signed entitlement issuance.
- Desktop signature verification.

### Device Replacement

- Customer replacement request.
- Administrator review.
- Approval.
- Rejection.
- Safe old-device deactivation.
- New-device activation.
- Audit history.

### Administration Dashboard

- View licenses.
- Configure device limits.
- View registered devices.
- View active devices.
- View activation history.
- Review replacement requests.
- Approve/reject requests.
- Revoke devices.
- Reactivate eligible devices.

### Offline Licensing

Implement only the policy approved by the owner.

Do not invent an offline grace duration.

Test:

1. First activation.
2. Same-device reactivation.
3. Multiple authorized devices.
4. Activation over limit.
5. Concurrent activation.
6. Replacement request.
7. Administrator approval.
8. Administrator rejection.
9. Device revocation.
10. Subscription expiration.
11. Subscription renewal.
12. Offline validation.
13. Hardware identifier changes.
14. Missing hardware identifiers.
15. Invalid signature.
16. Expired entitlement.
17. Copying local data to another computer.

Acceptance:

- Device limit is configurable per license.
- Backend prevents limit bypass.
- Replacement requires administrator approval.
- Entitlement signature is verified.
- Private signing key is not in Electron.
- Licensing errors do not delete business data.

## Phase 10 — Security and Production Release

Implement and verify:

- Security review.
- Electron packaging.
- Application signing strategy.
- MongoDB installation documentation.
- Backup and restore.
- Upgrade behavior.
- Regression testing.
- Performance testing.
- Licensing abuse tests.
- Release documentation.

Do not declare production-ready until critical security and recovery tests pass.

---

## Phase Completion Report

For each phase provide:

- Phase number.
- Status.
- Implemented features.
- Changed files.
- Automated tests.
- Test results.
- Playwright results.
- Electron test results.
- Screenshots or live visual demonstration where available.
- Remaining issues.
- Owner approval status.