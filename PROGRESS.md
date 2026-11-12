# PROGRESS — Licence Authority Separation

Resume from here after any interruption.

- **Baseline:** `3f70318` (single squashed import commit; its message "Remove in-app subscription and license management" does not match the code — D-LIC-15).
- **Plan:** `docs/licensing/` — rulings in `TD-RULINGS-001.md` win over older docs.
- **Branch:** Gate 1 on `gate1/security-baseline` (from `main` at `7c6b87e`). PR #1 (`chore/licence-containment`) merged at `7c6b87e`. Never work on `main`, never force-push.
- **Repo identity:** this is `edbryanna814-cloud/Pharmacy-POS-and-management-`. Factory ERP is a different repo (`Talaat-hub/Factory-ERP`); never mix them in a report.
- **Rule:** no private key or issuance code in this repo, ever. The old `PHM1` key is treated as exposed.

## Slice order (TD-RULINGS-001 §4)

| Slice | Repo | Status |
|---|---|---|
| C0 containment + CI + docs correction | app | **done** — `a457994`, CI run 42836474294 green |
| C0.1 Gate 0 fixes (G0-1…G0-5) | app | **done, merged** — PR #1 head `cb1d53b` (CI 42929253555), merged at `7c6b87e` |
| Gate 1 security baseline (CLOSURE-PLAN §4) | app | **in progress** on `gate1/security-baseline` — see "Gate 1" below |
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

## Gate 1 (security baseline), `gate1/security-baseline`

Commits (CI run listed where it was watched; each push ran CI):
- `14f9f64` auth fixes (fallback removed, no default admin, Argon2id, lockout, hashed sessions, audit), CI 42932666717
- `b85d686` S1 (gitleaks in CI, SBOM + licence check, pinned deps), CI 42933341929
- `c13ce3c` S2 (CSP, webContents guards, permissions, DevTools)
- `7680d1e` S3 (IPC schema, NoSQL guard, safe errors)
- `e519462` S5 (audit hash chain, startup verify, log rotation), CI 42934504857
- `03f36aa` S6/S7/S8 (MongoDB 9.0.8 pin, packaged smoke, threat model, security docs)
- `adcdf34` S4 restore drill (EJSON v2 backups, audit preserved on restore), CI 42936172900
- `c617b29` S4 MongoDB access control, encrypted backups, log PII limits (CI failed: test timeout and a non-runnable mongod copy, fixed below)
- `8f3d11a` test timeout raised (CI still failed: container mongod needs glibc 2.42 / OpenSSL 3.4)
- `e7d56c5` CI uses the official MongoDB 9.0.8 Ubuntu 24.04 build, SHA-256 pinned, CI 42938533976 green
- the next commit: packaged smoke reads the version as the app user (anonymous buildInfo is now refused)

Packaged smoke on the S4 build (installer SHA-256 `25606fe34b487bd59ef9032d04a263cae61f072dc1456109e0c6ac0c7fc1178b`): app DB connected as the app user, encrypted credential store, no keyFile left on disk, anonymous read and buildInfo refused, 9.0.8 on rs0 at 27028, dev 27017 untouched, 0 maps. The user's installed (pre-auth) copy was closed with the user's OK to free port 27028.

Still open in Gate 1:
- S4: BitLocker check on PC2.
- S5: support bundle (overlaps B5/L5).
- S6: SmartScreen/AV test; clean-VM install (needs a clean Windows VM / PC2).
- S8: D-LIC-17 written confirmation (owner/admins); old PHM1 key search (owner).

Installer built locally from `e7d56c5` (not distributed, SSPL hold): `release/Pharmacy-POS-Setup-0.2.0.exe`, SHA-256 `25606fe34b487bd59ef9032d04a263cae61f072dc1456109e0c6ac0c7fc1178b`. An older build of it (pre-auth) is installed on the builder PC; installing the new one secures that data folder on first start.

## Field-test backup (owner request, 2026-11-11)

- Branch `field-test/0.2.0` (from `gate1/security-baseline` at `12dcfc7`), commit `384caaf`, CI 42950835732 green.
- `installation/` (installer via Git LFS, EN/AR manual, SHA256SUMS, SBOM).
- Pre-release `field-test-0.2.0`: zip of the folder, the installer, and checksums.
- Installer SHA-256 `b6fe9a4394df30094b5f629b7fe670a02a8bc1b90ae4557d72a5c78aba9c2217`.
- Blocker for on-site use: the packaged app stops at PHM1 activation (no code can be issued: generator removed, panel not built).

## Audit and pre-sale fixes (2026-11-12)

- `b8695f5` user-facing cleanup: no MAC address, no internal licence fields, plain labels and errors,
  sessions excluded from backups.
- `dc33934` `docs/AUDIT-0.2.0.md`: features, security controls, findings.
- Licence re-checked on every IPC call (`src/main/licenseGate.ts`) plus a one-minute renderer poll.
- Tax recomputed on the server from saved settings; the renderer value is ignored.
- Cashbox only tracks cash sales and cash refunds; card/other payments stay in `pos_payments`.
- Low stock uses each product's `minStock` in the dashboard and the inventory report.
- Unused `lines?` removed from the preload return type.
- Verification: typecheck clean, 11 unit files / 59 tests pass, 7 Playwright tests pass.

## Field-test 0.2.1 (2026-11-12)

- Version 0.2.1: same app code as `27f075c`, plus the field-test verification key and the updated
  installation docs. Built from branch `field-test/0.2.0`, tag `field-test-0.2.1`.
- Signing key rotated to reference `phm-fieldtest-2026-01` because the original PHM1 private key was not
  on the build PC and no code could be issued. The private half stays outside the repo at
  `%USERPROFILE%\.pharmacy-pos-license\private.pem`; only the public half is in `src/main/license.ts`.
  Codes issued with this key stop working when the panel (A3) takes over issuance.
- Packaged build verified on the builder PC: activation screen shows the device code, a 30-day code is
  accepted, `licenseStatus` becomes `valid`, `dbHealth` reports `connected` on MongoDB 9.0.8
  (`replicaSet:rs0`, transactions supported), and `authSetupRequired` is `true`.
- Installer: `release/Pharmacy-POS-Setup-0.2.1.exe`, SHA-256
  `3eb2253e6f6cc7286f7b84ce063ea8eb6206173aa36b97800c7cc7815630fea2`.
- Zip: `release/Pharmacy-POS-0.2.1-field-test.zip`, SHA-256
  `aed460a128705d2fe135e38af2d86a5437951e9ab66b0236d1a8815844774e69`.
- The installer is not stored in Git for this version; the pre-release assets are the distribution copy.
- Owner-only test build: no sale, no customer distribution (SSPL hold).

## Field-test 0.2.2 (2026-11-12): CRM removed, panel licences

- `ba8efbb` CRM removed (page, services, IPC, role, permission); POS walk-in only; version 0.2.2.
- `76cd797` app accepts panel licences (ANB2 token or `.anbc` file; `src/main/anb2.ts`, 9 tests on
  panel-issued leases). `4effeee` gitleaks triage of the test-lease fixture. CI green on `4effeee`.
- `8988896` trusts the live panel key `phm-2026-01` (owner created it 2026-11-12T17:22:05Z; SHA-256 of the
  raw public key `45bedf7e…bddd`). Scratch test leases are proven not to activate a real install.
- Panel (`Anubis-hub/anubis-switcher`, branch `feat/a3-issue-licence`): `508a867` A3 issuance (Licences page,
  1-hour test length by default, `.anbc` export, standalone `scripts/verify-lease.mjs`), `824adc6` a new
  licence is allowed once the previous subscription has ended. Deployed on the laptop panel (restarted with
  the owner's OK). Scratch-DB verification only; the live DB holds the owner's key and no licences.
- Packaged 0.2.2: smoke ok (MongoDB 9.0.8 rs0 with access control), activation screen shows the licence-file
  button, a lease from another key is refused, no CRM API. Installer SHA-256
  `beb754bbf6815cb211040e4cfff870e984965cd1fe4417c41431bb3f2216e773`; zip
  `2fab12cc31cf49cb90945b41bf4cbfce7d0de38848c1d456d9f0a1b43d9db44b`. Not stored in Git; release assets.
- Not done: renewal before expiry, transfer, revoke, support leases (panel A4); sequence high-water mark and
  clock-rollback store in the app (Gate 2 L1/L4). After the field test, set the panel's `DEFAULT_LENGTH`
  back to `'product'` (30 days).

## Next

Finish the open Gate 1 items above. Do not start B1 until panel A3 signing is verified. No Gate 2 and no sale before TD confirmation. No build is distributed until the owner has an SSPL legal opinion or a commercial licence.

## Last completed step

2026-11-12: field-test 0.2.2 (CRM removed, panel licences with the live key) built, smoke-tested and released as pre-release `field-test-0.2.2`; panel A3 issuance live on the laptop.
