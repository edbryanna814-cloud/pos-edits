import type { PanelKey } from './anb2'

// Public keys of the Anubis licence panel (anubis-switcher → Settings → signing key, product PHM).
// Public keys only: a private key never enters this repo. Add a new key before the panel switches to it
// (rotation, contract v3 §11); mark an old one `retired: true` to refuse its leases.
export const PANEL_KEYS: PanelKey[] = [
  // Created in the panel 2026-11-12T17:22:05Z by the owner (audit seq 5).
  // SHA-256 of the raw key: 45bedf7e4fb0fa9857e03fccf6154c09c226dc1b7d7a959f27ccfbf3ebe9bddd
  { kid: 'phm-2026-01', publicKey: 'JDWgK4Sydp0Pu0iVG0xeVb8Or7ePnRgGVICsDQf/U5k=' }
]
