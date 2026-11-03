# Packaging and Signing Strategy

## Packaging
- Use electron-builder (configured in `package.json`/electron-builder config if present)
- Build renderer/main/preload via `electron-vite`
- Test packaged app on target platforms

## Signing
- Windows: code signing certificate (Authenticode)
- macOS: Developer ID + notarization
- Linux: consider AppImage/signing per distro

## Notes
- Do not embed secrets/keys in app bundle
- Licensing public key only if needed for verification; private key never in Electron
- Update strategy: consider auto-update separately (out of scope unless required)
