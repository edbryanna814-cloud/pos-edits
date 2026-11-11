# Builder Brief — Licence Authority Separation

**For:** the implementing developer
**From:** Technical Director
**Baseline:** `3f70318`
**Input:** `README.md`, `TD-RULINGS-001.md`, `ADR-001-licence-authority.md`,
`REQUIREMENTS.md`, `ARCHITECTURE-SECURITY.md`, `PANEL-CONTRACT.md`,
`FINDINGS.md`, `MIGRATION.md`, `TEST-PLAN.md`
**Deliverable:** working code in **two** repositories, with evidence. This
document is the order of work and the definition of done.

---

## 1. What is being changed, in one line

The pharmacy app stops issuing and accepting licences; a separate
owner-controlled panel issues signed entitlements, and the app only verifies
them.

---

## 2. Ground rules

1. **Do not add the panel to this repository.** It is a separate private repo.
   If you need a shared type, copy the minimal schema; do not create a
   monorepo.
2. **Do not touch POS, inventory, CRM, reports, or the database schema** beyond
   what the licence gate requires. No refactors, no renames, no cleanups.
3. **Do not keep any licence entry path**, not even behind a flag, a test
   screen, or `LICENSE_ENFORCE`.
4. **Do not commit signing material.** No private key, seed, or `.pem` in either
   repo, in CI, in fixtures, or in a screenshot.
5. **Read-only is the only failure mode.** No screen may block access to the
   pharmacy's own data, and nothing may delete data on a licence failure.
6. **No tax-compliance claim** in the licensing UI, docs, or installer.
7. **Latest commit green in CI before the next slice.** Report the exact SHA and
   run URL, as with Factory ERP.

---

## 3. Repository A — the panel (new, private)

Suggested name: `pharmacy-pos-licensing-panel`. Owner-owned. Do not fork this
app repo for it.

### Slice A1 — Skeleton, auth, audit

- Service skeleton with health endpoint, PostgreSQL, migrations.
- Owner account with 2FA; no public sign-up.
- Append-only, hash-chained audit table.
- Config row for the `POL-*` values in `REQUIREMENTS.md` §7.

**Done when:** health responds; an unauthenticated admin call is refused; an
audit entry is written and cannot be edited by the app role.

### Slice A2 — Customers, plans, licences

- CRUD for customers and plans.
- Licence create/activate with seats and expiry.
- Admin UI: list, detail, issue.

**Done when:** a licence can be created with a seat count and an expiry; invalid
input is rejected; every action is audited.

### Slice A3 — Reverse enrolment and entitlement signing

- The owner registers the device code shown by the app; no token is sent to
  the device.
- `POST /v1/enrol` with the transaction from `PANEL-CONTRACT.md` §6.
- `PHM2` signing with a configurable `kid`.
- Device rows and last check-in.

**Done when:** a registered device claims and receives a verifiable entitlement,
an unregistered hash gets `ENROLMENT_REQUIRED`, and a second claim at the seat
limit is refused; two concurrent claims cannot overrun.

### Slice A4 — Check-in, revocation, replacement

- `POST /v1/check-in`, `GET /v1/revocations`.
- Suspend, resume, revoke licence, revoke device.
- Replacement request, approve, reject.
- Seat reduction resolution.

**Done when:** the lifecycle table in `PANEL-CONTRACT.md` §7 behaves as
specified, including offline-visible state and audit entries.

### Slice A5 — Operations

- Backup/restore runbook, encrypted backups.
- Key rotation procedure and drill.
- Rate limits and structured logs.
- Support views: device list, last check-in, audit export.

**Done when:** a restore is performed on a clean database; a rotation is
performed without invalidating an active device.

---

## 4. Repository B — the application (this repo)

### Slice C0 — Containment (do this first)

Branch `chore/licence-containment` from `3f70318`.

- Commit 1, docs only: add `docs/licensing/`, apply the corrections in
  `TD-RULINGS-001.md`, create `PROGRESS.md`.
- Delete `scripts/license-keygen.mjs` and `scripts/license-generator.mjs`.
- Add `.github/workflows/ci.yml`: `npm ci`, `npm run typecheck`,
  `npm run build`, secret/signing scan, `npm run test:unit`.
- Add Vitest with one smoke test as `test:unit`; keep `npm test` as Playwright.
- Guard `license:apply` per `TD-RULINGS-001.md` D-LIC-16: handler-level check,
  no call when the current state is `valid`, no expiry downgrade, 5/hour,
  audited.
- Correct the false backend claims in `docs/SECURITY_REVIEW.md`,
  `ARCHITECTURE.md`, `START_HERE.md`, `IMPLEMENTATION_ROADMAP.md`,
  `MASTER_PROMPT.md`, and mark `DEVICE_LICENSING.md` as target, not implemented.
  Mark Roadmap Phase 8/9 and Master Prompt §6 as panel workstream, not app
  screens.
- Do not change `ActivationPage`, the `PHM1` public key, or any business module.

**Done when:** CI is green on the containment commit, the scan fails on a
planted private key, the `license:apply` guard tests pass, and the scripts are
absent. C0 does not close M1; the key rotation record comes with A1/A3.

### Slice B1 — Verifier and key set

- Introduce `PHM2` parsing and verification in the main process: signature,
  `kid`, version, `dev`, `iat`, `nbf`, `exp`, `seq`, `minApp`, `feat`.
- Replace the single PEM with a public key set (`kid`, key, `notBefore`,
  `retiredAt`).
- Keep the existing 32-hex device-hash approach unchanged.
- Remove price, currency, period, and the raw MAC from the `LicenseState`
  object exposed to the renderer; they stay in the main process.
- Unit tests V-01…V-16 from `TEST-PLAN.md`.

**Done when:** every tamper case fails with a stable code and the happy path
passes; no renderer code contains key material; the status payload contains no
price or MAC.

### Slice B2 — Central gate and read-only mode

- One `requireLicensedWrite()` used by every **write** IPC handler.
- **Login is never gated.** It stays available in read-only mode so reports,
  history, and export are reachable.
- Define read paths that remain available in read-only mode: reports, history,
  export, backup export, status.
- Refuse writes with a specific code; do not throw generic errors.

**Done when:** tests G-01…G-12 pass, including a static check that a new write
handler cannot be registered without the gate.

### Slice B3 — Remove in-app licence entry

- Delete `ActivationPage` as a code-entry screen.
- Remove `IPC.LicenseApply`, `window.api.licenseApply`, and the CSS specific to
  the form.
- Replace the pre-login gate with: **login always available**, and the
  status/read-only banner after login. No screen blocks login.
- No route, dialog, or hidden IPC accepts a code.
- Update `tests/electron.spec.ts` so the preload surface no longer contains
  `licenseApply`.

**Done when:** E-01 and E-14 pass; grep for licence input returns nothing.

### Slice B4 — Check-in client and protected cache

- Main-process HTTPS client: enrol, check-in, replacement request, revocations.
- Bounded timeout, retry with jitter, never block the UI thread.
- Cache the entitlement and last-seen time with DPAPI; atomic write; keep one
  previous copy.
- `effectiveNow = max(now, lastSuccessfulCheckIn)`; read-only when it exceeds
  `min(lastSuccessfulCheckIn + POL-GRACE, exp + POL-EXP-GRACE)`; detect
  rollback beyond 10 minutes.
- `PHM1` compatibility only if `D-LIC-17` is reversed; otherwise no legacy
  path, and `PHM1` files are left untouched for support.

**Done when:** C-01…C-10 and E-02…E-11 pass; killing the process during a
write leaves a usable cache.

### Slice B5 — Status, support bundle, bilingual UX

- Read-only status: state, plan, expiry, last check-in, seats, device code.
- Replacement request action with a note.
- Support bundle: version, hash, `lid`, last error, last check-in; no secrets,
  no business data, no raw serials.
- AR/EN strings, RTL-safe, non-accusatory.

**Done when:** E-13 and E-15 pass; a support bundle opens without exposing
anything sensitive.

### Slice B6 — Migration cleanup (conditional)

- Only if `D-LIC-17` is reversed: import sold `PHM1` licences into the panel
  (`MIGRATION.md` §4), converting milliseconds to seconds.
- Remove `PHM1` verification after the last legacy expiry.
- Otherwise: mark M3/M5/M7 not applicable and keep `PHM1` files read-only for
  support. Scripts and CI scans already happened in C0.

**Done when:** the applicable gates pass and no sold device is stranded.

---

## 5. Definition of done (applies to every slice)

A slice is done only when all of the following are attached to the report:

1. exact commit SHA;
2. CI run URL, green on that SHA;
3. the tests added for the slice, named;
4. the requirements closed, by ID (`FR-LIC-*`, `NFR-LIC-*`);
5. the rejection paths demonstrated, not just the happy path;
6. screenshots for UI changes, both languages;
7. a one-line statement of anything intentionally left out;
8. confirmation that no business module was modified outside the gate.

No "mostly done". No "will add tests later". No unverified claims in docs.

---

## 6. Non-goals (do not do these)

- Building a customer self-service portal.
- Adding a payment gateway.
- Multi-tenant SaaS.
- Remote wipe or data deletion on licence failure.
- Anti-tamper beyond the signature and the gate.
- Rewriting the authentication or role system.
- Changing prices, plans, or commercial terms.
- Adding telemetry beyond the check-in fields listed in the contract.
- Merging the panel into this app "for convenience".

---

## 7. Order and stop points

```text
C0            ── stop: containment + CI green
A1 → A2 → A3  ── stop: panel can register a device and sign
B1 → B2       ── stop: app verifies and gates writes, legacy activation still present
B3 → B4       ── stop: code entry removed, check-in live
B5            ── stop: status and support complete
A4 → A5       ── stop: lifecycle and operations complete
B6            ── stop: conditional migration cleanup
```

Do not start B3 until A3 can issue a real entitlement for a test device.
Removing code entry before the panel can enrol would leave new installs with no
path to access.

Do not start A4 before B2 is green; the panel's revocation work is only
meaningful once the app gates writes centrally.

---

## 8. What to report back, per stop point

```text
Slice: <id and name>
Repo: <panel | app>
Commit: <sha>
CI: <run url> (<workflow>, green)
Requirements closed: <ids>
Rejection paths tested: <list>
Not done / deferred: <list, with reason>
Risks discovered: <list>
```

At the final stop point, also provide:

- a traceability table `FR-LIC-*`/`NFR-LIC-*` → test → evidence;
- the abuse matrix from `TEST-PLAN.md` §7 with results;
- proof that the app repo has no signing material (scan output);
- proof that no UI accepts a licence code (E2E result);
- the migration list: every sold licence and its device row, or "not applicable
  under D-LIC-17";
- the key-rotation record, with the old key's disposition.

---

## 9. Decisions already made for you

Do not reopen these; they are the owner's:

- the panel is separate and owner-operated;
- no licence entry in the app, in any role;
- seats, renewal, suspension, revocation, and price live in the panel;
- read-only after grace, never data loss;
- `PHM2` signed entitlement with a key id;
- the defaults in `REQUIREMENTS.md` §7.

If implementation proves one of these impossible, stop and write a short ADR
with evidence. Do not silently substitute a different model.

---

## 10. Status of the first reply

The first reply was received and answered in `TD-RULINGS-001.md`. C0 is
approved; the panel repo and stack are accepted subject to the owner-account
rule in D-LIC-02.

Before C0 code, reply with one line: **"C0 approved, starting on
`chore/licence-containment`"**. Then execute C0 and report the three commits
with the CI run on the exact head.

Do not begin with the installer, UI polish, or pricing. Begin with containment
and the trust boundary.
