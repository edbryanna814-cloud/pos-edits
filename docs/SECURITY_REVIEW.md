# Security Review (Phase 10)

## Context Isolation
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` in BrowserWindow
- All Node access via preload (`contextBridge.exposeInMainWorld`)
- Only allowlisted IPC channels

## Preload/API Surface
- Typed IPC channels in `src/shared/ipc.ts`
- Preload exposes minimal API, no secrets

## Input Validation
- IPC handlers validate/trust boundaries; services enforce rules
- POS uses integer cents, idempotency considered
- Licensing enforces device limits server-side

## Authentication/Authorization
- Login gate, roles/permissions
- Audit logs present

## Licensing/Security
- Private signing key only on trusted backend (env), Electron uses verification logic
- Signed entitlements verified conceptually; local files not authoritative
- Device limits enforced in backend
- Replacement requires admin approval

## Data Safety
- Licensing/DB failures do not delete business data
- Backup/restore implemented (export/import)
- MongoDB transactions not guaranteed on standalone; code uses safe patterns

## Recommendations
- Use HTTPS for any remote calls
- Rotate signing keys deliberately
- Restrict admin operations by permissions
- Rate-limit activation endpoints
- Never log raw hardware identifiers
- Review packaging/signing per platform
