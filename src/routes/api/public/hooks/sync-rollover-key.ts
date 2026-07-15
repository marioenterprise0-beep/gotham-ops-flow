import { createFileRoute } from "@tanstack/react-router";

// One-shot: mirrors process.env.ROLLOVER_DISPATCH_KEY into cron_dispatch_config.rollover_key
// so the pg_cron HTTP header matches what shift-reminders.ts validates. The endpoint never
// returns the key value or length. Caller must present the same key as `x-rollover-key`,
// matching the guard used by the other rollover hooks.
export const Route = createFileRoute("/api/public/hooks/sync-rollover-key")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ROLLOVER_DISPATCH_KEY;
        if (!expected) {
          return new Response(JSON.stringify({ ok: false, error: "env not set" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const provided = request.headers.get("x-rollover-key");
        if (!provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("cron_dispatch_config")
          .update({ rollover_key: expected, updated_at: new Date().toISOString() })
          .eq("id", 1);
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
