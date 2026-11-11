# Security — Pharmacy POS

Status: Gate 1 (security baseline) in progress on `gate1/security-baseline`. This file states only
controls that have evidence (a test, a CI step, or a command output). Gaps are listed, not hidden.
Plan and evidence: `docs/security/CLOSURE-PLAN.md`, `docs/security/THREAT-MODEL.md`.

## Reporting a vulnerability

Report privately to the owner (repository admin). Do not open a public issue. Include the version
(`Pharmacy-POS-Setup-<version>.exe` SHA-256), steps, and impact. Do not include customer data.

## Trust boundaries

| Boundary | Trusted side | Rule |
|---|---|---|
| Renderer ↔ main (IPC) | main | Sender URL check, per-channel argument schema, no MongoDB operators/dotted keys, permission guard, stable error codes |
| Main ↔ MongoDB | main | Bundled `mongod` binds `127.0.0.1` only, port 27028 |
| Customer device | none | A local administrator can patch the app or edit files; controls detect and limit, they do not prevent |
| Repository / CI | owner | No private keys or signing code (scan in CI); full-history secret scan (gitleaks) in CI |
| Licence authority | separate panel repo | The app verifies, never issues (`docs/licensing/ADR-001-licence-authority.md`) |

## Controls with evidence

| Area | Control | Evidence |
|---|---|---|
| Auth | No default account; first-run setup with a chosen password (12+ chars) | `tests/unit/auth.test.ts`, E2E "first-run setup…" |
| Auth | Fails closed when the database is down; no fallback login | `tests/unit/auth.test.ts` "database unavailable", E2E "fails closed at sign-in…" |
| Auth | Argon2id (19 MiB, t=2, p=1, per-user salt); legacy SHA-256 re-hashed on login and reset forced | `tests/unit/password.test.ts`, `auth.test.ts` |
| Auth | Lockout: 5 failures → 15 min; success and failure audited | `auth.test.ts` |
| Auth | Session tokens stored as SHA-256 only | `auth.test.ts` "stores only the session token hash" |
| Electron | contextIsolation, sandbox, no nodeIntegration, webSecurity; DevTools off when packaged | `src/main/index.ts` createWindow |
| Electron | CSP: no inline/remote script, no unsafe-inline/unsafe-eval; window.open, navigation, webview, permissions denied | E2E "Gate 1 S2" |
| IPC | Schema for every channel; operator/prototype/size guards; DB errors hidden | `tests/unit/ipcSchema.test.ts`, E2E "Gate 1 S3" |
| Audit | Hash-chained, verified at startup; edits/deletions detected | `tests/unit/auditChain.test.ts`, `auth.test.ts` "audit chain" |
| Logs | mongod log and audit fallback rotate at 10 MB (3 kept) | `tests/unit/logRotate.test.ts` |
| Supply chain | Shipped deps pinned; `npm audit --omit=dev` high gate; SBOM incl. Electron + MongoDB; licence allowlist | CI steps; `scripts/sbom.mjs` |
| Supply chain | MongoDB runtime pinned to 9.0.8 | `scripts/prepare-mongodb.ps1` |

## Known gaps (not yet controls)

- MongoDB authentication / least-privilege user: not enabled (S4).
- Backups are plaintext JSON and include password hashes; restore converts ObjectIds to strings (S4).
- BitLocker is a deployment requirement, not yet verified on a clean PC (S4).
- No code-signing certificate; SmartScreen will warn (S6).
- Licence verifier/lock (Gate 2) not built; `PHM1` activation still present.
- **MongoDB Server is SSPL-1.0. No build may be distributed or sold** until the owner has a written legal opinion or a commercial licence.
