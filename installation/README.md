# Pharmacy POS 0.2.0: field-test installation folder

Everything needed to install and run Pharmacy POS on a Windows PC, kept together as a backup.

| File | What it is |
|---|---|
| `Pharmacy-POS-Setup-0.2.0.exe` | Windows 64-bit installer (stored with Git LFS in this branch) |
| `INSTALL.md` | Installation manual: PC requirements, required/included programs, install, first start, backup, troubleshooting |
| `INSTALL.ar.md` | The same manual in Arabic |
| `SHA256SUMS.txt` | SHA-256 checksums: verify the installer before running it |
| `sbom.cdx.json` | Software bill of materials (CycloneDX 1.5): every bundled component and its licence |

**Download:** the whole folder as one zip, plus the installer alone, is attached to the GitHub pre-release
`field-test-0.2.0` of this repository (Releases page). With Git: `git lfs install`, then clone and check out
branch `field-test/0.2.0`, or run `git lfs pull` in an existing clone.

**Start with `INSTALL.md` (English) or `INSTALL.ar.md` (Arabic).** Read §4 "First start" before going on site:
this build stops at licence activation unless the PC has a valid `PHM1` code.

Built from branch `field-test/0.2.0`; app code identical to `gate1/security-baseline` at `12dcfc7`
(PR edbryanna814-cloud/Pharmacy-POS-and-management-#2). Field test only: not for sale or distribution
(MongoDB SSPL position pending).
