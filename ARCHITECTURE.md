# ARCHITECTURE — Electron CRM + POS + Inventory

## 1. Architectural Style

Use a pragmatic Modular Monolith.

The project is a desktop application for one company.

Do not introduce microservices or excessive Domain-Driven Design infrastructure.

Priorities:

1. Maintainability.
2. Security.
3. Data integrity.
4. Clear module boundaries.
5. Testability.
6. Minimal unnecessary complexity.

## 2. Technology Stack

- Electron.
- React.
- TypeScript.
- Vite.
- Node.js.
- MongoDB.
- Playwright.

Do not use NestJS or Next.js.

## 3. Application Structure

Separate the application into these logical areas:

### Electron Main Process

Responsible for:

- Application lifecycle.
- BrowserWindow configuration.
- Secure IPC handlers.
- Database connection.
- Trusted business services.
- Filesystem operations.
- Licensing communication.
- Application-level configuration.

### Preload

Responsible for:

- Exposing a limited API to React.
- Typed communication with Electron Main.
- Restricting available IPC operations.

Never expose raw ipcRenderer.

### React Renderer

Responsible for:

- User interface.
- Forms.
- Tables.
- Navigation.
- Localization.
- User interactions.

Renderer must not access MongoDB directly.

Renderer must not access unrestricted Node.js APIs.

### Database Layer

Responsible for:

- MongoDB connection.
- Schemas and validation.
- Indexes.
- Repositories.
- Data persistence.
- Migrations where required.

### Business Services

Responsible for:

- Business rules.
- Validation.
- Permissions.
- Transaction workflows.
- Audit events.

## 4. Suggested Module Structure

Organize modules logically:

- auth
- users
- roles
- permissions
- crm
- catalog
- inventory
- purchasing
- pos
- payments
- cashbox
- expenses
- reports
- subscription
- licensing
- audit
- settings
- backup

Do not create unnecessary abstraction layers.

Modules must not directly manipulate another module's internal repositories.

Use explicit service interfaces for cross-module operations.

## 5. Main Data Entities

Potential entities:

### Authentication

- User
- Role
- Permission
- Session

### CRM

- Contact
- Company
- Lead
- Deal
- Activity
- Note

### Catalog and Inventory

- Product
- Category
- Unit
- StockBalance
- StockMovement
- Supplier
- PurchaseOrder
- PurchaseReceipt

### POS

- Sale
- SaleLine
- Payment
- Return
- ReturnLine
- Invoice

### Cashbox

- Cashbox
- CashMovement
- CashierShift
- Expense

### Subscription

- SoftwarePlan
- SoftwareSubscription
- SubscriptionPayment

### Licensing

- License
- DeviceActivation
- DeviceReplacementRequest

### Audit

- AuditEvent

These are conceptual entities. Refine them after inspecting existing code.

Do not create unnecessary entities before implementing their workflows.

## 6. POS Data Consistency

A completed sale must coordinate:

- Sale.
- Invoice.
- Payment.
- Stock movements.
- Cashbox movement.
- Audit event.

Use MongoDB transactions only if the actual database topology supports them.

Do not assume standalone MongoDB supports transactions.

If transactions are unavailable, implement a documented recovery strategy with:

- Explicit operation states.
- Idempotency.
- Retry handling.
- Reconciliation.
- Recovery of interrupted operations.

## 7. Financial Data

Use integer minor units or a documented decimal strategy.

Never use floating-point arithmetic for money.

Every monetary record must use an explicit currency.

Define:

- Currency precision.
- Tax calculation.
- Discount order.
- Rounding.
- Refund calculations.

## 8. Electron Security

Required:

- contextIsolation: true
- nodeIntegration: false
- Secure preload.
- Typed allowlisted IPC.
- Payload validation.
- Restrictive CSP.
- Authorization in trusted services.

Never expose database connections to React.

Never expose arbitrary filesystem or shell access.

## 9. Subscription and Licensing Architecture

### Separation of Responsibilities

Subscription module:

- Plans.
- Prices.
- Billing periods.
- Renewal.
- Subscription status.
- Payment history.

Licensing module:

- Licenses.
- Device limits.
- Device fingerprints.
- Device activations.
- Device replacement.
- Device revocation.
- Signed entitlements.

Software subscription is not the same as CRM customer subscriptions.

### Licensing Authority

The trusted licensing backend is authoritative for:

- Device count.
- Activation.
- Device replacement approval.
- Revocation.
- Subscription eligibility.
- Entitlement issuance.

Local-only licensing may be used for development/demo, but must not be described as strong anti-copy protection.

### Hardware Fingerprint

Use available signals:

- Disk serial.
- Motherboard UUID.
- BIOS serial.
- MAC address.
- OS machine identifier.

MAC alone is insufficient.

Identifiers can change or be unavailable.

Use a versioned normalized fingerprint and a documented matching policy.

Protect raw identifiers.

### Activation

The backend must:

1. Authenticate the request.
2. Validate license and subscription.
3. Detect an already activated device.
4. Check device limit.
5. Atomically register a new activation.
6. Issue a signed entitlement.

Concurrent requests must not exceed the device limit.

### Device Replacement

Replacement requires administrator approval.

The system must record:

- Existing device.
- Requested new device.
- Request reason.
- Request date.
- Reviewer.
- Decision.
- Decision date.
- Audit event.

Do not deactivate the existing device before approval and safe completion of the replacement workflow.

### Signed Entitlements

- Private key remains on trusted backend.
- Public key is embedded in Electron.
- Desktop verifies signatures.
- Include relevant license, device, status and expiry claims.
- Support key rotation deliberately.

### Offline Policy

Offline grace duration must be approved by the owner.

Do not invent the duration.

New activations and replacements require online authorization.

Never delete local business data because of licensing problems.

## 10. Payment Integration

Keep provider-neutral interfaces until a provider is selected.

Payment confirmation must come from verified server-side provider evidence.

A frontend redirect is not proof of payment.

Use idempotency.

Never store card numbers or CVV.

Never store payment secrets in Electron.

## 11. Localization

Support Arabic and English.

Test:

- RTL.
- LTR.
- Tables.
- Forms.
- Dialogs.
- Navigation.
- Currency.
- Dates.
- Number formatting.

## 12. Backup and Recovery

Provide:

- Database backup.
- Restore.
- Backup verification.
- Error reporting.
- Safe upgrade process.

Do not delete user data during updates or license failures.

## 13. Testing

Unit tests:

- Business rules.
- Money calculations.
- Permissions.
- Fingerprint normalization.

Integration tests:

- Database operations.
- POS workflows.
- Subscription.
- Licensing.

Security tests:

- IPC restrictions.
- Unauthorized actions.
- Entitlement signature verification.
- Device activation limits.
- Concurrent activation.

UI tests:

- Playwright.
- Electron desktop automation.

Test the actual supported MongoDB deployment topology.