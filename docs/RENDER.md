# Render deployment — configuration prepared, service not created

## Verified outcome from this session

The Render connection successfully listed the user's workspace and services. No services were listed.
Creating the requested `casa-hq` Node web service on the **free** plan with
`https://github.com/nommsweyMX/property-management`, branch `main`, failed with:

```text
400: branch main does not exist in the repository
```

GitHub's contents read reported an empty repository. A fresh README create-file
operation returned `403 Resource not accessible by integration`. Nothing was pushed,
no service URL was assigned, and no DNS, subscription, or Google account setting was changed.
A successful connected-app login is not proof of code-write permission.

OpenAI's standard GitHub app documentation describes read-only repository access and
routes code editing/pushing to Codex. Do not keep asking the user to toggle unspecified
GitHub permissions or claim the 403 proves a particular missing scope.

## What this revision adds

- `render.yaml`: free Node web service, manual deployment, `/healthz` liveness check,
  Google/Airtable settings supplied privately, and email explicitly disabled.
- Render defaults: listen on `0.0.0.0` at Render's `PORT`; local development remains loopback.
- Canonical origin: use server-provided `RENDER_EXTERNAL_URL` when `PUBLIC_ORIGIN` is
  absent; an explicit custom origin wins and must remain valid. No trust in browser
  host or forwarded-host headers.
- `/healthz` is **liveness only**, not proof that Google/Airtable/email are working.
- `NOTIFICATIONS_ENABLED=false` prevents email enqueue/delivery even if credentials
  are present. Free Render storage is ephemeral; do not risk losing an email outbox.
- Node major version bounded to 22; added 11 deployment tests.
- `scripts/push-initial.sh` can initialize only the specified empty remote, verifies
  the remote commit, rejects dirty checkouts, and never force-pushes.

## Getting the code into the repository

The ZIP is a complete source package. Put its **contents** at the repo root, so
`package.json`, `server.mjs`, and `render.yaml` are not hidden in an extra folder.
Do not commit the ZIP itself and expect Render to unpack it.

The companion Git bundle contains the full history on `work/render-deployment`.
On a machine/environment with Node 22 and authorized Git access:

```sh
git clone --branch work/render-deployment /path/to/property-management-render-ready.bundle casa-hq
cd casa-hq
bash scripts/push-initial.sh
```

When remote branches already exist, the helper intentionally stops: fetch/read them
and integrate this work with a feature branch/PR. Do not replace another session's code.
Normal Git authentication is required; this helper does not create or bypass permission.

## Create the Render service after the source is present

Deploy the `render.yaml` Blueprint, or create a single **Web Service** with:

| Setting | Value |
| --- | --- |
| Repository | `nommsweyMX/property-management` |
| Branch | `main` (must exist and contain the source) |
| Runtime | Node |
| Instance | Free, for initial preview only |
| Region | Oregon |
| Build command | `bash scripts/render-build.sh` |
| Start command | `npm start` |
| Health check | `/healthz` |
| Auto deploy | Off during validation |

For direct API/tool creation, specify these private environment variables explicitly:
`APP_MODE=live`, `NODE_ENV=production`, `NODE_VERSION=22`, `HOST=0.0.0.0`,
`NOTIFICATIONS_ENABLED=false`. The server cannot expose property data before the
required Google/Airtable settings are supplied.

Set the following **in Render's Environment settings**, not source code or chat:

| Key | Value source |
| --- | --- |
| `AIRTABLE_BASE_ID` | Existing Property Management base; do not create a replacement. |
| `AIRTABLE_TOKEN` | Website-specific PAT limited to that base, records read/write. |
| `GOOGLE_CLIENT_ID` | OAuth Web application client with the exact service origin authorized. |
| `OWNER_EMAILS` | Intended owner Google account(s), explicitly selected by the owner. |

`PUBLIC_ORIGIN` may be omitted for the initial assigned `onrender.com` URL.
ChatGPT's connected accounts do not automatically become this website's credentials.
The application stays on a configuration-required screen when settings are missing.

## Custom address without disrupting Workspace

The proposed address is `casa.scalio.info`, not the root domain. After the Render
service has its own verified URL, add that custom domain in Render. At the actual
DNS provider, add only a `casa` CNAME to the **actual assigned Render hostname**.
Check any existing records for that exact subdomain before changing them. Do not
change Google Workspace's MX/SPF/DKIM/DMARC records or the root domain's nameservers.
Then verify the custom domain in Render, update `PUBLIC_ORIGIN`, and authorize that
origin in the Google web-client settings. No DNS actions have been performed.

## Free preview vs reliable email

Render's free web service sleeps after 15 minutes without inbound activity and
loses local filesystem changes on restarts/spin-down. This preview is therefore
not an always-on notification service. Application records/photos remain in Airtable
once configured; the **email outbox** is currently file-based.

Before enabling Gmail delivery, use a paid always-on service with an attached
persistent disk for `DATA_DIR`, or implement an independently durable queue and
worker. Obtain approval before selecting a paid plan. Keep one app process/replica.
Neither a paid service nor a disk has been provisioned. Gmail credentials and real
sending tests remain separate activation steps described in `ENABLEMENT.md`.

## Tests and known limitations

`npm run check` and **63 Node tests passed** for this revision. Eleven new tests
cover Render origin/binding, health behavior, and notification disabling. External
Google, Airtable and Gmail test interactions use mocks. No production-provider or
hosted end-to-end test has passed because there is no deployed app yet.

`npm install --package-lock-only` was attempted but failed with `EAI_AGAIN` resolving
`registry.npmjs.org`. No dependency lockfile is fabricated. The Render build script
uses `npm ci` when a reviewed lockfile exists; otherwise it resolves dependencies
with `npm install --ignore-scripts`. Generate/review and commit the lockfile in an
internet-connected coding environment before production use.

## Primary documentation

- https://render.com/docs/web-services
- https://render.com/docs/environment-variables
- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
- https://render.com/docs/configure-other-dns
- https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt
