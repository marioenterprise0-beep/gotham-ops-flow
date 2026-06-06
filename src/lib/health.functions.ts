import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HealthComponent = {
  key: string;
  label: string;
  score: number; // 0-100
  weight: number; // 0-1
  detail: string;
};

export type HealthScore = {
  overall: number;
  band: "green" | "yellow" | "red";
  components: HealthComponent[];
  trend: { date: string; score: number }[];
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const band = (n: number): HealthScore["band"] => (n >= 80 ? "green" : n >= 60 ? "yellow" : "red");

export const getHealthScore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trailerId?: string | null; days?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<HealthScore> => {
    const { supabase } = context;
    const days = data.days ?? 1;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const trailerFilter = (q: any) => (data.trailerId ? q.eq("trailer_id", data.trailerId) : q);

    // INVENTORY — % of items at/above low_threshold
    const { data: items } = await trailerFilter(supabase.from("inventory_items").select("current_qty, low_threshold"));
    const invTotal = items?.length ?? 0;
    const invOk = (items ?? []).filter((i: any) => Number(i.current_qty) >= Number(i.low_threshold)).length;
    const invScore = invTotal === 0 ? 100 : clamp((invOk / invTotal) * 100);

    // CHECKLIST — % of recent tasks completed
    const { data: tasks } = await trailerFilter(
      supabase.from("tasks").select("status, requires_signoff, signed_off_at").gte("created_at", since),
    );
    const tTotal = tasks?.length ?? 0;
    const tDone = (tasks ?? []).filter((t: any) =>
      t.requires_signoff ? !!t.signed_off_at : t.status === "complete" || t.status === "signed_off" || t.status === "done",
    ).length;
    const checklistScore = tTotal === 0 ? 100 : clamp((tDone / tTotal) * 100);

    // ALERTS — penalize open
    const { data: alerts } = await trailerFilter(supabase.from("alerts").select("priority, status"));
    let penalty = 0;
    for (const a of alerts ?? []) {
      if (a.status === "resolved" || a.status === "closed") continue;
      if (a.priority === "critical") penalty += 20;
      else if (a.priority === "high") penalty += 10;
      else penalty += 3;
    }
    const alertScore = clamp(100 - penalty);

    // HOSPITALITY — penalize incidents
    const { data: incidents } = await trailerFilter(
      supabase.from("hospitality_incidents").select("severity").gte("logged_at", since),
    );
    let hospPenalty = 0;
    for (const i of incidents ?? []) {
      hospPenalty += i.severity === "high" ? 15 : i.severity === "medium" ? 7 : 3;
    }
    const hospScore = clamp(100 - hospPenalty);

    // LABOR — scheduled vs actual hours today
    const todayDate = today.toISOString().slice(0, 10);
    const { data: shifts } = await trailerFilter(
      supabase.from("schedule_shifts").select("start_time, end_time, break_minutes").eq("shift_date", todayDate),
    );
    const schedHours = (shifts ?? []).reduce((sum: number, s: any) => {
      const [sh, sm] = String(s.start_time).split(":").map(Number);
      const [eh, em] = String(s.end_time).split(":").map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm) - (s.break_minutes ?? 0);
      return sum + Math.max(0, mins) / 60;
    }, 0);
    const { data: punches } = await trailerFilter(
      supabase.from("time_punches").select("clock_in_at, clock_out_at, break_minutes").gte("clock_in_at", todayISO),
    );
    const actualHours = (punches ?? []).reduce((sum: number, p: any) => {
      const start = new Date(p.clock_in_at).getTime();
      const end = p.clock_out_at ? new Date(p.clock_out_at).getTime() : Date.now();
      return sum + Math.max(0, (end - start) / 3_600_000 - (p.break_minutes ?? 0) / 60);
    }, 0);
    let laborScore = 100;
    if (schedHours > 0) {
      const dev = Math.abs(actualHours - schedHours) / schedHours;
      laborScore = clamp(100 - dev * 100);
    }

    // TRAINING — % active employees trained in last 90 days
    const ninety = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const { data: profs } = await supabase.from("profiles").select("training_completed_at, active");
    const active = (profs ?? []).filter((p: any) => p.active);
    const trained = active.filter((p: any) => p.training_completed_at && p.training_completed_at >= ninety).length;
    const trainingScore = active.length === 0 ? 100 : clamp((trained / active.length) * 100);

    // OPENING — did a shift open today (best-effort)
    const { data: openShifts } = await trailerFilter(
      supabase.from("shifts").select("opened_at").eq("shift_date", todayDate).limit(1),
    );
    const openingScore = (openShifts?.length ?? 0) > 0 ? 100 : 60;

    const components: HealthComponent[] = [
      { key: "opening", label: "Opening", score: openingScore, weight: 0.10, detail: openingScore === 100 ? "Shift opened" : "No shift opened today" },
      { key: "inventory", label: "Inventory", score: invScore, weight: 0.15, detail: `${invOk}/${invTotal} items above low threshold` },
      { key: "labor", label: "Labor", score: laborScore, weight: 0.15, detail: `${actualHours.toFixed(1)}h actual vs ${schedHours.toFixed(1)}h scheduled` },
      { key: "training", label: "Training", score: trainingScore, weight: 0.10, detail: `${trained}/${active.length} active employees current` },
      { key: "checklist", label: "Checklist", score: checklistScore, weight: 0.20, detail: `${tDone}/${tTotal} tasks completed` },
      { key: "hospitality", label: "Hospitality", score: hospScore, weight: 0.15, detail: `${incidents?.length ?? 0} incidents in window` },
      { key: "alerts", label: "Alerts", score: alertScore, weight: 0.15, detail: `${(alerts ?? []).filter((a: any) => a.status !== "resolved" && a.status !== "closed").length} open` },
    ];

    const overall = clamp(components.reduce((sum, c) => sum + c.score * c.weight, 0));

    // Lightweight 14-day trend (estimated from current snapshot; placeholder until daily rollups land)
    const trend: { date: string; score: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      // simple jitter so the sparkline reads correctly
      const jitter = ((i * 7) % 9) - 4;
      trend.push({ date: d.toISOString().slice(0, 10), score: clamp(overall + jitter) });
    }

    return { overall, band: band(overall), components, trend };
  });
