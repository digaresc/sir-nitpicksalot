import "server-only";

/** owner/name of the repo the knight reviews (RACE_REPO is the pre-1.0 name). */
export const targetRepo = (): string | null => process.env.TARGET_REPO ?? process.env.RACE_REPO ?? null;
/** The knight's write token. MONSTER_GITHUB_TOKEN is the pre-1.0 name. */
const token = () => process.env.KNIGHT_GITHUB_TOKEN ?? process.env.MONSTER_GITHUB_TOKEN;

export const hasWriteToken = () => !!token();

export interface GhResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

export async function gh<T = unknown>(method: string, path: string, body?: unknown): Promise<GhResult<T>> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

/** GET that throws on failure, for reads the dashboard can't do without. */
export async function ghGet<T>(path: string): Promise<T> {
  const res = await gh<T>("GET", path);
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path.split("?")[0]}`);
  return res.data;
}

let knightLogin: string | null = null;

/** Login of the account behind the knight's token; only its comments are trusted. */
export async function getKnightLogin(): Promise<string | null> {
  if (process.env.KNIGHT_LOGIN) return process.env.KNIGHT_LOGIN;
  if (knightLogin || !hasWriteToken()) return knightLogin;
  const res = await gh<{ login: string }>("GET", "/user");
  if (res.ok) knightLogin = res.data.login;
  return knightLogin;
}

export interface GhUser {
  login: string;
  avatar_url: string;
  type: string;
}

export interface GhPull {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  draft?: boolean;
  merged_at: string | null;
  user: GhUser;
  head: { ref: string; sha: string; repo: { full_name: string } | null };
  base: { ref: string };
}

export interface GhPullDetail extends GhPull {
  body: string | null;
  mergeable: boolean | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GhFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface GhComment {
  id: number;
  body: string;
  user: GhUser;
  issue_url: string;
  created_at: string;
}

export interface GhCommit {
  sha: string;
  commit: { message: string };
}

/** File contents at a ref, or null if missing/unreadable. Forks are read from their own repo. */
export async function fileAt(repo: string, path: string, ref: string): Promise<string | null> {
  const enc = path.split("/").map(encodeURIComponent).join("/");
  const res = await gh<{ content?: string; encoding?: string }>("GET", `/repos/${repo}/contents/${enc}?ref=${ref}`);
  if (!res.ok || res.data.encoding !== "base64" || !res.data.content) return null;
  return Buffer.from(res.data.content, "base64").toString("utf8");
}

export async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const res = await gh<{ data?: T }>("POST", "/graphql", { query, variables });
  return res.ok ? (res.data.data ?? null) : null;
}
