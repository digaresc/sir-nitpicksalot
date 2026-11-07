import "server-only";
import { fileAt, getKnightLogin, gh, graphql, hasWriteToken, targetRepo, type GhCommit, type GhFile, type GhPull, type GhPullDetail } from "./github";
import {
  THREAD_TAG,
  approveComment,
  checkDemand,
  evalComment,
  generateDemands,
  holdComment,
  holdMessage,
  pickVerdict,
  reviewSummary,
  threadBody,
  type Demand,
  type HoldKind,
  type Marker,
} from "./knight";
import { getSnapshot, invalidateSnapshot } from "./snapshot";
import { FORBIDDEN_PATHS, eventWindow, rules } from "./rules";

// The referee walks every open PR through: first inspection (2–4 demands as review threads)
// → re-inspection on every push (all demands met + all threads resolved?) → approve → merge
// (respecting conflicts and the per-hacker cooldown). It is triggered by the GitHub webhook
// and by /api/tick (any cron, or Kentucky Merge's projector) — which also merges PRs whose cooldown expired.

let running: Promise<void> | null = null;
let lastRun = 0;

/** Runs a sweep unless one ran in the last `minIntervalMs` on this instance. */
export function sweep(minIntervalMs = 0): Promise<void> {
  if (!hasWriteToken() || !targetRepo()) return Promise.resolve();
  if (running) return running;
  if (Date.now() - lastRun < minIntervalMs) return Promise.resolve();
  lastRun = Date.now();
  running = doSweep()
    .catch((e) => console.error("[referee] sweep failed", e))
    .finally(() => {
      running = null;
    });
  return running;
}

type Review = Extract<Marker, { k: "review" }>;
type Eval = Extract<Marker, { k: "eval" }>;

async function doSweep() {
  const repo = targetRepo()!;
  invalidateSnapshot();
  const snap = await getSnapshot(repo);
  const { start, end } = eventWindow();
  const now = Date.now();

  // Last merge per author, so the cooldown applies across PRs.
  const lastMerge = new Map<string, number>();
  for (const p of snap.pulls) {
    if (!p.merged_at) continue;
    const t = new Date(p.merged_at).getTime();
    if (t > (lastMerge.get(p.user.login) ?? 0)) lastMerge.set(p.user.login, t);
  }

  const open = snap.pulls
    .filter((p) => p.state === "open" && !p.draft && p.base.ref === rules().baseBranch && p.user.type !== "Bot")
    .sort((a, b) => a.number - b.number);

  let changed = false;
  for (const pr of open) {
    const marks = snap.markers.get(pr.number) ?? [];
    const ctx = new PrContext(repo, pr, marks, lastMerge, now);

    if (start && now < start.getTime()) {
      if (!ctx.said("gates", true)) await ctx.hold("gates");
      continue;
    }
    if (end && now > end.getTime()) {
      if (!ctx.said("over", true)) await ctx.hold("over");
      continue;
    }
    // Held for this exact push already? Wait for a new push.
    if (ctx.said("tiny") || ctx.said("forbidden") || ctx.said("conflict")) continue;

    // Reviews from before the demand system have no demands; those PRs are already merged.
    const review = marks.findLast((m): m is Review => m.k === "review" && Array.isArray(m.demands));
    if (!review) await firstInspection(ctx);
    else if (ctx.said("approve")) await ctx.tryMerge();
    else if (pr.head.sha !== review.sha) await reinspect(ctx, review);
    changed ||= ctx.changed;
  }
  if (changed) invalidateSnapshot();
}

class PrContext {
  changed = false;
  constructor(
    readonly repo: string,
    readonly pr: GhPull,
    readonly marks: Marker[],
    readonly lastMerge: Map<string, number>,
    readonly now: number,
  ) {}

  said(k: Marker["k"], anySha = false) {
    return this.marks.some((m) => m.k === k && (anySha || m.sha === this.pr.head.sha));
  }

  async comment(body: string) {
    await gh("POST", `/repos/${this.repo}/issues/${this.pr.number}/comments`, { body });
    this.changed = true;
  }

  async hold(k: HoldKind, vars: Record<string, string | number> = {}) {
    const marker = { k, pr: this.pr.number, sha: this.pr.head.sha } as Extract<Marker, { k: HoldKind }>;
    await this.comment(holdComment(marker, holdMessage(k, `${this.pr.number}:${this.pr.head.sha}`, vars)));
  }

  async detail() {
    const res = await gh<GhPullDetail>("GET", `/repos/${this.repo}/pulls/${this.pr.number}`);
    return res.ok && res.data.state === "open" && res.data.head.sha === this.pr.head.sha ? res.data : null;
  }

  async files() {
    return (await gh<GhFile[]>("GET", `/repos/${this.repo}/pulls/${this.pr.number}/files?per_page=100`)).data ?? [];
  }

  async contentsAt(paths: string[], sha: string) {
    const headRepo = this.pr.head.repo?.full_name ?? this.repo;
    const entries = await Promise.all(paths.map(async (p) => [p, await fileAt(headRepo, p, sha)] as const));
    return new Map(entries);
  }

  async tryMerge() {
    const { pr, repo } = this;
    const d = await this.detail();
    if (!d || d.mergeable === null) return; // gone, or GitHub still computing
    if (d.mergeable === false) {
      if (!this.said("conflict")) await this.hold("conflict");
      return;
    }
    const readyAt = (this.lastMerge.get(pr.user.login) ?? 0) + rules().cooldownMinutes * 60_000;
    if (readyAt > this.now) {
      if (!this.said("cooldown")) await this.hold("cooldown", { at: new Date(readyAt).toISOString().slice(11, 16) });
      return;
    }
    const merge = await gh<{ message: string }>("PUT", `/repos/${repo}/pulls/${pr.number}/merge`, {
      merge_method: "squash",
      sha: pr.head.sha,
      commit_title: `${pr.title} (#${pr.number}) — approved by Sir Nitpicksalot`,
    });
    if (!merge.ok) {
      console.error(`[referee] merge #${pr.number} failed`, merge.status, merge.data.message);
      return;
    }
    this.changed = true;
    this.lastMerge.set(pr.user.login, Date.now());
    if (pr.head.repo?.full_name === repo) {
      await gh("DELETE", `/repos/${repo}/git/refs/heads/${encodeURIComponent(pr.head.ref)}`);
    }
  }
}

const touchesForbidden = (files: GhFile[]) => files.some((f) => FORBIDDEN_PATHS.some((re) => re.test(f.filename)));

/** Added/removed lines that aren't blank or whitespace-only. */
function countMeaningful(patch?: string): number {
  if (!patch) return 0;
  return patch.split("\n").filter((l) => /^[+-](?![+-]{2} )/.test(l) && l.slice(1).trim().length > 0).length;
}

async function firstInspection(ctx: PrContext) {
  const { pr, repo } = ctx;
  const files = await ctx.files();
  if (touchesForbidden(files)) return ctx.hold("forbidden");
  // Whitespace-only and lockfile churn doesn't count toward the minimum.
  const meaningful = files
    .filter((f) => !/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(f.filename))
    .reduce((n, f) => n + countMeaningful(f.patch), 0);
  const min = rules().minChangedLines;
  if (meaningful < min) return ctx.hold("tiny", { n: meaningful, min });

  const changedPaths = files.filter((f) => f.status !== "removed" && f.patch).map((f) => f.filename).slice(0, 8);
  const raw = await ctx.contentsAt(changedPaths, pr.head.sha);
  const contents = new Map([...raw].filter((e): e is [string, string] => e[1] !== null));
  const { demands: count, quickOnly } = rules();
  const demands = generateDemands({ number: pr.number, sha: pr.head.sha, title: pr.title, author: pr.user.login, files, contents, count, quickOnly });
  if (demands.length === 0) {
    // Nothing to latch onto (binary-only diff, etc.): skip straight to approval.
    return approve(ctx, false);
  }

  // Post the demands as review threads on the exact lines. You can't request changes on your
  // own PR, so fall back to a plain review; and if GitHub rejects the threads, to no threads.
  const comments = demands.map((d) => ({ path: d.file, line: d.line, side: "RIGHT", body: threadBody(d, demands.length) }));
  let threaded = false;
  for (const event of ["REQUEST_CHANGES", "COMMENT"]) {
    const res = await gh("POST", `/repos/${repo}/pulls/${pr.number}/reviews`, {
      commit_id: pr.head.sha,
      event,
      body: "⚜️ Inspection complete. My royal demands are below.",
      comments,
    });
    if (res.ok) {
      threaded = true;
      break;
    }
  }
  await ctx.comment(reviewSummary({ number: pr.number, sha: pr.head.sha }, demands, threaded));
}

async function reinspect(ctx: PrContext, review: Review) {
  const { pr, repo } = ctx;
  const lastEval = ctx.marks.findLast((m): m is Eval => m.k === "eval" && m.sha === pr.head.sha);
  if (lastEval) {
    // This push was already judged. Only reconsider if the sole problem was unresolved threads.
    if (lastEval.failed.length > 0 || lastEval.unresolved === 0) return;
    if ((await unresolvedThreads(repo, pr.number)) > 0) return;
    return approve(ctx, false);
  }

  const d = await ctx.detail();
  if (!d) return;
  const files = await ctx.files();
  if (touchesForbidden(files)) return ctx.hold("forbidden");

  const contents = await ctx.contentsAt([...new Set(review.demands.map((x) => x.file))], pr.head.sha);
  const commits = (await gh<GhCommit[]>("GET", `/repos/${repo}/pulls/${pr.number}/commits?per_page=100`)).data ?? [];
  const since = commits.findIndex((c) => c.sha === review.sha);
  const commitMessages = commits.slice(since + 1).map((c) => c.commit.message);

  const results = review.demands.map((dm: Demand) =>
    checkDemand(dm, { content: (f) => contents.get(f) ?? null, title: d.title, body: d.body ?? "", commitMessages }),
  );
  const failed = review.demands.filter((_, i) => !results[i].ok).map((x) => x.id);
  const unresolved = await unresolvedThreads(repo, pr.number);
  const round = ctx.marks.filter((m) => m.k === "eval").length + 1;
  const maxRounds = rules().maxRounds;
  // Safety valve: after too many failed rounds the knight gives up, so nobody is stuck all event.
  const mercy = failed.length > 0 && round >= maxRounds;
  const ok = (failed.length === 0 && unresolved === 0) || mercy;

  const marker: Eval = { k: "eval", pr: pr.number, sha: pr.head.sha, round, ok, failed, unresolved };
  await ctx.comment(evalComment(marker, review.demands, results, maxRounds));
  if (ok) await approve(ctx, mercy);
}

async function approve(ctx: PrContext, mercy: boolean) {
  const { pr } = ctx;
  const verdict = pickVerdict(`${pr.number}:${pr.head.sha}`, mercy);
  await ctx.comment(approveComment({ k: "approve", pr: pr.number, sha: pr.head.sha, verdict, mercy }, pr.user.login));
  ctx.marks.push({ k: "approve", pr: pr.number, sha: pr.head.sha, verdict, mercy });
  await ctx.tryMerge();
}

interface ThreadsQuery {
  repository: {
    pullRequest: {
      reviewThreads: { nodes: { isResolved: boolean; comments: { nodes: { author: { login: string } | null; body: string }[] } }[] };
    };
  };
}

/** How many of the knight's demand threads on this PR are still unresolved. */
async function unresolvedThreads(repo: string, number: number): Promise<number> {
  const [owner, name] = repo.split("/");
  const knight = await getKnightLogin();
  const data = await graphql<ThreadsQuery>(
    `query($owner:String!,$name:String!,$n:Int!){repository(owner:$owner,name:$name){pullRequest(number:$n){
      reviewThreads(first:100){nodes{isResolved comments(first:1){nodes{author{login} body}}}}}}}`,
    { owner, name, n: number },
  );
  if (!data) return 0;
  return data.repository.pullRequest.reviewThreads.nodes.filter((t) => {
    const first = t.comments.nodes[0];
    return !t.isResolved && first?.author?.login === knight && first.body.includes(THREAD_TAG);
  }).length;
}
