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

## Field-test 0.2.3 (2026-11-13): shared database, UI fixes

- `356cb1f` dashboard reloads after activation; the receipt prints only the receipt and says "Paid amount";
  "Expires soon" only within 8 months (`src/shared/expiry.ts`, used by dashboard, inventory, report).
- `360bb7c` shared live database: Settings → Database location (this computer, or one MongoDB server such as
  Atlas for several tills; TLS + login + replica set required; string stored DPAPI-encrypted). Shifts are per
  cashier; audit chain retries under contention. E2E: two tills on one server share users.
- Panel (`Anubis-hub/anubis-switcher`): `2c4d9e3` Cancel license, "license" spelling, min app 0.2.2.
- `installation/` now holds only `WHAT-TO-INSTALL.txt`. Installer 0.2.3 SHA-256
  `a7bcf2eb885ca73e05c75059742fc7844eda9ed74b91db08db0669c41c2b8a9e` (release asset, tag `field-test-0.2.3`).

## Field-test 0.2.4 (2026-11-13): three roles, panel customer groups

- `c31ff1d` roles: Administrator (all + `database.manage`), Manager (all except the database location;
  Administrator users, their audit entries and the role are hidden and refused), Seller (POS + Inventory only).
  Permissions come only from the role; custom per-user permissions removed. Old roles become Seller on startup.
- Panel `1257d52`: customer groups (name, contact, product, payment type, price, currency, period, count saved
  once); "Add device" needs only the device code, name and passphrase. Licenses listed per customer.
- Installer 0.2.4 SHA-256 `b49d3d2ca8f6dbaf3aed585892d29b3ad005d6411c9c88bf17d4a84c2ee357ba` (release asset, tag `field-test-0.2.4`).
- Owner decision: build both device links (internet server, and local network by IP).

## Field-test 0.2.5 (2026-11-13): local network (Wi-Fi) mode

- `667e43b` Settings → Database location (Administrator): "Main computer for this Wi-Fi" (bundled MongoDB
  binds 0.0.0.0:27028; join-only user `pharmacy_lan`, app rights, 12-char join code; this PC's IPs shown) and
  "Connect to the main computer" (private IP + join code, tested before saving; direct connection).
  Hosting off drops the join user. Shortcut: no TLS on the LAN; join code protected by SCRAM.
- Not tested: hosting in the packaged app across two real PCs (E2E runs unpackaged); Windows Firewall prompt.
- Installer 0.2.5 SHA-256 `f4d6278bb21f7912aca81d164f45631e24ae141586a8f4849b198ac266cbd29f` (release asset, tag `field-test-0.2.5`).

## Field-test 0.2.6 (2026-11-13): forgotten username/password

- `d16cc99` sign-in → "Forgot username or password?": device code + one-time request code; a panel-signed reset
  code (RST1, Ed25519, typ ANB-RST, bound to device + request, 1 h) lists Administrator names and sets a new
  password (unlocked, re-activated, audited `password.recovered`). Passwords stay one-way hashes.
- Panel `b4edc37`: Licenses → Forgotten password (product, device code, request code, passphrase); audited.
- Installer 0.2.6 SHA-256 `af0792bf419a56d8e045ab032961f4b98f68bd79c9848fd1030176cc5af314ca` (release asset, tag `field-test-0.2.6`).

## Field test closed (2026-11-13)

- Owner: field-test job finalized. 0.2.6 published as the latest release of the private distribution repo
  `Anubis-hub/pharmacy-pos-release` (README + WHAT-TO-INSTALL + installer, no source), tag `v0.2.6`,
  SHA-256 `af0792bf419a56d8e045ab032961f4b98f68bd79c9848fd1030176cc5af314ca`.
- Owner-confirmed deletions on the laptop: old app data backup, the app's own database, dev test databases
  (pharmacy_pos, pharmacy_pos_gatecheck, pharmacy_pos_shot, anubis_switcher_scratch_a3). Panel Atlas data untouched.
- Still open: PR #2 (Gate 1) and `field-test/0.2.0` not merged to main; panel default period still 'hour'
  (set to month after testing); MongoDB SSPL legal opinion before any sale.

## 0.3.0 (2026-11-16): pharmacy requests (branch feat/pharmacy-requests)

- TD catch-up: no Pharmacy changes since the merge; panel (`Anubis-hub/anubis-switcher`) gained the Factory field-test key + FAC
  subscription (`6502d98`) and explained refusals (`b216177`, `98dfcd1`).
- `4472324` passwords: minimum 3 characters (lockout still 5 tries); backup passphrase stays 12.
- `058522c` tax optional ("Charge tax on sales" switch); POS discount in percent (server computes the amount).
- `8c8d7df` units box / strip / pill (`src/shared/packaging.ts`): box price divided into strip and pill prices; stock in
  the smallest counted unit, shown as boxes · strips · pills; POS sells any unit; pre-0.3.0 products unchanged.
- `f176608` customers (name, ID number, phone, discount %; at least one) + POS picker; user ID numbers (counter from 1
  or typed, unique; existing users numbered on start).
- `fe6bb24` product import from Excel/CSV with a checked preview; own .xlsx reader on fflate 0.8.3 (no deps).
- `f746319` fingerprint attendance import (Excel export or ZKTeco attlog.dat, matched by user ID; in/out/breaks; hours)
  and per-seller KPIs on the dashboard. Not built: a live network link to the machine (needs the model).
- Installer 0.3.0 SHA-256 `10896fb3b3b5c4c9adea20375f24ed50bdd5a2c348302dd6909675c27a81a483` (pre-release `field-test-0.3.0`). Release repo not updated yet (owner: later).

## 0.3.1 (2026-11-16): owner review of 0.3.0 (same branch, PR #4)

- `fba20d5` Settings tick box beside its words; stock colours from each product's minimum (red at/below, yellow within a
  new per-product warning margin) on Inventory rows and POS cards; stock adjustment in boxes, strips or pills.
- `dd51ef3` return period per product (days; empty = not returnable), saved on each sold line; POS "Returnable items"
  list (passed periods drop off); per-line returns refunded their share of what was paid; server refuses the rest.
- `0bf4b67` permission `data.transfer` (Administrator only): backups, Excel imports, attendance import, exports.
  Exports per section as Excel or .db (MongoDB Extended JSON, records as stored; no password hashes). Record
  database IDs (`_id`, always created by MongoDB) shown to Administrators only - never shown before, incl. 3f70318.
- Installer 0.3.1 SHA-256 `d363e5cd5f9c83cbacb2467845e0551fcd83cfcb241cbb500e3445422f8de78a` (pre-release `field-test-0.3.1`).

## 0.3.2 (2026-11-17): delete options and the pharmacy's invoice template (PR #4)

- `6089be0` delete categories, products, suppliers, customers (permission `catalog.delete`: Administrator, Manager;
  customers: `customers.manage`); asked first, audited with the name; refused while a product is on an open PO or a
  supplier has orders. Users are not deleted (deactivate keeps the audit trail readable). The free-text Units list
  (unused since 0.3.0) is hidden behind a note.
- Printed invoice = owner's Arabic template (`src/renderer/src/pos/InvoicePrint.tsx`): "صيدلية" + pharmacy name,
  customer name/phone, seller, pharmacy phone (new Settings field `companyPhone`), totals with paid and الباقي.
  Page size follows the printer (80 mm / A5 / A4).
- Installer 0.3.2 SHA-256 `9a934fdd1313c909abfba707a500c77b8c7ffe5f16ba539bd28c72781da86d12` (pre-release `field-test-0.3.2`).

## Next

Finish the open Gate 1 items above. Do not start B1 until panel A3 signing is verified. No Gate 2 and no sale before TD confirmation. No build is distributed until the owner has an SSPL legal opinion or a commercial licence.

## Last completed step

2026-11-17: 0.3.2 (deletes, invoice template) built; pre-release `field-test-0.3.2`; PR #4 open (not merged). Release repo `Anubis-hub/pharmacy-pos-release` updated to v0.3.2 (commit 2301789, same installer SHA-256 9a934fdd…). User guide PDF added (renamed `docs/manual/Manuscript EN.pdf`) (21 pages of screenshots with numbered arrows; rebuild: `npm run build && npx playwright test -c docs/manual && node docs/manual/build.mjs`). Arabic guide `docs/manual/Manuscript AR.pdf` (same pages, Arabic screens; `MANUAL_LANG=ar` for both commands).

2026-11-17: staff guide `docs/manual/Manuscript Staff EN.pdf` / `Manuscript Staff AR.pdf` (screens as a Manager; no administrator, backups, files or database; `MANUAL_GUIDE=staff`). Administrator hidden from non-admins in the Reports per-cashier totals too (Users, Audit, Attendance, KPIs already); denial messages no longer name the administrator; Users and Audit pages had the Settings subtitle, fixed. Owner chose "lock files + LAN TLS" (below).

2026-11-17: data protection (owner choice: lock files + LAN TLS).
- App folder (database files, logs, keys) restricted at every start to the Windows account running the app + SYSTEM (`lockAppFolder`, icacls; Administrators group removed — a Windows admin can still take ownership).
- LAN host mode: mongod `requireTLS` with a self-signed RSA-2048 certificate made by the app (`src/main/lanTls.ts`, no new dependency), kept DPAPI-encrypted (`lan-tls.bin`); the key PEM exists only while mongod starts. The host app itself connects over TLS too.
- Joining tills pin the host certificate on "Test connection" (`lan-host-cert.pem`); both screens show a security code to compare; Save refuses if the certificate changed (`DB_SECURITY_CODE_CHANGED`).
- Verified on a packaged build (throw-away profile): folder ACL, plain connections refused (Wi-Fi and local), wrong pin refused, pinned join reads data, wrong join code refused, mongod stops on quit. Unit tests: certificate + pinned TLS (`tests/unit/lanTls.test.ts`).
- Disk encryption itself is Windows' job: WHAT-TO-INSTALL.txt and the owner manuscripts ask to turn on Device encryption / BitLocker.
- Tills that joined before this version must re-join (Settings → Database location) once the main computer runs it.
- Signing scan (`scripts/scan-signing.mjs`): owner approved one narrow exception, `src/main/lanTls.ts` only (key generation + signing for the TLS certificate). That file fails the scan if it mentions anything licence-related (licen*, lease, ANB/PHM/RST codes, panelKey, issu*); key blocks are still refused everywhere. Tests in `tests/unit/scanSigning.test.ts`.

2026-11-17: release 0.3.3 (staff manuscripts, admin hidden from reports, folder lock, LAN TLS). Installer `Pharmacy-POS-Setup-0.3.3.exe` 157562956 bytes, SHA-256 `879624cb5dae7d1a74df67130dd4a921b63429837abb80bb9f0cfdf24e2524f2`; packaged check re-run on this build (folder ACL, TLS only, pin, join code, stop on quit). Pre-release `field-test-0.3.3`; release repo `Anubis-hub/pharmacy-pos-release` v0.3.3.
- 2026-11-17: PR #4 merged into main (owner request), merge commit 5aa1030; CI green on main.
- 2026-11-17: owner asked for the staff manuscripts (EN/AR) on the release download; added to `Anubis-hub/pharmacy-pos-release` v0.3.3 (owner manuscripts stay out).

2026-11-17 (branch `feat/branding-reports`): default branding and manager reports.
- App name **Anubis Pharmacy** (window title, sign-in, license screen, sidebar; installer `Anubis-Pharmacy-Setup-<v>.exe`, `productName`). The internal package name stays `pharmacy-pos-management`, so the data folder (database, license, keys) does not move on update; appId unchanged.
- Logo from the owner's JPG (`G:\Mahmoud\Under Deployment\Logos\Pharmacy\`), corners made transparent: `build/icon.png` (Windows icon), `src/renderer/src/assets/logo.png` (sidebar, sign-in, license screen, printed invoice). Default until a buyer asks for their own (swap those two files).
- Reports page: "Download a report (Excel)" with a date range (at most a year): sales report (each invoice + totals) and purchasing report (each purchase-order line, supplier, received date + totals). Permission `reports.view` (Manager, Administrator); no record IDs; administrator cashier names left empty for non-admins; audited `report.export`. E2E: both files saved, bad range refused, seller refused.
- Manuscripts rebuilt (new name/logo on covers and screens, report buttons explained).
