# START HERE — Project Initialization

You are about to work on a desktop application combining:

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

## Technology

- Electron.
- React.
- TypeScript.
- Vite.
- Node.js.
- MongoDB.

Do not use NestJS or Next.js.

## Product Scope

This application is for ONE company.

Do not build a multi-tenant SaaS platform.

## Important Decisions

### Operating Mode

The application supports:

- Local Mode using a properly installed and managed local MongoDB service.
- Backend Mode only if the owner provides a real API contract.

Do not invent a backend.

Do not silently switch operating modes.

### Security

- Electron context isolation enabled.
- Node integration disabled.
- Secure preload.
- Typed IPC.
- Renderer cannot access MongoDB.
- Secrets never exposed in renderer.

### Monthly Subscription

The subscription is paid by the company to use the application.

It is not a CRM customer subscription.

Do not invent prices, providers or billing policies.

### Hardware Licensing

- Administration determines the allowed device count for each license.
- Device replacement requires administrator approval.
- Use multiple hardware identifiers.
- MAC address alone is insufficient.
- Backend enforces activation limits.
- Signed entitlements protect license data.
- Private signing key remains on trusted backend.
- Offline grace duration requires owner approval.
- Never delete business data due to licensing failure.

## First Task: Phase 0

Do not begin building every module immediately.

First:

1. Inspect the entire existing repository.
2. Inspect all supplied HTML files.
3. Identify existing working functionality.
4. Identify the current stack.
5. Run the existing application.
6. Run existing tests.
7. Document the current state.
8. Prepare a minimal Phase 1 plan.

Do not destroy or rewrite existing working code.

## Existing HTML Files

If HTML files are supplied:

- Inspect their layout.
- Identify reusable components.
- Identify images and assets.
- Reuse their visual direction.
- Preserve useful interactions.
- Replace mock behavior with real application functionality gradually.

Do not blindly copy unsafe scripts or duplicate functionality.

## Testing

Use Playwright to open and test the actual running application.

For Electron-specific workflows, use suitable desktop automation.

Show the running interface to the owner before proceeding to another phase.

Wait for approval before starting Phase 1 implementation.