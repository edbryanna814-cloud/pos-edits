# PROGRESS — Licence Authority Separation

Resume from here after any interruption.

- **Baseline:** `3f70318` (single squashed import commit; its message "Remove in-app subscription and license management" does not match the code — D-LIC-15).
- **Plan:** `docs/licensing/` — rulings in `TD-RULINGS-001.md` win over older docs.
- **Branch:** `chore/licence-containment` → `main`. Never work on `main`, never force-push.
- **Rule:** no private key or issuance code in this repo, ever. The old `PHM1` key is treated as exposed.

## Slice order (TD-RULINGS-001 §4)

| Slice | Repo | Status |
|---|---|---|
| C0 containment + CI + docs correction | app | **done** — `a457994`, CI run 42836474294 green |
| C0.1 Gate 0 fixes (G0-1…G0-5) | app | **done, awaiting review** — fixes `4c8250f`, CI run 42928915572 green; head = the `docs(progress)` commit after it (SHA and run in the PR #1 report) |
| A1 panel skeleton, auth, audit | panel | not started — contract v3 in `Anubis-hub/anubis-switcher` (`df66cf8`) |
| A2 customers, plans, licences | panel | — |
| A3 reverse enrolment + PHM2 signing | panel | — (stop point) |
| B1 verifier, key set, remove price/MAC from status | app | — |
| B2 central write gate, read-only (login allowed) | app | — |
| B3 remove activation form + `license:apply` | app | — |
| B4 check-in client, protected cache, clock rule | app | — |
| B5 status, support bundle, bilingual UX | app | — |
| A4 check-in, revocation, replacement, seats | panel | — |
| A5 operations | panel | — |
| B6 legacy retirement | app | only if D-LIC-17 is reversed |

## C0 scope

1. `docs(licensing)`: add `docs/licensing/`, this file; correct false backend claims (SECURITY_REVIEW, ARCHITECTURE, START_HERE, IMPLEMENTATION_ROADMAP, MASTER_PROMPT); DEVICE_LICENSING marked target-only.
2. `chore(licence)`: delete `scripts/license-*.mjs`; CI (`npm ci`, typecheck, build, signing scan, `test:unit`); Vitest; `license:apply` guard (D-LIC-16).
3. `docs(progress)`: C0 result with the CI run on the exact head.

Stop after C0 and wait for review. C0 does not close M1 (key rotation record comes with A1/A3).

## Decisions in force

D-LIC-01…18 (`docs/licensing/TD-RULINGS-001.md`). Key ones: reverse enrolment (no token typed into the app); 32-hex unsalted device hash unchanged; PHM2 times in seconds; login always allowed, gate on writes only; default no `PHM1` licences sold (D-LIC-17); panel repo under the owner's account (`Talaat-hub`), never `edbryanna814-cloud`.

## Owner actions open

- Search machines/backups for `~/.pharmacy-pos-license/private.pem`; record where found; destroy after rotation. Not on the builder machine (checked 2026-11-10).
- Confirm D-LIC-17 (no sales) before B4.

## C0 result

- `6f1f542` docs(licensing) — package, PROGRESS.md, false backend claims corrected.
- `a457994` chore(licence): C0 containment — CI green: https://github.com/edbryanna814-cloud/Pharmacy-POS-and-management-/actions/runs/42836474294 (npm ci, typecheck, build, signing scan, test:unit).
- Tests: `tests/unit/smoke.test.ts` (1), `tests/unit/licenseApplyGuard.test.ts` (7), `tests/unit/scanSigning.test.ts` (6) — 14 pass.
- Scan run against the baseline's two scripts: 4 failures, exit 1 (as intended).
- Closed: NFR-LIC-012. ADR E1 and MIGRATION K8 closed only at C0.1 (`4c8250f`), when the scan rules and the docs were made to match. Partly: M1 (rotation record pending, A1/A3), FR-LIC-020 (entry still exists, guarded; removed in B3).
- Deferred: Playwright E2E not in CI (needs Electron + MongoDB on Windows); apply rate limit is in-memory (resets on restart); guard messages English only (ActivationPage unchanged by ruling, removed in B3).

## Development environment (builder machine)

Checked 2026-11-10:
- **MongoDB Community Server 9.0.8** is installed as the Windows service `MongoDB` (running, automatic start). Community edition: the build lists no enterprise modules.
- Binary: `C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe`.
- Config: `...\bin\mongod.cfg`, listening on `127.0.0.1:27017`.
- Data: `...\Server\9.0\data`.
- Log: `...\Server\9.0\log\mongod.log`.
- `mongosh` is not installed.
- `npm run db:start|stop|status|init` (`scripts/mongodb.ps1`) controls this same service.
- 2026-11-10: the server was standalone (no `setName`), but the app (`src/main/db.ts:4`) and the E2E tests (`tests/electron.spec.ts:8`) expect `?replicaSet=rs0`.
- **2026-11-11, fixed (TD-approved, machine-only, not committed):**
  - added `replication: { replSetName: rs0 }` to `mongod.cfg` (backup `mongod.cfg.bak-before-rs0`);
  - restarted the service from an elevated shell;
  - `npm run db:init` → `PRIMARY rs0`; `hello` → `{"setName":"rs0","isWritablePrimary":true}`;
  - `npm test` (Playwright): 4 passed.
- The installer bundles its own MongoDB (`vendor/mongodb` → `localDb.ts`). This service is used for development only.

## C0.1 result (Gate 0)

- `4c8250f` fix(licence): G0-1 Playwright `testMatch`; G0-2 R-04 "absent from the tip"; G0-3 R-02 header + base64 body; G0-4 scan adds signing calls, and E1/K8 restated to the implemented rules; G0-5 "Implement:" lines under the panel banners reworded.
- `npx playwright test --list`: exit 0, 4 tests in 1 file (`electron.spec.ts`).
- `npm run test:unit`: 16 pass (scanSigning 8, licenseApplyGuard 7, smoke 1).

## Next

**Gate 1, security baseline (`docs/security/CLOSURE-PLAN.md` §4)**, on its own branch after PR #1 merges. Status assessed 2026-11-11, no code yet. Open HIGH findings:
- `auth.ts:131-146`: hard-coded `admin`/`admin` login when the DB is unavailable;
- `auth.ts:79-91`: default `admin`/`admin` account on first run;
- `auth.ts:36-38`: unsalted SHA-256 password hashes.

Do not start B1 until panel A3 signing is verified. Do not start Gate 2 or sell before TD confirmation.

## Last completed step

2026-11-11 — C0.1 Gate 0 fixes committed (`4c8250f`, CI green); dev MongoDB switched to `rs0` and E2E green; Gate 1 status assessed. Stopped for TD review.
