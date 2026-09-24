# Casa HQ — Property Management

A phone-first, English / Mexican Spanish maintenance app for a small household property portfolio. Preserve the existing green/terracotta interface; the live backend is added without replacing the local demonstration.

## Implemented

- Google Identity Services sign-in, Google ID-token verification, opaque HttpOnly sessions and CSRF protection.
- Server-side Airtable reads/writes with property-scoped access checked on every request.
- Photo-first tickets, status changes with stale-write detection, and linked work notes.
- Owner, Manager, Reporter and Viewer roles; owner-managed account allowlist and revocation.
- Gmail notices for website-created reports, status updates and notes. Messages use the address in Airtable, not a browser-supplied destination.
- Persistent email outbox; an ambiguous delivery is marked **unknown**, not repeatedly sent.
- Explicit offline/local demonstration mode. Live mode never silently falls back to local records.

**Implemented does not mean deployed.** Google sign-in, Airtable sync and email require this website's own host-side configuration. ChatGPT connections cannot supply those credentials to a running site. See [activation requirements](docs/ENABLEMENT.md) and [test/deployment status](docs/STATUS.md).

## Run

Requires Node 22+ and outbound internet access on the deployment host.

```sh
npm install
cp .env.example .env
# Configure .env privately; never put credentials in chat or the public repository.
npm run doctor
npm start
```

For the local demonstration only:

```sh
APP_MODE=demo npm start
```

Run validation with `npm run check` and `npm test`. Browser smoke tests require Python Playwright and Chromium. `tests/live-ui-offline.py` explicitly mocks external services and browser persistence; `tests/live-ui.py` is a separate local HTTP browser integration test, not a production-provider test.

## Deploy

Use a single Node process / one replica behind HTTPS, or the supplied Dockerfile/Compose definition behind an HTTPS reverse proxy. Persist `DATA_DIR`. In-memory sessions are invalidated on restart. Multiple replicas require a shared session/lock/outbox implementation before use. Static-only GitHub Pages hosting cannot execute this backend.

No host was specified for this build and no deployment, paid service, or subscription upgrade was performed. The Docker image has not been built in this offline environment. Dependency installation and a lockfile must be completed on an internet-connected host.

## Data and privacy

Property is the top-level object. Geography is metadata, not five linked tables. Areas and assets are optional for a report. Airtable tables are Properties, Areas, Systems & Assets, Tickets, Projects, Maintenance, Contractors, Work Log, plus the **App Access** allowlist.

Never commit home addresses, actual contacts, private photos, live exports, OAuth tokens or Airtable personal access tokens. Code reads private records only after server authorization. Browser caches contain the static app shell, never authenticated API responses or live household state. Downloaded exports are private and require appropriate handling.

No contractor-only restricted portal is claimed. Reporter and Viewer users can see all operational tickets/history within their assigned properties. Assign those roles only to people authorized for that scope.
