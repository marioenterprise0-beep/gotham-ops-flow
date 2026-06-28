import { createFileRoute } from "@tanstack/react-router";

// One-shot: copies process.env.ROLLOVER_DISPATCH_KEY into cron_dispatch_config.rollover_key.
// Caller must already know the key (passed in x-rollover-key header) to prove authority.
export const Route = createFileRoute("/api/public/hooks/sync-rollover-key")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ROLLOVER_DISPATCH_KEY;
        const provided = request.headers.get("x-rollover-key");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
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
        return new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
