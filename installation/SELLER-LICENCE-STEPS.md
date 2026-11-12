# Giving a PC access: licence panel steps (sellers only)

Two people involved: the **seller** (you, in the licence panel) and the **pharmacy PC** (where the app is
installed). The PC never connects to the panel; you send it a small licence file.

## Before the first licence (once)

- The Pharmacy POS signing key exists (panel → **Settings** → Pharmacy POS). It was created on
  2026-11-12, reference `phm-2026-01`. This app build (0.2.2) trusts only that key.
- Both sellers know the **signing passphrase**. Without it no licence can be issued.

## Each new PC

1. **On the pharmacy PC:** install `Pharmacy-POS-Setup-0.2.2.exe` and open it. The **"Activate this device"**
   screen shows a **Device code** (32 letters and digits). Press **Copy code** and send it to the seller
   (WhatsApp, email…). The code is not secret.
2. **In the panel** (on the laptop: http://127.0.0.1:3000; from the partner's PC over Tailscale:
   https://desktop-c4207d0.tail3622c7.ts.net/): sign in, then open **Licences**.
3. Fill **Issue a licence**:
   - **Product:** Pharmacy POS
   - **How the customer pays:** Subscription
   - **Length:** **1 hour (testing only)** for the field test, or **30 days** for a normal subscription
   - **Device code:** paste the code from step 1
   - **Customer name**, **Contact**, **Device name** (e.g. "PC 2"), **Note** (e.g. "field test")
   - **Minimum app version:** `0.2.2`
   - **Signing passphrase:** the passphrase from "Before the first licence"
4. Press **Issue licence**, then **Download licence file**. You get a file like
   `PHM-<Customer>-<first 8 letters of the device code>.anbc`. Send it to the pharmacy PC.
5. **On the pharmacy PC:** on the activation screen press **"Or choose the licence file (.anbc)"**, pick the
   file, press **Activate**. Then create the administrator account (first run only) and sign in.

## What to expect in the field test

- A 1-hour licence ends exactly one hour after you issued it. Within about a minute the app returns to the
  activation screen; nothing is deleted. To continue, issue a **new** licence for the same device code
  (same steps) and load the new file. The panel closes the ended licence automatically.
  - While a licence is still running, the panel refuses a second one for that PC
    ("already has a licence that is still running"). Renewal before the end is not built yet.
- The same file on another PC is refused ("issued for a different device").
- **Issued licences** (right side of the Licences page) lists every licence; **File** downloads the same
  licence file again.
- Every issue, and every wrong passphrase, is recorded in **Audit**.

## Errors in the panel

| Message | Meaning |
|---|---|
| That signing passphrase is wrong | Nothing was issued; the attempt is in the audit log |
| The device code must be the 32 letters/digits… | Copy the code again from the PC |
| This device already has a licence that is still running | Wait until it ends (see "What to expect") |
| This product has no signing key yet | Create it in Settings first |

## After the field test

Switch the default length back to 30 days: in the panel code `src/components/issue-licence-form.tsx`, set
`DEFAULT_LENGTH` to `'product'`, rebuild, and restart the panel. (Or simply choose **30 days** each time.)
