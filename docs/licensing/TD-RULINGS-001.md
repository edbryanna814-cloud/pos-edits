# TD Rulings — first builder reply

**Decision record:** `D-LIC-01` … `D-LIC-18`
**Date:** 2026-11-10
**Baseline:** `3f70318`
**Status:** binding. Where this document and an earlier doc disagree, this
document wins until the earlier doc is corrected (the corrections are listed
below and have been applied).

---

## 1. Approvals

| # | Question | Ruling |
|---|---|---|
| D-LIC-01 | Start C0 containment? | **Approved.** Branch `chore/licence-containment` from `3f70318`, target `main`. No force-push. |
| D-LIC-02 | Which account owns the panel? | The **owner's** account, `Talaat-hub`, or a new private org controlled by the owner. **Never** `edbryanna814-cloud`, never a repo shared with the app collaborators. Private, 2FA, one owner. |
| D-LIC-03 | Commit `docs/licensing/` in C0? | **Yes, first, as its own commit.** Order: (1) `docs(licensing): ...` including this file; (2) `chore(licence): C0 containment`; (3) `docs(progress): ...`. Docs before code. |
| D-LIC-04 | Add Vitest in B1? | **Add it in C0**, with one smoke test so the pipeline is real. B1 adds the verifier matrix. C0 CI also runs typecheck, build, and the secret/signing scan. |
| D-LIC-05 | Login in read-only mode? | **Login stays allowed.** The gate applies to **writes only**. Reports, history, export, and backup export remain available. This corrects `enrolment-token`-era wording in `REQUIREMENTS.md` and `BUILDER-BRIEF.md`. |
| D-LIC-06 | Grace formula | `effectiveNow = max(now, lastSuccessfulCheckIn)`; read-only when `effectiveNow > min(lastSuccessfulCheckIn + POL-GRACE, exp + POL-EXP-GRACE)`. Clock rollback if `now < lastSuccessfulCheckIn − 10 min`. Corrects `ARCHITECTURE-SECURITY.md`, `FINDINGS.md`, `BUILDER-BRIEF.md`. |
| D-LIC-07 | How does enrolment work? | **Reverse enrolment. No token reaches the device.** The app shows its 32-hex device code; the owner registers that code in the panel; the app claims with the hash. The panel decides. No code is typed into the app. Corrects `REQUIREMENTS.md`, `PANEL-CONTRACT.md`, `ARCHITECTURE-SECURITY.md`, `TEST-PLAN.md`, `BUILDER-BRIEF.md`. |
| D-LIC-08 | Device hash length | Keep the **existing 32-hex lowercase hash**, unsalted, as canonical. Do not change the algorithm. The panel stores `device_hash char(32)` and may additionally store a peppered HMAC for exports/logs. Corrects `PANEL-CONTRACT.md` and `MIGRATION.md`. |
| D-LIC-09 | Time units | `PHM2` uses **seconds**. Import `PHM1` as `floor(exp_ms / 1000)`. Corrects `MIGRATION.md`. |
| D-LIC-10 | Error codes | One canonical list in `PANEL-CONTRACT.md` §8. No test or doc may invent a code. Added local codes: `MALFORMED`, `DEVICE_MISMATCH`, `EXPIRED`, `NOT_YET_VALID`, `VERSION_UNSUPPORTED`, `CLOCK_ROLLBACK`, `CLOCK_UNAVAILABLE`, `ENROLMENT_REQUIRED`, `PANEL_UNAVAILABLE`. Removed: `ENROLMENT_INVALID`, `ENROLMENT_EXPIRED`, `ENROLMENT_USED` (no token on the device). |
| D-LIC-11 | Endpoint name | `/v1/replacement-request` is canonical. Corrects `TEST-PLAN.md` A-08. |
| D-LIC-12 | Spelling | Prose says "licence"; **code and API identifiers use `license`** to match the existing code. Canonical: `licenseStatus()`. Corrects `REQUIREMENTS.md` FR-LIC-023. |
| D-LIC-13 | Price and MAC in the renderer | Remove price, currency, period, and the raw MAC from `LicenseState` exposed to the renderer. They stay in the main process only. Status shows plan name, expiry, seats, state, device code. Add to B1. Corrects FR-LIC-021. |
| D-LIC-14 | False backend claims | C0 corrects **all** of them: `docs/SECURITY_REVIEW.md`, `ARCHITECTURE.md`, `START_HERE.md`, `IMPLEMENTATION_ROADMAP.md`, `MASTER_PROMPT.md`, `DEVICE_LICENSING.md` (mark as target, not implemented). In particular, the Phase 8/9 "Administration Dashboard" is **panel** work, not app screens. `FINDINGS.md` F-02 updated. |
| D-LIC-15 | Commit message contradicts the code | The repo has one squashed import commit and no history to rewrite. Ignore the message. `PROGRESS.md` and `FINDINGS.md` record the truth. Do not amend the baseline. |
| D-LIC-16 | `license:apply` has no auth check | C0 adds a **handler-level** guard in `LicenseApply` (not a permission entry): allow only when the current state is not `valid`, reject any code whose `exp` is earlier than the installed one (no downgrade), rate-limit to 5/hour, and audit each attempt with actor `system:license-apply`. Removed entirely in B3. Under `D-LIC-17` there are no live installs, so this cannot strand a paying customer during C0–B2. |
| D-LIC-17 | Key location and sold licences | **Default: no `PHM1` licences were sold.** The repo has no CI, no releases, no distribution artifacts, and one import commit, so there is no evidence of a sale. Proceed on that basis: **no `PHM1` import, no legacy compatibility work**. Rotate the key and destroy the old one when found. If the owner says otherwise, stop before B4 and I will issue a separate migration ruling. |
| D-LIC-18 | Section order in C0 | C0 is the **first** slice, before A1. `BUILDER-BRIEF.md` §4/§7 updated accordingly. Script removal and the CI scan move from B6 into C0. |

---

## 2. C0 — exact scope

Branch: `chore/licence-containment`.

Commit 1 — docs only:

- add `docs/licensing/` (nine files plus this ruling);
- correct the false backend claims listed in D-LIC-14;
- mark `IMPLEMENTATION_ROADMAP.md` Phase 8/9 and `MASTER_PROMPT.md` §6 as the
  **panel** workstream, not in-app screens;
- add `PROGRESS.md` with the baseline, the C0 scope, and the stop point.

Commit 2 — containment code:

1. delete `scripts/license-keygen.mjs` and `scripts/license-generator.mjs`;
2. add `.github/workflows/ci.yml`: `npm ci`, `npm run typecheck`,
   `npm run build`, the secret/signing scan, and `npm run test:unit`;
3. add Vitest as a dev dependency with one smoke test, exposed as
   `test:unit`; leave `npm test` as Playwright so existing E2E commands do not
   change;
4. add the scan: fail on a private-key block **with a base64 body**
   (`BEGIN … PRIVATE KEY` followed by key material), on `generateKeyPair` and
   `createPrivateKey` in app code, and on any `scripts/license-*.mjs`; a bare
   header mention in prose is allowed, so `docs/licensing/` can describe the
   rule without being excluded from scanning;
5. guard `license:apply` per D-LIC-16;
6. no change to `ActivationPage`, the PHM1 public key, or any business module.

Commit 3 — progress record: C0 done, CI SHA, next slice.

**C0 does not close M1.** M1 also needs the key-rotation record, which needs the
panel key from A1/A3.

---

## 3. Answers to the four owner questions

**Where is the old private key?**
Not on this machine, and not in the repo (verified). It was generated by
`scripts/license-keygen.mjs` into `~/.pharmacy-pos-license/private.pem` on
whichever machine ran it — most likely the machine that built the app. Action:
the owner and the builder each search their machines and backups for
`private.pem` and for any copy; record where it was found; do not open it in
chat. Rotation happens regardless, because existence elsewhere is unproven.
With D-LIC-17 (no sales), the old key can be destroyed after rotation.

**Were any licences sold under the current key?**
Default: **no**. Proceed as if none were sold. This removes the legacy import
and lets B4 ship without `PHM1` compatibility. If that is wrong, say so before
B4; the cost is a one-time import, not a redesign.

**Commit `docs/licensing/` in C0?**
Yes — as commit 1, before the code. Untracked docs are not a gate.

**Can Vitest be added in B1?**
Add it in C0 (D-LIC-04). The pipeline must exist before slices claim to be green
on it.

---

## 4. Slice order (replaces BUILDER-BRIEF §7)

```text
C0  containment + CI + docs correction        ← approved now
A1  panel skeleton, auth, audit
A2  customers, plans, licences
A3  reverse enrolment + PHM2 signing          ← stop: panel can licence a device
B1  verifier, key set, remove price/MAC from status
B2  central write gate, read-only mode (login allowed)
B3  remove activation form, license:apply, license code entry
B4  check-in client, protected cache, clock rule
B5  status, support bundle, bilingual UX
A4  check-in, revocation, replacement, seats
A5  operations: backup, rotation drill, rate limits
B6  migration cleanup + legacy retirement (only if D-LIC-17 is reversed)
```

Stop points and the definition of done are unchanged.

---

## 5. Conditions the builder must not relax

1. **No token, code, or file is entered by the pharmacy.** The device code is
   displayed outward, never typed in.
2. **Login is not a write.** It stays available in read-only mode.
3. **One canonical error list.** No new codes without a doc change.
4. **32-hex device hash, unchanged.** Changing it breaks every future
   migration and buys nothing.
5. **Read-only never deletes or hides data.** Export and backup export remain.
6. **No signing material in the app repo**, including fixtures and CI.
7. **Panel code never enters this repo.**
8. **Every slice reports SHA + green CI run + named tests + closed IDs.**

---

## 6. Corrections applied to the package

| Document | Corrected |
|---|---|
| `README.md` | `App.tsx:448-453`; status and gate record owner acceptance; conditional migration; link to this ruling |
| `ADR-001-licence-authority.md` | Status accepted by owner authority; `PHM1` retirement conditional; signature optional |
| `REQUIREMENTS.md` | FR-LIC-004 reverse enrolment; FR-LIC-020 outbound code allowed; FR-LIC-021 no price/MAC; FR-LIC-023 `licenseStatus`; FR-LIC-025 formula; FR-LIC-026 login allowed; NFR-LIC-007 32-hex unsalted |
| `ARCHITECTURE-SECURITY.md` | Enrolment flow; grace formula; token threat replaced; renderer may see the device code; `PHM1` removal conditional |
| `PANEL-CONTRACT.md` | 32-hex hash; no device token; reverse enrol; canonical error list; endpoint name; `DEVICE_PENDING` defined |
| `MIGRATION.md` | C0 first; hash import direct; ms→s; default no sales; every `PHM1` section conditional |
| `TEST-PLAN.md` | G-02 login allowed; reverse enrol cases; canonical codes; endpoint name; V-14 field |
| `BUILDER-BRIEF.md` | C0 slice; B2 login; B3 login never blocked; B4 formula; B6 scope reduced; price/MAC in B1 |
| `FINDINGS.md` | F-02 wider claim list; F-03 line; F-05 formula; F-08 hash; new F-16/F-17/F-18 |

---

## 7. Reply expected

One line: **"C0 approved, starting on `chore/licence-containment`"**, then
execute C0 and report the three commits with the CI run on the exact head.

No other approval is pending.
