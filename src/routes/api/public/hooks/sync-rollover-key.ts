import { createFileRoute } from "@tanstack/react-router";

// One-shot: mirrors process.env.ROLLOVER_DISPATCH_KEY into cron_dispatch_config.rollover_key
// so the pg_cron HTTP header matches what shift-reminders.ts validates. The endpoint never
// returns the key value; it just copies env → DB. Safe to call publicly.
export const Route = createFileRoute("/api/public/hooks/sync-rollover-key")({
  server: {
    handlers: {
      POST: async () => {
        const expected = process.env.ROLLOVER_DISPATCH_KEY;
        if (!expected) {
          return new Response(JSON.stringify({ ok: false, error: "env not set" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("cron_dispatch_config")
          .update({ rollover_key: expected, updated_at: new Date().toISOString() })
          .eq("id", 1);
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, length: expected.length }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
