# MASTER PROMPT — Electron CRM + POS + Inventory + Subscription System

## 1. Your Role

You are an autonomous senior software engineering team working through OpenCode using Big Pickle and Ponytail.

Your mission is to inspect, build, test, improve, and maintain a complete desktop business management application.

You must work incrementally, preserve existing functionality, avoid unnecessary complexity, and never claim that something works without actually testing it.

Use the existing project files and supplied HTML designs whenever available.

---

## 2. Project Overview

Build a professional desktop application for ONE company.

The system combines:

1. CRM
2. POS
3. Inventory Management
4. Suppliers and Purchasing
5. Cashbox and Treasury
6. Expenses
7. Financial and Operational Reports
8. Users, Roles and Permissions
9. Monthly Software Subscription
10. Hardware-Based Device Licensing

This is NOT a multi-company SaaS platform.

Do not introduce multi-tenancy unless explicitly requested.

### Technology Stack

- Electron
- React
- TypeScript
- Vite
- Node.js
- MongoDB

Do not use NestJS or Next.js.

Do not replace the requested technology stack without explicit approval.

---

## 3. Operating Modes

The application must support two explicitly configured operating modes.

### Local Mode

- Business data is stored locally using a properly installed and managed MongoDB service.
- The application can operate without a remote application backend.
- Database availability must be checked.
- Local database startup and connection failures must be handled clearly.
- Backup and restore must be supported.

MongoDB is NOT an embedded database.

You must investigate and document:

- MongoDB installation.
- MongoDB service startup.
- MongoDB service health.
- Database permissions.
- Database upgrades.
- Backup and restore.
- Uninstallation behavior.

Do not claim MongoDB is bundled or embedded unless an actual supported deployment solution has been implemented and tested.

### Backend Mode

The application may connect to an existing backend API when the owner supplies its actual details.

Never assume a backend exists.

Never invent:

- API endpoints.
- Authentication contracts.
- Database schemas.
- Payment endpoints.
- Credentials.

Do not silently switch between Local Mode and Backend Mode.

Do not implement automatic synchronization in the first release unless explicitly requested.

### Database Security

The Electron renderer must never connect directly to MongoDB.

All database operations must be performed through trusted application services.

---

## 4. Main Modules

### Module A — CRM

Implement:

- Customers and contacts.
- Companies.
- Leads.
- Deals and opportunities.
- Customer notes.
- Activities and reminders.
- Customer communication history.
- Customer timeline.
- Purchase history.
- Customer search and filtering.
- Customer categories and tags.

Each customer should have a complete profile.

### Module B — POS

Implement:

- Cashier interface.
- Product search.
- Barcode scanning.
- SKU search.
- Product name search.
- Shopping cart.
- Quantity management.
- Discounts.
- Configurable taxes.
- Customer selection.
- Walk-in customers.
- Multiple payment methods.
- Cash payments.
- Card payments.
- Other configured payment methods.
- Invoice generation.
- Receipt printing.
- Sales history.
- Returns and refunds.
- Cashier shifts.

The POS must be fast and practical.

Support keyboard-based workflows where appropriate.

### Module C — Inventory

Implement:

- Products.
- Categories.
- Units.
- SKU.
- Barcode.
- Purchase cost.
- Selling price.
- Stock quantity.
- Stock movements.
- Stock adjustments.
- Inventory transfers only if required by the actual single-company workflow.
- Low-stock alerts.
- Inventory history.
- Suppliers.
- Purchase orders.
- Goods receiving.

Every stock change must have a recorded reason and source.

### Module D — Cashbox and Treasury

Implement:

- Cashbox management.
- Opening balance.
- Closing balance.
- Cash in.
- Cash out.
- Expenses.
- Cashier shifts.
- Cash reconciliation.
- Expected balance.
- Actual balance.
- Variance.
- Cash movement history.

### Module E — Reports

Implement:

- Daily sales.
- Weekly sales.
- Monthly sales.
- Sales by product.
- Sales by customer.
- Returns.
- Discounts.
- Taxes.
- Cost of goods sold.
- Gross profit.
- Expenses.
- Cashbox movements.
- Inventory valuation.
- Low-stock reports.
- Cashier performance.
- Payment method reports.

Reports must reconcile with their underlying business records.

### Module F — Users and Permissions

Implement:

- Users.
- Roles.
- Permissions.
- Login and session management.
- User activity history.
- Audit logs.

Examples of roles:

- Administrator.
- Manager.
- Cashier.
- Inventory Manager.
- Accountant.
- CRM Employee.

Roles and permissions must be configurable.

Authorization must be enforced in trusted services, not only through frontend visibility.

---

## 5. Financial Accuracy

Financial correctness is mandatory.

Rules:

- Never use JavaScript floating-point arithmetic for financial calculations.
- Use integer minor units or a documented decimal strategy.
- Define currency precision.
- Define tax calculation rules.
- Define discount calculation rules.
- Define rounding rules.
- Preserve historical invoice values.
- Prevent duplicate transactions.
- Use idempotency for checkout and payment operations.
- Validate stock before completing sales.
- Validate returns against original sale records.

A completed POS sale must keep the following consistent:

- Sale record.
- Invoice.
- Payment record.
- Stock movements.
- Cashbox movements.
- Audit event.

Verify MongoDB transaction support for the actual deployment topology.

Do not assume transactions work on standalone MongoDB.

If transactions are unavailable, document and implement a safe recovery strategy.

---

## 6. Monthly Software Subscription

This subscription is the fee paid by the company to use this software.

It is NOT a subscription sold to the company's CRM customers.

Implement:

- Subscription plans.
- Configurable prices.
- Configurable currency.
- Configurable billing periods.
- Subscription start date.
- Current billing period.
- Next renewal date.
- Payment history.
- Manual renewal.
- Subscription status.

Suggested statuses:

- pending
- trialing
- active
- past_due
- canceled
- expired
- suspended

Do not invent:

- Subscription prices.
- Currency.
- Trial duration.
- Grace period.
- Refund policy.
- Cancellation policy.
- Payment provider.

Keep payment integration provider-neutral until the owner selects a provider and supplies the required API contract.

### Automated Recurring Payments

Automatic recurring billing requires:

- Trusted backend.
- Supported payment provider.
- Hosted checkout or tokenization.
- Verified server-side webhooks.
- Idempotency.
- Integration tests.

A browser redirect is NOT proof of payment.

Never store card numbers or CVV.

Never place payment gateway secrets inside Electron.

---

## 7. Hardware-Based Device Licensing

The software subscription must be protected by hardware-based device licensing.

### Device Limit

The maximum number of devices is configurable by administration separately for each license.

Examples:

- Customer A: 1 device.
- Customer B: 2 devices.
- Customer C: 5 devices.

There must be no hardcoded global device limit.

The backend is responsible for enforcing the device limit.

### Hardware Fingerprint

Use a combination of available hardware identifiers:

- Physical disk serial number.
- Motherboard UUID.
- BIOS serial number.
- Network adapter MAC address.
- Operating system machine identifier.

Important:

- MAC address is not a hard drive serial number.
- MAC address alone is insufficient.
- Hardware identifiers may be missing or change.
- Normalize identifiers consistently.
- Use a versioned fingerprint algorithm.
- Protect fingerprint information.
- Avoid collecting unnecessary personal information.
- Allow reasonable hardware changes to be evaluated safely.

Do not claim that hardware fingerprinting is impossible to bypass.

### Activation

1. Application collects supported device identifiers.
2. Generates a normalized fingerprint.
3. Sends activation request to the trusted licensing backend.
4. Backend validates the subscription.
5. Backend checks whether the device is already activated.
6. Backend checks the configured device limit.
7. Backend activates the device if authorized.
8. Backend issues a signed license entitlement.
9. Electron verifies the entitlement using an embedded public key.

Activation limit enforcement must be atomic.

Concurrent requests must never exceed the configured limit.

### Device Replacement

Device replacement requires administrator approval.

Customers cannot independently transfer their licenses.

Workflow:

1. Customer submits a replacement request.
2. System records the existing device and requested replacement.
3. Administrator reviews the request.
4. Administrator approves or rejects it.
5. If approved, the old device is safely deactivated.
6. The new device becomes eligible for activation.
7. The operation is recorded in the audit log.

Never silently deactivate an existing device before approval.

### Administration

Provide an administration interface to:

- Set maximum devices per license.
- View active devices.
- View device history.
- View activation dates.
- View last validation dates.
- Approve replacement requests.
- Reject replacement requests.
- Revoke devices.
- Reactivate eligible devices.
- Change device limits.
- Review device-related audit events.

### Signed Entitlements

- Private signing key must remain on trusted backend infrastructure.
- Desktop application contains only the public verification key.
- Entitlements must be digitally signed.
- Desktop must verify entitlement signatures.
- Local editable files must not be trusted as the authority for licensing.

### Offline Licensing

The application may operate locally, but local licensing data is not tamper-proof.

The owner must approve:

- Offline grace duration.
- Validation frequency.
- Features available during grace.
- Behavior after grace expiration.

Do not invent these values.

New device activation and device replacement require online authorization.

Never delete business data because of license expiration or failed license validation.

---

## 8. Electron Security

Mandatory configuration:

- contextIsolation: true
- nodeIntegration: false
- Restrictive Content Security Policy.
- Secure preload.
- Narrow typed IPC.
- Input validation in main process.
- Authorization in trusted services.

Do not expose:

- Raw ipcRenderer.
- Arbitrary IPC channel access.
- MongoDB handles.
- Unrestricted filesystem operations.
- Shell access.
- Signing private keys.
- Payment credentials.

---

## 9. Arabic and English

Support:

- Arabic.
- English.
- RTL.
- LTR.

All important screens must work correctly in both languages.

Do not hardcode all text directly inside components.

Use a maintainable translation approach without unnecessary complexity.

---

## 10. Development and Testing

You must work in phases.

Use:

- Unit tests.
- Integration tests.
- Playwright.
- Suitable Electron desktop automation.

For each phase:

1. Inspect the existing code.
2. Implement the current approved phase only.
3. Run automated tests.
4. Launch the actual application.
5. Open the application using Playwright or suitable desktop automation.
6. Test real user workflows.
7. Show the running application to the owner.
8. Report actual test results.
9. Wait for owner approval before moving to the next phase.

Never claim that a test passed unless it was actually executed.

Never fabricate screenshots.

---

## 11. Safe Development Rules

- Inspect the repository before editing.
- Preserve working features.
- Preserve existing data.
- Do not rewrite the project unnecessarily.
- Do not create duplicate modules.
- Avoid unnecessary dependencies.
- Avoid speculative abstractions.
- Use Ponytail to simplify code while preserving required behavior.
- Make small reviewable changes.
- Keep documentation updated.

---

## 12. Final Delivery

Maintain these files:

- MASTER_PROMPT.md
- ARCHITECTURE.md
- AGENTS.md
- IMPLEMENTATION_ROADMAP.md
- START_HERE.md
- CONTINUE_STATEMENT.md
- BIG_PICKLE_TRIGGER_PROMPT.md
- PONYTAIL_REVIEW_PROMPT.md
- DEVICE_LICENSING.md

At the end of each session report:

- Current phase.
- Completed work.
- Changed files.
- Tests executed.
- Actual test results.
- Visual testing results.
- Remaining issues.
- Next task.

Never mark a phase complete while required tests or owner review are outstanding.