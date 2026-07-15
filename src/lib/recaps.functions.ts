import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireTabAccess } from "./auth-guards";
import { enqueueAlertEmail } from "@/lib/email/enqueue.server";
import { getOwners } from "@/lib/email/recipients.server";

async function getRoles(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role as string);
  return {
    isOwner: roles.includes("owner"),
    isManager: roles.includes("owner") || roles.includes("manager"),
  };
}

const RECAP_FIELDS = {
  recapDate: z.string().optional(),
  shiftId: z.string().uuid().nullable().optional(),
  trailerId: z.string().uuid().nullable().optional(),
  location: z.string().max(120).optional().nullable(),
  shiftScore: z.number().int().min(1).max(10).optional().nullable(),
  crew: z.array(z.object({ id: z.string().optional(), name: z.string() })).optional(),
  kind: z.enum(["crew", "manager"]).optional(),
  crewSummary: z.string().max(4000).optional().nullable(),
  opsWentWell: z.string().max(4000).optional().nullable(),
  opsSlowed: z.string().max(4000).optional().nullable(),
  opsAttention: z.string().max(4000).optional().nullable(),
  invLowStock: z.string().max(4000).optional().nullable(),
  invConcerns: z.string().max(4000).optional().nullable(),
  invOrders: z.string().max(4000).optional().nullable(),
  laborAttendance: z.string().max(4000).optional().nullable(),
  laborStaffing: z.string().max(4000).optional().nullable(),
  laborPerformance: z.string().max(4000).optional().nullable(),
  hospFeedback: z.string().max(4000).optional().nullable(),
  hospWins: z.string().max(4000).optional().nullable(),
  hospComplaints: z.string().max(4000).optional().nullable(),
  nextShiftNotes: z.string().max(4000).optional().nullable(),
};

function toRow(d: any, managerId: string) {
  return {
    manager_id: managerId,
    recap_date: d.recapDate ?? new Date().toISOString().slice(0, 10),
    shift_id: d.shiftId ?? null,
    trailer_id: d.trailerId ?? null,
    location: d.location ?? null,
    shift_score: d.shiftScore ?? null,
    crew: d.crew ?? [],
    kind: d.kind ?? "manager",
    crew_summary: d.crewSummary ?? null,
    ops_went_well: d.opsWentWell ?? null,
    ops_slowed: d.opsSlowed ?? null,
    ops_attention: d.opsAttention ?? null,
    inv_low_stock: d.invLowStock ?? null,
    inv_concerns: d.invConcerns ?? null,
    inv_orders: d.invOrders ?? null,
    labor_attendance: d.laborAttendance ?? null,
    labor_staffing: d.laborStaffing ?? null,
    labor_performance: d.laborPerformance ?? null,
    hosp_feedback: d.hospFeedback ?? null,
    hosp_wins: d.hospWins ?? null,
    hosp_complaints: d.hospComplaints ?? null,
    next_shift_notes: d.nextShiftNotes ?? null,
  };
}

export const saveRecap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        submit: z.boolean().optional(),
        ...RECAP_FIELDS,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Any authenticated employee can save their own recap.
    // tab access check applies to manager-grade recaps; crew recaps are always allowed.
    if ((data.kind ?? "manager") === "manager") {
      const { isManager } = await getRoles(supabase, userId);
      if (isManager) await requireTabAccess(supabase, userId, "recaps", "edit");
    }

    const row = toRow(data, userId);

    if (data.id) {
      const update: any = { ...row };
      if (data.submit) update.status = "submitted";
      const { data: rec, error } = await supabase
        .from("daily_recaps")
        .update(update)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      if (data.submit) await sendNightSummaryEmail(supabase, userId, rec).catch(() => null);
      return rec;
    } else {
      const insert: any = { ...row, status: "draft" };
      const { data: created, error } = await supabase
        .from("daily_recaps")
        .insert(insert)
        .select()
        .single();
      if (error) throw new Error(error.message);
      if (data.submit) {
        const { data: subm, error: e2 } = await supabase
          .from("daily_recaps")
          .update({ status: "submitted" })
          .eq("id", created.id)
          .select()
          .single();
        if (e2) throw new Error(e2.message);
        await sendNightSummaryEmail(supabase, userId, subm).catch(() => null);
        return subm;
      }
      return created;
    }
  });

export const listRecaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        scope: z.enum(["mine", "today", "pending", "all"]).default("all"),
        trailerId: z.string().uuid().nullable().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        includeArchived: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isOwner, isManager } = await getRoles(supabase, userId);
    let q = supabase
      .from("daily_recaps")
      .select(
        "id, recap_date, manager_id, trailer_id, location, shift_score, status, kind, crew_summary, submitted_at, reviewed_at, reviewed_by, owner_comment, created_at, archived_at, archived_by, archive_reason",
      )
      .order("recap_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data.includeArchived) q = q.is("archived_at", null);

    // Role scoping: crew sees only own; manager sees own trailer; owner sees all.
    if (!isOwner && !isManager) {
      q = q.eq("manager_id", userId);
    } else if (!isOwner && isManager) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("trailer_id")
        .eq("id", userId)
        .maybeSingle();
      if (prof?.trailer_id) q = q.eq("trailer_id", prof.trailer_id);
    }

    if (data.scope === "mine") q = q.eq("manager_id", userId);
    if (data.scope === "today") q = q.eq("recap_date", new Date().toISOString().slice(0, 10));
    if (data.scope === "pending") q = q.eq("status", "submitted");
    if (data.trailerId) q = q.eq("trailer_id", data.trailerId);
    if (data.from) q = q.gte("recap_date", data.from);
    if (data.to) q = q.lte("recap_date", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Attach manager names
    const managerIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.manager_id).filter(Boolean)),
    );
    let nameMap: Record<string, string> = {};
    if (managerIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", managerIds);
      nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name]));
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      manager_name: nameMap[r.manager_id] ?? "Manager",
    }));
  });

export const getRecap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: r, error } = await supabase
      .from("daily_recaps")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    let manager_name = "Manager";
    if (r.manager_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", r.manager_id)
        .maybeSingle();
      manager_name = (p as any)?.display_name ?? manager_name;
    }
    return { ...r, manager_name };
  });

async function sendNightSummaryEmail(supabase: any, managerId: string, recap: any) {
  const owners = await getOwners();
  if (!owners.length) return;

  // Gather labor hours for this recap date
  const dateStart = `${recap.recap_date}T00:00:00`;
  const dateEnd = `${recap.recap_date}T23:59:59`;
  const [{ data: punches }, { data: cashSessions }, { data: critAlerts }, { data: trailer }] =
    await Promise.all([
      supabase
        .from("time_punches")
        .select("clock_in_at, clock_out_at, break_minutes")
        .is("archived_at", null)
        .gte("clock_in_at", dateStart)
        .lte("clock_in_at", dateEnd)
        .not("clock_out_at", "is", null),
      supabase
        .from("cash_drawer_sessions")
        .select("variance")
        .gte("closed_at", dateStart)
        .lte("closed_at", dateEnd)
        .not("closed_at", "is", null),
      supabase
        .from("alerts")
        .select("id")
        .eq("priority", "critical")
        .eq("status", "open")
        .is("archived_at", null),
      recap.trailer_id
        ? supabase.from("trailers").select("name").eq("id", recap.trailer_id).maybeSingle()
        : { data: null },
    ]);

  let workedMin = 0;
  let crewCount = 0;
  const empSet = new Set<string>();
  for (const p of punches ?? []) {
    if (!p.clock_out_at) continue;
    const diff = (new Date(p.clock_out_at).getTime() - new Date(p.clock_in_at).getTime()) / 60000;
    workedMin += Math.max(0, diff - (p.break_minutes ?? 0));
    if ((p as any).employee_id) empSet.add((p as any).employee_id);
  }
  crewCount = empSet.size || (punches ?? []).length;

  const totalVariance = (cashSessions ?? []).reduce(
    (sum: number, s: any) => sum + Number(s.variance ?? 0),
    0,
  );
  const varStr = (totalVariance >= 0 ? "+" : "") + `$${Math.abs(totalVariance).toFixed(2)}`;
  const hoursStr = `${(workedMin / 60).toFixed(1)}h`;
  const trailerName = (trailer?.data as any)?.name ?? "Dip N Shake";

  let managerName = "Manager";
  if (managerId) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", managerId)
      .maybeSingle();
    managerName = (prof as any)?.display_name ?? managerName;
  }

  await enqueueAlertEmail({
    alertId: null,
    templateName: "night-summary",
    templateData: {
      trailer_name: trailerName,
      shift_date: recap.recap_date,
      shift_score: recap.shift_score ?? null,
      total_hours: hoursStr,
      cash_variance: varStr,
      critical_alerts: (critAlerts ?? []).length,
      crew_count: crewCount || "—",
      highlights: recap.ops_went_well ?? recap.crew_summary ?? null,
    },
    recipients: owners,
    category: "operations",
    priority: "normal",
    subject: `Night summary — ${trailerName} · ${recap.recap_date}`,
    sourceModule: "recaps",
    sourceId: recap.id,
  });
}

export const reviewRecap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["review", "archive"]),
        comment: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isOwner } = await getRoles(supabase, userId);
    if (!isOwner) throw new Error("Owner role required");
    const status = data.action === "archive" ? "archived" : "reviewed";
    const { error } = await supabase
      .from("daily_recaps")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        owner_comment: data.comment ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
