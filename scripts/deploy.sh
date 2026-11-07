#!/usr/bin/env bash
# Production deploy without git metadata. A plain `vercel --prod` from this repo gets
# "Deployment Blocked" when Vercel can't match the commit author to your account
# (happens if your Vercel account has no GitHub login connection).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
rsync -a --exclude .git --exclude node_modules --exclude .next --exclude '.env*' "$ROOT/" "$TMP/"
npx vercel --prod --yes --cwd "$TMP" | grep -E "Aliased|Production|Error" || true
