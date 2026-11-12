# Pharmacy POS 0.2.2: field-test installation folder

Everything needed to install and run Pharmacy POS on a Windows PC, kept together with the release.

| File | What it is |
|---|---|
| `SELLER-LICENCE-STEPS.md` | Sellers: issue a licence for a PC from the licence panel (1-hour test or 30 days) |
| `WHAT-TO-INSTALL.md` | Short answer to "what must be installed alongside the app" (EN + AR) |
| `INSTALL.md` | Installation manual: PC requirements, install, first start, backup, troubleshooting |
| `INSTALL.ar.md` | The same manual in Arabic |
| `SHA256SUMS.txt` | SHA-256 checksums: verify the installer before running it |
| `sbom.cdx.json` | Software bill of materials (CycloneDX 1.5): every bundled component and its licence |

**Download:** `Pharmacy-POS-Setup-0.2.2.exe`, the whole folder as one zip, and the checksums are attached
to the GitHub pre-release `field-test-0.2.2` of this repository (Releases page). The installer is not
stored in Git for this version; the release assets are the distribution copy.

**Start with `WHAT-TO-INSTALL.md` or `INSTALL.md` §4 "First start".** The app needs a licence code tied
to the PC: install it, copy the **Device code** from the activation screen, and send it to the seller.
Sellers: see `SELLER-LICENCE-STEPS.md`.

Built from branch `field-test/0.2.0`, tag `field-test-0.2.2`. Field test only: not for sale or
distribution (MongoDB SSPL position pending).

## What changed in 0.2.2

- CRM removed completely: the Customers page, contacts, leads, deals, activities and notes are gone,
  along with the CRM Employee role and the customer permission.
- POS checkout is walk-in only; sales no longer attach a customer.
- The sales report no longer shows a per-customer section.
- Activation accepts licences from the Anubis licence panel: load the `.anbc` licence file (button on the
  activation screen) or paste its code. This build trusts the panel key `phm-2026-01`. Field-test licences
  can last 1 hour; when one ends the app returns to the activation screen and keeps all data.
