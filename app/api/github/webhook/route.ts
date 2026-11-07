import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { invalidateSnapshot } from "@/lib/snapshot";
import { sweep } from "@/lib/referee";

// GitHub webhook on the target repo (content type: application/json, events: Pull requests
// and Pull request review threads — resolving the last demand thread should merge right away).
// Each event wakes the referee, which reviews, re-inspects and merges whatever is eligible.
export async function POST(request: Request) {
  const body = await request.text();
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "GITHUB_WEBHOOK_SECRET not configured" }, { status: 503 });

  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(body).digest("hex")}`);
  const given = Buffer.from(request.headers.get("x-hub-signature-256") ?? "");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (event === "ping") return Response.json({ ok: true, pong: "🍕" });
  if (event !== "pull_request" && event !== "pull_request_review_thread") return Response.json({ ok: true, ignored: event });

  invalidateSnapshot();
  after(() => sweep());
  return Response.json({ ok: true, action: JSON.parse(body).action });
}
