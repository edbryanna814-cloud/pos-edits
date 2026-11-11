# Release checklist (Gate 1 S8)

No build is sold or distributed until every line below has evidence attached (command output, CI run,
test report, or signed document). "Done" without evidence is not done.

## Blockers that apply today

- [ ] **MongoDB SSPL:** written legal opinion or commercial licence (owner). Until then: no distribution, no sale.
- [ ] **Gate 2 green** (licence verifier, full lock, PHM1 removal, clean-PC2 end-to-end).
- [ ] D-LIC-17 written confirmation (owner/admins): no `PHM1` licences sold.
- [ ] Old `PHM1` key located and destroyed, or declared lost; the panel never trusts it.

## Per release

- [ ] Exact commit SHA; CI green on that SHA (typecheck, build, signing scan, gitleaks full history,
      unit + integration tests, `npm audit --omit=dev`, SBOM + licence check).
- [ ] `npm test` (Playwright E2E) green on that SHA, with the output attached.
- [ ] `scripts/prepare-mongodb.ps1` output shows MongoDB **9.0.8** and the `mongod.exe` SHA-256.
- [ ] Installer built from that SHA; SHA-256 of `Pharmacy-POS-Setup-<version>.exe` published beside it.
- [ ] SBOM (`release/sbom.cdx.json`) archived with the installer.
- [ ] Clean-VM install: Windows with no Node, no MongoDB, no dev tools; first-run setup, sale, backup,
      restore, reopen. Screenshots attached.
- [ ] Bundled MongoDB on 27028 starts, initialises `rs0`, and does not touch a service on 27017.
- [ ] SmartScreen / antivirus behaviour recorded (no code-signing certificate yet).
- [ ] Restore drill on a clean data directory: totals and a sample sale match.
- [ ] BitLocker confirmed on the target PC.
- [ ] Arabic and English screenshots of every changed screen.
- [ ] `SECURITY.md` "Known gaps" reviewed; no claim without evidence.
