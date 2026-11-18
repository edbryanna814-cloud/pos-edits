# MASTER PROMPT — SAFE FEATURE EXPANSION
## Existing Application Enhancement — Big Pickle + Ponytail

You are working on an EXISTING, FUNCTIONAL application. Your task is to extend it with new features while preserving every existing feature, workflow, UI component, business rule, database record, integration, and working behavior.

This is NOT a rebuild, redesign from scratch, replacement, or migration to a different architecture.

Your highest priority is:

**ADD FEATURES WITHOUT BREAKING, REMOVING, RESETTING, OR REPLACING ANYTHING THAT ALREADY WORKS.**

Use Big Pickle as the primary implementation agent and Ponytail as the engineering simplification and review workflow.

---

# 1. NON-NEGOTIABLE RULES

1. Inspect the entire existing repository before changing anything.
2. Understand the current architecture, database models, API routes, UI pages, permissions, POS workflow, invoices, inventory, and existing tests.
3. Do not delete existing files or features unless I explicitly authorize it.
4. Do not replace existing working implementations simply because you prefer another approach.
5. Do not rename existing database collections, fields, routes, or components without a verified compatibility requirement.
6. Do not reset, drop, truncate, or overwrite existing MongoDB data.
7. Do not introduce breaking database migrations.
8. Reuse existing components, utilities, services, and dependencies whenever possible.
9. Follow the current project's architecture and coding conventions.
10. Do not introduce unnecessary libraries, abstractions, services, or dependencies.
11. Keep all existing functionality working.
12. Every new feature must integrate with the existing application instead of becoming a disconnected module.
13. Preserve existing UI styling and design language. Improve visual quality where necessary without destroying the current identity.
14. Maintain backward compatibility with existing records and invoices.
15. Never use mock data as a replacement for real application functionality.

## Before modifying anything

Create:

`SAFE_EXPANSION_AUDIT.md`

Include:
- Existing project architecture.
- Existing modules and features.
- Existing database collections and relationships.
- Existing POS and invoice workflows.
- Existing authentication and authorization.
- Existing financial calculations.
- Existing printing implementation.
- Existing backup implementation, if any.
- Existing testing setup.
- Files that each requested feature needs to modify.
- Potential risks and compatibility requirements.

Then create:

`FEATURE_EXPANSION_PLAN.md`

Map all 11 requested features to the existing application and explain how each one will be integrated safely.

After completing the audit and plan, proceed with implementation. Do not stop after writing documentation.

---

# 2. NEW FEATURES

## FEATURE 01 — Financial Treasury / Cashbox

Create a dedicated Treasury (الخزنة) module.

Its responsibility is tracking MONEY MOVEMENTS ONLY.

It must be connected to the existing sales and purchasing workflows.

### Required functionality

- Cash received from sales.
- Cash paid for purchases.
- Money received.
- Money paid.
- Current cash balance.
- Opening balance.
- Closing balance.
- Cash movement history.
- Movement date and time.
- Movement reference.
- Transaction type.
- Payment method.
- Description and notes.
- User responsible for the transaction.

### Financial rules

1. Sales payments must increase the treasury balance according to the actual amount received.
2. Purchase payments must decrease the treasury balance according to the actual amount paid.
3. Partial payments must be supported.
4. Credit transactions must not be counted as received or paid money until an actual payment occurs.
5. Refunds must create appropriate reverse financial movements.
6. Voided transactions must be handled safely without silently deleting historical financial records.
7. Never count the same financial transaction twice.
8. All treasury movements must be traceable to their original transaction.
9. Prevent unauthorized modification of historical financial movements.
10. Record who performed every financial operation.

The treasury must not become another inventory or invoice management module. It manages financial movements only.

---

## FEATURE 02 — Suppliers and Customers

Create or extend:

- Suppliers management.
- Customers management.

### Suppliers

Each supplier should support:
- Name.
- Phone number.
- Address.
- Email (optional).
- Tax information (optional).
- Notes.
- Previous transactions.
- Total purchases.
- Total paid.
- Outstanding balance.

### Customers

Each customer should support:
- Name.
- Phone number.
- Address.
- Email (optional).
- Notes.
- Sales history.
- Total purchases.
- Total paid.
- Outstanding balance.

### Important

- Integrate suppliers with purchasing.
- Integrate customers with POS and sales invoices.
- Support searching and filtering.
- Support editing and viewing transaction history.
- Prevent deleting records that are referenced by financial or commercial transactions.
- Use archive/deactivation where appropriate.

Do not create duplicate customer or supplier systems if they already exist.

---

## FEATURE 03 — Purchasing: Supply Orders and Purchase Orders

Improve the existing purchasing module.

I need TWO separate workflows:

### A. Purchase Order (أمر شراء)

This represents a request or authorization to purchase products from a supplier.

Fields:
- Purchase order number.
- Supplier.
- Products.
- Quantities.
- Expected prices.
- Order date.
- Expected delivery date.
- Notes.
- Created by.
- Status.

Suggested statuses:
- Draft.
- Pending approval.
- Approved.
- Sent to supplier.
- Partially received.
- Completed.
- Cancelled.

### B. Supply Order (أمر توريد)

This represents the actual delivery/receipt of goods from the supplier.

Fields:
- Supply order number.
- Related purchase order.
- Supplier.
- Received products.
- Received quantities.
- Damaged quantities, if applicable.
- Remaining quantities.
- Receipt date.
- Receiving employee.
- Notes.

### Business logic

- Creating a purchase order must not automatically increase inventory.
- Receiving goods through a supply order updates inventory according to the actual accepted quantities.
- Partial deliveries must be supported.
- Multiple supply orders can belong to one purchase order.
- Do not allow receiving quantities that violate the remaining order quantities without an authorized exception.
- Purchase invoices must be linked to the correct supplier and purchasing records.
- Avoid duplicate stock additions.

Integrate with the existing inventory and product management systems.

---

## FEATURE 04 — Reports Center

Create a unified Reports Center.

I need to generate, view, filter, print, and export reports for both SALES and PURCHASES.

### Sales reports
- Daily sales.
- Weekly sales.
- Monthly sales.
- Custom date range.
- Sales by product.
- Sales by customer.
- Sales by employee.
- Sales by payment method.
- Sales returns.
- Cancelled invoices.
- Total received money.
- Outstanding customer balances.

### Purchasing reports
- Daily purchases.
- Weekly purchases.
- Monthly purchases.
- Custom date range.
- Purchases by supplier.
- Purchases by product.
- Purchase returns.
- Outstanding supplier balances.
- Total paid.
- Unpaid purchases.

### Report functionality

- Date range filters.
- Search.
- Sorting.
- Pagination.
- Summary totals.
- Print.
- PDF export.
- Excel export.
- CSV export.

Make sure all reports use real database records and accurate financial calculations.

---

## FEATURE 05 — Sales and Purchase Invoices

Improve the existing invoice system without breaking existing invoice records.

### Invoice IDs

Make invoice identifiers shorter and more readable.

Requirements:
- Short human-readable invoice numbers.
- Unique identifiers.
- No duplicate invoice numbers.
- Keep internal database IDs unchanged.
- Preserve references to old invoices.
- Existing invoices must remain accessible.

Use a safe numbering strategy, for example:

`INV-000123`

The format can be adapted to the existing project.

### Invoice barcode

Every new invoice should have a scannable barcode.

Requirements:
- Barcode represents a unique invoice reference.
- Scanning it inside the application should open the corresponding invoice.
- Support barcode scanning through the existing barcode scanner workflow.
- Make the barcode available on printed invoices.
- Preserve invoice lookup through existing search methods.

### Company footer

Every printed sales and purchase invoice must have a footer containing:

**ANUBIS**

Company name and contact information.

Include configurable:
- Company name.
- Phone numbers.
- Address.
- Other business contact information.

Do not hardcode fictional phone numbers or addresses. Make them configurable through application settings.

### Invoice returns — CRITICAL

Review the entire existing invoice return implementation.

The current behavior must support returning ONE OR MORE SELECTED ITEMS without cancelling or resetting the entire invoice.

Required behavior:

1. Open an existing invoice.
2. Select a specific product.
3. Enter the quantity being returned.
4. Calculate the refund based on the returned quantity and applicable price/discount rules.
5. Keep all non-returned products in the original invoice.
6. Update returned quantities correctly.
7. Update inventory according to the existing stock rules.
8. Record the return as a separate traceable transaction.
9. Update financial records according to the actual refund.
10. Allow additional partial returns later, but never exceed the remaining returnable quantity.

Example:

Original invoice:

- Product A: 5 units.
- Product B: 3 units.
- Product C: 2 units.

Customer returns:
- Product B: 1 unit.

Expected result:
- Product A remains unchanged.
- Product B has 1 returned unit and 2 remaining sold units.
- Product C remains unchanged.
- The original invoice remains available.
- Only the correct refund is calculated.
- Inventory and treasury are updated correctly.

Never reset the entire invoice because one item is returned.

Apply appropriate validation and transaction safety to prevent duplicate returns.

---

## FEATURE 06 — Administrator Data Reset

Add a button that allows an authorized administrator to reset application data in one operation.

This is a HIGH-RISK operation.

### Requirements

- Visible only to authorized administrators.
- Require administrator authentication.
- Require explicit confirmation.
- Require typing a confirmation phrase before execution.
- Show a clear warning explaining what will be reset.
- Create and verify a backup before resetting.
- Log the administrator responsible, date, and time.
- Never allow ordinary employees to access this operation.

### Reset scope

Analyze the existing database and classify data before implementing the reset.

Provide a clear reset preview.

Do not automatically delete:
- Application configuration.
- Licensing information.
- Administrator credentials.
- Company settings.
- Essential system configuration.

The reset must target operational/business data only according to the administrator's confirmed selection.

Do not execute destructive database operations against unrelated collections.

---

## FEATURE 07 — Optional Barcode Generator

Add an optional Barcode Generator.

This feature must be OPTIONAL, not mandatory.

Some businesses may already have their own barcode system and do not want automatic barcode generation.

### Settings

Add an administrator setting:

`Enable Automatic Barcode Generation`

Values:
- Enabled.
- Disabled.

### When enabled

- Generate barcodes for products that need them.
- Prevent duplicate barcodes.
- Allow barcode printing.
- Support barcode lookup and scanning.
- Follow the existing product identification rules.

### When disabled

- Do not automatically generate barcodes.
- Continue accepting manually entered product barcodes.
- Continue supporting existing barcode scanning.
- Do not break existing products.

### Important

Never replace existing product barcodes automatically.

If a product already has a barcode, preserve it.

---

## FEATURE 08 — Flexible Expenses Management

Create a dedicated Expenses page.

The expense categories must be flexible.

Examples:
- Water.
- Gas.
- Electricity.
- Internet.
- Maintenance.
- Repairs.
- Transportation.
- Rent.
- Other expenses.

But these are examples only.

The administrator or authorized employee must be able to enter a custom expense name.

### Expense fields

- Expense title.
- Category.
- Amount.
- Date.
- Payment method.
- Description.
- Attachment (optional, if supported by the current architecture).
- Employee responsible.
- Notes.

### Functionality

- Add expenses.
- Edit expenses with proper authorization.
- View expense history.
- Search and filter.
- Filter by date.
- Filter by category.
- Print expense reports.
- Export reports.

### Financial integration

When an expense is paid:
- Record the corresponding outgoing treasury movement.
- Update the available balance.
- Prevent duplicate treasury entries.
- Keep the expense linked to its treasury transaction.

Unpaid expenses must not decrease the cash balance until actually paid.

---

## FEATURE 09 — Flexible Printing and Paper Sizes

Improve printing across the application.

A5 should be supported, but printing must not be limited to A5.

### Required formats

- A5.
- A4.
- A6.
- 80mm thermal receipt.
- 58mm thermal receipt.
- Custom paper size where the printer supports it.

### Requirements

- Printer selection.
- Paper size selection.
- Portrait and landscape where appropriate.
- Preview before printing.
- Proper margins.
- Correct scaling.
- No clipped text.
- No missing barcode.
- No unnecessary blank pages.
- Support common Windows printers.
- Make layouts responsive to the selected paper size.

Use the existing printing solution if it works.

Do not introduce a new printing library unless necessary.

Test actual print layouts using print preview and browser/desktop printing capabilities available in the project.

---

## FEATURE 10 — Automatic Backup System

Improve the backup system.

I want the administrator to choose how frequently backups happen.

### Backup interval setting

Add an administrator setting that allows choosing:

- Every 1 hour.
- Every 2 hours.
- Every 4 hours.
- Every 6 hours.
- Every 8 hours.
- Every 12 hours.
- Every 24 hours.
- Custom interval in hours.

The administrator should be able to change this interval whenever necessary.

### Important architecture requirement

The backup execution should NOT depend on the user keeping a particular application page open.

Prefer a lightweight independent backup worker/service or an appropriate Windows scheduled task, depending on the current application architecture.

The application settings should configure the backup interval, while the backup execution remains independent of the UI.

Do not introduce unnecessary infrastructure.

### Required backup behavior

1. Automatically create backups according to the configured interval.
2. Create a backup when the user logs out, as requested.
3. Avoid creating duplicate backups during repeated logout events.
4. Handle application shutdown safely.
5. Preserve existing backup files.
6. Allow selecting the backup destination.
7. Show the last successful backup date.
8. Show backup status.
9. Show errors if backup fails.
10. Allow manual backup.
11. Allow safe restore.
12. Verify backup integrity before considering it successful.

### Data safety

- Never overwrite the only available backup.
- Never delete existing backups without an explicit retention policy.
- Do not report success before the backup is verified.
- Protect sensitive backup contents.
- Handle interrupted backups.
- Keep backup operations independent from normal POS operations.

### Logout behavior

Before completing logout:
- Attempt to create a backup.
- Verify the backup operation.
- Complete logout safely.
- If backup fails, show an appropriate warning and let the administrator's configured security policy determine whether logout proceeds.

Do not risk losing user-entered transactions.

---

## FEATURE 11 — Keyboard Shortcuts F1–F12

Add global keyboard shortcuts from F1 through F12.

The administrator should be able to assign application pages to the function keys.

Example default mapping:

| Key | Suggested Page |
|---|---|
| F1 | POS |
| F2 | Sales |
| F3 | Purchases |
| F4 | Products / Inventory |
| F5 | Customers |
| F6 | Suppliers |
| F7 | Treasury |
| F8 | Expenses |
| F9 | Reports |
| F10 | Dashboard |
| F11 | Settings |
| F12 | Users Management |

These are default suggestions, not mandatory fixed assignments.

### Requirements

- Allow changing assignments.
- Save assignments persistently.
- Support different user permissions.
- Do not allow shortcuts to open pages the current user cannot access.
- Avoid duplicate assignments unless explicitly supported.
- Display shortcut labels in the UI where useful.
- Support navigation without requiring mouse interaction.

### Important keyboard handling

- Do not interrupt normal typing inside inputs, textareas, search fields, or editable components.
- Avoid interfering with browser/system-reserved shortcuts.
- Handle key combinations safely.
- Ensure shortcuts work consistently across application pages.
- Prevent a single key press from triggering multiple navigations.

---

# 3. DASHBOARD — VISUAL IMPROVEMENT

Improve the existing dashboard or add a dashboard if one does not exist.

Do not remove existing dashboard information.

I want a professional dashboard with attractive, clean charts.

### Suggested widgets

- Today's sales.
- Today's purchases.
- Today's expenses.
- Current treasury balance.
- Monthly sales chart.
- Monthly purchasing chart.
- Expenses chart.
- Sales vs purchases comparison.
- Top-selling products.
- Recent invoices.
- Low-stock products.
- Outstanding customer balances.
- Outstanding supplier balances.

### Design requirements

- Professional visual design.
- Clear chart labels.
- Good spacing.
- Consistent colors.
- Responsive layout.
- Smooth interactions.
- Useful date filters.
- Accurate calculations.
- Real database data.

Do not make the dashboard visually attractive at the expense of performance.

Reuse an existing chart library if one is already installed.

---

# 4. DATABASE AND FINANCIAL INTEGRITY

All features must integrate with the current MongoDB database.

Before changing any schema:
- Inspect existing models.
- Reuse existing collections where appropriate.
- Add only the fields and collections actually needed.
- Preserve existing documents.
- Make migrations backward-compatible.
- Add indexes where justified.
- Avoid duplicate records.
- Maintain referential integrity through application-level validation and safe transaction handling.

### Financial integrity is mandatory

Sales, purchases, partial payments, returns, expenses, and treasury transactions must use consistent financial rules.

Never calculate the treasury balance by simply summing invoice totals.

Only actual financial movements affect the cash balance.

Use safe MongoDB transaction handling where supported by the existing deployment. If transactions are unavailable, implement a safe alternative that prevents partial or duplicated financial operations.

All financial operations must be auditable.

---

# 5. PERMISSIONS AND SECURITY

Integrate new permissions into the existing authentication and authorization system.

Examples:

- View treasury.
- Manage treasury.
- View expenses.
- Manage expenses.
- Manage suppliers.
- Manage customers.
- Create purchase orders.
- Receive supply orders.
- Manage invoices.
- Process returns.
- Generate reports.
- Export reports.
- Reset operational data.
- Configure backups.
- Manage keyboard shortcuts.
- Configure barcode generation.

Do not assume every employee is an administrator.

Validate permissions on the backend, not just by hiding UI buttons.

Record important administrative actions in an audit log.

---

# 6. IMPLEMENTATION STRATEGY

Work in small, controlled phases.

Do not implement all features in one massive uncontrolled change.

### Phase 0 — Existing Application Audit

- Inspect repository.
- Inspect architecture.
- Inspect database.
- Inspect existing workflows.
- Inspect existing tests.
- Create audit and expansion plan.
- Run existing tests before modifying anything.
- Record the baseline.

### Phase 1 — Suppliers, Customers, Purchasing

- Suppliers.
- Customers.
- Purchase orders.
- Supply orders.
- Inventory integration.

### Phase 2 — Invoices and Returns

- Short invoice numbers.
- Invoice barcodes.
- ANUBIS invoice footer.
- Partial item returns.
- Sales and purchase invoice improvements.

### Phase 3 — Treasury and Expenses

- Financial treasury.
- Incoming and outgoing movements.
- Flexible expenses.
- Sales/purchase/payment integration.

### Phase 4 — Dashboard and Reports

- Visual dashboard.
- Charts.
- Sales reports.
- Purchase reports.
- Export and printing.

### Phase 5 — Printing and Barcode Settings

- Multiple paper formats.
- Print preview.
- Optional automatic barcode generation.

### Phase 6 — Backup System

- Configurable interval.
- Independent backup execution.
- Logout backup.
- Restore and integrity verification.

### Phase 7 — Keyboard Shortcuts and Admin Reset

- F1–F12 mapping.
- Permissions.
- Safe operational data reset.

### Phase 8 — Full Regression Testing

Test every new feature and every affected existing feature.

Fix any regression before declaring the work complete.

---

# 7. PLAYWRIGHT AND VISUAL TESTING

This requirement is mandatory.

Use Playwright to test the actual running application.

I want to SEE the browser open and the application being tested.

Do not rely exclusively on:
- Unit tests.
- Static analysis.
- TypeScript compilation.
- API tests.
- Screenshots without actual interaction.

For each phase:

1. Start the actual application.
2. Open the browser visibly.
3. Navigate to the relevant pages.
4. Interact with the UI.
5. Test forms.
6. Test validation.
7. Test saving and retrieving real records.
8. Test permissions.
9. Test important workflows.
10. Check the browser console.
11. Check API errors.
12. Check database results.
13. Run regression tests for existing features.

### Important test scenarios

- Complete a sale and verify treasury movement.
- Create a purchase order.
- Receive part of the ordered goods.
- Verify inventory quantities.
- Record a purchase payment.
- Return one product from a multi-product invoice.
- Verify other invoice items remain unchanged.
- Scan an invoice barcode and open the invoice.
- Record an expense and verify the treasury movement.
- Generate sales and purchasing reports.
- Print invoices using different supported formats.
- Perform a backup and restore test.
- Verify F1–F12 navigation and permissions.
- Test data reset using a safe test database only.

Never test destructive operations against production data.

---

# 8. PONTAIL ENGINEERING RULES

Apply Ponytail in FULL mode.

- Understand the existing implementation before changing it.
- Reuse existing code.
- Choose the simplest solution that actually works.
- Do not create unnecessary abstractions.
- Do not add dependencies without a real requirement.
- Keep code changes minimal and focused.
- Fix root causes rather than symptoms.
- Never simplify away validation, financial integrity, security, or data protection.
- Add tests for important financial and destructive operations.
- Do not rewrite working modules just to make the code look different.

Ponytail must simplify the implementation, NOT remove requested features.

---

# 9. PHASE COMPLETION REQUIREMENTS

A phase is complete only when:

- Its requested functionality is implemented.
- Existing related functionality still works.
- Database compatibility is verified.
- Permissions are implemented.
- Tests pass.
- Playwright visual testing is completed.
- No critical browser errors remain.
- No critical API errors remain.
- No known financial inconsistencies remain.

After every phase create a report:

`PHASE_X_COMPLETION_REPORT.md`

Include:
- What was implemented.
- Files added.
- Files modified.
- Database changes.
- Tests performed.
- Playwright results.
- Known limitations.
- Remaining tasks.
- Confirmation that existing features were preserved.

Do not claim a test passed if it was not actually executed.

---

# 10. FINAL ACCEPTANCE CRITERIA

The final application must:

1. Retain all original features.
2. Include all 11 requested enhancements.
3. Have an integrated financial treasury.
4. Have supplier and customer management.
5. Have purchase and supply order workflows.
6. Have comprehensive sales and purchasing reports.
7. Support partial item returns.
8. Have invoice barcodes and ANUBIS company footers.
9. Have a protected administrator data-reset function.
10. Support optional barcode generation.
11. Have flexible expense management.
12. Support multiple printer paper formats.
13. Have configurable independent backups and logout backups.
14. Have configurable F1–F12 shortcuts.
15. Have a professional visual dashboard.
16. Preserve existing MongoDB records and compatibility.
17. Pass regression and integration testing.

**FINAL INSTRUCTION:**

Start by inspecting the existing application. Do not rebuild it.

Add the requested features incrementally, integrate them into existing workflows, preserve all existing functionality, and test everything before declaring completion.

If you encounter an existing bug, document it and fix it only when it is directly related to the requested enhancement or blocks its safe implementation. Do not use this task as an excuse to rewrite unrelated modules.

If something cannot be implemented safely without clarification, explain the exact issue and propose the safest solution instead of silently changing existing behavior.