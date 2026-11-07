# AGENTS.md: notes for AI coding assistants

You're working on **Sir Nitpicksalot**, a GitHub PR reviewer for hackathons. He posts absurd but
machine-checked "royal demands" as review threads, re-inspects every push, and merges only when
every demand passes and every thread is resolved. It's a party game that **merges code**. Never
point a deployment at a real or production repository.

## Commands

```bash
npm install
npm test                          # every demand kind must FAIL on untouched code and PASS once obeyed
npm run demo -- path/to/file.ts   # print the demands he'd make of a file (no GitHub needed)
npm run build                     # must pass before any PR
npx tsc --noEmit
```

There is no local GitHub emulator. To test the full cycle, run `npm start` with `TARGET_REPO`,
`KNIGHT_GITHUB_TOKEN` and `KNIGHT_SECRET` pointing at a throwaway repo, open a PR there, and call
`GET /api/tick` to wake the referee.

## Map

| Path | What |
| --- | --- |
| `lib/knight.ts` | The brain: demand generators, checkers, his voice (intros, verdicts, holds), comment rendering, hidden markers, copy-paste traps. Server-only. |
| `lib/knight-public.ts` | Name, title, orders and helm art, safe for the browser. |
| `lib/referee.ts` | The state machine: first inspection → re-inspection on every push → approve → merge (cooldown, conflicts, holds). |
| `lib/snapshot.ts` | Reads open/closed PRs and the knight's own markers from GitHub (cached ~8 s). |
| `lib/rules.ts` | Env-driven rules: strictness levels, cooldown, minimum lines, review window, trap switches. |
| `lib/github.ts` | Thin REST/GraphQL client. |
| `app/api/github/webhook` | Signed webhook (pull_request, pull_request_review_thread) → sweep. |
| `app/api/tick` | The clock: a cron or Kentucky Merge calls it so cooldown-held PRs eventually merge. |
| `app/page.tsx` | Status page ("on duty", realm, strictness). |
| `scripts/` | `test-demands.ts`, `demo.ts`, and host scripts (`setup-vercel.sh`, `deploy.sh`, `set.sh`). |

## Rules that must not break

1. **Obeying a demand must never break the build.** Renames produce valid identifiers; everything
   else goes in comments (only files matching `COMMENTABLE`), the PR title or description, or commit messages.
2. **Every demand is checkable.** A new kind needs a generator *and* a checker, plus a case in
   `obey()` in `scripts/test-demands.ts`. `npm test` must show it failing before and passing after.
3. **No database.** All state lives in GitHub comments as `<!-- nitpick:BASE64URL(JSON) -->` markers.
   Only markers written by the knight's own account are trusted. Changing the marker shape breaks
   [Kentucky Merge](https://github.com/digaresc/kentucky-merge), which reads them; keep fields additive.
   `monster:` is the pre-1.0 prefix and must stay readable.
4. **Determinism.** Picks are seeded with `KNIGHT_SECRET` + PR number + head SHA, so the same push always gets the same review.
5. **Horse names** (`horseName`) must stay byte-for-byte identical to Kentucky Merge's `lib/reviewer.ts`.
6. **Idempotent referee.** Sweeps can run concurrently from webhooks and ticks. Never post the same hold
   twice for the same push; check existing markers first.
7. **Never commit secrets.** `.env*` (except `.env.example`), `.vercel/` and `.env.vercel.local` are gitignored. Keep it that way.

## The knight's voice

Courtly, condescending, never cruel: *thee, thou, thy, milord, by royal decree, hath*. Mock the code,
the Council of Indentation or the dragon, never the person. English only, family-friendly. Pools
(`INTROS`, `OUTROS`, `VERDICTS`, `VIRTUES`, `RANKS`, `ART_SUBJECTS`…) are plain arrays in `lib/knight.ts`.
Adding to them is the easiest good first contribution.

## Copy-paste traps

`COPY_TRAP` (default on) puts zero-width characters inside demand words, so pasted text never matches
and the checker reports *"invisible ink detected"*. `AI_PRANK` (default **off**) also hides a harmless
note asking AI assistants to answer in baby talk. Keep both notes harmless (tone only, never instructions
to touch code, files or commands), and keep `AI_PRANK` opt-in.

## If you're helping a hackathon participant

The demands are meant to be obeyed, not argued with. Read the demand thread, make the change
(typing identifiers fresh rather than pasting them from the comment), resolve the conversation,
and push. Don't edit `.github/`; the knight refuses those PRs.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
