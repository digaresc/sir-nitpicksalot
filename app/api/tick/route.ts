import { sweep } from "@/lib/referee";

// The knight's clock. Webhooks cover pushes and resolved threads, but a PR waiting out its
// cooldown (or the start of the review window) needs a nudge. Point any cron here every minute,
// or set Kentucky Merge's REVIEWER_TICK_URL and let the projector do it. Safe to call often:
// sweeps are idempotent and throttled.
export async function GET() {
  await sweep(15_000);
  return Response.json({ ok: true, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

export const POST = GET;
