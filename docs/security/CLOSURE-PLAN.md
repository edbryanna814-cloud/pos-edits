# Pharmacy POS — Security Closure Plan

**Status:** owner-confirmed 2026-11-11. The app is feature-complete; this plan
closes it for sale.
**Scope:** Pharmacy POS v0.2.0, Electron + React + TypeScript + MongoDB.
**Rule:** no new features during closure. Security and licensing only.
**Owner decisions:** security closure now; B1–B5 licensing is the release gate
before the first sale.

---

## 1. Current state

| Item | State |
|---|---|
| Features | Complete |
| Electron hardening | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, `contextBridge` preload |
| Licensing | C0 containment on `chore/licence-containment`; PR #1 open; C0.1 fixes pending |
| Licence format | `PHM1` still accepted; `ANB2` verifier not built |
| Expiry behaviour | Not yet full lock; `D-LIC-05` read-only is superseded by `D-LIC-21` full lock |
| Dev MongoDB | 9.0.8 Community, service `MongoDB`, `127.0.0.1:27017`, standalone, **not** `rs0` |
| Bundled MongoDB | `vendor/mongodb` missing; `npm run dist` will pick the installed 9.0.8 |
| Panel | Contract v3 in `Anubis-hub/anubis-switcher`; A1 not started |

The honest position: the app is feature-complete, but it is **not sellable** yet
because the licence system is unfinished and the security baseline has not been
evidenced.

---

## 2. Gates

| Gate | Name | Purpose | When |
|---|---|---|---|
| 0 | Merge C0.1 | Make the containment and docs claims true | Now |
| 1 | Security baseline | Remove the ordinary security defects and prove the controls | 1–2 weeks |
| 2 | Release gate | Finish licensing and prove the install on a clean PC | 2–4 weeks |
| 3 | Assurance (optional) | External review, fuzzing, attestation | Later |

No gate is “done” without evidence: a CI run, a command output, a test report or
a screenshot.

---

## 3. Gate 0 — Merge C0.1

Fix these five items on `chore/licence-containment`; nothing else.

- [ ] **G0-1** `playwright.config.ts`: add `testMatch: '**/*.spec.ts'`.
      `npx playwright test --list` must exit 0 and list only
      `tests/electron.spec.ts`, not the Vitest files.
- [ ] **G0-2** `docs/licensing/TEST-PLAN.md` R-04: “absent from history after
      C0” is impossible; the baseline still contains both scripts and
      `git log --all -- scripts/license-*.mjs` prints the add and the delete.
      Reword to “absent from the tip” and fix the check command.
- [ ] **G0-3** `docs/licensing/TEST-PLAN.md` R-02: plant a header **and** a
      base64 body, or the scan passes and the test plan gives a false pass.
- [ ] **G0-4** `docs/licensing/ADR-001-licence-authority.md` E1 and
      `docs/licensing/MIGRATION.md` K8: the scan does not catch `sign(` or
      `createSign`. Either add `createSign`/`privateEncrypt` to
      `scripts/scan-signing.mjs`, or restate the claim to the implemented rules.
      Do not mark E1/K8 closed until then.
- [ ] **G0-5** `PROGRESS.md`: the table still says C0 is at `a457994` / run
      `42836474294`. Head is `fe35815` / run `42894351045`. Also fix the
      residual “Implement:” lists under the panel-only banners in
      `IMPLEMENTATION_ROADMAP.md` Phase 8/9 and `MASTER_PROMPT.md` §6/§7.

**Evidence:** new SHA, CI run URL on that SHA, and the `--list` output.

---

## 4. Gate 1 — Security baseline

### S1 — Dependencies and secrets

- [ ] `npm audit --omit=dev` and full audit; no high/critical unresolved.
- [ ] `osv-scanner` (or equivalent) on `package-lock.json`; record results.
- [ ] Full-history secret scan with `gitleaks` or `trufflehog`; no private keys,
      tokens or passwords. The old `PHM1` key must not appear.
- [ ] Lockfile committed and reviewed; no floating `^` drift in shipped
      dependencies.
- [ ] CycloneDX SBOM generated for the release.
- [ ] Licence check for bundled dependencies; MongoDB is SSPL — confirm the
      distribution position with the owner before sale.
- [ ] `npm run scan:signing` passes; its rules match the documentation
      (Gate 0).

### S2 — Electron hardening

- [ ] Verify `contextIsolation: true`, `nodeIntegration: false`, `sandbox:
      true`, `webSecurity: true`.
- [ ] Add a Content-Security-Policy that forbids inline script and remote
      script; confirm the app still renders.
- [ ] `setWindowOpenHandler` denies new windows; external links go through a
      controlled allowlist, never `shell.openExternal` with untrusted input.
- [ ] `will-navigate` blocks navigation away from the app origin.
- [ ] `will-attach-webview` is denied; no `<webview>` is used.
- [ ] `session.setPermissionRequestHandler` denies camera, microphone,
      geolocation, notifications and clipboard unless a feature needs it.
- [ ] DevTools are disabled in production builds.
- [ ] No `eval`, `new Function`, `remote` module, or dynamic `require` from
      untrusted input.
- [ ] `asar` packaging is enabled; no source maps or secrets in the package.

### S3 — IPC and input validation

- [ ] Every `ipcMain.handle` channel has an allowlist entry and a schema
      validation (Zod or equivalent).
- [ ] Validate the sender frame; reject IPC from unexpected webContents.
- [ ] No raw objects from the renderer reach MongoDB queries; validate types,
      lengths and ranges.
- [ ] NoSQL injection: reject operator keys (`$`, `.`) in user-controlled
      strings where they are not expected.
- [ ] Path traversal: any file path from the renderer is resolved and checked
      against an allowed root.
- [ ] Errors returned to the renderer are stable codes, not stack traces or
      database errors.
- [ ] The renderer never receives the licence token, raw fingerprint or key
      material; it receives the display device code only.

### S4 — Data at rest and backups

- [ ] MongoDB binds `127.0.0.1` only; no `0.0.0.0`.
- [ ] MongoDB authentication enabled; the app uses a least-privilege user, not
      an admin.
- [ ] Windows disk encryption (BitLocker) is a documented deployment
      requirement; verify on PC2.
- [ ] Backups are encrypted; the passphrase is not stored beside the backup.
- [ ] Restore drill: restore a backup to a clean data directory and verify
      totals and a sample sale.
- [ ] No raw hardware identifiers, passwords or PII in logs; redact.
- [ ] Uninstall does not delete the business database (`deleteAppDataOnUninstall:
      false` is already set).

### S5 — Audit and logging

- [ ] Audit log is append-only and hash-chained; verify the chain on startup.
- [ ] Audit covers login, licence apply, licence rejection, renewal, device
      change, backup and restore.
- [ ] Logs rotate and do not grow without bound.
- [ ] A support bundle can be exported without secrets.

### S6 — Installer and supply chain

- [ ] Pin the MongoDB version to ship. 9.0.8 is the current candidate; test it
      first, then pin it. Do not let `prepare-mongodb.ps1` follow whatever is
      installed later.
- [ ] `vendor/mongodb` contains the full `bin` folder and VC runtime DLLs;
      verify `mongod.exe --version`.
- [ ] `scripts/prepare-mongodb.ps1` and `scripts/mongodb.ps1` discover the
      installed version instead of hardcoding `9.0`.
- [ ] Build `Pharmacy-POS-Setup-0.2.0.exe`; publish a SHA-256 checksum.
- [ ] Test SmartScreen and antivirus behaviour; document that there is no
      code-signing certificate yet.
- [ ] Clean-VM install test: no Node, no MongoDB, no dev tools.
- [ ] Confirm the bundled MongoDB starts on the app port, initialises `rs0` and
      does not collide with the dev service on `27017`.

### S7 — Threat model and abuse cases

- [ ] Refresh the threat model in `docs/licensing/ARCHITECTURE-SECURITY.md`
      against the current code.
- [ ] Abuse cases: forged lease, copied licence file, wrong device, replayed
      lease, clock rollback, tampered history, tampered database, stolen backup,
      renderer XSS, NoSQL injection, IPC injection, seat limit.
- [ ] For each abuse case: expected behaviour, test, evidence.
- [ ] State honestly what is not prevented: a local admin can patch the app; a
      VM snapshot can rewind local markers; offline revocation runs to expiry.

### S8 — Documentation and key custody

- [ ] `SECURITY.md` — controls, trust boundaries, reporting.
- [ ] `RUNBOOK.md` — install, backup, restore, renew, transfer, support lease,
      incident response.
- [ ] `KEY-CUSTODY.md` — key generation, backup, rotation, two-copy rule,
      ceremony record.
- [ ] `RELEASE-CHECKLIST.md` — the evidence required before a sale.
- [ ] D-LIC-17: written owner confirmation that no `PHM1` licences were sold.
- [ ] Old `PHM1` key search: locate or declare lost; rotate before B4.

**Evidence for Gate 1:** command outputs, audit-chain test, restore report,
clean-VM install report, SBOM, threat-model table with test links.

---

## 5. Gate 2 — Release gate

Licensing is not a separate feature; it is the release gate. Do not sell before
this gate is green.

### L1 — ANB2 verifier

- [ ] Parse `ANB2`; verify Ed25519 with the per-product public key set.
- [ ] Check `prod`, `dev`, `fpv`, `nbf`, `exp`, `minApp`, `seq`, `kind`.
- [ ] Reject a lower `seq`, an unknown `kid`, a retired key and a wrong product.
- [ ] Accept `kind: "perpetual"` with `exp: null` and no expiry timer.
- [ ] Remove price and MAC from the licence status view.

### L2 — Full lock

- [ ] Gate every write path through one function, not only login.
- [ ] At `exp`, show the lock screen within 60 seconds.
- [ ] No login, no business screens, no reports, no export while locked.
- [ ] Allow an in-flight write to finish; block new writes.
- [ ] Data is retained; a valid renewal unlocks immediately.
- [ ] Support lease path works (1–3 days, audited).

### L3 — Remove PHM1

- [ ] Remove the pre-login activation form and `license:apply` from the UI.
- [ ] Remove `PHM1` acceptance after the migration window.
- [ ] Add **Import licence / Renew** on the lock screen and in settings.
- [ ] The app ships public keys only; no private key or issuance code.

### L4 — Offline import, clock and history

- [ ] Import `.anbc` or raw token while locked.
- [ ] `lastSeen` high-water mark in four independent stores.
- [ ] `CLOCK_ROLLBACK` when the clock is more than 10 minutes behind.
- [ ] `HISTORY_TAMPER` on a large mismatch; take the maximum values.
- [ ] Reminders before expiry; no grace after expiry.

### L5 — Lock screen, status and bilingual UX

- [ ] Lock screen shows product, customer, expiry, device code, import and
      support contact.
- [ ] Status view shows licence type, expiry/perp, device, renewal history.
- [ ] Arabic and English, RTL/LTR.
- [ ] Support bundle export.

### R1 — Clean PC2 end-to-end

- [ ] Install on a clean Windows PC with no Node and no MongoDB.
- [ ] First run, activate subscription, make a sale, close, reopen.
- [ ] Backup, restore, verify totals.
- [ ] Expire the lease, confirm full lock, import renewal, confirm unlock.
- [ ] Activate a perpetual licence on a second clean profile; confirm no expiry.
- [ ] Transfer device; confirm old device behaviour and new lease.
- [ ] Confirm the dev MongoDB on `27017` does not interfere.

### R2 — Negative tests

- [ ] Forged signature, wrong `kid`, wrong `prod`, wrong `dev`, lower `seq`,
      expired lease, not-yet-valid lease, unsupported `minApp`.
- [ ] Tampered `license.json`, tampered history, clock rollback.
- [ ] Missing MongoDB, database down during apply, database down during sale.
- [ ] Seat limit, revoked licence, suspended licence.
- [ ] The app never deletes business data on any licence failure.

### R3 — Installer and release artifacts

- [ ] Signed-off installer build with pinned MongoDB.
- [ ] SHA-256 checksum published.
- [ ] Arabic and English manual.
- [ ] Pilot agreement with the offline/no-kill/clock-tamper terms.
- [ ] Version and changelog.

### R4 — Key ceremony and restore

- [ ] Per-product key generated in the panel, public key embedded in the app.
- [ ] Encrypted key backup in two offline locations.
- [ ] Restore drill from the key backup.
- [ ] Audit record of the ceremony.

### R5 — Sale readiness

- [ ] Owner signs D-LIC-17.
- [ ] Old PHM1 key located or declared lost; rotation completed.
- [ ] Pricing and plan mapping confirmed by the owner (not invented).
- [ ] Support contact and renewal process documented.
- [ ] First customer onboarding checklist.

**Evidence for Gate 2:** clean-PC2 report with screenshots, test list and
results, installer checksum, restore report, key ceremony record, signed pilot
terms.

---

## 6. Gate 3 — Assurance (optional)

- [ ] External review or penetration test of the Electron app and installer.
- [ ] IPC fuzzing.
- [ ] SBOM attestation.
- [ ] Code-signing certificate (EV) if the budget allows.
- [ ] Reproducible build check.

This gate is not required for the first pilot sale, but it is required before
claiming “independently reviewed” or “enterprise-grade”.

---

## 7. Stop points

1. Do not start B1 until panel A3 signing is verified.
2. Do not merge PR #1 until Gate 0 is green on the new head.
3. Do not sell until Gate 2 is green.
4. Do not unfreeze Factory until Gate 2 is green.
5. Do not claim a control that is not evidenced in this plan.

---

## 8. Out of scope

- New features.
- Online check-in, remote kill, telemetry.
- Payment gateway, invoices, tax claims.
- Client portal.
- Factory app code, packaging or testing.
- Auto-update.

---

## 9. Reporting format for the developer

For every item, report:

1. Task ID.
2. Status: done / blocked / not started.
3. Files changed.
4. Evidence: command, output, CI run, screenshot or report.
5. Known issues.
6. Next action.
7. Whether owner approval is required.

**No item is “done” without evidence.**
