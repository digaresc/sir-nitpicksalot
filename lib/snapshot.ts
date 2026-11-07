import "server-only";
import { getKnightLogin, ghGet, type GhComment, type GhPull } from "./github";
import { decodeMarker, type Marker } from "./knight";
import { eventWindow } from "./rules";

export interface Snapshot {
  pulls: GhPull[];
  /** The knight's markers by PR number, oldest first. */
  markers: Map<number, Marker[]>;
}

// Per-instance cache so webhook bursts and ticks don't burn the GitHub rate limit.
let cache: { at: number; snap: Snapshot } | null = null;

export function invalidateSnapshot() {
  cache = null;
}

async function pages<T>(path: string, max: number): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= max; page++) {
    const batch = await ghGet<T[]>(`${path}&per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

/** Open + recently closed PRs and every marker the knight has left on them. */
export async function getSnapshot(repo: string): Promise<Snapshot> {
  if (cache && Date.now() - cache.at < 8_000) return cache.snap;

  const since = (eventWindow().start ?? new Date(Date.now() - 14 * 86_400_000)).toISOString();
  const [open, closed, comments, knight] = await Promise.all([
    pages<GhPull>(`/repos/${repo}/pulls?state=open`, 2),
    pages<GhPull>(`/repos/${repo}/pulls?state=closed&sort=updated&direction=desc`, 3),
    pages<GhComment>(`/repos/${repo}/issues/comments?since=${since}&sort=created&direction=asc`, 5),
    getKnightLogin(),
  ]);

  const markers = new Map<number, Marker[]>();
  for (const c of comments) {
    // Anyone can paste a marker into a comment; only the knight's own count.
    if (!knight || c.user.login !== knight) continue;
    const m = decodeMarker(c.body);
    if (!m) continue;
    markers.set(m.pr, [...(markers.get(m.pr) ?? []), m]);
  }

  const snap = { pulls: [...open, ...closed], markers };
  cache = { at: Date.now(), snap };
  return snap;
}
