import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { enqueueAlertEmail } from "@/lib/email/enqueue.server";

// Daily shift reminder cron endpoint.
// pg_cron invokes this at 8 AM and 6 PM UTC (cover morning-of reminders).
// Auth: x-rollover-key header must match ROLLOVER_DISPATCH_KEY env var.
export const Route = createFileRoute("/api/public/hooks/shift-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ROLLOVER_DISPATCH_KEY;
        const provided = request.headers.get("x-rollover-key");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return new Response("Server not configured", { status: 500 });
        }

        const body = await request.json().catch(() => ({})) as Record<string, unknown>;
        const reminderFor = (body.reminder_for as string) === "today" ? "today" : "tomorrow";

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        });

        const targetDate = new Date();
        if (reminderFor === "tomorrow") targetDate.setDate(targetDate.getDate() + 1);
        const dateStr = targetDate.toISOString().slice(0, 10);

        const { data: shifts, error: shiftsErr } = await supabase
          .from("schedule_shifts")
          .select(
            "id, employee_id, shift_date, start_time, end_time, role, segment, schedules!inner(status, trailer_id, trailers(name))",
          )
          .eq("shift_date", dateStr)
          .not("employee_id", "is", null)
          .in("schedules.status", ["published", "locked"]);

        if (shiftsErr) {
          console.error("shift-reminders: failed to query shifts", shiftsErr);
          return new Response(JSON.stringify({ ok: false, error: shiftsErr.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        if (!shifts || shifts.length === 0) {
          return new Response(JSON.stringify({ ok: true, sent: 0, date: dateStr }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        // Group by employee
        const byEmployee = new Map<string, typeof shifts>();
        for (const s of shifts) {
          const empId = s.employee_id as string;
          if (!byEmployee.has(empId)) byEmployee.set(empId, []);
          byEmployee.get(empId)!.push(s);
        }

        const empIds = Array.from(byEmployee.keys());
        const [{ data: profiles }, { data: authUsers }] = await Promise.all([
          supabase.from("profiles").select("id, display_name").in("id", empIds),
          supabase.auth.admin.listUsers(),
        ]);

        const emailMap = new Map<string, string>(
          (authUsers?.users ?? []).map((u: any) => [u.id as string, u.email as string]),
        );
        const nameMap = new Map<string, string>(
          (profiles ?? []).map((p: any) => [p.id as string, (p.display_name ?? "Crew") as string]),
        );

        let sent = 0;
        for (const [empId, empShifts] of byEmployee) {
          const email = emailMap.get(empId);
          if (!email) continue;
          const name = nameMap.get(empId) ?? "Crew";
          const location = (empShifts[0] as any).schedules?.trailers?.name ?? "Gotham Halal";
          const shiftRows = (empShifts as any[])
            .sort((a, b) => (a.start_time as string).localeCompare(b.start_time as string))
            .map((s: any) => {
              const d = new Date((s.shift_date as string) + "T00:00:00");
              return {
                date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                day: d.toLocaleDateString("en-US", { weekday: "short" }),
                start: s.start_time as string,
                end: s.end_time as string,
                role: s.role as string,
                segment: s.segment as string,
              };
            });

          try {
            await enqueueAlertEmail({
              alertId: null,
              templateName: "shift-reminder",
              templateData: { recipient_name: name, location, shifts: shiftRows, reminder_for: reminderFor },
              recipients: [{ user_id: empId, email, display_name: name, role: "crew" as const }],
              category: "schedule",
              priority: "normal",
              subject:
                reminderFor === "today"
                  ? `You're on today — ${location}`
                  : `Shift tomorrow — ${location}`,
            });
            sent++;
          } catch (e) {
            console.error("shift-reminders: failed to enqueue for", empId, e);
          }
        }

        return new Response(JSON.stringify({ ok: true, sent, date: dateStr }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
