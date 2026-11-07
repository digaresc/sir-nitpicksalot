#!/usr/bin/env bash
# One-shot setup: link a Vercel project, set every production env var, deploy.
# Safe to re-run: secrets are kept in .env.vercel.local (gitignored) and reused,
# because KNIGHT_SECRET must never change once an event has started.
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -d .vercel ]] || npx vercel link   # first run: "Link to existing project?" → No → pick a name

read -rp "Party repo Sir Nitpicksalot reviews (owner/name): " REPO
[[ $REPO == */* ]] || { echo "Expected owner/name, e.g. octocat/hackathon-2026"; exit 1; }
read -rsp "Paste KNIGHT_GITHUB_TOKEN (github_pat_…): " TOKEN; echo
[[ $TOKEN == github_pat_* ]] || { echo "That doesn't look like a fine-grained token"; exit 1; }

SECRETS=.env.vercel.local
[[ -f $SECRETS ]] && source "$SECRETS"
KNIGHT_SECRET=${KNIGHT_SECRET:-$(openssl rand -hex 32)}
GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET:-$(openssl rand -hex 32)}
umask 077
printf 'KNIGHT_SECRET=%s\nGITHUB_WEBHOOK_SECRET=%s\n' "$KNIGHT_SECRET" "$GITHUB_WEBHOOK_SECRET" > "$SECRETS"

while IFS='=' read -r name value; do
  printf %s "$value" | npx vercel env add "$name" --environment production --force > /dev/null
  echo "✓ $name"
done <<EOF
TARGET_REPO=$REPO
KNIGHT_GITHUB_TOKEN=$TOKEN
KNIGHT_SECRET=$KNIGHT_SECRET
GITHUB_WEBHOOK_SECRET=$GITHUB_WEBHOOK_SECRET
EOF

bash scripts/deploy.sh
echo
echo "Webhook secret (also saved in $SECRETS) — paste it into the webhook on $REPO:"
echo "$GITHUB_WEBHOOK_SECRET"
