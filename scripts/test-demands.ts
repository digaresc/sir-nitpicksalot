// npm test — every demand type must FAIL on untouched code and PASS once obeyed.
// Adding a demand type? Teach obey() below how a well-behaved hacker would satisfy it.
import { checkDemand, generateDemands, type Demand } from "../lib/knight";

const file = "app/crm/page.tsx";
const content = `import { customers } from "@/lib/data";

export default function CustomersPage() {
  const vipCount = customers.filter((c) => c.status === "vip").length;
  return (
    <section className="card">
      <h1>Customers ({vipCount} VIPs)</h1>
    </section>
  );
}
`;
const patch = "@@ -1,0 +1,10 @@\n" + content.trimEnd().split("\n").map((l) => "+" + l).join("\n");
const files = [{ filename: file, status: "modified", additions: 10, deletions: 0, patch }];
const contents = new Map([[file, content]]);
const TITLE = "Add VIP count";
const gen = (number: number, sha: string) =>
  generateDemands({ number, sha, title: TITLE, author: "crustpunk", files, contents, count: [2, 4], quickOnly: false });

// 1. Variety: one diff, many pushes.
const seen = new Set<string>();
for (let i = 0; i < 300; i++) for (const d of gen(i, `sha${i}`)) seen.add(d.text);
console.log(`distinct demand texts from one diff over 300 pushes: ${seen.size}`);

// 2. One example of every kind + variant.
const kinds = new Map<string, Demand>();
for (let i = 0; i < 5000 && kinds.size < 40; i++)
  for (const d of gen(i, `s${i}`)) if (!kinds.has(d.kind + (d.variant ?? ""))) kinds.set(d.kind + (d.variant ?? ""), d);

/** How an obedient hacker would satisfy each demand. */
function obey(d: Demand): { content: string; title: string; body: string; commits: string[] } {
  let c = content;
  let title = TITLE;
  let body = "";
  let commits: string[] = [];
  const n = d.count ?? 0;
  const lines = () => c.split("\n");
  switch (d.kind) {
    case "rename": c = c.replace(new RegExp(`\\b${d.from}\\b`, "g"), d.to!); break;
    case "indent": c = lines().map((l) => (l.trim() === d.lineText ? (d.indent === "tab" ? "\t".repeat(n) : " ".repeat(d.indent as number)) + l.trim() : l)).join("\n"); break;
    case "commas": c = lines().flatMap((l) => (l.trim() === d.lineText ? [l, "// " + ",".repeat(n)] : [l])).join("\n"); break;
    case "semicolons": c = `// ${";".repeat(n)}\n` + c; break;
    case "exclaim": c = `// wow${"!".repeat(n)}\n` + c; break;
    case "caps": c = `// ${Array(n).fill("HUZZAH").join(" ")}\n` + c; break;
    case "emoji": c = `// ${d.emoji!.repeat(n)}\n` + c; break;
    case "repeat": c = `// ${Array(n).fill(d.word).join(" ")}\n` + c; break;
    case "ascii": c = c + "\n" + Array(n).fill("//  /\\_/\\  ~~ ").join("\n") + "\n"; break;
    case "stamp": c = `// ${d.word}\n` + c; break;
    case "virtue": c = `// such ${d.word}\n` + c; break;
    case "horse": c = `// ${d.variant}: thank you ${d.word}\n` + c; break;
    case "sign": c = `// — @crustpunk, ${d.word}\n` + c; break;
    case "title": title = d.variant === "emoji" ? `${title} ${d.emoji!.repeat(n)}` : `${title} ${d.word}`; break;
    case "description":
      body =
        d.variant === "recipe" ? Array(n).fill("- cheese").join("\n")
        : d.variant === "letter" ? ["Dear Sir Nitpicksalot,", ...Array(n).fill("I am thy humble servant")].join("\n")
        : Array(5).fill(`ode to ${d.word}`).join("\n");
      break;
    case "commit":
      commits = [d.variant === "word" ? `fix: ${d.word}` : d.variant === "bangs" ? "fix" + "!".repeat(n) : d.variant === "caps" ? "FIX ALL THE THINGS" : `fix ${d.emoji}`];
      break;
  }
  return { content: c, title, body, commits };
}

let bad = 0;
for (const [k, d] of [...kinds].sort()) {
  const before = checkDemand(d, { content: () => content, title: TITLE, body: "", commitMessages: [] });
  const o = obey(d);
  const after = checkDemand(d, { content: () => o.content, title: o.title, body: o.body, commitMessages: o.commits });
  const good = !before.ok && after.ok;
  if (!good) bad++;
  console.log(`${good ? "✅" : "❌"} ${k.padEnd(20)} ${good ? "" : `before: ${before.note} / after: ${after.note}`}`);
}
console.log(`\nkinds covered: ${kinds.size}, failures: ${bad}`);
if (bad > 0) process.exit(1);
