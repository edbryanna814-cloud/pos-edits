# Architecture and Security — Licence Authority Separation

This document defines where trust sits, what each component may do, and what
happens when each control fails. It is the reference for the builder and for
review.

---

## 1. Current architecture (baseline `3f70318`)

```text
┌────────────────────────── customer machine ──────────────────────────┐
│                                                                      │
│  Renderer (React)                                                    │
│    ActivationPage  ──► window.api.licenseApply(code)                 │
│    App.tsx         ──► blocks every route until licence is valid     │
│                                                                      │
│  Preload            ──► license:status, license:apply                │
│                                                                      │
│  Main process                                                        │
│    license.ts: verify PHM1 with hard-coded public key                │
│                write license.json in userData                        │
│                expiry = Date.now() vs payload.exp                    │
│    index.ts:   only AuthLogin calls hasValidLicense()                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

Developer machine / repo
    scripts/license-keygen.mjs     ──► ~/.pharmacy-pos-license/private.pem
    scripts/license-generator.mjs  ──► PHM1 codes
```

There is no server. The customer machine holds the acceptance decision, the
repo holds the issuance method, and the private key sits on a workstation.
`docs/SECURITY_REVIEW.md` describes a backend that does not exist.

---

## 2. Target architecture

```text
┌──────────── owner-controlled ────────────┐        ┌──── customer machine ────┐
│                                          │        │                          │
│  Licence panel (separate private repo)    │        │  App (this repo)         │
│    - customers, licences, plans, prices   │        │   main process           │
│    - devices, seats, replacements         │◄──────►│    verifier              │
│    - suspension, revocation, audit        │ HTTPS  │    entitlement cache     │
│    - entitlement signer (Ed25519, KMS)    │        │    protected clock       │
│    - revocation publisher                 │        │   renderer               │
│                                          │        │    status view only      │
└──────────────────────────────────────────┘        └──────────────────────────┘
             │                                                  │
             │ signing key never leaves                         │ no signing
             ▼                                                  ▼
      secret store / KMS                                 public key set only
```

The app is a **relying party**. The panel is the **issuer**. There is no path
from the customer to issuance.

---

## 3. Trust boundaries

| Boundary | Inside | Outside | Rule |
|---|---|---|---|
| **TB0 — Owner** | Owner identity, 2FA device | Everything | Only the owner can issue, renew, revoke, or set price |
| **TB1 — Panel** | Panel app, database, signer | Network, app | Signs entitlements; enforces seats; writes audit |
| **TB2 — Transport** | TLS endpoint | Both ends | Certificate validation; no pinning required at v2 |
| **TB3 — App main** | Verifier, cache, clock | Renderer, OS user | Verifies before licensed actions; holds no secrets beyond public keys |
| **TB4 — Renderer** | UI | Main, panel | Never sees keys, raw entitlement, or panel credentials |
| **TB5 — Device** | OS, disk, hardware | Customer user | Untrusted: user can edit files, patch the app, change the clock |
| **TB6 — Repository** | Git history, CI | Cooperators | No signing material, no issuance code, no customer data |

The important consequence: **TB5 is assumed hostile**. The app cannot protect
the vendor from a determined customer patching the binary. It protects the
vendor from ordinary misuse — copying a licence, editing a file, rolling back a
clock, sharing a code, exceeding seats — and it makes large-scale abuse
detectable in the panel audit. That is the honest security claim.

---

## 4. Component responsibilities

### 4.1 Panel

- Identity and access: owner account with 2FA; optional operator with scoped
  permissions; no public sign-up.
- Licence lifecycle: draft → active → suspended → revoked/expired.
- Device lifecycle: pending → active → retired/revoked.
- Seat accounting inside a database transaction with a unique active-device
  constraint per licence.
- Entitlement issuance: builds the payload, signs with the active key, records
  the `lid` and sequence.
- Revocation: publishes a signed list with `seq` and `issuedAt`.
- Audit: append-only, hash-chained, exportable.
- Backup and restore: daily, encrypted, restore tested before first sale.

### 4.2 Application (this repo)

- Device identity: stable hash over board/BIOS, disk fallback, MAC last resort
  (keep the existing approach in `src/main/license.ts` but stop displaying raw
  MAC).
- Enrolment request: hash + app version + optional note; no user-editable
  licence material.
- Check-in client: HTTPS, bounded timeout, retry with jitter, never blocks the
  UI thread.
- Verifier: signature, key id, version, device hash, `nbf`, `exp`, revocation
  list sequence.
- Cache: last valid entitlement plus last-seen time, OS-protected.
- Gate: a small, single function used by every licensed write path; not only
  login.
- Degradation: read-only after grace; export/backup always available.
- Status view: read-only facts and a "request replacement" action.

### 4.3 What is removed

- `src/renderer/src/license/ActivationPage.tsx` (as a code-entry page).
- `IPC.LicenseApply` and `window.api.licenseApply`.
- `scripts/license-keygen.mjs`, `scripts/license-generator.mjs`.
- The `PHM1` acceptance path, only if `D-LIC-17` is reversed and after the
  migration window.
- The claim in `docs/SECURITY_REVIEW.md` that a backend exists, until it does.

---

## 5. Entitlement flow

```text
1. App starts and computes the 32-hex device hash.
2. Main reads the protected cache: entitlement E, lastSuccessfulCheckIn T.
3. If there is no E, or the panel has no device row, the app shows its device
   code and claims:
      POST /v1/enrol { deviceHash, appVersion, os }
      → 201 { entitlement }            (owner already registered the code)
      → 404 { code: ENROLMENT_REQUIRED } or 202 { code: DEVICE_PENDING }
   The owner registers the device code in the panel. Nothing is typed into the
   app.
4. effectiveNow = max(now, T).
   deadline     = min(T + POL-GRACE, E.exp + POL-EXP-GRACE).
   A write needs both E and T. With no T, the device must claim or check in
   successfully before any write.
5. If online and POL-CHECKIN elapsed:
      POST /v1/check-in { deviceHash, lid, appVersion, nonce }
      → 200 { entitlement: PHM2..., revocations: {seq, list} }
      → 403 { code: LICENCE_REVOKED | DEVICE_REVOKED | LICENCE_SUSPENDED | LICENCE_EXPIRED }
6. Verify PHM2: signature, kid, v, dev == deviceHash, nbf <= effectiveNow <= exp, not revoked.
7. On success: store E and T = max(T, now) atomically; unlock.
8. On network failure: use E and T; read-only when effectiveNow > deadline.
9. On hard rejection: read-only; keep data; export and backup remain.
```

There is no step where a human types a licence. The first enrolment is
outbound-only: the device shows a code, the owner records it.

---

## 6. Threat model

Severity is impact × likelihood for a single-pharmacy sale, not for a bank.

| ID | Threat | Vector | Control | Residual | Test |
|---|---|---|---|---|---|
| T01 | Customer mints a licence | Repo has generator + key | Remove issuance code; rotate key; panel-only signing | None expected | Repo scan; forge attempt rejected |
| T02 | Leaked private key | Key on a workstation or in git | KMS/secret store; rotation; CI secret scan | Blast radius until rotation | Rotation drill |
| T03 | Copy licence to another PC | Copy `license.json` | Device hash binding; cache protected; check-in | Same model machine could match | Cache-copy test |
| T04 | Extend by clock rollback | Change Windows clock | `max(now, lastCheckIn)` + deadline formula; `CLOCK_ROLLBACK` | Determined user can reinstall, but loses data | Clock test |
| T05 | Exceed seats | Two PCs, one licence | Panel transaction + unique active device | Offline second PC until check-in | Concurrent enrolment test |
| T06 | Keep using after revocation | Offline | Grace window; check-in on launch | Up to POL-GRACE | Grace test |
| T07 | Re-register a device the owner did not approve | Device code copied to another PC | Code is a hardware hash, not a secret; owner approves each code; rate limit | Same-hardware clone only | Claim test |
| T08 | Operator fraud | Insider changes price/status | Separate permissions, 2FA, audit chain | Collusion with owner | Permission test |
| T09 | Forged entitlement | Edit payload, swap key id | Ed25519 verify; fixed key set; version check | None without key | Tamper matrix |
| T10 | Downgrade attack | Old app ignores revocation | Min app version in entitlement; panel can refuse old versions | Old installs until forced update | Version gate test |
| T11 | Patch the app | Replace asar / main | Out of scope for prevention; detect via check-in telemetry | Customer can run a patched app locally | Documented |
| T12 | Data loss on licence failure | Bug in gate | Read-only only; no delete path; export always | None | E2E expiry test |
| T13 | Repo/CI leak | Cooperator access | Separate panel repo; least privilege; no secrets in app repo | Source of verifier is public to cooperators, which is fine | Access review |
| T14 | Panel outage | Hosting failure | Grace period; status page; restore runbook | No new enrolment during outage | Chaos test |
| T15 | Lost/stolen PC | Physical | Owner revokes device; data at rest is the app's existing DB protection | Data exposure before revocation | Revocation flow |
| T16 | Tax/legal claim | Marketing or UI | String scan; no compliance wording | None | Review |

### Why "patch the app" is accepted

Electron code runs on the customer's machine. Any local check can be bypassed
by a user with administrator rights. The design goal is not to make piracy
impossible; it is to make it **unnecessary for honest customers, inconvenient
for dishonest ones, and visible in the audit**. Spending more on anti-tamper
would raise support cost and break legitimate repairs.

---

## 7. Failure and degradation matrix

| Condition | App behaviour | Business data | User message |
|---|---|---|---|
| No network, within grace | Full function | Untouched | Small "offline, last check-in …" status |
| No network, past grace | Read-only | Read/export/backup | Explains how to reconnect or contact vendor |
| Entitlement expired, within `POL-EXP-GRACE` and check-in grace | Full function | Untouched | Renewal reminder |
| Expired past grace | Read-only | Read/export/backup | Renewal instructions |
| Revoked at check-in | Read-only | Read/export/backup | Contact vendor |
| Seat limit reached on new device | No access on that device | Existing devices untouched | Panel-side resolution |
| Signature invalid | Read-only | Read/export/backup | Support bundle offered |
| Clock rollback detected | Read-only until corrected | Read/export/backup | Set the correct date/time |
| Panel 5xx / timeout | Cached entitlement | Untouched | Silent, status shows last check-in |
| Local cache deleted | Enrolment required | Data intact on disk | Re-enrol from the same device |

---

## 8. Threat-model invariants

These must hold in every implementation:

1. The app never possesses a private key or a panel credential.
2. The renderer never receives the entitlement, the raw fingerprint, or key
   material. It may receive the device code (the same 32-hex hash) for display
   and support only.
3. The gate is central: one function decides "licensed write allowed", and every
   write path uses it. No handler may bypass it.
4. Seat and revocation truth are server-side; the client may only cache.
5. Grace never grants new writes after it ends, online or offline.
6. Data is never deleted, encrypted, or hidden because of licence state.
7. Every rejection has a stable error code and a support path.
8. The panel audit cannot be edited by the actor it records.
