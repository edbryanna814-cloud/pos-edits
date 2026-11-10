# PROGRESS — Licence Authority Separation

Resume from here after any interruption.

- **Baseline:** `3f70318` (single squashed import commit; its message "Remove in-app subscription and license management" does not match the code — D-LIC-15).
- **Plan:** `docs/licensing/` — rulings in `TD-RULINGS-001.md` win over older docs.
- **Branch:** `chore/licence-containment` → `main`. Never work on `main`, never force-push.
- **Rule:** no private key or issuance code in this repo, ever. The old `PHM1` key is treated as exposed.

## Slice order (TD-RULINGS-001 §4)

| Slice | Repo | Status |
|---|---|---|
| C0 containment + CI + docs correction | app | **in progress** |
| A1 panel skeleton, auth, audit | panel | not started — waits for C0 review |
| A2 customers, plans, licences | panel | — |
| A3 reverse enrolment + PHM2 signing | panel | — (stop point) |
| B1 verifier, key set, remove price/MAC from status | app | — |
| B2 central write gate, read-only (login allowed) | app | — |
| B3 remove activation form + `license:apply` | app | — |
| B4 check-in client, protected cache, clock rule | app | — |
| B5 status, support bundle, bilingual UX | app | — |
| A4 check-in, revocation, replacement, seats | panel | — |
| A5 operations | panel | — |
| B6 legacy retirement | app | only if D-LIC-17 is reversed |

## C0 scope

1. `docs(licensing)`: add `docs/licensing/`, this file; correct false backend claims (SECURITY_REVIEW, ARCHITECTURE, START_HERE, IMPLEMENTATION_ROADMAP, MASTER_PROMPT); DEVICE_LICENSING marked target-only.
2. `chore(licence)`: delete `scripts/license-*.mjs`; CI (`npm ci`, typecheck, build, signing scan, `test:unit`); Vitest; `license:apply` guard (D-LIC-16).
3. `docs(progress)`: C0 result with the CI run on the exact head.

Stop after C0 and wait for review. C0 does not close M1 (key rotation record comes with A1/A3).

## Decisions in force

D-LIC-01…18 (`docs/licensing/TD-RULINGS-001.md`). Key ones: reverse enrolment (no token typed into the app); 32-hex unsalted device hash unchanged; PHM2 times in seconds; login always allowed, gate on writes only; default no `PHM1` licences sold (D-LIC-17); panel repo under the owner's account (`Talaat-hub`), never `edbryanna814-cloud`.

## Owner actions open

- Search machines/backups for `~/.pharmacy-pos-license/private.pem`; record where found; destroy after rotation. Not on the builder machine (checked 2026-11-10).
- Confirm D-LIC-17 (no sales) before B4.

## Last completed step

2026-11-10 — branch `chore/licence-containment` created from `3f70318`; docs corrected.
