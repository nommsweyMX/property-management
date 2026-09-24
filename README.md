# Casa HQ / Hogar — Property Management

A mobile-first, bilingual home-maintenance application for a small portfolio.

**Version 0.1 is a functional local prototype, not a deployed/shared production system.** The interface labels this clearly. No GitHub push succeeded in the build session that produced this package.

## Run

Requires Node.js 22 or newer. Runtime dependencies: none.

```sh
npm start
```

Open `http://127.0.0.1:3000`.

```sh
npm run check
npm test
```

No npm installation or paid subscription is needed to run this local prototype. The executable server uses only Node's standard library.

## Implemented

- Responsive phone-first navigation with English and Mexican Spanish.
- Property switching and a local form to add up to four properties with address metadata and a theme color.
- Photo intake, ticket creation, status updates, search/filtering and work notes.
- IndexedDB local storage implementation; explicit local-only save labels.
- Work-order sharing/copying with property name and full address.
- Local JSON backup export.
- PWA manifest, icons and a static-only service worker.
- Server-only Airtable adapter with pagination, request pacing, strict field mapping, property allowlist checks and cross-property area/asset validation.
- A data-free snapshot of the live Airtable table structure.

The public sample omits the street address and starts with no tickets. The one maintenance item is explicitly an example, not a recommended schedule. Newly added properties initially have empty area/equipment lists.

## Not yet implemented or verified live

Google sign-in, contractor roles, shared multi-user state, notification delivery, live photo uploads, automatic recurring scheduling, production ticket numbering, deployment, and wiring the browser to authenticated Airtable endpoints. Project/maintenance/contractor pages currently show local records or empty states; their editing workflows are future work.

The public server intentionally exposes **no live Airtable API route**. The adapter is a tested integration component, not a claim that live sync works. `GET /api/*` returns an explicit unavailable response rather than pretending to save.

## Data and privacy

Only `public/` is served. `.env` and `server/` are never public. This repository must not contain personal addresses, contractor contacts, live records, photographs or credentials. Never upload a local backup to the public repo.

Local browser records are not backed up automatically and are not encrypted by this application. Browser eviction or clearing storage can remove them. This initial build does not synchronize concurrent browser tabs or devices, and backup import is not implemented. Treat it as a usability prototype until authenticated live storage and backup recovery are completed.

## Repository layout

- `public/`: frontend, locales, data rules, IndexedDB store, manifest and service worker.
- `server.mjs`: static development/prototype host.
- `server/airtable.mjs`: server-only integration component; not exposed publicly.
- `airtable/schema.snapshot.json`: portable structure snapshot; not an executable migration.
- `tests/`: Node tests and an optional offline-rendered UI smoke test.
- `docs/`: implementation status, handoff and backlog.
- `AGENTS.md`: project-owner preferences and implementation rules.

## Hosting

The static prototype can be served from `public/`. A real multi-user deployment requires an authenticated server or serverless API before Airtable access is enabled. PWA installation depends on browser support and serving over HTTPS or a supported local development origin; adding a manifest alone is not proof of installation.

References: [MDN PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [Airtable Web API](https://support.airtable.com/docs/getting-started-with-airtables-web-api).

## Collaboration

Target: `nommsweyMX/property-management`. This package is on a local feature branch. Inspect the current remote before integrating it; do not force-push over another contributor's initialization. See `docs/HANDOFF.md`.
