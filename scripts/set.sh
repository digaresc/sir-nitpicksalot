#!/usr/bin/env bash
# Change one production setting and redeploy (~1 min). Usage: bash scripts/set.sh NAME VALUE
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $# -eq 2 ]] || { echo "usage: bash scripts/set.sh NAME VALUE"; exit 1; }
printf %s "$2" | npx vercel env add "$1" --environment production --force > /dev/null
echo "✓ $1=$2 — redeploying…"
bash scripts/deploy.sh
