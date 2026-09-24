# Activation — code vs. a working hosted service

The code supports live services; **no service is silently marked live because its configuration fields exist**. Successful server reads are required before the app shows an Airtable-connected banner. This package contains no credentials or personal data.

## 1. Hosting (one deployment, one replica)

Use your existing Node-capable host, or Docker behind an HTTPS reverse proxy. Serve the app at the origin root, not a URL subdirectory. Set `PUBLIC_ORIGIN` to the exact HTTPS origin (no trailing slash/path), and preserve request bodies/cookies. The API uses the configured origin, never a client-supplied forwarded host. The local server binds loopback by default; Compose binds its published port to loopback for the proxy.

Keep `DATA_DIR` persistent and private (owner-only file permissions, restricted backups). It holds email message payloads and delivery history. Apply host disk encryption/backup access controls as appropriate. Do not deploy more than one process or replica: sessions, mutation locks and API throttling are process-local; the outbox assumes a single writer. Restarting signs users out.

Run `npm install` on the connected host, review the dependency tree and lockfile, and then use `npm ci` for repeatable builds. The build environment could not download `google-auth-library`; production Google verification has not been tested here.

## 2. Airtable, using the existing base

Set `AIRTABLE_BASE_ID` and a private `AIRTABLE_TOKEN` with `data.records:read` and `data.records:write`, restricted to the intended property base. Do not put the token in frontend JavaScript or an environment variable prefixed for client export. A token granted to ChatGPT is not automatically available to this website.

The live base already has these additive changes:

- Tickets: `Ticket Sequence` auto-number; `Ticket ID` formula; `Property Address` lookup of Properties → Full Address.
- Work Log: `Ticket` linked record.
- App Access: Email, Google Subject, Role (Owner/Manager/Reporter/Viewer), Properties, Active, Receive Notices, Language (en/es).

Preserve existing records and the user's separate image table. No destructive migration is required. Field names in server modules must match the schema; server-side writes use Airtable's REST API, not connector tool argument formats.

Direct photo uploads use Airtable's attachment upload API. The app validates JPG/PNG/WebP MIME signatures, accepts up to three 3-MiB images, and reports any unconfirmed upload separately from the already-created ticket. Actual attachment upload must be tested against the selected base before relying on it.

## 3. Google sign-in (private allowlist)

Create/configure a Google OAuth **Web application** client in a Cloud project. Add `PUBLIC_ORIGIN` to its authorized JavaScript origins, and configure the Google consent/branding screen appropriately. Set `GOOGLE_CLIENT_ID` on the server. The public client ID is not a secret. This sign-in flow verifies ID tokens; it does not need Gmail scopes to sign people in.

Set `OWNER_EMAILS` privately to the intended owner Gmail or Workspace account email(s). On the first successful authoritative Google login, a matching owner email bootstraps an active Owner entry with the stable Google `sub`. Existing disabled entries do not get re-enabled by bootstrap. Subsequent access follows `sub`, not an arbitrary client email string. Unlisted accounts are denied; no public signup.

First-time email binding is automatic only when Google is authoritative for the address (`@gmail.com` or a verified Workspace hosted-domain claim). Other Google accounts with third-party email addresses require the owner to verify and populate the stable Google Subject deliberately, rather than trusting a potentially reassigned third-party address.

The owner can grant Manager / Reporter / Viewer access and property scope from **More → People & notices**. This grants an allowlist entry; it does not send an invitation email. Share the site URL through an appropriate private channel. Nobody has been invited or granted new user access in this build.

## 4. Automatic Gmail notices

Authorize **this application** to send mail from the selected Gmail/Workspace account using `https://www.googleapis.com/auth/gmail.send`. The refresh token must be issued to the same OAuth client as `GOOGLE_CLIENT_ID`. Store `GOOGLE_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` and `GMAIL_FROM` in the host's private environment. GMAIL_FROM must be that account's permitted sender address. Configure the consent screen and token lifecycle for ongoing use; do not rely on an expiring testing authorization for production.

This is distinct from Google sign-in and from the Gmail connector in ChatGPT. Credentials are not requested through chat, copied from the connector, or logged. No mail is sent before sender configuration and recipient authorization are present.

The website queues notices after a report, status change or work note. Recipients must be Active, opted in with Receive Notices, and authorized for the property (Owners can receive all). Messages include the property name/address and ticket link. The worker runs every 30 seconds **only while this app server is running**, and rechecks recipient permissions before sending.

Direct edits made inside Airtable do not trigger this website worker automatically. A separate Airtable automation would be needed for that behavior; none has been enabled here. Phone push notifications, SMS and automated WhatsApp delivery are also not implemented.

`pending` means queued, `sent` means Gmail returned a message ID, not proof of inbox delivery. A timeout or interrupted send is `unknown`; check the sender's Gmail before manually recovering that item. There is deliberately no automatic resend after uncertainty. The owner UI shows delivery-status counts.

## Verification on the real host

Run `npm run doctor`, deploy, then verify a real Google login, rejected unlisted login, a new ticket with one photo, second-account visibility, cross-property denial, status history, and a single notice delivered to the owner. Confirm no tokens or household data appear in the public repository or static files. Confirm revoked accounts are denied on the next request. Do not describe the site as live until these actual-provider tests pass.

Reference documentation:
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send
- https://airtable.com/developers/web/api/upload-attachment
