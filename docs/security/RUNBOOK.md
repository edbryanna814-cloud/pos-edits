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

1. Settings → Export backup → choose a location **off the PC** (encrypted USB drive).
2. **The backup is plaintext JSON and contains password hashes.** Store it encrypted and access-controlled
   until encrypted backups land (S4).
3. Export and import are recorded in the audit log.

## Restore

1. Settings → Import backup → choose the file → confirm "Replace database".
2. Check totals on the Reports page and open one recent sale.
3. Backups are EJSON (format v2): record ids and dates keep their types through a restore. Older v1
   files still import, but their ids come back as text. Re-export after upgrading.
4. The audit log is never replaced by a restore. The restore is appended to it as `backup.import`.

## Audit log

- Hash-chained and verified at every start. If verification fails, the app records `audit.chain_broken`.
  Treat that as a possible tampering incident.
- If MongoDB was unavailable, failed sign-ins are written to `%APPDATA%\Pharmacy POS\audit-fallback.jsonl`
  (the folder may differ with the product name).

## Renew, transfer, support lease

**Gate 2.** Not available in this build. Licences are still `PHM1` codes; do not sell.

## Incident response

1. Isolate: unplug the PC from the network. Do not wipe it.
2. Preserve: copy the app data folder (`mongodb-data`, `mongodb.log*`, `audit-fallback.jsonl*`) and export
   the audit log.
3. Check the audit chain status and failed-login entries.
4. Rotate: reset every user password; if a licence key is involved, follow `KEY-CUSTODY.md` "Compromise".
5. Record what happened, when, who was involved, and what was changed.
