import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Public dispatcher cron endpoint. pg_cron invokes this every 15 minutes;
// the SQL function decides which trailers (if any) should roll over right now
// based on each trailer's local time and the configured rollover hour.
//
// Auth: passes the Supabase anon key in the `apikey` header (canonical pattern
// for /api/public/* hooks). The endpoint additionally requires the
// `x-rollover-key` header to match the configured ROLLOVER_DISPATCH_KEY,
// when set, so the route cannot be triggered casually from the open web.
export const Route = createFileRoute("/api/public/hooks/daily-rollover")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ROLLOVER_DISPATCH_KEY;
        const provided = request.headers.get("x-rollover-key");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
          return new Response("Server not configured", { status: 500 });
        }
        const supabase = createClient(url, key, { auth: { persistSession: false } });

        const { data, error } = await supabase.rpc("dispatch_daily_rollover", {});
        if (error) {
          console.error("daily-rollover dispatch failed", { error });
          return new Response(JSON.stringify({ ok: false, error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, trailers_rolled: data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
