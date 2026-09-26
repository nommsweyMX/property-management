#!/usr/bin/env bash
# Run only from a local Git checkout restored from the supplied bundle.
# Uses your normal Git authentication; no tokens are embedded or requested in chat.
set -euo pipefail
cd "$(dirname "$0")/.."
target='https://github.com/nommsweyMX/property-management.git'
git rev-parse --verify HEAD >/dev/null
if ! git diff --quiet HEAD || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  printf '%s\n' 'Working tree has uncommitted changes. Review and commit them first.' >&2
  exit 2
fi
heads="$(git ls-remote --heads "$target")"
if [[ -n "$heads" ]]; then
  printf '%s\n' 'Remote branches already exist. Stop and integrate on a feature branch; no push was performed.' >&2
  exit 3
fi
npm run check
npm test
# Never force-push. A concurrent initial commit causes this command to fail safely.
git push "$target" HEAD:refs/heads/main
expected="$(git rev-parse HEAD)"
actual="$(git ls-remote "$target" refs/heads/main | awk '{print $1}')"
if [[ "$actual" != "$expected" ]]; then
  printf '%s\n' 'Remote HEAD differs; fetch and inspect before reporting completion.' >&2
  exit 4
fi
printf 'Verified remote main at %s\n' "$actual"
