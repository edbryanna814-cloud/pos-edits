# Licensing Requirements

**Status:** accepted for build; `TD-RULINGS-001.md` is binding where this file
was ambiguous
**Applies to:** the pharmacy desktop app (this repo) **and** the separate licence panel
**Identifiers:** `FR-LIC-*` functional, `NFR-LIC-*` non-functional, `POL-*` owner policy

A requirement is met only when both the acceptance path and the rejection path
are tested. "Works when the licence is good" is half a requirement.

---

## 1. Actors

| Actor | Where | May do |
|---|---|---|
| **Owner / vendor** | Panel | Issue, renew, extend, suspend, revoke, set seats, approve replacement, set prices, see audit |
| **Panel operator** (optional delegate) | Panel | A subset granted by the owner, always audited |
| **Pharmacy administrator** | App | Use the product; see licence status read-only; request a device replacement |
| **Pharmacy user** (cashier, manager, etc.) | App | Use the product only |
| **Device** | App | Present its fingerprint, check in, verify a signed entitlement |
| **Builder** | Repo | Implement; never issue |

The pharmacy administrator and the pharmacy user have **no** licensing
authority. The distinction between them is irrelevant to licensing.

---

## 2. Functional requirements — panel

### FR-LIC-001 — Single source of truth
The panel is the only component that can create or change a licence.
**Accept:** an entitlement exists only after a panel record exists for the same
`lid`. **Reject:** no API path lets the app or the customer create, extend, or
alter a licence; attempts return `403`.

### FR-LIC-002 — Customer and licence records
The panel stores customer, licence, plan, price, currency, period, seat count,
and status.
**Accept:** every issued entitlement traces to one customer and one licence.
**Reject:** issuing without a customer is refused; a licence cannot belong to
two customers.

### FR-LIC-003 — Seats enforced server-side
The number of active devices per licence never exceeds `seats`.
**Accept:** a licence with 2 seats accepts the 2nd device and refuses the 3rd
with `SEAT_LIMIT_REACHED`; concurrent requests cannot both take the last seat.
**Reject:** the app cannot raise `seats`; there is no client-side override.

### FR-LIC-004 — Device enrolment (reverse enrolment)
The device displays its own 32-hex device code. The owner registers that code
in the panel, which decides whether the device becomes active. The app then
claims the entitlement by hash.
**Accept:** a device the owner has registered becomes `active` and receives an
entitlement on its next claim.
**Reject:** an unregistered device receives `ENROLMENT_REQUIRED` or
`DEVICE_PENDING`; a device never becomes active without a panel decision.
No token, code, or file is delivered to or entered on the device.

### FR-LIC-005 — Device replacement
A replacement is a request, not an automatic swap.
**Accept:** owner approves; old device becomes `retired`; new device becomes
`active`; seat count unchanged.
**Reject:** approval cannot leave the licence over its seat limit; rejection
leaves the old device active; the old device is never deactivated before approval.

### FR-LIC-006 — Renewal and extension
Renewal adds a period to the licence; an extension is a deliberate, audited
override with a reason.
**Accept:** a renewed licence produces a new entitlement with a later `exp`.
**Reject:** renewal cannot shorten an existing paid period without an explicit
adjustment record; an extension without a reason is refused.

### FR-LIC-007 — Suspension and revocation
The owner can suspend (temporary, reversible) or revoke (permanent, with
reason) a licence or a single device.
**Accept:** the next check-in rejects the entitlement with `LICENCE_REVOKED` /
`DEVICE_REVOKED`, and the app enters read-only mode after grace.
**Reject:** suspension never deletes data; revocation of one device does not
affect the other devices of the same licence.

### FR-LIC-008 — Seat reduction is explicit
If the owner reduces seats below the active device count, the panel demands a
resolution: choose devices to retire, or cancel the change.
**Accept:** the change is refused until resolved; the chosen devices are
retired with an audit record.
**Reject:** the panel never silently deactivates devices.

### FR-LIC-009 — Signed entitlement
Every entitlement is signed with the vendor's Ed25519 key and carries a key id.
**Accept:** the app verifies signature, key id, version, device hash, `nbf`,
`exp`, and revocation before granting access.
**Reject:** any failure is a distinct error code; there is no "ignore if
invalid" path.

### FR-LIC-010 — Revocation publication
The panel publishes a signed revocation list with a sequence number and
timestamp.
**Accept:** the app fetches it at check-in and rejects listed `lid`/device pairs.
**Reject:** a stale list cannot be used to resurrect a licence that the panel
has already marked revoked at check-in.

### FR-LIC-011 — Audit trail
Every owner action, enrolment, check-in, replacement, renewal, suspension,
revocation, and failed authorisation is recorded with actor, time, target, and
reason where applicable.
**Accept:** the audit is append-only and exportable.
**Reject:** no endpoint deletes an audit entry; an operator cannot edit history.

### FR-LIC-012 — Separation of duties
The person who issues licences cannot silently change prices, and no single
operator can both issue and erase the audit.
**Accept:** price changes and issuance are separate permissions; audit is
read-only to operators.
**Reject:** a combined "super operator" role is refused unless the owner holds
it personally.

---

## 3. Functional requirements — application

### FR-LIC-020 — No licence entry in the product
The app has no field, dialog, route, or IPC channel that accepts a licence
code, file, token, or entitlement entered by a user. Displaying the device's
own code outward is allowed; it is not an input.
**Accept:** grep and UI test find no licence input; the preload surface has no
`licenseApply`.
**Reject:** any hidden or debug entry point fails review, even behind
`LICENSE_ENFORCE`.

### FR-LIC-021 — Read-only status
The app may show: licensed/not licensed, plan name if provided, expiry,
last successful check-in, seat count, and the device code for support.
**Accept:** the status view has no action that changes entitlement.
**Reject:** no button labelled activate, renew, extend, upgrade, or manage.
The renderer must not receive or display price, currency, period, or the raw
MAC address.

### FR-LIC-022 — Check-in
The app checks in on launch, every `POL-CHECKIN`, and before a licensed action
when online.
**Accept:** success stores the new entitlement atomically and advances the
protected last-seen clock.
**Reject:** network failure falls back to the cached entitlement, never to an
error screen that blocks the till.

### FR-LIC-023 — Verifier is main-process only
The renderer receives a status object, never a key, token, or raw entitlement.
**Accept:** preload exposes only `licenseStatus()` and a status subscription.
(Code and API identifiers use the `license` spelling, matching the existing
code; prose uses "licence".)
**Reject:** renderer cannot read the entitlement file or node crypto.

### FR-LIC-024 — Protected cache
The cached entitlement and last-seen time are stored outside the renderer,
protected with OS facilities (DPAPI on Windows), and never treated as authority
for seats or revocation. The device hash is the existing 32-hex lowercase
value; the algorithm must not change.
**Accept:** editing or deleting the cache cannot extend access beyond the
signed `exp` or the grace window.
**Reject:** copying the file to another machine does not work without the
matching device hash.

### FR-LIC-025 — Clock-rollback resistance
Access is evaluated with `effectiveNow = max(now, lastSuccessfulCheckIn)`.
Read-only begins when
`effectiveNow > min(lastSuccessfulCheckIn + POL-GRACE, exp + POL-EXP-GRACE)`.
**Accept:** setting the clock back does not extend access; the app reports
`CLOCK_ROLLBACK` when `now` is more than 10 minutes behind the protected
last-seen time.
**Reject:** the app never writes the clock backwards. A successful check-in
advances the stored last-seen time and never reduces it.

### FR-LIC-026 — Grace and read-only mode
Read-only begins at the deadline in FR-LIC-025: existing data is visible,
reports and export/backup work, writes are refused with a clear message.
**Login is always allowed**, including in read-only mode. The licence gate
applies to writes, not to authentication or to reads.
**Accept:** a test user can log in, export a backup, and read history.
**Reject:** no path deletes, hides, or corrupts business data; no forced logout
loop; no licence check on the login handler itself.

### FR-LIC-027 — Offline behaviour
With no connectivity, a device with a valid cached entitlement keeps working
until the deadline in FR-LIC-025 is reached.
**Accept:** the status shows last check-in and remaining grace.
**Reject:** an expired grace period does not grant write access, even offline.

### FR-LIC-028 — Device change requests
The pharmacy can *request* a replacement (hardware change, new PC) from the
status view; the request contains only the device hash and a note.
**Accept:** the request creates a panel record; the device stays as it is.
**Reject:** the app cannot approve its own request or deactivate anything.

### FR-LIC-029 — Support diagnostics
The status view can export a support bundle: app version, device hash, licence
id, last error code, last check-in.
**Accept:** no password, no business data, no raw hardware serials.
**Reject:** the bundle never contains signing material or full identifiers.

### FR-LIC-030 — Bilingual, non-alarming UX
All licensing messages exist in Arabic and English, RTL-safe, and avoid
accusatory language.
**Accept:** AR/EN render correctly; the read-only message explains what to do.
**Reject:** no "fraud", "pirate", or "illegal" wording; no tax-compliance claim.

---

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-LIC-001 | Panel availability for check-in | 99.5% monthly; check-in is non-blocking for a working device |
| NFR-LIC-002 | Check-in latency | p95 < 800 ms; timeout 5 s, then cache |
| NFR-LIC-003 | Enrolment concurrency | 50 concurrent requests, no seat overrun |
| NFR-LIC-004 | Secrets | Private key only in the panel secret store/KMS; never in either repo or any installer |
| NFR-LIC-005 | Transport | HTTPS only, TLS 1.2+, certificate validation on |
| NFR-LIC-006 | Rate limiting | Per IP and per device on enrolment, check-in, and replacement |
| NFR-LIC-007 | Data minimisation | Store the existing 32-hex unsalted device hash, never raw serials; an optional peppered HMAC is for exports/logs only |
| NFR-LIC-008 | Audit immutability | Append-only, hash-chained, exportable |
| NFR-LIC-009 | Recoverability | Panel database backed up; restore tested before first sale |
| NFR-LIC-010 | Key rotation | Two live keys supported; rotate without forcing all devices offline |
| NFR-LIC-011 | Observability | Structured logs without secrets or raw identifiers |
| NFR-LIC-012 | Repo hygiene | CI blocks secrets, private keys, and issuance code in the app repo |
| NFR-LIC-013 | Accessibility | Status and read-only notices meet the app's existing keyboard/focus rules |

---

## 5. Explicit non-goals

- Multi-tenant SaaS licensing.
- Customer self-service portal that can change entitlement.
- Card data handling in the app. Payments, if any, are recorded by the owner
  in the panel; the app never sees payment credentials.
- Automatic feature upsell inside the app.
- A tax, VAT, or regulatory compliance claim.
- Rewriting POS, inventory, CRM, or reporting code.

---

## 6. Acceptance summary

The change is accepted when:

1. the app repo contains no issuance capability and no licence entry UI;
2. the app verifies `PHM2` entitlements and rejects every tampered variant;
3. the panel enforces seats, renewal, suspension, and revocation with audit;
4. a device with an expired or revoked licence can still read and export data;
5. clock rollback and cache copying do not extend access;
6. existing `PHM1` installations migrate as described in `MIGRATION.md`;
7. the tests in `TEST-PLAN.md` pass on the exact reported commit.

---

## 7. Owner policy defaults

These are decisions, not open questions. They live in one panel configuration
row so they can be changed without a code release.

| ID | Policy | Default | Why |
|---|---|---|---|
| POL-CHECKIN | Check-in interval | every 24 h, plus on launch | Detects revocation within a day without hammering the panel |
| POL-GRACE | Offline grace after last successful check-in | 14 days | Covers holidays, outages, and a pharmacy with no internet |
| POL-EXP-GRACE | Grace after signed `exp` | 7 days | Prevents a hard stop at midnight on the renewal date |
| POL-READONLY | Behaviour after grace | read-only; export and backup allowed | Protects the pharmacy's records and the vendor's position |
| POL-SEATS | Default seats per licence | 1 | Matches a single-till pharmacy; changed per customer |
| POL-REPLACE | Replacement approval | owner only, reason required | Prevents till-hopping |
| POL-CLOCK | Clock tolerance | 10 minutes backward | Allows NTP correction without false alarms |
| POL-KEY | Entitlement TTL | 30 days | Bounds the life of a cached entitlement |
| POL-REVOKE | Offline revocation effect | at next successful check-in | Documented residual risk, see threat model |

Changing any `POL-*` value requires an owner decision recorded in the panel
audit; it does not require an app release.
