#!/usr/bin/env bash
set -euo pipefail
# Do not execute third-party package lifecycle scripts during deployment.
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund
else
  printf '%s\n' 'No lockfile yet: resolve dependencies on this connected build host.'
  printf '%s\n' 'Commit the generated/reviewed package-lock.json before production use.'
  npm install --omit=dev --ignore-scripts --no-audit --no-fund
fi
npm run check
npm test
