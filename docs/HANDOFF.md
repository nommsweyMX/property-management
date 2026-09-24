# Handoff to the repo/build session

Target repository: `nommsweyMX/property-management`.
Local branch: `work/casa-hq-foundation`.

This package contains source and a local Git commit, not a successful remote push. The GitHub connector rejected an actual README creation request with 403. Do not infer that the owner must change a specific setting merely from that message.

## Continue

Read the current remote first; another session may have initialized it after this package was produced. Preserve any existing work. If the repository is still empty, publish this local feature branch and initialize the default branch intentionally. If it has commits, create an integration branch from the current default and apply the package's files or cherry-pick its commit, resolving collisions explicitly. Do not force-push.

The bundle contains the complete local branch history:

```sh
git fetch /path/to/property-management-foundation.bundle work/casa-hq-foundation:incoming/casa-hq-foundation
```

Inspect `incoming/casa-hq-foundation` before merging/cherry-picking. Run `npm run check` and `npm test`. The bundle is portable and does not contain tokens or live household records.

## Known state

- Airtable tables were created earlier and their structure was freshly read for the snapshot. The frontend is not live-connected to them yet.
- The frontend uses local IndexedDB and labels that explicitly.
- `server/airtable.mjs` is an integration module only. It requires authentication/authorization at its future HTTP boundary.
- Do not enable real data endpoints without Google identity verification and a server-derived allowlist.
- The house address and other private setup values should be read from authorized Airtable records, not copied from conversation text into public source.
- `AGENTS.md` records the owner's high-effort preference and working-code-first rule.

No message was sent to another chat. This handoff file is the coordination mechanism; the other session needs access to this package or its eventual remote commit.
