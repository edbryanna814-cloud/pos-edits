# Licensing Test Plan

Every requirement in `REQUIREMENTS.md` must have a test that proves both the
acceptance path and the rejection path. A test that only proves the happy path
does not close the requirement.

Tests are grouped by layer:

| Layer | Runs on | Tooling |
|---|---|---|
| Unit — verifier | Linux/Windows CI | Vitest |
| Unit — panel domain | CI + PostgreSQL service | Vitest + test database |
| Integration — panel API | CI | Supertest/HTTP against a disposable DB |
| Integration — app IPC | Windows CI | Vitest + mocked panel |
| E2E — app | Windows CI | Playwright + Electron |
| Manual — device/key operations | Owner machine | Checklist |

---

## 1. Verifier unit tests (app)

| ID | Case | Input | Expected |
|---|---|---|---|
| V-01 | Valid entitlement | Correct signature, device, times | `valid`, correct fields |
| V-02 | Bad signature | Flip one signature byte | `SIGNATURE_INVALID` |
| V-03 | Unknown key id | `kid: "nope"` | `KEY_UNKNOWN` |
| V-04 | Wrong device | Different `dev` | `DEVICE_MISMATCH` |
| V-05 | Expired | `exp` in the past, no grace | `EXPIRED` |
| V-06 | Not yet valid | `nbf` in the future | `NOT_YET_VALID` |
| V-07 | Wrong version | `v: 1` in a `PHM2` envelope | `VERSION_UNSUPPORTED` |
| V-08 | Truncated token | Missing segment | `MALFORMED` |
| V-09 | Base64 tampering | Invalid base64url | `MALFORMED` |
| V-10 | Duplicate JSON keys | Payload with `exp` twice | reject |
| V-11 | Huge payload | > 8 KB | reject |
| V-12 | Sequence replay | Lower `seq` than cached | reject, keep cached |
| V-13 | Revoked licence | `lid` in list | `LICENCE_REVOKED` |
| V-14 | Revoked device | device hash in list | `DEVICE_REVOKED` |
| V-15 | `minApp` above current | `minApp: "99.0.0"` | `VERSION_TOO_OLD` |
| V-16 | Feature gate | `feat` without `reports` | reports denied, POS allowed |

The verifier must be a pure function over (token, key set, device hash, now,
last-seen, revocation list). That makes V-01…V-16 fast and deterministic.

---

## 2. Clock and cache tests (app)

| ID | Case | Setup | Expected |
|---|---|---|---|
| C-01 | Clock rollback before expiry | lastSeen = today; clock set back 1 year | `CLOCK_ROLLBACK`, read-only |
| C-02 | Small NTP correction | clock back 5 min | allowed |
| C-03 | Cache copy to another PC | different device hash | `DEVICE_MISMATCH` |
| C-04 | Cache edited by hand | change `exp` text | signature fails; read-only |
| C-05 | Cache deleted | no file | `ENROLMENT_REQUIRED`; data intact |
| C-06 | Cache corrupt/truncated | half-written JSON | previous good copy used, else re-enrol |
| C-07 | Atomic write | kill during write | previous file intact |
| C-08 | Last-seen never moves back | check-in with earlier time | stored value unchanged |
| C-09 | Protected storage unavailable | DPAPI failure | read-only, support bundle, no deletion |
| C-10 | Grace boundary | now = deadline ± 1 min | full vs read-only at the boundary |

---

## 3. Gate tests (app)

The current defect is that only login checks the licence. The test must prove
every write path is covered.

| ID | Case | Expected |
|---|---|---|
| G-01 | Valid licence, login | allowed |
| G-02 | Expired licence, login | **allowed** (login is not a write); read-only banner |
| G-03 | Expired licence, POS sale write | denied, read-only |
| G-04 | Expired licence, inventory write | denied |
| G-05 | Expired licence, settings write | denied |
| G-06 | Expired licence, user create | denied |
| G-07 | Expired licence, backup export | **allowed** |
| G-08 | Expired licence, reports read | **allowed** |
| G-09 | Expired licence, backup import | denied (it is a write) |
| G-10 | Suspended licence | read-only after grace |
| G-11 | Revoked licence | read-only after grace |
| G-12 | New write IPC handler added without gate | CI check fails |

G-12 is a static check: every **write** handler must be registered through a
helper that applies the gate, and the test enumerates the IPC map. Read
handlers, health, status, and login are exempt by design.

---

## 4. Panel domain tests

| ID | Case | Expected |
|---|---|---|
| P-01 | Issue licence | licence active, entitlement signed |
| P-02 | Issue with seats = 0 | rejected |
| P-03 | Owner registers a device code | device `pending`, no seat consumed |
| P-04 | Pending device claims | `active`, count 1 |
| P-05 | Claim at limit | `SEAT_LIMIT_REACHED` |
| P-06 | Two concurrent claims, one seat | exactly one succeeds |
| P-07 | Same device claims twice | idempotent, no extra seat |
| P-08 | Unregistered hash claims | `ENROLMENT_REQUIRED` |
| P-09 | Replacement request | pending, no state change |
| P-10 | Approve replacement | old retired, new active, seats unchanged |
| P-11 | Reject replacement | old stays active |
| P-12 | Approve replacement at limit | still within seats |
| P-13 | Reduce seats below active count | requires resolution; nothing retired silently |
| P-14 | Resolve seat reduction | chosen devices retired, audit entries |
| P-15 | Renew | `exp` extended, new sequence |
| P-16 | Extend without reason | rejected |
| P-17 | Suspend then resume | check-in reflects both |
| P-18 | Revoke licence | check-in 403; list contains it |
| P-19 | Revoke one device | other devices unaffected |
| P-20 | Reactivate a revoked licence | requires a new licence, old stays revoked |
| P-21 | Audit for every action | entry exists with actor, reason, hash chain valid |
| P-22 | Attempt to edit audit | DB permission denies |
| P-23 | Operator changes price | denied unless separate permission |
| P-24 | Signing failure after commit | device active, no unsigned success returned; next check-in signs |

---

## 5. API tests

| ID | Case | Expected |
|---|---|---|
| A-01 | `/v1/health` | 200, no customer data |
| A-02 | `/v1/enrol` for a registered device | 201 + entitlement |
| A-03 | `/v1/enrol` for an unregistered hash | 404 `ENROLMENT_REQUIRED` |
| A-04 | `/v1/enrol` malformed hash | 400, no stack trace |
| A-05 | `/v1/check-in` valid | 200 + entitlement + revocations |
| A-06 | `/v1/check-in` unknown device | 404 `DEVICE_UNKNOWN` |
| A-07 | `/v1/check-in` after licence revoke | 403 `LICENCE_REVOKED` |
| A-08 | `/v1/replacement-request` creates request | 202 |
| A-09 | `/v1/revocations?since` unchanged | 304 |
| A-10 | Rate limit enrolment | 429 with `Retry-After` |
| A-11 | Oversized body | 413, no crash |
| A-12 | Wrong content type | 415 |
| A-13 | TLS only | plain HTTP refused/redirected at the edge |
| A-14 | Error responses contain no secrets | string scan |
| A-15 | Logs contain no raw device hash in full | log review |

---

## 6. E2E scenarios (Playwright + Electron)

| ID | Scenario | Pass criteria |
|---|---|---|
| E-01 | Fresh install, not registered | Status screen shows the device code; **no code input** |
| E-02 | Owner registers the code, app claims | Device becomes active; app unlocks |
| E-03 | Restart | Stays unlocked without network |
| E-04 | Go offline, inside grace | Full function |
| E-05 | Go offline, past grace | Read-only; export works |
| E-06 | Reconnect after grace | Unlocks without restart |
| E-07 | Revoked while offline, then online | Read-only after next check-in |
| E-08 | Seat limit on a second device | Refused with a clear message |
| E-09 | Replacement request from the app | Panel record visible; device unchanged |
| E-10 | Clock set back | Read-only + clock message |
| E-11 | Cache copied from another PC | Rejected |
| E-12 | Licence removed while a sale is open | Sale completes or fails cleanly; no partial write |
| E-13 | Arabic locale | All licence messages translated, RTL correct |
| E-14 | No admin or role can manage licences | Navigate every screen as Administrator; no such control |
| E-15 | Support bundle export | Contains version, hash, code; no secrets, no business data |

E-14 is the direct regression test for the original request: no licence panel
exists in any role.

---

## 7. Abuse and tamper matrix

| ID | Attack | Expected result |
|---|---|---|
| X-01 | Paste a `PHM1` code into the app | No place to paste it |
| X-02 | Edit `license.json` | Signature/cache check fails |
| X-03 | Replace the public key in the bundle | App fails integrity/signature; no unlock |
| X-04 | Roll the clock back | Read-only |
| X-05 | Clone the disk to another PC | Device hash differs or check-in flags; not silently accepted |
| X-06 | Call `license:apply` over IPC | Channel absent |
| X-07 | Forge a JWT-like entitlement | Signature fails |
| X-08 | Swap `kid` to an older retired key | Rejected after retirement |
| X-09 | Replay an old entitlement after renewal | Lower sequence rejected |
| X-10 | Use a test/staging entitlement in production | Key set/`kid` mismatch |
| X-11 | Use a dev build as production | Visibly marked, check-in refuses, support bundle identifies it |
| X-12 | Bulk device claims to exhaust seats | Rate limit + seat limit |

---

## 8. Manual checks (owner)

These need a real machine and a real panel deployment.

1. Rotate the signing key and confirm old installs keep working through the
   overlap window.
2. Issue a licence for a clean VM, enrol, restart, and confirm no typing.
3. Revoke the VM, confirm read-only, export a backup, then restore that backup
   on another machine.
4. Delete the panel database, restore from backup, confirm entitlements still
   verify.
5. Unplug the network for the whole grace period and confirm the boundary.
6. Confirm the panel audit exports and the hash chain verifies.

---

## 9. Evidence to attach to the implementation report

- CI run URL per commit.
- Coverage of `FR-LIC-*` and `NFR-LIC-*` in a traceability table.
- The abuse matrix results, including the expected failures.
- The manual checklist with dates and machine identifiers (hashed).
- A statement that no signing material exists in the repo, with the scan output.
- A statement that no licence input exists in the UI, with the E2E result.

No requirement is "done" on a verbal claim.

---

## 10. Repository and CI checks (C0)

These prove the containment itself, before any verifier exists.

| ID | Case | Expected |
|---|---|---|
| R-01 | CI workflow on a pull request and on `main` | typecheck, build, secret/signing scan, Vitest all run |
| R-02 | Plant a private-key PEM block **with a base64 body** (header line, then at least one line of 40+ base64 characters) in a source file. A bare header alone passes by design (R-09). | scan job fails; remove the plant afterwards |
| R-03 | Plant a `scripts/license-*.mjs` file | scan job fails |
| R-04 | `scripts/license-keygen.mjs` and `scripts/license-generator.mjs` | absent from the tip of every branch after C0. They remain in history at baseline `3f70318`, by design: history is not rewritten (D-LIC-15), and the old key is treated as exposed anyway. |
| R-05 | `license:apply` while the current state is `valid` | refused before writing `license.json` |
| R-06 | `license:apply` with an earlier `exp` than the installed licence | refused; installed licence unchanged |
| R-07 | More than 5 `license:apply` attempts in an hour | refused with a rate-limit error; each attempt audited |
| R-08 | Vitest smoke test via `npm run test:unit` | runs and passes locally and in CI; `npm test` stays Playwright |
| R-09 | Prose in `docs/licensing/` mentions a private-key header with no key body | scan passes; the directory is scanned, not excluded |

R-04 is checked at the tip with `git ls-tree -r --name-only HEAD -- scripts/`
(no `license-*.mjs` listed) and with `npm run scan:signing`, which fails on any
tracked `scripts/license-*.mjs`. The scan must not rely on `.gitignore`.
`git log --all -- 'scripts/license-*.mjs'` is expected to print the baseline
add and the C0 delete. It proves when the files were removed, not that they
are absent from history.
