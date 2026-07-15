import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";

// Email QA self-test endpoint.
// Authenticated via x-qa-key matching process.env.ROLLOVER_DISPATCH_KEY.
// Validates:
//   1. All registered templates render without throwing (using previewData)
//   2. Recent email_send_log health (last 24h counts by status)
//   3. Detects duplicate idempotency keys (sign of broken dedupe)
//   4. Optional: enqueues a smoke-test email to ?to=<address> using
//      template 'critical-alert' so the full pipeline can be observed.

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/public/hooks/email-qa-selftest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ROLLOVER_DISPATCH_KEY;
        const provided = request.headers.get("x-qa-key") ?? request.headers.get("x-rollover-key");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = new URL(request.url);
        const smokeTo = url.searchParams.get("to");

        // ---- 1. Template render check ----
        const renderResults: { template: string; ok: boolean; error?: string }[] = [];
        // Dynamically import render only when needed (avoid SSR cost otherwise)
        const { render } = await import("@react-email/components");
        for (const [name, entry] of Object.entries(TEMPLATES)) {
          try {
            const Comp = entry.component as any;
            const data = entry.previewData ?? {};
            const html = await render(Comp(data));
            if (!html || html.length < 50) {
              renderResults.push({ template: name, ok: false, error: "empty_render" });
            } else {
              renderResults.push({ template: name, ok: true });
            }
          } catch (e: any) {
            renderResults.push({ template: name, ok: false, error: e?.message?.slice(0, 200) });
          }
        }

        // ---- 2. Send log health ----
        const sb = admin();
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await sb
          .from("email_send_log")
          .select("status")
          .gte("created_at", since);
        const counts: Record<string, number> = {};
        for (const r of recent ?? []) {
          const s = (r as any).status ?? "unknown";
          counts[s] = (counts[s] ?? 0) + 1;
        }

        // ---- 3. Duplicate detection: same template+recipient+alert within 5 minutes ----
        const { data: dupes } = await sb
          .from("email_send_log")
          .select("alert_id, template_name, recipient_email, created_at")
          .not("alert_id", "is", null)
          .gte("created_at", since);
        const seen = new Map<string, number>();
        for (const d of dupes ?? []) {
          const key = `${(d as any).alert_id}:${(d as any).template_name}:${(d as any).recipient_email}`;
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }
        const duplicate_keys = Array.from(seen.entries())
          .filter(([, n]) => n > 1)
          .map(([k, n]) => ({ key: k, count: n }));

        // ---- 4. Optional smoke email ----
        let smoke: any = null;
        if (smokeTo) {
          const payload = {
            template_name: "critical-alert",
            recipient_email: smokeTo,
            subject: "Dip N Shake OS — Email pipeline self-test",
            template_data: {
              recipient_name: "QA",
              trailer_name: "QA Trailer",
              title: "Email pipeline self-test",
              description: "If you received this, branded delivery is healthy.",
              cta_url: "https://dipnshake.com/alerts",
            },
            idempotency_key: `qa-selftest:${smokeTo}:${Date.now()}`,
            metadata: { kind: "qa_selftest" },
          };
          const { error } = await sb.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload,
          });
          smoke = error ? { ok: false, error: error.message } : { ok: true, recipient: smokeTo };
        }

        const renderFailures = renderResults.filter((r) => !r.ok);

        return Response.json({
          ok: renderFailures.length === 0,
          templates: {
            total: renderResults.length,
            failures: renderFailures,
          },
          last_24h_counts: counts,
          duplicate_alerts: duplicate_keys,
          smoke,
        });
      },
    },
  },
});
