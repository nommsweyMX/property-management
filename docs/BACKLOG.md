# Next implementation work

These are follow-up tasks, not reasons to rewrite the working prototype.

## Before live use

1. Resolve remote write authorization and verify a real commit by reading it back.
2. Select the user's actual hosting target and runtime; do not assume Google Workspace is a hosting service.
3. Add Google sign-in and a server-derived per-property permission model. Reject access by default.
4. Wire authenticated read/write routes to the Airtable adapter. Never put tokens in browser code.
5. Add protected photo uploads and durable, idempotent ticket submission. On timeout, check whether a write succeeded before retrying.
6. End-to-end test persistence, access isolation, slow/offline networks, service worker lifecycle and actual mobile installation.

## Day-to-day usability

- Edit property metadata/theme and manage areas/equipment (currently only new-property creation and seeded example areas are available).
- Add project, contractor and recurring-maintenance editing.
- Use server-issued IDs and readable ticket numbers. Preserve offline-local identifiers as external references rather than assuming local codes are globally authoritative.
- Add direct Ticket and Maintenance links to Work Log after inspecting current schema; currently absent.
- Derive full address from structured property metadata and expose it via lookups/templates on work records; currently the database has manual Full Address text.
- Add start/completion dates where actually needed, without inventing history.
- Replace the current Parent Area text field with an optional self-link only if navigation needs it. It is not currently a stable relationship.
- Add optional maintenance recurrence rules based on the equipment manual and the owner's schedule, not arbitrary dates.
- Add encrypted/scope-aware backup and restore; handle multi-tab/multi-device writes.

## Integrations

- Draft email and calendar templates in EN/es-MX with full address and stable ticket reference.
- Gmail, Drive, Calendar and notification delivery require their own configured authorization and tests; none is represented as live here.
- WhatsApp/web share is manual. Automated WhatsApp messaging would be separate work.

## Privacy

Keep operational data and secrets out of the public repo. Add field-level disclosure rules before contractor or guest access. Review image retention and access controls before real photo uploads.
