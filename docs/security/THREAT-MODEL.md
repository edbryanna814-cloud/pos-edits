# Threat model and abuse cases (Gate 1 S7)

Refreshed 2026-11-11 against `gate1/security-baseline`. It complements `docs/licensing/ARCHITECTURE-SECURITY.md` §6
(licensing threats T01–T16). Status: **tested** = an automated test proves the expected behaviour;
**open** = not yet controlled; **Gate 2** = depends on the licence verifier, not built yet.

## Abuse cases

| # | Abuse case | Expected behaviour | Status | Test / evidence |
|---|---|---|---|---|
| X-01 | Log in with `admin`/`admin` on a new install | No such account; setup screen instead | tested | `auth.test.ts` "first run…"; E2E "first-run setup…" |
| X-02 | Log in while the database is down | `LOGIN_FAILED`, no session, attempt audited to fallback file | tested | `auth.test.ts` "database unavailable"; E2E "fails closed…" |
| X-03 | Online password guessing | Lock after 5 failures for 15 min, persists across restart | tested | `auth.test.ts` "locks the account…" |
| X-04 | Steal password hashes from the DB / a backup | Argon2id per-user salt; old SHA-256 hashes replaced at next login; backups encrypted | tested | `password.test.ts`, `auth.test.ts`, `backupCrypto.test.ts` |
| X-05 | Steal session tokens from the DB | Only SHA-256 of the token stored | tested | `auth.test.ts` "stores only the session token hash" |
| X-06 | NoSQL injection over IPC (`{$ne:null}`, dotted keys) | `VALIDATION_FAILED` before any service code | tested | `ipcSchema.test.ts`; E2E "Gate 1 S3" |
| X-07 | IPC injection: wrong types, extra args, bad ids | `VALIDATION_FAILED` | tested | `ipcSchema.test.ts`; E2E "Gate 1 S3" |
| X-08 | Renderer XSS: injected inline script | Blocked by CSP (`script-src 'self'`) | tested | E2E "Gate 1 S2" |
| X-09 | Renderer opens windows / navigates away / attaches webview | Denied | tested | E2E "Gate 1 S2" |
| X-10 | Renderer requests camera/mic/geolocation/notifications | Denied | tested | E2E "Gate 1 S2" |
| X-11 | Tampered audit history (edit, delete, insert) | Chain break detected at startup and audited | tested | `auditChain.test.ts`; `auth.test.ts` "detects an edited, then a deleted…" |
| X-12 | Tampered business data in MongoDB | Not detected (no integrity check on business collections) | open | — |
| X-13 | Stolen backup file | Unreadable without the passphrase (Argon2id + AES-256-GCM); a tampered file is refused | tested | `backupCrypto.test.ts`; E2E "…restores a backup" |
| X-14 | Direct access to MongoDB from another local process | Refused without credentials; the app user cannot reach other DBs, manage users, drop the DB or shut down | tested | `mongoAuth.test.ts` (real mongod), `smoke-packaged.mjs` |
| X-15 | Leak of DB internals in errors | Driver/runtime errors → `INTERNAL_ERROR` / `DUPLICATE` | tested | `ipcSchema.test.ts` "never leaks…" |
| X-16 | Private key or signing code committed | CI scan + gitleaks fail | tested | `scanSigning.test.ts`; CI steps |
| X-17 | Forged / replayed / wrong-device licence, copied licence file, clock rollback | Verifier rejects; lock | **Gate 2** | `docs/licensing/TEST-PLAN.md` V-, C-, X- |
| X-18 | Seat limit bypass | Enforced in the panel | **Gate 2 / panel** | `PANEL-CONTRACT.md` §6 |

## What is not prevented (stated honestly)

- A local Windows administrator can patch the app (asar/main), edit the database, or run another
  `mongod` against the data directory. The design detects audit tampering; it does not stop a
  determined local admin.
- A VM snapshot or disk image can rewind local state, including the audit log and future licence
  markers, to an earlier point.
- Offline revocation runs to the end of the current lease (Gate 2 design).
- A process running as the same Windows user can decrypt the DPAPI-protected MongoDB credentials.
