# PROGRESS — Licence Authority Separation

Resume from here after any interruption.

- **Baseline:** `3f70318` (single squashed import commit; its message "Remove in-app subscription and license management" does not match the code — D-LIC-15).
- **Plan:** `docs/licensing/` — rulings in `TD-RULINGS-001.md` win over older docs.
- **Branch:** `chore/licence-containment` → `main`. Never work on `main`, never force-push.
- **Rule:** no private key or issuance code in this repo, ever. The old `PHM1` key is treated as exposed.

## Slice order (TD-RULINGS-001 §4)

| Slice | Repo | Status |
|---|---|---|
| C0 containment + CI + docs correction | app | **done, awaiting review** — `a457994`, CI run 42836474294 green |
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

## C0 result

- `6f1f542` docs(licensing) — package, PROGRESS.md, false backend claims corrected.
- `a457994` chore(licence): C0 containment — CI green: https://github.com/edbryanna814-cloud/Pharmacy-POS-and-management-/actions/runs/42836474294 (npm ci, typecheck, build, signing scan, test:unit).
- Tests: `tests/unit/smoke.test.ts` (1), `tests/unit/licenseApplyGuard.test.ts` (7), `tests/unit/scanSigning.test.ts` (6) — 14 pass.
- Scan run against the baseline's two scripts: 4 failures, exit 1 (as intended).
- Closed: NFR-LIC-012, ADR E1. Partly: M1 (rotation record pending, A1/A3), FR-LIC-020 (entry still exists, guarded; removed in B3).
- Deferred: Playwright E2E not in CI (needs Electron + MongoDB on Windows); apply rate limit is in-memory (resets on restart); guard messages English only (ActivationPage unchanged by ruling, removed in B3).

## Next

A1 panel skeleton, auth, audit — in the owner's account (`Talaat-hub`), **not started**; waits for C0 review.

## Last completed step

2026-11-10 — C0 committed and CI green on `a457994`; stopped for review.
