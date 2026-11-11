# Runbook (Gate 1 S8)

Operational procedures for the current build. Items marked **Gate 2** do not exist yet. Do not promise
them to a customer.

## Install

1. Check the installer checksum: `Get-FileHash .\Pharmacy-POS-Setup-<version>.exe -Algorithm SHA256`.
   It must equal the published value.
2. There is no code-signing certificate yet: Windows SmartScreen shows "Unknown publisher". Continue only
   if the checksum matches.
3. **Deployment requirement:** BitLocker (or equivalent full-disk encryption) on the pharmacy PC. The
   database and backups are not encrypted by the app yet.
4. First launch shows **Create the administrator account**. Choose a unique username and a password of at
   least 12 characters. There is no default account.
5. The app runs its own MongoDB on `127.0.0.1:27028`. It does not use or conflict with a MongoDB service
   on `27017`.

## Users

- Passwords: at least 12 characters. 5 wrong attempts lock the account for 15 minutes.
- An administrator reset sets a temporary password; the user must choose a new one at next sign-in.
- Accounts migrated from older versions are forced to change their password at first sign-in.

## Backup

1. Settings → enter a **backup passphrase** (at least 12 characters) → Export backup → choose a location
   **off the PC**.
2. The file is encrypted (Argon2id + AES-256-GCM). **Without the passphrase it cannot be restored.** Keep the
   passphrase separately from the backup (for example in the owner's password manager); the app never stores it.
3. Export, import and refused imports (wrong passphrase) are recorded in the audit log.
4. Backups exported before this version are plaintext. Re-export, then destroy the old files.

## Restore

1. Settings → enter the backup's passphrase → Import backup → choose the file → confirm "Replace database".
2. Check totals on the Reports page and open one recent sale.
3. Backups are EJSON (format v2): record ids and dates keep their types through a restore. Older v1
   files still import, but their ids come back as text. Re-export after upgrading.
4. The audit log is never replaced by a restore. The restore is appended to it as `backup.import`.

## Audit log

- Hash-chained and verified at every start. If verification fails, the app records `audit.chain_broken`.
  Treat that as a possible tampering incident.
- If MongoDB was unavailable, failed sign-ins are written to `%APPDATA%\pharmacy-pos-management\audit-fallback.jsonl`.

## Renew, transfer, support lease

**Gate 2.** Not available in this build. Licences are still `PHM1` codes; do not sell.

## Incident response

1. Isolate: unplug the PC from the network. Do not wipe it.
2. Preserve: copy the app data folder (`mongodb-data`, `mongodb.log*`, `audit-fallback.jsonl*`) and export
   the audit log.
3. Check the audit chain status and failed-login entries.
4. Rotate: reset every user password; if a licence key is involved, follow `KEY-CUSTODY.md` "Compromise".
5. Record what happened, when, who was involved, and what was changed.

## Database access (MongoDB)

- The bundled MongoDB requires authentication. The app creates its users on first start (also on an
  existing data folder from an older version) and keeps the credentials in `mongodb-auth.bin`, encrypted
  with the Windows user's DPAPI key.
- **Do not delete `mongodb-auth.bin`.** Without it the app cannot open its database. Recovery is a support
  task: stop the app, start `mongod` on the data folder without `--keyFile`, drop `pharmacy_admin` and
  `pharmacy_app` from `admin.system.users`, stop it, delete `mongodb-auth.bin`, and start the app (it
  re-creates both users). Record it as an incident.
- Moving the data folder to another Windows user or PC needs the same recovery, because DPAPI keys do not
  move. Use an encrypted backup and restore instead.
