# Current handoff

Use this revision, including `render.yaml`, not the older ZIP. Hosting is Render; the source remote is still `nommsweyMX/property-management`. Read [RENDER.md](RENDER.md) before deployment or requesting credentials. The code has not been pushed.

# Handoff — Casa HQ live-integration build

Target repository: `nommsweyMX/property-management`.
Local branch: `work/casa-hq-live-integration` (based on the original foundation).

## Import without losing concurrent work

Read the current remote first. Another session may have initialized it since the last connector check. The latest attempted README write here failed with 403; no remote commit is claimed.

The supplied Git bundle contains both the foundation commit and this integration branch:

```sh
git fetch /path/to/property-management-live-integration.bundle \
  work/casa-hq-live-integration:incoming/casa-hq-live-integration
```

Inspect before merging. For an initialized repository, branch from its current default branch and cherry-pick/apply the changes with explicit conflict handling; never force-push. The application is independent source, not an Airtable export of household records. The ZIP includes the full current source, not node_modules, credentials, outbox messages or private backups.

## Added implementation

- server/config.mjs: private deployment configuration and non-secret public readiness.
- server/auth.mjs: Google verification, nonce binding, opaque sessions and CSRF.
- server/access.mjs: App Access allowlist, per-property roles and revocation.
- server/records.mjs: authorized state projection, without exposing all raw fields.
- server/api.mjs: live endpoints and per-record serialized status changes.
- server/notices.mjs: Gmail sending and persistent private outbox.
- public/live.mjs plus existing app edits: sign-in, shared forms, grants and logout.
- Docker/Compose, deployment guide, migration documentation and additional tests.

The original approved visual design is preserved. Demo mode remains explicit; live API failures are not converted into local saves. Real record IDs and private addresses are read only after authorization.

## Before claiming activation

`npm install`, `npm run doctor`, `npm run check`, `npm test`. Deploy a **single instance** behind HTTPS, persist DATA_DIR, configure the private website credentials described in ENABLEMENT.md, and test real sign-in, a scoped ticket/photo, a second user's access and one owner notice. Never mark those integrations live just because the code or ChatGPT connector exists.

The actual Airtable schema additions and published pages are recorded in STATUS.md. App Access is currently empty; the intended owner bootstraps only after a real verified login matching privately configured OWNER_EMAILS. No invitations were sent, no subscriptions changed, and no website hosting was provisioned.

No message was sent to a separate chat. This file and the repository/package are the coordination mechanism.
