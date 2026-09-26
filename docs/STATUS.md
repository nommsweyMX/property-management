# Latest: Render preparation

See [RENDER.md](RENDER.md) for the current deployment attempt, configuration, and **63 passing Node tests**. The historical section below documents the preceding build. No remote push or live deployment is claimed.

# Implementation status — 2026-09-24, live-integration build

## Actual connected changes

The existing Airtable base was read before modification. Added Tickets `Ticket Sequence`, valid `Ticket ID` formula, and `Property Address` lookup. Added a `Ticket` relation to Work Log and an empty `App Access` table for explicit account authorization. No house records, contractor records or user-uploaded images were overwritten. The user-managed image table was left unchanged.

Published **Casa HQ / Hogar** with Properties / Casas and Tickets / Reportes. Read-back confirmed both pages are now published, with no remaining draft pages. Publishing did not add collaborators or make anonymous access public. The website is distinct from this Airtable interface.

The GitHub contents read again reported an empty repository. A fresh `create_file` attempt for a non-sensitive README returned **403 Resource not accessible by integration**. This proves only that the write failed from this connection, not which configuration caused it. No remote push or deployment is claimed.

## Code implemented

The existing interface now selects explicit demo mode or a fail-closed live mode. Live mode uses Google sign-in, opaque server sessions, CSRF/origin checks, property-specific Airtable reads/writes, protected photo uploads, stale-status-change detection, linked work history and owner-managed access grants/revocation. Users without a matching active allowlist record cannot sign in. No actual additional people were granted access.

Optional automatic Gmail notices use a persistent private outbox and revalidate each recipient before sending. Unknown outcomes are not retried automatically. Nothing was emailed in this build. Direct Airtable edits, calendar scheduling, Drive sync and push/SMS/WhatsApp automation are not activated by this implementation.

## Tests executed

- **52 Node tests passed**, including real local HTTP requests with mocked Google/Airtable/mail, authentication failure paths, nonce/CSRF/origin checks, role/property isolation, revocation, stale writes, linked notes, safe email formatting, outbox recovery and unconfirmed delivery.
- **10 existing local-demo browser smoke checks passed**, with browser storage and UUIDs mocked.
- **11 live-mode browser UI smoke checks passed**, rendered in memory with Google/API/storage mocked; includes POST/PATCH forms, Spanish UI, account grants/revocation, viewer controls and logout.
- JavaScript syntax checks passed.

The separate `tests/live-ui.py` attempt to navigate Chromium to the local server was blocked by this environment's administrator (`ERR_BLOCKED_BY_ADMINISTRATOR`). It did not pass. The in-memory smoke test is not represented as equivalent to a full browser HTTP integration test.

No production Google token exchange, live website-to-Airtable write/photo upload, Gmail delivery, HTTPS deployment, actual phone installation or Docker build has been verified. The Google verification dependency could not be downloaded in this environment; install/review dependencies and generate a lockfile on the connected deployment host.

## Remaining activation inputs

No hosting provider/domain or Google Cloud web-client configuration is known. The runtime has no AIRTABLE_TOKEN, GOOGLE_CLIENT_ID, OWNER_EMAILS, or Gmail sending credentials. These are host-side application settings, not ChatGPT connector toggles. See ENABLEMENT.md. No paid service or subscription change was made.
