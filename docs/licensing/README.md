# Licence Authority Separation — Documentation Package

**Repository:** `edbryanna814-cloud/Pharmacy-POS-and-management-` (private)
**Reviewed baseline:** `3f70318` (2026-11-10), single squashed commit
**Status:** documentation pass complete; C0 approved. No application code has
been changed. The
builder's first reply is answered in [`TD-RULINGS-001.md`](./TD-RULINGS-001.md);
C0 containment is approved.
**Audience:** the builder implementing the change, and the owner who grants licences.

---

## 1. Decision in one paragraph

The customer application (`this` repo) must stop being a licensing authority.
It may **verify** a licence that someone else issued, and it may **display** its own
status. It must not issue, extend, alter, revoke, price, or accept a licence on its
own. Issuance, device limits, renewals, suspension, revocation, replacement
approval, and pricing move to a separate owner-controlled panel, deployed from a
different private repository, reachable only by the owner. The customer app
receives a **signed entitlement** and treats it as read-only evidence.

This is the same separation already agreed for Factory ERP: the vendor signs,
the product verifies, the customer never administers.

---

## 2. Correction to the original brief

The request said: *"the licence panel exists in the role given to the user"*.

At the reviewed baseline this is not literally true, and the documentation must
record what the code actually does:

- There is **no licence permission** in `src/shared/auth.ts`; no role can
  grant or manage a licence.
- The activation screen is **pre-login** (`src/renderer/src/App.tsx:448-453`), so
  it is available to **anyone standing at the machine**, before authentication.
- The real problem is worse than a role-gated panel: the **entire licensing
  authority** lives in the customer app and in this repo — the activation form,
  the local `license.json`, the hard-coded public key, and the key-generation and
  licence-generation scripts (`scripts/license-keygen.mjs`,
  `scripts/license-generator.mjs`).

So the redesign is not "move a panel to another page". It is "remove the
authority from the product and from this repository". The full evidence is in
[`FINDINGS.md`](./FINDINGS.md).

---

## 3. Document map

| Document | Contents | Read by |
|---|---|---|
| [`TD-RULINGS-001.md`](./TD-RULINGS-001.md) | Binding rulings on the builder's first reply, 16 contradictions, and the C0 scope | Owner, builder |
| [`FINDINGS.md`](./FINDINGS.md) | Audit of the current licensing code, with file/line evidence and severity | Owner, builder |
| [`ADR-001-licence-authority.md`](./ADR-001-licence-authority.md) | The architecture decision, rejected alternatives, enforcement rules | Owner, builder |
| [`REQUIREMENTS.md`](./REQUIREMENTS.md) | Functional and non-functional requirements, acceptance and rejection paths, owner policy defaults | Builder |
| [`ARCHITECTURE-SECURITY.md`](./ARCHITECTURE-SECURITY.md) | Trust boundaries, target architecture, threat model and residual risks | Builder, reviewer |
| [`PANEL-CONTRACT.md`](./PANEL-CONTRACT.md) | Panel data model, API, entitlement format, seat model, key management, offline policy | Builder |
| [`MIGRATION.md`](./MIGRATION.md) | How to move from `PHM1` + in-repo issuance to the panel without breaking installed devices | Builder, owner |
| [`TEST-PLAN.md`](./TEST-PLAN.md) | Required automated and manual tests, including abuse cases | Builder, reviewer |
| [`BUILDER-BRIEF.md`](./BUILDER-BRIEF.md) | Ordered implementation slices, definition of done, non-goals, reporting | Builder |

Read in that order. The builder starts at `BUILDER-BRIEF.md` only after
`ADR-001` and `REQUIREMENTS.md` are accepted.

---

## 4. Hard rules (apply to every document here)

1. **No issuance capability in this repo.** No key generator, no licence
   generator, no private key, no seed, no `.env` with signing material. Any such
   file present at baseline is removed, not merely ignored.
2. **No licence entry form in the app.** The pharmacy cannot type, paste, or
   import a licence code. Access arrives from the panel.
3. **No licence administration in any role.** Users, Administrators, and the
   pharmacy owner have no control over seats, expiry, price, or status.
4. **The panel is a separate private repository**, owned by the vendor, not a
   module inside this app.
5. **Licence failure never deletes or blocks access to business data.** At worst
   the app becomes read-only, and export/backup always remains available.
6. **No claim of tax or regulatory compliance** anywhere in the licensing UI.

---

## 5. Scope

In scope:

- the licensing trust boundary;
- the panel contract and data model;
- signed entitlement design and key management;
- conditional migration of existing installations (only if `D-LIC-17` is
  reversed);
- acceptance tests and the builder brief.

Out of scope for this pass:

- writing application code;
- building or deploying the panel;
- pricing, billing, or payment-provider selection;
- changes to POS, inventory, CRM, reports, or user roles beyond removing
  licence entry points;
- a tax-compliance or e-invoicing claim.

---

## 6. Gate

The owner accepted the trust boundary and the policy defaults in
`REQUIREMENTS.md` §7 when issuing `TD-RULINGS-001.md`, and approved C0. Nothing
else is pending. Any change to the trust boundary requires a new ADR; it is not
an implementation detail.
