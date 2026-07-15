import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Daily digest worker.
// Runs once per day (pg_cron). For every user with
// notification_preferences.frequency = 'daily_digest' (and email_enabled),
// aggregates the last 24h of alerts that match their opted-in categories
// and enqueues a single branded "daily-digest" email through the existing
// transactional_emails pgmq queue.
//
// Idempotent: uses a date-stamped idempotency_key per recipient so re-runs
// in the same UTC day are no-ops.

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Map alert.source_module → notification preference category
function categoryFor(alert: any): string {
  const m = (alert.source_module || "").toLowerCase();
  if (m === "cash") return "cash";
  if (m === "inventory") return "inventory";
  if (m === "schedule") return "schedule";
  if (m === "time" || m === "time_clock") return "time_clock";
  if (m === "training") return "training";
  if (m === "operations") return "operations";
  if (m === "announcement") return "announcements";
  return "operations";
}

export const Route = createFileRoute("/api/public/hooks/daily-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Required dispatch guard
        const expected = process.env.ROLLOVER_DISPATCH_KEY;
        const provided =
          request.headers.get("x-digest-key") ?? request.headers.get("x-rollover-key");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const sb = admin();
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        // 1. Pull all digest-frequency users
        const { data: prefs, error: prefErr } = await sb
          .from("notification_preferences")
          .select("user_id, email_enabled, frequency, categories")
          .eq("frequency", "daily_digest")
          .eq("email_enabled", true);
        if (prefErr) {
          console.error("daily-digest pref fetch failed", { error: prefErr });
          return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
        }
        if (!prefs || prefs.length === 0) {
          return Response.json({ ok: true, processed: 0, reason: "no_digest_users" });
        }

        // 2. Resolve profiles (email + name + active)
        const userIds = prefs.map((p: any) => p.user_id);
        const { data: profiles } = await sb
          .from("profiles")
          .select("id, email, display_name, active, trailer_id")
          .in("id", userIds);
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

        // 3. Pull recent alerts in window (cap to keep payloads sane)
        const { data: alerts } = await sb
          .from("alerts")
          .select("id, type, title, description, priority, source_module, trailer_id, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500);

        const trailerIds = Array.from(
          new Set((alerts ?? []).map((a: any) => a.trailer_id).filter(Boolean)),
        );
        const { data: trailers } = trailerIds.length
          ? await sb.from("trailers").select("id, name").in("id", trailerIds)
          : { data: [] as any[] };
        const trailerMap = new Map((trailers ?? []).map((t: any) => [t.id, t.name]));

        // 4. Suppression list — skip blocked emails entirely
        const emails = (profiles ?? [])
          .map((p: any) => p.email)
          .filter((e: string | null) => !!e) as string[];
        const { data: suppressed } = emails.length
          ? await sb.from("suppressed_emails").select("email").in("email", emails)
          : { data: [] as any[] };
        const blocked = new Set((suppressed ?? []).map((s: any) => s.email));

        let enqueued = 0;
        let skipped = 0;

        for (const pref of prefs as any[]) {
          const profile: any = profileMap.get(pref.user_id);
          if (!profile?.email || !profile.active) {
            skipped++;
            continue;
          }
          if (blocked.has(profile.email)) {
            skipped++;
            continue;
          }

          const cats: Record<string, boolean> = pref.categories ?? {};
          const eligible = (alerts ?? []).filter((a: any) => {
            const cat = categoryFor(a);
            return cats[cat] !== false;
          });

          if (eligible.length === 0) {
            skipped++;
            continue;
          }

          // Aggregate
          const by_category: Record<string, number> = {};
          let critical_count = 0;
          for (const a of eligible) {
            const cat = categoryFor(a);
            by_category[cat] = (by_category[cat] ?? 0) + 1;
            if (a.priority === "critical") critical_count++;
          }

          const items = eligible.slice(0, 12).map((a: any) => ({
            type: a.type,
            title: a.title,
            description: a.description ?? "",
            priority: a.priority ?? "normal",
            trailer_name: a.trailer_id ? (trailerMap.get(a.trailer_id) ?? undefined) : undefined,
            created_at: a.created_at,
          }));

          const idempotency_key = `daily-digest:${pref.user_id}:${stamp}`;

          // Idempotency: skip if already logged today
          const { data: existing } = await sb
            .from("email_send_log")
            .select("id")
            .eq("template_name", "daily-digest")
            .eq("recipient_email", profile.email)
            .gte("created_at", `${stamp}T00:00:00Z`)
            .maybeSingle();
          if (existing) {
            skipped++;
            continue;
          }

          const payload = {
            template_name: "daily-digest",
            recipient_email: profile.email,
            subject: `Dip N Shake OS daily digest — ${eligible.length} update${eligible.length === 1 ? "" : "s"}`,
            template_data: {
              recipient_name: profile.display_name ?? "Team",
              recipient_email: profile.email,
              window_label: "last 24 hours",
              total: eligible.length,
              critical_count,
              by_category,
              items,
            },
            idempotency_key,
            metadata: {
              kind: "daily_digest",
              user_id: pref.user_id,
              window_start: since,
              window_end: new Date().toISOString(),
            },
          };

          const { error } = await sb.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload,
          });

          if (error) {
            await sb.from("email_send_log").insert({
              template_name: "daily-digest",
              recipient_email: profile.email,
              subject: payload.subject,
              status: "failed",
              error_message: error.message,
            });
            skipped++;
            continue;
          }

          await sb.from("email_send_log").insert({
            template_name: "daily-digest",
            recipient_email: profile.email,
            subject: payload.subject,
            status: "pending",
          });
          enqueued++;
        }

        return Response.json({
          ok: true,
          digest_users: prefs.length,
          enqueued,
          skipped,
          window_since: since,
        });
      },
    },
  },
});
