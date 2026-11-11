# ADR-001 — Licence authority lives outside the product

- **Status:** Accepted by owner authority via `TD-RULINGS-001.md` (2026-11-10)
- **Date:** 2026-11-10
- **Baseline:** `3f70318`
- **Supersedes:** the in-app licensing model described in `DEVICE_LICENSING.md` §7–§10
- **Related:** `FINDINGS.md`, `REQUIREMENTS.md`, `PANEL-CONTRACT.md`

---

## 1. Context

The application is sold to a pharmacy as a desktop product with a monthly or
period-based software subscription. Money changes hands between the vendor and
the pharmacy. That makes licensing a **treasury control**, not a UI feature.

At baseline the customer application contains:

- a pre-login activation screen that accepts a licence code;
- a local `license.json` treated as the installed licence;
- a hard-coded Ed25519 public key in `src/main/license.ts`;
- the key-generation and licence-generation scripts in `scripts/`;
- a device ID derived from hardware, displayed on the activation screen.

`docs/SECURITY_REVIEW.md` claims that "the private signing key is only on a
trusted backend" and that "device limits are enforced server-side". **No backend
exists.** The documentation describes an architecture the product does not have.
That mismatch is itself a finding (`FINDINGS.md` F-02).

The consequences:

- issuance depends on a private key stored on a developer machine
  (`~/.pharmacy-pos-license/private.pem`), not in a controlled service;
- anyone with repo access can see how licences are made and, if the key is on
  the same machine, make them;
- the customer can paste any code they receive, and the app — which the
  customer controls — is the only thing that accepts it;
- device counts are a decorative field in the payload (`cnt`) with no
  enforcement anywhere;
- a copied `license.json` on matching hardware restores access;
- expiry trusts the system clock, so rolling the clock back extends access;
- only `AuthLogin` checks the licence (`src/main/index.ts:182`); every other IPC
  handler operates without it.

## 2. Decision

**Move every act of licensing authority to a separate, owner-controlled panel.
The product becomes a verifier and a reporter, never an issuer.**

Concretely:

1. **The panel** (separate private repo, owner-operated) owns customers,
   licences, seats, devices, expiry, suspension, revocation, replacement
   approval, pricing, and the audit trail. It is the only component that can
   produce a valid entitlement.
2. **The app** ships only a public key set and a verifier. It never signs,
   never accepts a typed code, never offers a licence management screen, and
   never lets a role change licence state.
3. **The interface between them is a signed entitlement** (`PHM2`), bound to a
   device hash and a licence id, with an explicit issue time, not-before,
   expiry, seat count, feature set, and key id.
4. **The panel enforces seat limits** by counting active devices inside a
   transaction. The app displays the result; it cannot raise it.
5. **Revocation is published by the panel** and applied at check-in. The app
   caches the last valid entitlement and degrades to read-only after the
   approved grace period; it never deletes business data.
6. **Issuance tooling is removed from this repository.** The `scripts/`
   keygen and generator, the dev private key path, and the `PHM1` acceptance
   path are retired. The activation form and `license:apply` are removed in B3;
   no `PHM1` compatibility is built under `D-LIC-17`.

## 3. Why not the alternatives

### A. Keep activation in the app, add a permission

Rejected. A permission only decides *which logged-in user* can press the
button. It does not remove the button, the local acceptance, the clock trust,
or the key material in the repo. The pharmacy owner is an Administrator by
design; hiding the panel from Cashier does not protect the treasury.

### B. Keep issuance in this repo, protect it with a role

Rejected. The repo is accessible to cooperators, and the app is shipped to the
customer. A role is an application concept the customer can bypass by editing
the database, the packaged `asar`, or the main process. Authority must not
reside on a machine the customer controls.

### C. Online-only licensing

Rejected as the sole model. Pharmacies lose connectivity; blocking a till
because the internet is down is a business failure, and the owner already has
an offline requirement. The decision is online-first with signed, cached
entitlements and a bounded grace period (`REQUIREMENTS.md` §7).

### D. Hardware dongle

Rejected for v2. It adds shipping, loss, and driver problems, and it does not
solve issuance authority. A signed entitlement plus a hardware fingerprint
achieves the same binding without physical logistics.

## 4. Consequences

**Positive**

- Forging a licence requires the panel's private key, not repo access.
- Seat, renewal, and revocation decisions are made once, centrally, with audit.
- The customer cannot extend their own subscription by editing a file or
  rolling back the clock.
- The product can be audited: every entitlement is traceable to a panel record.
- The same model can serve Factory ERP later, with a different product code.

**Negative / accepted**

- The vendor must operate a panel: hosting, backup, access control, and an
  on-call path when a pharmacy cannot check in.
- Offline devices can outlive a revocation by up to the grace period.
- A compromised panel key compromises every licence; hence key rotation,
  separation of duties, and the incident procedure in `PANEL-CONTRACT.md` §9.
- Existing installations need a migration path only if `D-LIC-17` is reversed;
  under the default ruling there are no `PHM1` sales to migrate.

## 5. Enforcement rules (non-negotiable for the builder)

| # | Rule | How it is checked |
|---|---|---|
| E1 | This repo contains no key-generation, signing, or issuance code | `npm run scan:signing` in CI, over every tracked file, fails on: a private-key PEM block with a base64 body; in code files, `generateKeyPair(Sync)`, `createPrivateKey`, `createSign`, `privateEncrypt`, `crypto.sign(` / `subtle.sign(`, or `sign` imported or required from `crypto`; any `scripts/license-*.mjs`. Tested by `tests/unit/scanSigning.test.ts`. Not covered: the built bundle (`out/`, asar) is not scanned. |
| E2 | The app has no licence input control | UI test asserts no input with licence semantics exists on any route, pre- or post-login |
| E3 | No role or permission mentions licences | `Permission` union and `BUILTIN_ROLES` contain no licence entry; test asserts it |
| E4 | Only the main process talks to the panel; renderer gets status only | Preload surface review + IPC test |
| E5 | Entitlement signature, device binding, `nbf`/`exp`, and revocation are verified before any licensed action | Unit tests for each rejection path |
| E6 | Seat limits are enforced in the panel, under a transaction/unique constraint | Panel integration test with concurrent enrolments |
| E7 | Expiry does not trust the wall clock alone | Clock-rollback test with protected last-seen store |
| E8 | Licence failure never deletes or hides business data; read-only + export remain | E2E test |
| E9 | The panel is a separate private repo; this repo never gains a `panel/` folder | Repository review at each slice |
| E10 | No tax-compliance claim in licensing UI or docs | String scan + manual review |

## 6. Owner acceptance

Accepting this ADR means accepting:

- the panel as the single source of licence truth;
- removal of the activation form and the in-repo issuance scripts;
- a mandatory key rotation, because the current key must be treated as
  exposed (it was generated and used from a developer machine);
- the offline grace policy in `REQUIREMENTS.md` §7.

The owner accepted this ADR on 2026-11-10 by issuing `TD-RULINGS-001.md`
(`D-LIC-01`, `D-LIC-17`). No external signature is required; the decision record
is the authority. The line below is retained for the file record.

Signature: ____________________  Owner  Date: ____________
