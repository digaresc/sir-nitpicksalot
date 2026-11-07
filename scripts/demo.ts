// npm run demo -- path/to/file.ts
// Prints the demands Sir Nitpicksalot would make if every line of that file were new in a PR.
// No GitHub, no tokens. Run it twice: a new "push" gets a new review.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { generateDemands } from "../lib/knight";
import { KNIGHT_NAME, KNIGHT_TITLE } from "../lib/knight-public";
import { rules } from "../lib/rules";

const path = process.argv[2];
if (!path) {
  console.error("usage: npm run demo -- path/to/file.ts");
  process.exit(1);
}

const content = readFileSync(path, "utf8");
const lines = content.split("\n");
const patch = `@@ -0,0 +1,${lines.length} @@\n` + lines.map((l) => `+${l}`).join("\n");
const { demands: count, quickOnly, level } = rules();

const demands = generateDemands({
  number: 1,
  sha: `demo-${Date.now()}`,
  title: `Add ${basename(path)}`,
  author: process.env.USER ?? "you",
  files: [{ filename: path, status: "added", additions: lines.length, deletions: 0, patch }],
  contents: new Map([[path, content]]),
  count,
  quickOnly,
});

const strip = (s: string) => s.replace(/\*\*/g, "");
console.log(`\n⚜️  ${KNIGHT_NAME}, ${KNIGHT_TITLE}\n`);
console.log(`Hear ye. Having inspected ${path} (strictness: ${level}), I hereby issue ${demands.length} royal demand${demands.length === 1 ? "" : "s"}:\n`);
demands.forEach((d) => console.log(`  ${d.id}. [line ${d.line}] ${strip(d.text)}\n`));
console.log("Obey every demand, resolve my conversations, push. I re-inspect upon every push.\n");
