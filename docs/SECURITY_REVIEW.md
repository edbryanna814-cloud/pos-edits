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

## Authentication/Authorization
- Login gate, roles/permissions
- Audit logs present

## Licensing/Security

Corrected in C0 (`docs/licensing/TD-RULINGS-001.md` D-LIC-14). An earlier
version of this section described a backend that does not exist.

Actual state at baseline `3f70318`:
- **No licensing backend exists.** There is no HTTP client, server, or admin
  dashboard. Device limits are **not** enforced anywhere; the payload count is
  display-only (`docs/licensing/FINDINGS.md` F-04).
- The app verifies an Ed25519-signed `PHM1` code in the main process against
  one hard-coded public key and stores it in a plain `license.json`.
- A pre-login activation screen accepts a licence code. C0 adds a guard
  (no apply while valid, no expiry downgrade, 5 attempts/hour, audited); the
  screen is removed in B3.
- The old signing key was generated on a developer workstation and is treated
  as exposed. The issuance scripts are removed from this repo in C0, and CI
  scans for private keys and issuance code.

Target (not implemented): a separate, owner-controlled licence panel issues
signed `PHM2` entitlements; the app only verifies them. See
`docs/licensing/ADR-001-licence-authority.md`.

## Data Safety
- Licensing/DB failures do not delete business data
- Backup/restore implemented (export/import)
- MongoDB transactions not guaranteed on standalone; code uses safe patterns

## Recommendations
- Use HTTPS for any remote calls
- Rotate signing keys deliberately
- Restrict admin operations by permissions
- Rate-limit the panel's enrolment and check-in endpoints (none exist yet)
- Never log raw hardware identifiers
- Review packaging/signing per platform
