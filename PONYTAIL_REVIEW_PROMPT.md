# PONYTAIL — Engineering Review and Simplification

You are reviewing the existing Electron CRM + POS + Inventory project.

Your goal is to remove unnecessary complexity while preserving all required behavior.

Read:

- MASTER_PROMPT.md
- ARCHITECTURE.md
- AGENTS.md
- IMPLEMENTATION_ROADMAP.md
- DEVICE_LICENSING.md

## 1. Review Objectives

Identify:

- Unnecessary dependencies.
- Duplicate code.
- Duplicate components.
- Duplicate business logic.
- Unnecessary abstraction layers.
- Speculative architecture.
- Dead code.
- Unused configuration.
- Excessive state management.
- Unnecessary custom implementations.
- Unsafe Electron IPC.
- Inconsistent database access.
- Poor error handling.
- Unnecessary complexity in licensing.

Prefer the simplest implementation that actually works.

## 2. Do Not Break Existing Behavior

Do not remove:

- CRM functionality.
- POS functionality.
- Inventory operations.
- Cashbox consistency.
- Financial calculations.
- User permissions.
- Audit history.
- Backup and restore.
- Subscription functionality.
- Device licensing.
- Security protections.

## 3. Financial Safety

Verify:

- No floating-point money calculations.
- Consistent tax calculations.
- Correct discount calculations.
- Idempotent checkout.
- No duplicate sales.
- Correct stock movements.
- Correct payment records.
- Correct cashbox records.
- Valid returns and refunds.

## 4. Electron Security Review

Verify:

- contextIsolation enabled.
- nodeIntegration disabled.
- Secure preload.
- Restricted IPC.
- IPC input validation.
- No unrestricted renderer access.
- No secrets in frontend code.
- No direct MongoDB connection from renderer.

## 5. Device Licensing Review

Verify:

1. Device limit is configurable per license.
2. Administration can change device limits.
3. Backend enforces device limits.
4. Concurrent activation cannot exceed the limit.
5. Same device is recognized after restart.
6. MAC address is not used as the sole identifier.
7. Missing hardware identifiers are handled.
8. Hardware changes are handled using a documented matching policy.
9. Device replacement requires administrator approval.
10. Rejected replacement does not deactivate the old device.
11. Approved replacement is recoverable if activation fails.
12. Device revocation is audited.
13. License entitlements are digitally signed.
14. Private signing key is not included in Electron.
15. Local editable files are not trusted as licensing authority.
16. Offline grace duration has not been invented.
17. License failure cannot delete business data.

## 6. Subscription Review

Verify:

- Subscription and CRM customer billing are separate.
- Subscription status is validated.
- Payment confirmation is trusted.
- Client redirects are not treated as proof of payment.
- Payment secrets are not stored in Electron.
- Renewal behavior is tested.

## 7. Review Output

Return findings ranked by severity.

### Critical

Security vulnerabilities, data loss, financial corruption or licensing bypass.

### High

Major correctness or maintainability problems.

### Medium

Unnecessary complexity or likely defects.

### Low

Minor cleanup.

For every finding include:

- File.
- Location.
- Problem.
- Recommended minimal change.
- Risk.
- Required tests.

Then provide:

1. Code that can be removed.
2. Dependencies that can be removed.
3. Duplicate logic that can be consolidated.
4. Required behavior that must remain unchanged.
5. Tests required after simplification.

Do not rewrite the entire project.

Do not change project scope.

Do not remove required safeguards merely to reduce code size.

If no meaningful simplification is needed, say so clearly.