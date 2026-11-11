# Licence Panel Contract

**Status:** contract v1, accepted for build (`TD-RULINGS-001.md`). The panel is a
**separate private repository** owned by the vendor. Nothing in this document
describes code that belongs in the pharmacy app repo.

The app and the panel interact through exactly the surfaces below. Anything not
listed is internal to the panel.

---

## 1. Deployment and tenancy

| Item | Decision |
|---|---|
| Repo | `pharmacy-pos-licensing-panel` (private, owner account) — not this repo |
| Deployment | Single-tenant owner service; one environment is enough for v2, staging recommended |
| Access | Owner account + optional scoped operator; 2FA mandatory; no public registration |
| Data store | PostgreSQL (transactions and unique constraints are required for seats) |
| Public surface | `/v1/*` only, HTTPS |
| Admin surface | Separate host or path, owner auth |
| Backups | Daily encrypted; restore tested before first sale |
| Logs | Structured, no secrets, no raw hardware identifiers |

The panel is not multi-tenant SaaS. One deployment serves this vendor's
customers.

---

## 2. Data model

### 2.1 `customers`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | text | Pharmacy legal/trading name |
| `contact_name`, `contact_phone`, `contact_email` | text | Support contact |
| `status` | enum | `active`, `suspended`, `closed` |
| `created_at`, `updated_at` | timestamptz | |

### 2.2 `plans`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `code` | text | e.g. `PHARMACY-STD` |
| `name` | text | |
| `price`, `currency` | numeric, char(3) | Display and invoicing only |
| `period` | enum | `day`, `month`, `year` |
| `features` | jsonb | Feature flags; the app renders only what it is told |
| `active` | bool | |

### 2.3 `licences`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (`lid`) | Appears in the entitlement |
| `customer_id` | uuid | FK |
| `plan_id` | uuid | FK |
| `seats` | int | Enforced; > 0 |
| `status` | enum | `draft`, `active`, `suspended`, `revoked`, `expired` |
| `starts_at`, `expires_at` | timestamptz | |
| `grace_days` | int | Default from policy |
| `notes` | text | |
| `created_at`, `updated_at` | timestamptz | |

Constraint: `seats >= 1`.

### 2.4 `devices`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `licence_id` | uuid | FK |
| `device_hash` | char(32) | The app's existing 32-hex lowercase hash; never the raw serial. Do not re-hash or salt for lookup. |
| `label` | text | e.g. "Front till" |
| `status` | enum | `pending`, `active`, `retired`, `revoked` |
| `first_seen_at`, `activated_at`, `retired_at` | timestamptz | |
| `last_check_in_at` | timestamptz | |
| `last_app_version` | text | |
| `replacement_of_device_id` | uuid null | Audit link |
| `device_hash_hmac` | char(64) null | Optional: peppered HMAC for exports/logs, never used for lookup |

Partial unique index:

```sql
CREATE UNIQUE INDEX one_active_hash_per_licence
  ON devices (licence_id, device_hash)
  WHERE status = 'active';
```

Seat guard (inside the enrolment transaction):

```sql
SELECT count(*) FROM devices
 WHERE licence_id = $1 AND status = 'active'
 FOR UPDATE;  -- then refuse if count >= licence.seats
```

### 2.5 No enrolment token on the device

The device never receives a token, code, or file. Enrolment is **reverse**:

1. the app displays its 32-hex device code;
2. the owner enters that code in the panel and assigns it to a licence
   (`devices.status = 'pending'` then `active`, after the seat check);
3. the app claims with `POST /v1/enrol` and the panel returns an entitlement.

For bulk pre-provisioning, the panel may hold an internal invitation record, but
it is consumed by the owner in the panel UI and never delivered to the machine.
There is therefore no `enrolment_tokens` table in the app-facing design.

### 2.6 `entitlements`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `licence_id`, `device_id` | uuid | |
| `lid`, `dev` | text | Denormalised for audit |
| `issued_at`, `not_before`, `expires_at` | timestamptz | |
| `key_id` | text | Which signing key |
| `sequence` | bigint | Monotonic per licence |
| `payload_sha256` | char(64) | Tamper-evident record |
| `revoked_at` | timestamptz null | |

### 2.7 `revocations`

| Column | Type | Notes |
|---|---|---|
| `seq` | bigint | Monotonic list sequence |
| `target_type` | enum | `licence`, `device` |
| `target_id` | uuid | |
| `reason` | text | Required |
| `effective_at` | timestamptz | |
| `published_at` | timestamptz | |
| `signature` | text | Signature over the list |

### 2.8 `audit_events`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | |
| `at` | timestamptz | |
| `actor_id`, `actor_role` | uuid, text | |
| `action` | text | `licence.issue`, `licence.renew`, `device.retire`, … |
| `target_type`, `target_id` | text, uuid | |
| `reason` | text | Required for destructive actions |
| `before`, `after` | jsonb | Redacted of secrets |
| `prev_hash`, `hash` | char(64) | Hash chain |

No `DELETE` grant on this table for the application role.

---

## 3. Entitlement format (`PHM2`)

```text
PHM2.<base64url(header)>.<base64url(payload)>.<base64url(signature)>
```

### 3.1 Header

```json
{ "alg": "Ed25519", "kid": "phm-2027-01", "typ": "PHM-ENT" }
```

### 3.2 Payload

```json
{
  "v": 2,
  "lid": "8c5f0a0e-2f7e-4c3a-9b1a-1f6d2c7a9e10",
  "cid": "d2b7c1a4-0a55-4a41-9f0e-7c1e2b3d4f56",
  "dev": "3f9a1c2b4d5e6f708192a3b4c5d6e7f8",
  "seats": 2,
  "plan": "PHARMACY-STD",
  "feat": ["pos", "inventory", "reports"],
  "iat": 1762732800,
  "nbf": 1762732800,
  "exp": 1765324800,
  "grace": 7,
  "minApp": "1.0.0",
  "seq": 41
}
```

| Field | Meaning | Enforced by app |
|---|---|---|
| `v` | entitlement version | yes, must be `2` |
| `lid` | licence id | displayed, used for revocation |
| `cid` | customer id | displayed only |
| `dev` | device hash, 32 hex | yes, must equal local hash |
| `seats` | purchased seats | displayed only; panel enforces |
| `plan` | plan code | displayed |
| `feat` | enabled features | yes, for gated modules |
| `iat` / `nbf` | issue / not-before | yes |
| `exp` | expiry | yes |
| `grace` | post-expiry days | yes |
| `minApp` | minimum app version | yes, refuse below |
| `seq` | licence sequence | yes, reject lower than cached |

Signature = Ed25519 over the ASCII bytes
`base64url(header) + "." + base64url(payload)`.

### 3.3 Key set in the app

```json
[
  { "kid": "phm-2027-01", "publicKey": "<base64 raw 32-byte>", "notBefore": "2027-01-01T00:00:00Z", "retiredAt": null }
]
```

Rules:

- the app ships **public keys only**;
- at most two active keys, to allow rotation;
- an unknown `kid` is a hard reject with `KEY_UNKNOWN`;
- a retired key rejects new entitlements but may verify during a stated overlap
  window;
- rotation procedure in §9.

---

## 4. API

All responses are JSON. All errors use `{ "code": "...", "message": "..." }`
with a stable code from §8. Authentication for app endpoints is the device hash
plus the entitlement; there are no user accounts in the app-facing API.

### 4.1 `POST /v1/enrol` (claim by device hash)

The owner registers the device code in the panel first. The app then claims.

Request:

```json
{
  "deviceHash": "32 hex chars",
  "appVersion": "1.0.0",
  "os": "Windows 11 23H2",
  "label": "Front till"
}
```

Response `201`:

```json
{
  "deviceId": "uuid",
  "licenceId": "uuid",
  "entitlement": "PHM2...",
  "checkInIntervalHours": 24
}
```

Rejections: `ENROLMENT_REQUIRED` (hash unknown to the panel),
`DEVICE_PENDING` (the code is registered, but its licence is not active yet or
no seat is free), `SEAT_LIMIT_REACHED`, `LICENCE_SUSPENDED`,
`LICENCE_REVOKED`, `DEVICE_ALREADY_ACTIVE` (returns the existing entitlement
instead), `VERSION_TOO_OLD`.

Notes:

- idempotent for the same `deviceHash`;
- the panel never sends a token to the device;
- a successful claim of the same hash on the same licence returns the existing
  device, not a new seat;
- the owner may pre-register a device as `pending`, then activate it; the app
  can poll or be retried by the installer.

### 4.2 `POST /v1/check-in`

Request:

```json
{ "deviceHash": "…", "licenceId": "uuid", "appVersion": "1.0.0", "nonce": "random" }
```

Response `200`:

```json
{
  "entitlement": "PHM2...",
  "revocations": { "seq": 128, "issuedAt": "2026-11-10T09:00:00Z", "list": ["licence:uuid", "device:uuid"] },
  "checkInIntervalHours": 24,
  "serverTime": "2026-11-10T09:00:00Z"
}
```

Rejections: `DEVICE_UNKNOWN`, `DEVICE_RETIRED`, `DEVICE_REVOKED`,
`LICENCE_REVOKED`, `LICENCE_SUSPENDED`, `LICENCE_EXPIRED`,
`SEAT_LIMIT_REACHED` (should not occur for an active device),
`VERSION_TOO_OLD`.

`serverTime` is informational only; the app never trusts it over the signed
times.

### 4.3 `POST /v1/replacement-request`

Request:

```json
{ "deviceHash": "…", "licenceId": "uuid", "reason": "PC replaced", "contact": "+20…" }
```

Response `202`:

```json
{ "requestId": "uuid", "status": "pending" }
```

This creates a panel record. It **does not** change device state.

### 4.4 `GET /v1/revocations?since=<seq>`

Returns the signed revocation list, or `304` if unchanged. Signature covers
`seq`, `issuedAt`, and the sorted list.

### 4.5 `GET /v1/health`

`{ "status": "ok", "time": "..." }`. No version or customer data leaked.

### 4.6 Admin endpoints (panel UI only)

Not part of the app contract. The panel must provide, at minimum:

- create customer;
- create/activate licence with seats and plan;
- register a device code (owner enters the code shown by the app);
- renew, extend (reason), suspend, resume, revoke (reason);
- set seats, with the explicit reduction resolution;
- approve/reject replacement;
- view devices and last check-in;
- view and export audit;
- rotate signing key.

Every admin action is authenticated, authorised, reason-checked where
destructive, and audited.

---

## 5. Device lifecycle

```text
pending ──owner registers code──► active ──replacement approved──► retired
   │                                │
   │                                ├──owner revoke──► revoked
   │                                └──licence revoke──► revoked
   └──owner never approves──► (left pending or deleted)
```

Rules:

- the owner creates the device row (`pending`) from the code shown by the app;
- a `pending` device that claims becomes `active` only if a seat is free;
- a `retired` device cannot check in; it can request a replacement;
- a `revoked` device cannot check in and cannot be reactivated by an app action;
- re-claiming the same hash on the same licence reactivates the same row if
  it is `pending`; if it is `retired`, a replacement is required;
- the licence's active count is always the count of `status='active'`.

---

## 6. Seat enforcement algorithm

```text
-- Owner step: register the code (status = 'pending'), no seat consumed yet.

-- Claim step (POST /v1/enrol), per device:
BEGIN;
SELECT seats FROM licences WHERE id = $licence FOR UPDATE;
IF device_hash already active for this licence THEN return existing (idempotent);
IF device_hash not present as pending for this licence THEN ROLLBACK; return ENROLMENT_REQUIRED;
SELECT count(*) FROM devices WHERE licence_id = $licence AND status = 'active';
IF count >= seats THEN ROLLBACK; return SEAT_LIMIT_REACHED;
UPDATE devices SET status='active', activated_at=now() WHERE device_hash=$hash;
INSERT entitlement (sequence = next);
COMMIT;  -- sign after commit; the record is the authority
```

If signing fails after commit, the device is active without an entitlement; the
next check-in issues one. The panel must never report success with an unsigned
entitlement.

Seat reduction:

```text
IF new_seats < active_count THEN
  require a list of device ids to retire, or refuse;
  retire them in the same transaction;
  audit each retirement with reason "seat reduction";
END IF;
```

---

## 7. Renewal, suspension, revocation

| Action | Effect on entitlement | Effect on app |
|---|---|---|
| Renew | new `exp`, new sequence | continues |
| Extend (override) | new `exp`, reason recorded | continues |
| Suspend | check-in returns `LICENCE_SUSPENDED` | continues until grace, then read-only |
| Resume | check-in returns a new entitlement | continues |
| Revoke licence | check-in returns `LICENCE_REVOKED`; list includes it | read-only after grace |
| Revoke device | check-in returns `DEVICE_REVOKED` | that device read-only after grace |
| Seat reduction | chosen devices retired | those devices read-only after grace |

Suspension is temporary and reversible. Revocation is permanent for that `lid`;
reactivation means issuing a new licence.

---

## 8. Error codes

| Code | Source | HTTP | App behaviour |
|---|---|---|---|
| `MALFORMED` | app verifier | — | Read-only; support bundle |
| `SIGNATURE_INVALID` | app verifier | 400 | Hard reject; support bundle |
| `KEY_UNKNOWN` | app verifier | 400 | Hard reject; support bundle |
| `DEVICE_MISMATCH` | app verifier | — | Read-only; support bundle |
| `EXPIRED` | app verifier | — | Read-only after `exp + POL-EXP-GRACE` |
| `NOT_YET_VALID` | app verifier | — | Read-only; check the clock |
| `VERSION_UNSUPPORTED` | app verifier | — | Read-only; support bundle |
| `VERSION_TOO_OLD` | either | 426 | Read-only + update prompt |
| `CLOCK_ROLLBACK` | app | — | Read-only until corrected |
| `CLOCK_UNAVAILABLE` | app | — | Read-only; support bundle |
| `ENROLMENT_REQUIRED` | panel | 404 | Show device code; owner registers |
| `DEVICE_PENDING` | panel | 202 | "Waiting for registration"; retry |
| `DEVICE_UNKNOWN` | panel | 404 | Re-claim |
| `DEVICE_RETIRED` | panel | 403 | Replacement request |
| `DEVICE_REVOKED` | panel | 403 | Read-only after grace |
| `DEVICE_ALREADY_ACTIVE` | panel | 200 | Return existing entitlement |
| `LICENCE_SUSPENDED` | panel | 403 | Continue to grace, then read-only |
| `LICENCE_REVOKED` | panel | 403 | Read-only after grace |
| `LICENCE_EXPIRED` | panel | 403 | Grace, then read-only |
| `SEAT_LIMIT_REACHED` | panel | 409 | Resolve in panel |
| `RATE_LIMITED` | panel | 429 | Back off with jitter |
| `PANEL_UNAVAILABLE` | app | — | Use cache; show last check-in |

Codes are stable and documented for support. The app maps them to bilingual
messages; it never shows raw JSON. No other code may appear in code or tests.

---

## 9. Key management

### 9.1 Generation

1. Generate Ed25519 on an offline or owner-only machine.
2. Store the private key in the panel's secret store or KMS. Never in git,
   never in an installer, never in a backup that leaves the owner's control.
3. Put only the public key in the app's key set, reviewed in a normal PR.
4. Record the key id, creation date, owner, and storage location in the panel
   audit.

### 9.2 Rotation

1. Add the new public key to the app key set with `notBefore` in the future.
2. Release the app; wait until the fleet has it (or accept that old installs
   keep the old key until update).
3. Switch the panel signer to the new `kid`.
4. Set `retiredAt` on the old key after the overlap window.
5. Destroy the old private key once no live entitlement is signed with it. Under
   `D-LIC-17` that is immediately after the switch; if any `PHM1` sale exists,
   keep it offline until the last legacy entitlement expires, then destroy it.

### 9.3 Compromise

If a private key is suspected exposed:

1. treat all licences signed with it as suspect;
2. add a new key and ship it;
3. issue new entitlements on next check-in;
4. revoke the old key id in the app key set in the next release;
5. record the incident and notify affected customers only if their data or
   payment is involved — the licence itself is not customer data.

**Current obligation:** the existing `PHM1` key must be treated as exposed,
because key generation and signing were performed from a developer workstation
(`~/.pharmacy-pos-license/private.pem`) and the tooling is in the app repo. See
`MIGRATION.md` §2.

---

## 10. Audit and retention

- Append-only, hash-chained.
- Retain for the life of the licence plus 6 years (accounting evidence).
- Exportable as CSV/JSON by the owner.
- Contains no secrets, no raw serials, no passwords.
- Check-ins may be aggregated daily to keep volume bounded; the last check-in
  per device is always current.

---

## 11. Rate limits

| Endpoint | Limit |
|---|---|
| `/v1/enrol` | 5 per hour per IP, 10 per day per licence |
| `/v1/check-in` | 60 per hour per device |
| `/v1/replacement-request` | 3 per day per device |
| `/v1/revocations` | 60 per hour per device |
| admin auth | 5 failures per 15 min, then lock |

Limits are enforced server-side; the app backs off on `429`.
