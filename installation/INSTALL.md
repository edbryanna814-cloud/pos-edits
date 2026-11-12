# Pharmacy POS 0.2.1: installation manual (field test)

Arabic version: `INSTALL.ar.md`.

| | |
|---|---|
| Package | `Pharmacy-POS-Setup-0.2.1.exe` (Windows 64-bit installer, about 158 MB) |
| Built from | branch `field-test/0.2.0`, tag `field-test-0.2.1` |
| SHA-256 | see `SHA256SUMS.txt` in this folder |
| Status | **Field test build.** Not a sales release. No code-signing certificate yet. |

---

## 1. What the PC needs

### Required

| Item | Requirement |
|---|---|
| Operating system | Windows 10 (64-bit, version 1809 or later) or Windows 11 (64-bit) |
| Processor | Any 64-bit (x64) Intel or AMD processor |
| Memory | 4 GB RAM minimum, 8 GB recommended |
| Disk | 1 GB free for the program (installed size about 530 MB) **plus** room for the database and backups (allow 2 GB or more) |
| Screen | 1280 × 720 or larger |
| Windows account | A normal user account is enough. The program installs for the current user only; no administrator rights are needed |
| Network port | Local port **27028** must be free. The program runs its own database on it, on this PC only (`127.0.0.1`) |

### Already included: do **not** install these separately

| Component | Version | Why it is included |
|---|---|---|
| Program runtime (Electron, with Chromium and Node.js) | Electron 45.2.1 | Runs the application |
| Database server (MongoDB Community Server) | 9.0.8 | Stores all pharmacy data, on this PC only |
| Microsoft Visual C++ runtime files | 14.x | Needed by the database server |

You do **not** need Node.js, MongoDB, Visual Studio, Python, or an internet connection to install or run the program.

### Strongly recommended

| Item | Why |
|---|---|
| **BitLocker** (or another full-disk encryption) switched on | The database files on disk are not encrypted by the program. BitLocker protects them if the PC or disk is stolen. Check: *Settings → Privacy & security → Device encryption* or *Control Panel → BitLocker Drive Encryption* |
| A USB drive or second location for backups | Backups should never stay only on the same PC |
| A Windows user account with a password | The program's database login is protected with the Windows user's key (DPAPI) |

### Optional hardware

| Item | Notes |
|---|---|
| Receipt printer | Any printer installed in Windows; the program prints through the normal Windows print dialog |
| Barcode scanner | A USB scanner that types like a keyboard ("keyboard wedge" mode) |

---

## 2. Before you install

1. **Check the file is genuine.** In PowerShell, in the folder that holds the installer:
   ```powershell
   Get-FileHash .\Pharmacy-POS-Setup-0.2.1.exe -Algorithm SHA256
   ```
   The result must equal the value in `SHA256SUMS.txt`. If it does not, **do not install**.
2. **Close any running copy** of Pharmacy POS (an older test copy also uses port 27028).
3. **If an older test version is installed:** you can install over it. Your data is kept and secured on first start (see §5).

---

## 3. Install

1. Double-click `Pharmacy-POS-Setup-0.2.1.exe`.
2. **Windows SmartScreen** may say "Windows protected your PC" because the installer is not code-signed yet.
   Click **More info → Run anyway**, but only if the SHA-256 check in §2 matched.
3. Antivirus software may scan or question the installer and `mongod.exe` (the database). Allow them.
4. Choose the installation folder (the default is fine: `%LOCALAPPDATA%\Programs\Pharmacy POS`) and finish.
5. A **Pharmacy POS** shortcut is created on the desktop and in the Start menu.

---

## 4. First start

> ⚠ **Licence activation.** A packaged build opens on **"Activate this device"**. Send the **Device code**
> shown on that screen to the seller; you will receive a licence code for this exact PC. Paste it and press
> **Activate**. The test licence lasts 30 days. No internet connection is needed for activation. Keep the
> code: you need it again if the app data folder is reset or the PC is replaced.

After activation:

1. **Create the administrator account.** There is no default user. Choose a username and a password of
   **at least 12 characters**. Write the password down somewhere safe; there is no password-recovery email.
2. Open **Settings**, fill in the company name, currency, decimal places, tax rate, and default language
   (Arabic or English), and save.
3. Open **Users** and create an account for each person (Cashier, Manager, Inventory Manager, Accountant,
   CRM Employee). Passwords: at least 12 characters. A password set by the administrator is temporary; the
   user must choose their own at first sign-in.
4. Make a first backup (§6).

Sign-in rules: 5 wrong passwords lock the account for 15 minutes.

---

## 5. Where things are

| What | Location |
|---|---|
| Program files | `%LOCALAPPDATA%\Programs\Pharmacy POS` |
| Pharmacy data (database) | `%APPDATA%\pharmacy-pos-management\mongodb-data` |
| Database login (encrypted) | `%APPDATA%\pharmacy-pos-management\mongodb-auth.bin`: **never delete it** |
| Database log | `%APPDATA%\pharmacy-pos-management\mongodb.log` (rotates at 10 MB) |
| Sign-in attempts while the database was down | `%APPDATA%\pharmacy-pos-management\audit-fallback.jsonl` |

The database runs only while the program is open, only on this PC, and requires a login that the program
creates itself on first start. An older, unsecured data folder is secured automatically on first start, with
its data kept.

**Uninstalling does not delete the pharmacy data.** It stays in `%APPDATA%\pharmacy-pos-management`.

---

## 6. Backup and restore

### Backup (do this daily, and before any update)

1. **Settings → Backup passphrase**: type a passphrase of at least 12 characters.
2. Click **Export backup** and save the file to a USB drive or another safe place, not only on this PC.
3. **Keep the passphrase separately from the backup** (for example in the owner's password manager).
   The program never stores it. **Without the passphrase the backup cannot be restored.**

### Restore

1. **Settings → Backup passphrase**: type the passphrase used for that backup.
2. Click **Import backup**, choose the file, and confirm **Replace database**.
3. Check the totals on **Reports** and open one recent sale.

The audit log is never replaced by a restore; the restore is added to it. A wrong passphrase is refused and
nothing is changed.

---

## 7. Troubleshooting

| Problem | What to do |
|---|---|
| "Database: Disconnected" | Close every Pharmacy POS window and start it again. Check that nothing else uses port 27028 (`Get-NetTCPConnection -LocalPort 27028`). |
| Sign-in fails although the password is right | The account may be locked after 5 wrong attempts. Wait 15 minutes. |
| Sign-in says it failed and the database is disconnected | This is intentional: nobody can sign in without the database. Fix the database first. |
| `mongodb-auth.bin` was deleted or the data folder was copied to another PC/user | The program cannot open its database. Do not delete anything. Contact support (recovery procedure: `docs/security/RUNBOOK.md`, "Database access"). Use an encrypted backup + restore to move data between PCs. |
| "Wrong passphrase, or the backup file is damaged" | Use the exact passphrase from the day of the backup. |
| SmartScreen or antivirus blocks the installer | Expected for an unsigned build. Verify the SHA-256 first, then allow it. |

---

## 8. Known limits of this field-test build

- Licence activation needs a code tied to this PC (see §4). Field-test codes last 30 days; a later build with
  a different signing key needs a new code.
- No code-signing certificate: SmartScreen warns.
- Not yet tested on a clean PC by the seller; this release is the clean-PC test.
- **MongoDB Server is licensed under SSPL.** The owner's legal position is pending. This build is for
  the owner's own field testing, not for sale or distribution to customers.
- Business-data changes made directly in the database files are not detected (the audit log is).

Security details: `SECURITY.md` and `docs/security/` in the repository.
