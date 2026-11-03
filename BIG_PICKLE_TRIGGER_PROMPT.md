# BIG PICKLE — PROJECT BUILD TRIGGER

You are the lead developer responsible for implementing this project.

Use Ponytail as the engineering simplification and review agent.

## 1. Read All Instructions

Before coding, read:

- MASTER_PROMPT.md
- ARCHITECTURE.md
- AGENTS.md
- IMPLEMENTATION_ROADMAP.md
- START_HERE.md
- CONTINUE_STATEMENT.md
- DEVICE_LICENSING.md

## 2. Project Goal

Build a complete desktop business management application for one company.

Modules:

- CRM.
- POS.
- Inventory.
- Suppliers and Purchasing.
- Cashbox.
- Expenses.
- Reports.
- Users and Permissions.
- Monthly Software Subscription.
- Hardware-Based Device Licensing.

Technology:

- Electron.
- React.
- TypeScript.
- Vite.
- Node.js.
- MongoDB.

No NestJS.

No Next.js.

No multi-company SaaS.

## 3. Inspect Before Building

Inspect the existing repository and all supplied HTML files.

Identify:

- Existing functionality.
- Existing architecture.
- Current dependencies.
- Current UI.
- Existing tests.
- Existing database setup.
- Potential risks.

Do not assume the repository is empty.

Do not replace working code unnecessarily.

## 4. Build in Phases

Follow IMPLEMENTATION_ROADMAP.md.

Start with Phase 0 only.

After discovery, report:

- Repository structure.
- Current stack.
- Existing features.
- Existing tests.
- Current defects.
- Technical risks.
- Proposed Phase 1 plan.

Wait for owner approval.

## 5. Non-Negotiable Requirements

### Electron Security

- contextIsolation: true
- nodeIntegration: false
- Secure preload.
- Typed allowlisted IPC.
- Input validation.
- Renderer has no direct MongoDB access.

### Database

MongoDB must be properly installed and managed.

Do not pretend it is embedded.

Verify transaction support for the selected deployment.

### Financial Correctness

- No floating-point money calculations.
- Idempotent POS checkout.
- Consistent sale, payment, stock and cashbox operations.
- Correct return validation.

### Subscription

The subscription is the fee paid by the company to use the software.

Do not confuse it with CRM customer subscriptions.

Do not invent prices or payment provider details.

### Device Licensing

- Administration controls the maximum devices per license.
- Backend enforces the device limit.
- Use multiple hardware identifiers.
- MAC address alone is insufficient.
- Device replacement requires administrator approval.
- Signed entitlements are mandatory for production licensing.
- Private signing key remains on trusted backend.
- Electron contains only the public key.
- Offline grace policy requires owner approval.
- Never delete business data because of licensing failure.

## 6. Playwright Requirement

You must open the actual running application.

Use Playwright for UI testing.

Use suitable Electron automation for desktop-specific workflows.

Test real user actions, not only mocked components.

Show the working application to the owner.

Do not move to the next phase before owner review.

## 7. Ponytail Collaboration

Ask Ponytail to review:

- Unnecessary dependencies.
- Duplicate logic.
- Over-engineered abstractions.
- Unnecessary complexity.
- Security weaknesses.
- Data integrity.
- Licensing enforcement.
- Financial correctness.

Do not remove required functionality in the name of simplification.

## 8. Completion Reports

After each phase report:

- Implemented functionality.
- Changed files.
- Tests run.
- Actual test results.
- Visual testing evidence.
- Remaining issues.
- Risks.
- Next phase.
- Owner approval status.

Never fabricate results.

Start now with Phase 0 repository discovery. Do not begin a broad implementation before reporting the baseline.