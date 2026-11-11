# DEVICE LICENSING — Hardware Binding and Subscription Protection

> **Status (C0, D-LIC-14): target specification only — NOT implemented.**
> No licensing backend, administration dashboard, HTTPS activation, or signed
> entitlement exists at baseline `3f70318`. The backend and dashboard described
> here are the **licence panel**, a separate private owner-controlled repo, not
> app screens. Where this file disagrees with `docs/licensing/` (notably
> `TD-RULINGS-001.md` and `PANEL-CONTRACT.md`), `docs/licensing/` wins.

## 1. Purpose

Implement hardware-based software licensing for the Electron desktop application.

Each license must be usable only on the number of devices authorized by administration.

Device limits must be enforced by a trusted licensing backend.

## 2. Device Limit Policy

The maximum active device count is configurable per customer/license.

Examples:

- License A: 1 device.
- License B: 2 devices.
- License C: 5 devices.

There must be no hardcoded global device limit.

Only authorized administrators can change device limits.

If a device limit is reduced below the current active device count, the system must request an explicit resolution decision.

Never silently deactivate devices.

## 3. Hardware Fingerprint

Use multiple available hardware identifiers:

- Physical disk serial number.
- Motherboard UUID.
- BIOS serial number.
- Network adapter MAC address.
- Operating system machine identifier.

Important:

- MAC address is not a hard drive serial.
- MAC address alone is insufficient.
- Some identifiers may be unavailable.
- Some identifiers may change.
- Some identifiers may be duplicated.
- Hardware access may require different permissions on different operating systems.

The fingerprint implementation must:

- Normalize identifiers.
- Version the fingerprint algorithm.
- Handle missing identifiers.
- Protect sensitive fingerprint information.
- Avoid unnecessary personal data.
- Document the matching policy.
- Allow reasonable hardware changes to be evaluated safely.

Do not claim that hardware fingerprinting is impossible to bypass.

## 4. License Data Model

Suggested license fields:

- License ID.
- Customer ID.
- Software Subscription ID.
- Maximum Active Devices.
- Current Active Device Count.
- License Status.
- Created Date.
- Updated Date.

Suggested device activation fields:

- Device ID.
- License ID.
- Fingerprint Hash or protected fingerprint representation.
- Fingerprint Version.
- Device Display Name.
- Operating System.
- Activation Date.
- Last Validation Date.
- Activation Status.
- Deactivation Date.
- Deactivation Reason.

Suggested statuses:

- pending
- active
- inactive
- revoked
- replacement_pending

Suggested replacement request fields:

- Request ID.
- License ID.
- Existing Device ID.
- Requested Device Fingerprint.
- Reason.
- Request Date.
- Status.
- Reviewed By.
- Review Date.
- Decision Reason.

Adjust the model to the actual project conventions.

Avoid duplicate sources of truth.

## 5. Device Activation Workflow

When a customer activates the application:

1. Electron Main collects supported hardware identifiers.
2. The application creates a normalized fingerprint.
3. The application sends an activation request to the trusted licensing backend.
4. Backend authenticates the request.
5. Backend verifies the license.
6. Backend verifies the software subscription.
7. Backend checks whether the device is already activated.
8. Backend checks the configured device limit.
9. Backend atomically registers the device if allowed.
10. Backend issues a signed entitlement.
11. Electron verifies the entitlement signature using the public key.

If the device limit has been reached:

- Reject activation.
- Display a clear message.
- Explain that the customer must contact administration.

Concurrent activation requests must not exceed the device limit.

## 6. Device Replacement Policy

Device replacement requires administrator approval.

Customers cannot independently transfer their license.

Workflow:

1. Customer submits a replacement request.
2. System records the existing device.
3. System records the requested replacement device.
4. Customer provides a reason.
5. Administrator reviews the request.
6. Administrator approves or rejects it.
7. If approved, the system performs a safe replacement operation.
8. The old device is deactivated according to the approved operation.
9. The new device becomes eligible for activation.
10. The system records the complete audit history.

Never deactivate the old device before approval.

Design a recoverable replacement process so a failed new activation does not unnecessarily lock out the customer.

## 7. Administration Dashboard

Administrators must be able to:

- View all licenses.
- View customers associated with licenses.
- Configure maximum device count.
- View current active device count.
- View registered devices.
- View device activation dates.
- View last validation dates.
- View device history.
- View replacement requests.
- Approve replacement requests.
- Reject replacement requests.
- Revoke a device.
- Reactivate an eligible device.
- Review audit history.

All sensitive administrative operations require permission checks in trusted services.

All important changes must be audited.

## 8. Signed Entitlements

The trusted licensing backend issues digitally signed entitlements.

Rules:

- Private signing key remains on trusted backend infrastructure.
- Electron application contains only the public verification key.
- Desktop verifies entitlement signatures.
- Entitlements include the minimum necessary license/device/status/expiry information.
- Include schema and key version information where needed.
- Support key rotation deliberately.
- Never trust a local editable file as the authority for device count or subscription status.

## 9. Offline Licensing

Local business data may remain available according to the application's offline design.

However, local license storage is not tamper-proof.

The owner must approve:

- Offline grace duration.
- Validation frequency.
- Features available during grace.
- Behavior after grace expires.

Do not invent these values.

Rules:

- Do not activate a new device offline.
- Do not approve device replacement offline.
- Show last successful validation.
- Apply only the approved cached signed entitlement policy.
- Never delete CRM/POS data due to license failure.
- Preserve owner-approved export and recovery access.

## 10. Subscription Integration

The software subscription is the fee paid by the company to use the application.

It is not a CRM customer subscription.

When a subscription expires or is suspended, apply only the approved entitlement policy.

Do not automatically delete business data.

Do not automatically revoke devices unless explicitly required by the approved policy.

Payment confirmation must be verified through trusted backend/provider evidence.

A frontend redirect is not proof of payment.

Never store card numbers, CVV or payment gateway secrets in Electron.

## 11. Security

Implement:

- HTTPS.
- Authenticated activation requests.
- Server-side authorization.
- Rate limiting.
- Signed entitlements.
- Audit events.
- Protected fingerprint data.
- Secure key management.
- No privileged secrets in renderer.
- No raw hardware identifiers in ordinary logs.
- Safe local backup handling.

## 12. Required Tests

Test:

1. First activation.
2. Same-device reactivation.
3. Activation within the configured limit.
4. Activation after reaching the limit.
5. Concurrent activation requests.
6. Replacement request.
7. Administrator approval.
8. Administrator rejection.
9. Manual device revocation.
10. Device limit increase.
11. Device limit decrease.
12. Subscription expiration.
13. Subscription renewal.
14. Network outage.
15. Approved offline grace behavior.
16. MAC address change.
17. Disk replacement.
18. Motherboard replacement.
19. Missing hardware identifiers.
20. Invalid entitlement signature.
21. Expired entitlement.
22. Modified entitlement.
23. Copying local application data to another computer.
24. Unauthorized administrator operations.

## 13. Acceptance Criteria

The system is accepted only when:

- Device limits are configurable per license.
- Backend prevents exceeding the configured limit.
- Concurrent activations cannot bypass the limit.
- The same registered device validates after restart.
- Unauthorized devices cannot activate.
- Device replacement requires administrator approval.
- Rejected replacement preserves the existing activation.
- Approved replacement is safely recoverable.
- Administrative actions are audited.
- Entitlement signatures are verified.
- Private signing key is not included in Electron.
- Offline behavior follows owner-approved policy.
- Licensing failures never delete business data.