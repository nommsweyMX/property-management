# Follow-up work

These are incremental tasks, not reasons to replace working code.

## Activation

- Obtain the user's existing hosting target, deploy single-instance behind HTTPS, and configure this website's own Airtable/Google/Gmail credentials.
- Install and review dependencies on an internet-connected host, generate a lockfile, use npm ci, and perform actual-provider/browser/mobile integration tests.
- Confirm a remote commit by reading it back; preserve other sessions' work. Latest attempted write here returned 403; exact cause undetermined.

## Reliability

- Durable idempotency for ticket creation; currently ambiguous writes explicitly require checking before retry. Do not automatically resend POSTs.
- Versioning beyond the current status/description/target revision check. Direct concurrent Airtable edits are not protected by an atomic compare-and-swap API.
- Outbox retention/archival, owner-assisted recovery of unknown mail outcomes after checking Gmail, and recipient delivery diagnostics.
- Shared session/lock/outbox storage before multiple replicas. Current sessions/locks and API throttle are per process.
- Real IndexedDB behavior (demo only), phone installation, service worker lifecycle, offline/slow networks, accessibility audit.

## Features

- Edit existing property metadata/theme, manage areas/equipment, projects, contractors and preventive schedules.
- Add maintenance links and equipment-manual-based recurrence without inventing service dates.
- Optional calendar appointments, Drive document storage, and direct-Airtable-edit notification triggers.
- Contractor-specific ticket-level disclosure before inviting contractors who should not see every operational ticket in their assigned property.
- Public attachments/exports lifecycle review and encrypted backups with explicit restore semantics.

Completed in the integration build: Google verification/API boundary, property allowlist/roles, shared reads and ticket mutations, protected photo-upload adapter, ticket numbering/address lookup, linked ticket history, website Gmail-outbox implementation. These code features still require real-host activation and tests.
