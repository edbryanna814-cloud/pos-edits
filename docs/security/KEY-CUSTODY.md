# Key custody (Gate 1 S8)

Applies to the licence signing keys. **No private key ever enters this repository, CI, an installer, a
fixture, a screenshot, or chat.** The app ships public keys only (`docs/licensing/ADR-001-licence-authority.md`).

## Current state (2026-11-11)

| Key | Status | Action |
|---|---|---|
| Old `PHM1` key (`~/.pharmacy-pos-license/private.pem`) | **Untrusted; location unknown.** Not on the builder machine (checked 2026-11-10), not in git history (gitleaks + scan) | Owner search continues. Never use or import it. Destroy any copy found and record where. The new panel must not trust it. |
| Panel per-product key (Anubis panel) | Not generated yet | Generated in the panel ceremony (Gate 2 R4) |

## Generation (ceremony)

1. On an owner-controlled machine, offline or with no other software running.
2. Generate an Ed25519 key pair with the panel's own tooling (never this repo).
3. Record in the ceremony log: date, key id (`kid`), public key fingerprint (SHA-256), people present,
   machine identifier (hashed), storage locations. Never the private key itself.
4. Only the public key and `kid` go to the app, in a reviewed pull request.

## Backup: two-copy rule

- Two encrypted copies of the private key, in **two different offline locations** under owner control
  (for example two encrypted USB drives in separate places).
- The encryption passphrase is stored separately from both copies.
- Restore drill: decrypt a copy on a clean machine and sign a test entitlement that the app verifies;
  record the date and result. Required before the first sale (Gate 2 R4).

## Rotation

Follow `docs/licensing/PANEL-CONTRACT.md` §9.2: ship the new public key first, switch the signer, retire
the old `kid` after the overlap window, and keep the old private key offline until its last entitlement
expires. Every step is recorded in the panel audit.

## Compromise

`PANEL-CONTRACT.md` §9.3: treat all entitlements signed by the key as suspect, ship a new key, reissue on
renewal, retire the old `kid`, and record the incident.

## Ceremony record (template)

```text
Date:            Key id:             Public key SHA-256:
Machine (hash):  Present:            Copy 1 location:      Copy 2 location:
Passphrase held by:                  Restore drill date/result:
```
