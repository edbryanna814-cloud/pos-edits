import type { PanelKey } from './anb2'

// Public keys of the Anubis licence panel (anubis-switcher → Settings → signing key, product PHM).
// Public keys only: a private key never enters this repo. Add a new key before the panel switches to it
// (rotation, contract v3 §11); mark an old one `retired: true` to refuse its leases.
export const PANEL_KEYS: PanelKey[] = []
