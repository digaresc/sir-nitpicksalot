import { HELM, KNIGHT_NAME, KNIGHT_TITLE, ORDERS } from "@/lib/knight-public";
import { hasWriteToken, targetRepo } from "@/lib/github";
import { rules } from "@/lib/rules";

// Read env on every request, not at build time.
export const dynamic = "force-dynamic";

// A tiny status page: is the knight on duty, and how strict is he today?
export default function Status() {
  const repo = targetRepo();
  const r = rules();
  const onDuty = !!repo && hasWriteToken();
  return (
    <main>
      <pre className="helm">{HELM}</pre>
      <h1>{KNIGHT_NAME}</h1>
      <p className="title">{KNIGHT_TITLE}</p>
      <p className="tag">The code reviewer that has never once said LGTM.</p>
      <dl>
        <dt>Status</dt>
        <dd className={onDuty ? "ok" : "no"}>{onDuty ? "⚜️ On duty, monocle polished" : "Off duty. Set TARGET_REPO and KNIGHT_GITHUB_TOKEN."}</dd>
        <dt>Realm</dt>
        <dd>{repo ? <a href={`https://github.com/${repo}/pulls`}>{repo}</a> : "—"}</dd>
        <dt>Strictness</dt>
        <dd>{r.level}</dd>
      </dl>
      <p className="orders">{ORDERS.join(" · ")}</p>
    </main>
  );
}
