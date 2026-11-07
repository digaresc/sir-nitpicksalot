# Hosting a tournament with Sir Nitpicksalot

## The day before (~20 min)

1. **Create the party repo** (public, so people can fork it) with some starter code worth improving.
2. **Create the knight's token:** https://github.com/settings/personal-access-tokens/new
   - Only select repositories → the party repo.
   - Contents, Issues, Pull requests: **Read and write**. Never grant Workflows.
   - The knight comments and merges as the owner of this token. A dedicated bot account looks best.
3. **Deploy:** `bash scripts/setup-vercel.sh`. It asks for the repo and token, generates the secrets
   (saved in `.env.vercel.local`, gitignored) and deploys.
4. **Add the webhook** on the party repo (Settings → Webhooks → Add), or run this from the terminal:
   ```bash
   source .env.vercel.local
   gh api repos/OWNER/REPO/hooks -f name=web -F active=true \
     -f 'events[]=pull_request' -f 'events[]=pull_request_review_thread' \
     -f 'config[url]=https://YOUR-APP.vercel.app/api/github/webhook' \
     -f 'config[content_type]=json' -f "config[secret]=$GITHUB_WEBHOOK_SECRET"
   ```
5. **Give the knight a clock:** a free cron (for example cron-job.org) calling `https://YOUR-APP.vercel.app/api/tick`
   every minute, or Kentucky Merge's `REVIEWER_TICK_URL`.
6. **Dry run:** open a PR with 6+ real lines, obey the demands, resolve the threads and push. It should merge.

## Deploying

Always deploy with `bash scripts/deploy.sh` (or `bash scripts/set.sh NAME VALUE`, which also redeploys).
A plain `vercel --prod` from a git folder can get "Deployment Blocked" when Vercel can't match the commit author
to your account. The script deploys a copy without the git metadata.

## During the event

| Situation | Do this |
| --- | --- |
| Set the tournament window | `bash scripts/set.sh EVENT_START 2026-11-20T18:00:00-06:00` |
| The room is struggling | `bash scripts/set.sh STRICTNESS lenient` (applies to newly inspected PRs) |
| Everyone is stuck | `bash scripts/set.sh MAX_REVIEW_ROUNDS 1` (merges on the next push, open PRs included) |
| The room is too fast | `bash scripts/set.sh STRICTNESS insufferable` |
| One person is stuck | Merge their PR by hand on GitHub |
| A PR got no comment after ~30 s | Settings → Webhooks → Recent Deliveries → Redeliver |

Logs: `npx vercel logs https://YOUR-APP.vercel.app` (look for `[referee]`).

Keep these controls to yourself. If participants know `MAX_REVIEW_ROUNDS` exists, they'll ask for it.

## After the event

Delete the webhook, revoke the token.
