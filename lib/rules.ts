// One dial for the knight's strictness (STRICTNESS). Individual env vars still override.
//  lenient:      1–2 quick demands (comments, emoji, title…), gives up after 2 failed rounds
//  proper:       2–3 demands of any kind, gives up after 3 failed rounds
//  insufferable: 3–4 demands of any kind, gives up after 5 failed rounds
// easy / medium / hard (and the pre-1.0 MONSTER_LEVEL) are accepted as aliases.
const LEVELS = {
  lenient: { demands: [1, 2], maxRounds: 2, quickOnly: true },
  proper: { demands: [2, 3], maxRounds: 3, quickOnly: false },
  insufferable: { demands: [3, 4], maxRounds: 5, quickOnly: false },
} as const;

export type Level = keyof typeof LEVELS;

const ALIASES: Record<string, Level> = { easy: "lenient", medium: "proper", hard: "insufferable" };

export const level = (): Level => {
  const l = (process.env.STRICTNESS ?? process.env.MONSTER_LEVEL ?? "").toLowerCase();
  return l in LEVELS ? (l as Level) : (ALIASES[l] ?? "proper");
};

const flag = (name: string, fallback: boolean) => {
  const v = process.env[name]?.toLowerCase();
  return v === undefined ? fallback : ["on", "true", "1", "yes"].includes(v);
};

export const rules = () => ({
  level: level(),
  demands: LEVELS[level()].demands,
  quickOnly: LEVELS[level()].quickOnly,
  baseBranch: process.env.BASE_BRANCH || "main",
  minChangedLines: Math.max(0, Number(process.env.MIN_CHANGED_LINES ?? 6)),
  cooldownMinutes: Math.max(0, Number(process.env.MERGE_COOLDOWN_MINUTES ?? 4)),
  // Failed re-inspections before the knight gives up and merges anyway.
  maxRounds: Math.max(1, Number(process.env.MAX_REVIEW_ROUNDS ?? LEVELS[level()].maxRounds)),
  // Invisible characters in demands, so pasted text gets caught.
  copyTrap: flag("COPY_TRAP", true),
  // Hidden note asking AI assistants that receive a pasted demand to talk funny. Opt-in.
  aiPrank: flag("AI_PRANK", false),
});

/** Optional review window: PRs are held before the start and never merged after the end. */
export function eventWindow(): { start: Date | null; end: Date | null } {
  const raw = process.env.EVENT_START;
  const start = raw ? new Date(raw) : null;
  if (!start || Number.isNaN(start.getTime())) return { start: null, end: null };
  const minutes = Math.max(1, Number(process.env.EVENT_MINUTES) || 80);
  return { start, end: new Date(start.getTime() + minutes * 60_000) };
}

/** Paths a PR may not touch: the target repo's CI is the royal treasury. */
export const FORBIDDEN_PATHS = [/^\.github\//];
