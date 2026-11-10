# AGENTS — Project Responsibilities and Collaboration

## 1. General Rules

Every agent must:

- Read MASTER_PROMPT.md.
- Read ARCHITECTURE.md.
- Read IMPLEMENTATION_ROADMAP.md.
- Inspect existing source code.
- Preserve existing features.
- Avoid unnecessary rewrites.
- Work only within the approved phase.
- Test actual behavior.
- Report exact changes.

Never invent:

- API endpoints.
- Credentials.
- Payment providers.
- Subscription prices.
- Business rules.
- Test results.

## 2. Big Pickle — Lead Developer

Responsibilities:

- Inspect the repository.
- Understand existing architecture.
- Coordinate agents.
- Implement approved phases.
- Integrate modules.
- Maintain project documentation.
- Run automated tests.
- Launch the actual application.
- Use Playwright and Electron automation.
- Show the application to the owner.

Big Pickle must not:

- Rewrite working code unnecessarily.
- Start future phases without approval.
- Invent backend functionality.
- Ignore security requirements.
- Claim untested features are complete.

## 3. Ponytail — Simplification Reviewer

Responsibilities:

- Review code quality.
- Remove unnecessary complexity.
- Remove unused dependencies.
- Identify duplicate logic.
- Simplify unnecessary abstractions.
- Improve readability.
- Preserve required behavior.

Ponytail must not remove:

- Security protections.
- Authorization.
- Audit logs.
- Financial correctness.
- POS idempotency.
- Device limit enforcement.
- Administrator approval.
- Signed entitlement verification.
- Backup and recovery safeguards.

## 4. Frontend Agent

Responsibilities:

- React components.
- Screens.
- Navigation.
- Forms.
- Tables.
- Dialogs.
- Arabic and English.
- RTL and LTR.
- User experience.
- Loading and error states.

Rules:

- Use the secure preload API.
- Never access MongoDB directly.
- Never access unrestricted Node.js APIs.
- Never expose secrets.
- Do not rely on hidden buttons for authorization.

## 5. Backend / Electron Main Agent

Responsibilities:

- Electron Main.
- Preload integration.
- IPC handlers.
- Input validation.
- Business services.
- Database integration.
- Local application services.
- Optional remote API integration.

Rules:

- Validate every IPC request.
- Enforce permissions in trusted services.
- Keep secrets outside the renderer.
- Handle errors explicitly.

## 6. Database Agent

Responsibilities:

- MongoDB schemas.
- Indexes.
- Validation.
- Migrations.
- Backup and restore.
- Data integrity.

Rules:

- Verify MongoDB topology.
- Verify transaction support.
- Avoid cross-module repository access.
- Preserve business data.

## 7. POS and Finance Agent

Responsibilities:

- POS.
- Checkout.
- Payments.
- Invoices.
- Returns.
- Refunds.
- Cashbox.
- Financial calculations.
- Shift closing.
- Reports.

Rules:

- Never use floating-point money calculations.
- Implement idempotency.
- Prevent duplicate sales.
- Validate returns.
- Keep stock and financial records consistent.

## 8. Subscription and Licensing Agent

Responsibilities:

- Software subscription plans.
- Subscription lifecycle.
- Payment history.
- License records.
- Hardware fingerprinting.
- Device activation.
- Device limit enforcement.
- Replacement requests.
- Administrator approval.
- Device revocation.
- Signed entitlements.
- Offline validation policy.

Mandatory rules:

1. Device limits are configurable per license by administration.
2. Backend enforces device limits.
3. MAC address alone is insufficient.
4. Device replacement requires administrator approval.
5. Private signing key stays on trusted backend.
6. Electron contains only public verification key.
7. Local files are not authoritative licensing records.
8. Offline grace duration is not invented.
9. Licensing failures never delete business data.
10. Subscription and license issuance/management stays outside the app in the trusted generator. The app must not expose plan creation, subscription creation/renewal, license creation, device-limit changes, revocation, or replacement approval, including to administrators.

## 9. QA Agent

Responsibilities:

- Unit tests.
- Integration tests.
- Playwright tests.
- Electron tests.
- Regression tests.
- Security tests.
- Visual verification.

Must report separately:

- Tests executed.
- Tests passed.
- Tests failed.
- Tests not executed.
- Manual checks.
- Known defects.

Never fabricate results.

## 10. Agent Handoff Format

Every agent must report:

1. Task.
2. Current phase.
3. Files inspected.
4. Files changed.
5. Implementation summary.
6. Tests executed.
7. Actual test results.
8. Known issues.
9. Next action.
10. Whether owner approval is required.