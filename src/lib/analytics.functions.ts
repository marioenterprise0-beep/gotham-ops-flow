import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireManager } from "@/lib/auth-guards";
import { z } from "zod";

const RANGE = z.enum(["today", "week", "month"]);

function rangeBounds(range: "today" | "week" | "month", monthIso?: string | null) {
  // If an explicit month (YYYY-MM) is provided, return that whole calendar month.
  if (monthIso) {
    const [y, m] = monthIso.split("-").map((n) => parseInt(n, 10));
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999); // last day of month
    return { start, end };
  }
  const end = new Date();
  const start = new Date();
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(end.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function shortDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

export const getAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        range: RANGE.default("week"),
        trailerId: z.string().uuid().nullable().optional(),
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .nullable()
          .optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await requireManager(supabase, context.userId);
    const { start, end } = rangeBounds(data.range, data.month ?? null);
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const startDate = dayKey(start);
    const endDate = dayKey(end);

    // Build day buckets
    const days: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(dayKey(new Date(d)));
    }

    const trailerFilter = data.trailerId ?? null;

    // Tasks completion
    let tasksQ = supabase
      .from("tasks")
      .select("status, created_at, completed_at, trailer_id")
      .is("archived_at", null)
      .gte("created_at", startIso)
      .lte("created_at", endIso);
    if (trailerFilter) tasksQ = tasksQ.eq("trailer_id", trailerFilter);

    // Waste by item -> category
    let wasteQ = supabase
      .from("waste_log")
      .select("qty, item_id, logged_at, trailer_id")
      .is("archived_at", null)
      .gte("logged_at", startIso)
      .lte("logged_at", endIso);
    if (trailerFilter) wasteQ = wasteQ.eq("trailer_id", trailerFilter);

    // Inventory counts (variance)
    let countsQ = supabase
      .from("inventory_counts")
      .select("variance, expected_qty, counted_at, trailer_id")
      .is("archived_at", null)
      .gte("counted_at", startIso)
      .lte("counted_at", endIso);
    if (trailerFilter) countsQ = countsQ.eq("trailer_id", trailerFilter);

    // Hospitality incidents
    let hospQ = supabase
      .from("hospitality_incidents")
      .select("type, severity, logged_at, trailer_id")
      .is("archived_at", null)
      .gte("logged_at", startIso)
      .lte("logged_at", endIso);
    if (trailerFilter) hospQ = hospQ.eq("trailer_id", trailerFilter);

    // Shifts for opening time
    let shiftsQ = supabase
      .from("shifts")
      .select("opened_at, phase, status, shift_date, trailer_id")
      .is("archived_at", null)
      .gte("shift_date", startDate)
      .lte("shift_date", endDate);
    if (trailerFilter) shiftsQ = shiftsQ.eq("trailer_id", trailerFilter);

    const itemsQ = supabase
      .from("inventory_items")
      .select("id, category, cost_per_unit")
      .is("archived_at", null);

    const [
      { data: tasks },
      { data: waste },
      { data: counts },
      { data: hosp },
      { data: shifts },
      { data: items },
    ] = await Promise.all([tasksQ, wasteQ, countsQ, hospQ, shiftsQ, itemsQ]);

    // KPIs
    const totalTasks = tasks?.length ?? 0;
    const doneTasks = (tasks ?? []).filter(
      (t: any) => t.status === "done" || t.status === "signed_off",
    ).length;
    const taskCompPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const totalCounted = (counts ?? []).reduce(
      (s: number, c: any) => s + Number(c.expected_qty ?? 0),
      0,
    );
    const totalVar = (counts ?? []).reduce(
      (s: number, c: any) => s + Math.abs(Number(c.variance ?? 0)),
      0,
    );
    const invVarPct = totalCounted > 0 ? +((totalVar / totalCounted) * 100).toFixed(1) : 0;

    // Waste cost approximation
    const itemMap = new Map<string, { category: string; cost: number }>(
      (items ?? []).map((i: any) => [
        i.id,
        { category: i.category ?? "Other", cost: Number(i.cost_per_unit ?? 0) },
      ]),
    );
    const wasteCost = (waste ?? []).reduce((s: number, w: any) => {
      const it = itemMap.get(w.item_id);
      return s + Number(w.qty ?? 0) * (it?.cost ?? 0);
    }, 0);
    const wastePct =
      totalCounted > 0
        ? +((wasteCost / Math.max(1, totalCounted)) * 100).toFixed(1)
        : +wasteCost.toFixed(1);

    // Waste by category
    const wasteByCatMap = new Map<string, number>();
    for (const w of waste ?? []) {
      const it = itemMap.get((w as any).item_id);
      const cat = it?.category ?? "Other";
      wasteByCatMap.set(
        cat,
        (wasteByCatMap.get(cat) ?? 0) + Number((w as any).qty ?? 0) * (it?.cost ?? 1),
      );
    }
    const wasteByCat = Array.from(wasteByCatMap.entries()).map(([c, v]) => ({
      c,
      v: +v.toFixed(1),
    }));

    // Task completion trend per day
    const completedPerDay = new Map<string, { total: number; done: number }>();
    for (const d of days) completedPerDay.set(d, { total: 0, done: 0 });
    for (const t of tasks ?? []) {
      const key = dayKey(new Date((t as any).created_at));
      const bucket = completedPerDay.get(key);
      if (!bucket) continue;
      bucket.total += 1;
      if ((t as any).status === "done" || (t as any).status === "signed_off") bucket.done += 1;
    }
    const taskTrend = days.map((d) => {
      const b = completedPerDay.get(d)!;
      return { d: shortDay(d), v: b.total ? Math.round((b.done / b.total) * 100) : 0 };
    });

    // Opening time per day (minutes from shift_date 09:00 to opened_at for opening-phase shifts)
    const openingPerDay = new Map<string, number[]>();
    for (const d of days) openingPerDay.set(d, []);
    for (const s of shifts ?? []) {
      const sd = (s as any).shift_date as string;
      if (!openingPerDay.has(sd)) continue;
      const opened = new Date((s as any).opened_at);
      const target = new Date(sd + "T09:00:00");
      const min = Math.max(0, Math.round((opened.getTime() - target.getTime()) / 60000));
      if (min < 240) openingPerDay.get(sd)!.push(min);
    }
    const openingTrend = days.map((d) => {
      const arr = openingPerDay.get(d) ?? [];
      const avg = arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : 0;
      return { d: shortDay(d), v: avg };
    });

    // Hospitality breakdown by type
    const hospMap = new Map<string, { count: number; sev: number }>();
    for (const h of hosp ?? []) {
      const t = (h as any).type ?? "Other";
      const prev = hospMap.get(t) ?? { count: 0, sev: 0 };
      const sev = (h as any).severity === "high" ? 3 : (h as any).severity === "medium" ? 2 : 1;
      hospMap.set(t, { count: prev.count + 1, sev: prev.sev + sev });
    }
    const hospBreakdown = Array.from(hospMap.entries()).map(([c, { count, sev }]) => ({
      c,
      v: Math.max(0, 100 - Math.round((sev / Math.max(1, count)) * 25)),
    }));

    // Quality score: 100 - normalized incidents
    const incidentCount = hosp?.length ?? 0;
    const hospScore = Math.max(0, 100 - incidentCount * 3);

    // Opening / closing %: completed phase tasks (signed_off) / total in phase
    const phaseStats = (phase: "opening" | "closing") => {
      const subset = (tasks ?? []).filter(
        (t: any) => t.phase === phase || (phase === "opening" && !t.phase),
      );
      const total = subset.length;
      const done = subset.filter(
        (t: any) => t.status === "done" || t.status === "signed_off",
      ).length;
      return total ? Math.round((done / total) * 100) : 0;
    };

    return {
      range: data.range,
      startDate,
      endDate,
      kpis: {
        openingPct: phaseStats("opening"),
        closingPct: phaseStats("closing"),
        invVarPct,
        taskCompPct,
        wastePct,
        hospScore,
      },
      taskTrend,
      wasteByCat: wasteByCat.length ? wasteByCat : [{ c: "No data", v: 0 }],
      openingTrend,
      hospBreakdown: hospBreakdown.length ? hospBreakdown : [{ c: "No data", v: 0 }],
      totals: {
        tasks: totalTasks,
        wasteEntries: waste?.length ?? 0,
        countEntries: counts?.length ?? 0,
        incidents: incidentCount,
        shifts: shifts?.length ?? 0,
      },
    };
  });
