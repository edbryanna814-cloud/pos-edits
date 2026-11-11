# Findings — current licensing implementation

**Baseline:** `3f70318` ("Remove in-app subscription and license management")
**Method:** source review of every licensing path, the preload surface, IPC
registration, the renderer gate, the issuance scripts, packaging config, and the
existing documentation.
**Rule:** this document records what exists. It does not propose code here; the
change is specified in `ADR-001`, `REQUIREMENTS.md`, and `BUILDER-BRIEF.md`.

---

## 1. Summary

| ID | Severity | Finding | Owner action |
|---|---|---|---|
| F-01 | **Critical** | Licence generation and key generation scripts are committed in the customer app repo | Remove; move issuance to the panel |
| F-02 | **High** | Security documentation claims a backend and server-side limits that do not exist | Correct or delete the claim |
| F-03 | **High** | Activation is a pre-login screen available to anyone at the machine | Remove code entry entirely |
| F-04 | **High** | Seat count (`cnt`) is displayed but never enforced | Enforce in the panel |
| F-05 | **Medium** | Expiry trusts the system clock; rollback extends access | Protected last-seen clock |
| F-06 | **Medium** | Only login checks the licence; other IPC handlers do not | Central gate |
| F-07 | **Medium** | One hard-coded key, no key id, no rotation, no revocation | Key set + revocation list |
| F-08 | **Medium** | `license.json` is plaintext, copyable, and the only local authority | Protected cache, device-bound |
| F-09 | **Medium** | No audit of licence application or rejection | Panel + local audit |
| F-10 | **Medium** | Any unpackaged build is fully unlocked unless `LICENSE_ENFORCE=1` | Build-time guard |
| F-11 | **Low** | `iat`/`nbf` are not validated; future-dated codes are accepted | Validate times |
| F-12 | **Low** | Raw MAC is displayed and stored | Hash only |
| F-13 | **Low** | Cache write is not atomic | Write-temp-then-rename |
| F-14 | **Low** | No automated licensing tests | Add the matrix in `TEST-PLAN.md` |
| F-15 | Info | The installer does not ship `scripts/`; the repo and build machine still hold them | Repo-level control, not packaging |
| F-16 | **Medium** | `license:apply` is callable without login and can downgrade a valid licence | Guard in C0; remove in B3 |
| F-17 | Low | The import commit message contradicts the code | Record the truth; do not rewrite |
| F-18 | **Medium** | No CI and no unit runner, so "green on every SHA" is unverifiable | C0 adds CI + Vitest |

---

## 2. Detail

### F-01 — Issuance capability is in the customer app repo (Critical)

**Evidence**

- `scripts/license-keygen.mjs` generates an Ed25519 key pair and writes
  `~/.pharmacy-pos-license/private.pem` and `public.pem`.
- `scripts/license-generator.mjs` reads that private key and prints a valid
  `PHM1` code. Its usage text is in the file header.
- `scripts/license-generator.mjs` default key path:
  `join(homedir(), '.pharmacy-pos-license', 'private.pem')`.

**Impact**

Anyone with repo access can read the signing procedure. Anyone with access to
the machine where the key was generated can mint unlimited licences for any
device, with any price, period, and count. This is the treasury risk in its
purest form: the customer-facing product ships next to its own mint.

**Required action**

Delete both scripts from this repo in C0. Move issuance into the panel (separate
repository). Rotate the key and treat every existing `PHM1` code as suspect
(`MIGRATION.md` §2). Add a CI check that fails on private-key material. Under
`D-LIC-17` no `PHM1` code was sold, so there is nothing to migrate; the key is
rotated regardless.

---

### F-02 — Documentation describes a backend that does not exist (High)

**Evidence**

`docs/SECURITY_REVIEW.md`:

> "Private signing key only on trusted backend (env), Electron uses verification
> logic … Device limits enforced in backend … Replacement requires admin approval."

`DEVICE_LICENSING.md` §7–§10 describes an administration dashboard, HTTPS
activation, cached signed entitlements, and backend-verified payment — none of
which exist in the code. There is no HTTP client, no backend URL, no admin
dashboard, and no entitlement file.

The same false claim appears in `ARCHITECTURE.md:271-282,304-311,334`,
`START_HERE.md:69-71`, `IMPLEMENTATION_ROADMAP.md:260-262,316`,
`MASTER_PROMPT.md` §6 and §"Administration", and the Roadmap Phase 8/9 titles.
Those Phase 8/9 screens belong to the **panel**, not this app.

**Impact**

A reviewer, a customer, or a future builder will believe the product already has
the separation it lacks. That is how the current situation survived review.

**Required action**

Correct `docs/SECURITY_REVIEW.md`, `ARCHITECTURE.md`, `START_HERE.md`, and
`IMPLEMENTATION_ROADMAP.md` to describe the baseline truth, and keep
`DEVICE_LICENSING.md` as the target specification, clearly marked as not
implemented. The panel contract in this package becomes the implementation
reference. C0 does this.

---

### F-03 — Activation is pre-login and available to anyone (High)

**Evidence**

- `src/renderer/src/App.tsx:448-453`: if the licence is not `valid`, the app
  renders `ActivationPage` and returns before the login screen.
- `src/renderer/src/license/ActivationPage.tsx`: shows MAC address, device ID,
  a licence-code input, and an Activate button.

**Impact**

No authentication is required to see the device identity or to submit a code.
The screen is a licence administration surface inside the customer product. It
also discloses the MAC address to anyone who walks up to the till.

**Required action**

Remove the code-entry screen. Replace with a read-only status view (or no view),
and move enrolment to the panel. The app may show a device hash for support, not
the MAC.

---

### F-04 — Seat count is decorative (High)

**Evidence**

- `LicensePayload.cnt` is parsed and copied into `LicenseState.count`
  (`src/main/license.ts:141`).
- The value is never compared with anything. There is no registry of devices,
  no active count, and no server call.

**Impact**

A licence sold as "1 device" is valid on every device that receives a copy of
the code, provided the device hash matches the payload. A single-device code
cannot be reused across different hardware, but the commercial seat promise is
unenforced and unaudited.

**Required action**

Seats are enforced by the panel (`PANEL-CONTRACT.md` §6). The app displays the
number and never treats it as authority.

---

### F-05 — Clock rollback extends the licence (Medium)

**Evidence**

`src/main/license.ts:161`:

```ts
return payload.exp > Date.now() ? validState(info, payload) : expiredState(info, payload)
```

There is no stored last-seen time, no monotonic check, and no clock-tamper
state.

**Impact**

Setting the Windows clock back before `exp` restores access indefinitely. This
is a one-minute bypass for any customer who wants free use.

**Required action**

Protected last-seen clock (DPAPI):
`effectiveNow = max(now, lastCheckIn)`; read-only when it exceeds
`min(lastCheckIn + POL-GRACE, exp + POL-EXP-GRACE)`, plus a
`CLOCK_ROLLBACK` state (`REQUIREMENTS.md` FR-LIC-025).

---

### F-06 — The licence gate covers login only (Medium)

**Evidence**

`src/main/index.ts:182` is the only `hasValidLicense()` call:

```ts
handle(IPC.AuthLogin, async (event, input) => {
  assertTrusted(event)
  if (!(await hasValidLicense())) throw new Error('License required or expired')
  return login(input as any)
})
```

All other handlers — settings, backup, users, POS, inventory, CRM, reports —
are registered without a licence check.

**Impact**

The gate is a login gate, not a product gate. A renderer that skips the gate,
or a session created while valid, can continue writing after expiry. A backup
import can overwrite a licensed database from an unlicensed state.

**Required action**

One central `requireLicensedWrite()` in the main process, used by every write
handler and by the login path. Read paths may stay open in read-only mode; write
paths must not (`REQUIREMENTS.md` FR-LIC-026).

---

### F-07 — Single hard-coded key, no rotation, no revocation (Medium)

**Evidence**

- `src/main/license.ts:12-14`: PEM literal in source.
- `license.ts:113`: `createPublicKey(PUBLIC_KEY_PEM)`.
- No key id in the `PHM1` payload; no revocation list; no server.

**Impact**

A key compromise requires a new app release and invalidates every existing
installation. There is no way to revoke a stolen or shared licence, and no way
to introduce a new key without a flag day.

**Required action**

`PHM2` with `kid` and a public key set; signed revocation list; rotation
procedure (`PANEL-CONTRACT.md` §9).

---

### F-08 — `license.json` is the local authority (Medium)

**Evidence**

- `license.ts:176`: writes `{ code, appliedAt }` as plain JSON under
  `app.getPath('userData')`.
- `license.ts:121-129`: reads and parses it on every state check.
- Copying the file to a machine with the same `dev` hash reproduces the licence.

**Impact**

The local file is editable and portable. Device binding is the only barrier, and
the file is not protected at rest. A cloned disk or a matching board/BIOS pair
restores access. The user can also delete the file to reset to `missing` and
re-enter a code.

**Required action**

The cache stores the signed entitlement, protected with DPAPI, plus the
last-seen clock. Deleting it forces re-enrolment through the panel, not code
entry. The cache is never treated as authority for seats, revocation, or price.

---

### F-09 — No licence audit (Medium)

**Evidence**

`src/main/license.ts` contains no audit write. The auth module writes audit
events for users and sessions; licensing does not. The panel does not exist, so
there is no server-side record either.

**Impact**

There is no evidence of who applied which code when, no record of failed
attempts, and no way to investigate a dispute about a subscription.

**Required action**

Panel audit for every issuance and change; local audit for claim, reject,
check-in, and read-only transitions, included in the support bundle.

---

### F-10 — Unpackaged builds are fully unlocked by default (Medium)

**Evidence**

`src/main/license.ts:100-102`:

```ts
function devBypass(): boolean {
  return !app.isPackaged && process.env['LICENSE_ENFORCE'] !== '1'
}
```

**Impact**

A development build distributed by mistake is a free, fully functional product.
The bypass is a single environment variable away from being disabled, but the
default is permissive.

**Required action**

Make enforcement default-on for any build that is not explicitly marked
development, and stamp development builds so a support bundle can identify
them. Keep a bypass only for the local test suite, never for a shipped artifact.

---

### F-11 — Time fields are not validated (Low)

**Evidence**

`verifyCode` (`license.ts:108-119`) checks version, signature, and `dev`. It
never checks `iat` or rejects a code whose `iat` is in the future. `nbf` does not
exist in `PHM1`.

**Impact**

A future-dated code is accepted immediately; a code with an implausible issue
date is indistinguishable from a normal one. Minor, but it weakens the audit
story.

**Required action**

`PHM2` validates `iat`, `nbf`, `exp`, and sequence (`PANEL-CONTRACT.md` §3.2).

---

### F-12 — Raw MAC is displayed and stored (Low)

**Evidence**

- `ActivationPage.tsx` shows the MAC address and offers a copy button.
- `LicenseState.mac` is part of the IPC type and is returned by
  `getLicenseState()`.

**Impact**

Unnecessary disclosure of a device identifier to anyone at the machine, and a
value that is easy to spoof. `computeDeviceId` already correctly prefers
board/BIOS and treats MAC as a last resort; the UI undoes that care.

**Required action**

Display a device hash for support. Do not return the MAC to the renderer. Do not
log raw serials.

---

### F-13 — Cache write is not atomic (Low)

**Evidence**

`license.ts:176` writes directly to the final path. A crash or power loss
during the write can leave a truncated JSON file.

**Impact**

The app would report `missing` or `invalid` after a crash and require
re-activation. For a pharmacy, a till that refuses to open is an operational
problem.

**Required action**

Write to a temp file in the same directory, flush, then rename. Keep the
previous good copy for one generation.

---

### F-14 — No licensing tests (Low)

**Evidence**

`tests/electron.spec.ts` (502 lines) asserts the preload surface, including
`licenseApply` and `licenseStatus`, but there is no test for signature failure,
device mismatch, expiry, clock rollback, or seat limits.

**Impact**

Every rejection path is unproven. Regressions in the gate would be invisible.

**Required action**

Implement `TEST-PLAN.md` and make its abuse cases part of CI.

---

### F-15 — Scripts are not packaged, but are still in the repo (Info)

**Evidence**

`package.json` `build.files` is `["out/**/*", "package.json"]`; `scripts/` is
not included in the installer. `extraResources` includes only the bundled
MongoDB.

**Impact**

The shipped EXE does not contain the generator, which is good. The risk is at
the repository and build-machine level, not in the installer.

**Required action**

Remove the scripts from the repo, keep them out of CI artifacts, and enforce
with a secret/issuance scan. C0 does this, not B6.

---

### F-16 — `license:apply` is unauthenticated and can downgrade (Medium)

**Evidence**

- `src/main/index.ts:155-158` registers `IPC.LicenseApply` with no entry in
  `channelGuards` (`index.ts:38-84`). Only `assertTrusted(event)` runs, which
  checks the sender window, not a session.
- `applyLicenseCode` overwrites any existing `license.json`
  (`license.ts:172-178`) without comparing expiry.

**Impact**

Any renderer code, or a compromised renderer, can replace a valid licence with
one that expires sooner, forcing an unnecessary read-only state. It cannot mint
a licence without the key, but it can degrade one.

**Required action**

C0 interim guard (handler-level): reject when the current state is `valid`,
reject an `exp` earlier than the installed one, rate-limit to 5/hour, audit each
attempt. Remove the channel and the page in B3.

---

### F-17 — The import commit message contradicts the code (Low)

**Evidence**

The only commit is `3f70318 "Remove in-app subscription and license
management"`, yet `ActivationPage`, `license:apply`, and the PHM1 key remain.

**Impact**

Anyone reading history is misled about the baseline. There is no earlier
history to bisect.

**Required action**

Do not rewrite the commit. Record the actual state in `PROGRESS.md` and here;
treat this package as the authoritative description.

---

### F-18 — No CI and no unit runner (Medium)

**Evidence**

No `.github/workflows` directory at `3f70318`. `package.json` has Playwright
only; there is no Vitest/Jest unit runner. Yet the brief requires green CI on
every slice and the test plan assumes Vitest.

**Impact**

No slice can be verified on its exact commit, and the rejection paths have
nowhere to run.

**Required action**

C0 adds the first workflow (typecheck, build, secret/signing scan, Vitest smoke
test via `test:unit`) and the Vitest dependency. B1 adds the verifier matrix.

---

## 3. What is already good and must be preserved

- Ed25519 signatures, verified in the main process only.
- Device identity is a hash, not a raw serial, and deliberately prefers
  board/BIOS so a disk swap does not break a till.
- `contextIsolation`, `sandbox`, `nodeIntegration: false`, typed IPC, and a
  narrow preload.
- The renderer never touches Node or MongoDB.
- Business data is independent of the licence file; nothing deletes data today.
- The app already has audit infrastructure in `src/main/auth.ts` to reuse.

The redesign removes authority, not the security posture.

---

## 4. Verification commands used

```powershell
git log --oneline -3
git rev-parse HEAD
Select-String -Path src\main\license.ts -Pattern 'PUBLIC_KEY_PEM|devBypass|writeFile|Date.now'
Select-String -Path src\main\index.ts -Pattern 'hasValidLicense|LicenseApply|LicenseStatus'
Select-String -Path src\renderer\src\App.tsx -Pattern 'ActivationPage|status !== .valid.'
Select-String -Path src\shared\auth.ts -Pattern 'Permission|BUILTIN_ROLES'
Get-Content scripts\license-keygen.mjs, scripts\license-generator.mjs
Get-Content docs\SECURITY_REVIEW.md, DEVICE_LICENSING.md
Get-Content package.json
```

No application file was modified to produce this report.
