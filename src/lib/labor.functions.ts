import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireManager as requireManagerRole, requireOwner as requireOwnerRole, requireTabAccess } from "./auth-guards";

function weekStartOf(d: Date): string {
  const dt = new Date(d);
  const dow = dt.getDay();
  const back = (dow + 1) % 7;
  dt.setDate(dt.getDate() - back);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

async function requireManager(supabase: any, userId: string) {
  await requireManagerRole(supabase, userId);
  await requireTabAccess(supabase, userId, "labor", "edit");
}
async function requireOwner(supabase: any, userId: string) {
  await requireOwnerRole(supabase, userId);
}

export const getLaborDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    trailerId: z.string().uuid().nullable().optional(),
    weekStart: z.string().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);

    const ws = data.weekStart ?? weekStartOf(new Date());
    const start = new Date(ws + "T00:00:00");
    const end = new Date(start); end.setDate(end.getDate() + 7);

    // Always load all active profiles for display names; do NOT filter by
    // trailer here. We seed the employee map from actual shifts/punches in
    // scope so anyone scheduled or punched-in at this trailer shows up, even
    // if their profiles.trailer_id is null or assigned elsewhere.
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, trailer_id, active")
      .is("archived_at", null);
    const profMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

    let punchesQ = supabase.from("time_punches").select("*").is("archived_at", null)
      .gte("clock_in_at", start.toISOString())
      .lt("clock_in_at", end.toISOString());
    let shiftsQ = supabase.from("schedule_shifts").select("*, schedules!inner(archived_at)")
      .is("schedules.archived_at", null)
      .is("archived_at", null)
      .gte("shift_date", ws)
      .lt("shift_date", end.toISOString().slice(0, 10));
    let corrQ = supabase.from("time_corrections").select("*").is("archived_at", null).eq("status", "pending");
    let timeoffQ = supabase.from("time_off_requests").select("*").is("archived_at", null).eq("status", "pending");

    if (data.trailerId) {
      punchesQ = punchesQ.eq("trailer_id", data.trailerId);
      shiftsQ = shiftsQ.eq("trailer_id", data.trailerId);
      corrQ = corrQ.eq("trailer_id", data.trailerId);
      timeoffQ = timeoffQ.eq("trailer_id", data.trailerId);
    }

    const [{ data: punches }, { data: shifts }, { data: corrections }, { data: timeoff }] = await Promise.all([
      punchesQ, shiftsQ, corrQ, timeoffQ,
    ]);

    const empMap = new Map<string, { id: string; name: string; trailerId: string | null; scheduledMin: number; workedMin: number; flags: string[]; openPunch: boolean }>();
    const seedEmp = (id: string) => {
      if (!id || empMap.has(id)) return empMap.get(id);
      const p = profMap.get(id);
      const row = {
        id,
        name: p?.display_name ?? "Crew",
        trailerId: p?.trailer_id ?? null,
        scheduledMin: 0, workedMin: 0, flags: [] as string[], openPunch: false,
      };
      empMap.set(id, row);
      return row;
    };

    for (const s of shifts ?? []) {
      if (!s.employee_id) continue;
      const e = seedEmp(s.employee_id); if (!e) continue;
      const [sh, sm] = (s.start_time as string).split(":").map(Number);
      const [eh, em] = (s.end_time as string).split(":").map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins <= 0) mins += 24 * 60; // overnight
      mins -= (s.break_minutes ?? 0);
      e.scheduledMin += Math.max(0, mins);
    }

    let openShifts = 0;
    for (const s of shifts ?? []) if (!s.employee_id) openShifts++;

    let missedClockOuts = 0;
    for (const p of punches ?? []) {
      const e = seedEmp(p.employee_id); if (!e) continue;
      if (p.clock_out_at) {
        const diff = (new Date(p.clock_out_at).getTime() - new Date(p.clock_in_at).getTime()) / 60000;
        e.workedMin += Math.max(0, diff - (p.break_minutes ?? 0));
      } else {
        const ageH = (Date.now() - new Date(p.clock_in_at).getTime()) / 3600000;
        e.openPunch = true;
        if (ageH > 16) { missedClockOuts++; e.flags.push("missed_clock_out"); }
      }
    }

    const employees = Array.from(empMap.values()).map((e) => {
      const diff = e.workedMin - e.scheduledMin;
      if (e.workedMin > 40 * 60) e.flags.push("overtime");
      if (e.scheduledMin > 0 && e.workedMin === 0) e.flags.push("no_show");
      return { ...e, diffMin: diff };
    }).sort((a, b) => a.name.localeCompare(b.name));



    const totals = employees.reduce((acc, e) => ({
      scheduled: acc.scheduled + e.scheduledMin,
      worked: acc.worked + e.workedMin,
    }), { scheduled: 0, worked: 0 });

    return {
      weekStart: ws,
      totals,
      employees,
      openShifts,
      missedClockOuts,
      pendingCorrections: (corrections ?? []).length,
      pendingTimeOff: (timeoff ?? []).length,
      corrections: corrections ?? [],
      timeoff: timeoff ?? [],
    };
  });

export const getEmployeeWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    weekStart: z.string().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const ws = data.weekStart ?? weekStartOf(new Date());
    const start = new Date(ws + "T00:00:00");
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const [{ data: punches }, { data: shifts }, { data: notes }] = await Promise.all([
      supabase.from("time_punches").select("*").is("archived_at", null)
        .eq("employee_id", data.userId)
        .gte("clock_in_at", start.toISOString())
        .lt("clock_in_at", end.toISOString())
        .order("clock_in_at"),
      supabase.from("schedule_shifts").select("*, schedules!inner(archived_at)")
        .is("schedules.archived_at", null)
        .is("archived_at", null)
        .eq("employee_id", data.userId)
        .gte("shift_date", ws)
        .lt("shift_date", end.toISOString().slice(0, 10))
        .order("shift_date"),
      supabase.from("shift_notes").select("*")
        .is("archived_at", null)
        .eq("employee_id", data.userId)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false }),
    ]);
    return { punches: punches ?? [], shifts: shifts ?? [], notes: notes ?? [] };
  });

export const ownerEditPunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    punchId: z.string().uuid(),
    clockInAt: z.string().datetime().optional(),
    clockOutAt: z.string().datetime().nullable().optional(),
    breakMinutes: z.number().int().min(0).max(480).optional(),
    reason: z.string().min(3).max(500),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId);
    const patch: any = { edited_by: userId, edited_at: new Date().toISOString(), status: "edited" };
    if (data.clockInAt !== undefined) patch.clock_in_at = data.clockInAt;
    if (data.clockOutAt !== undefined) patch.clock_out_at = data.clockOutAt;
    if (data.breakMinutes !== undefined) patch.break_minutes = data.breakMinutes;
    if (data.clockOutAt) patch.status = "closed";
    const { data: row, error } = await supabase.from("time_punches").update(patch).eq("id", data.punchId).select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("time_audit").insert({
      actor_id: userId, entity: "time_punch", entity_id: data.punchId,
      action: "owner_edit", reason: data.reason, new_value: patch,
    });
    return row;
  });

export const decideCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    decision: z.enum(["approved", "declined", "info_requested"]),
    note: z.string().max(500).optional(),
    requestedIn: z.string().datetime().nullable().optional(),
    requestedOut: z.string().datetime().nullable().optional(),
    breakMinutes: z.number().int().min(0).max(480).nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId);

    // Allow the owner to adjust the requested punch values before approving.
    const updatePatch: any = {
      status: data.decision,
      decided_by: userId,
      decided_at: new Date().toISOString(),
      decision_note: data.note ?? null,
    };
    if (data.requestedIn !== undefined) updatePatch.requested_in = data.requestedIn;
    if (data.requestedOut !== undefined) updatePatch.requested_out = data.requestedOut;

    const { data: row, error } = await supabase.from("time_corrections")
      .update(updatePatch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);

    if (data.decision === "approved") {
      // Apply correction: create or update a punch
      if (row.punch_id && (row.requested_in || row.requested_out)) {
        const patch: any = { status: "edited", edited_by: userId, edited_at: new Date().toISOString() };
        if (row.requested_in) patch.clock_in_at = row.requested_in;
        if (row.requested_out) { patch.clock_out_at = row.requested_out; patch.status = "closed"; }
        if (data.breakMinutes != null) patch.break_minutes = data.breakMinutes;
        await supabase.from("time_punches").update(patch).eq("id", row.punch_id);
      } else if (row.requested_in) {
        await supabase.from("time_punches").insert({
          employee_id: row.employee_id,
          trailer_id: row.trailer_id,
          schedule_shift_id: row.schedule_shift_id,
          clock_in_at: row.requested_in,
          clock_out_at: row.requested_out ?? null,
          status: row.requested_out ? "closed" : "open",
          break_minutes: data.breakMinutes ?? 0,
          edited_by: userId,
          edited_at: new Date().toISOString(),
        });
      }
    }
    await supabase.from("time_audit").insert({
      actor_id: userId, entity: "time_correction", entity_id: data.id,
      action: `decision_${data.decision}`, reason: data.note ?? null,
    });

    // info_requested has no matching email template (not approved, not
    // declined) — only notify the employee on a real decision.
    if (data.decision === "approved" || data.decision === "declined") {
      const { data: decider } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      const approvedValue = [
        row.requested_in ? `In: ${new Date(row.requested_in).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : null,
        row.requested_out ? `Out: ${new Date(row.requested_out).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : null,
      ].filter(Boolean).join(" · ");
      await supabase.from("alerts").insert({
        type: "time_adjustment_decided",
        title: `Time adjustment ${data.decision} — ${row.for_date}`,
        description: data.note ?? null,
        source_module: "time_corrections",
        source_id: row.id,
        trailer_id: row.trailer_id,
        created_by: userId,
        assigned_user_id: row.employee_id,
        assigned_role: "manager",
        priority: "normal",
        status: "pending",
        payload: {
          decision: data.decision,
          shift_date: row.for_date,
          approved_value: approvedValue || undefined,
          decision_reason: data.note ?? null,
          decided_by_name: decider?.display_name ?? "Management",
          punch_id: row.punch_id ?? undefined,
        },
      } as any);
    }

    return row;
  });

export const decideTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    decision: z.enum(["approved", "declined", "info_requested"]),
    note: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId);
    const { data: row, error } = await supabase.from("time_off_requests").update({
      status: data.decision,
      decided_by: userId,
      decided_at: new Date().toISOString(),
      decision_note: data.note ?? null,
    }).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("time_audit").insert({
      actor_id: userId, entity: "time_off", entity_id: data.id,
      action: `decision_${data.decision}`, reason: data.note ?? null,
    });

    // info_requested has no matching email template (not approved, not
    // declined) — only notify the employee on a real decision.
    if (data.decision === "approved" || data.decision === "declined") {
      const { data: decider } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      await supabase.from("alerts").insert({
        type: "time_off_decided",
        title: `Time off ${data.decision} — ${row.start_date}`,
        description: data.note ?? null,
        source_module: "time_off",
        source_id: row.id,
        trailer_id: row.trailer_id,
        created_by: userId,
        assigned_user_id: row.employee_id,
        assigned_role: "manager",
        priority: "normal",
        status: "pending",
        payload: {
          decision: data.decision,
          start_date: row.start_date,
          end_date: row.end_date,
          decision_reason: data.note ?? null,
          decided_by_name: decider?.display_name ?? "Management",
        },
      } as any);
    }
    return row;
  });

export const getPayrollDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ weekStart: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId);
    const weekEnd = new Date(data.weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const endStr = weekEnd.toISOString().slice(0, 10) + "T23:59:59";
    const [{ data: punches }, { data: profiles }] = await Promise.all([
      supabase.from("time_punches")
        .select("id, employee_id, clock_in_at, clock_out_at, break_minutes, status, device_info")
        .is("archived_at", null)
        .gte("clock_in_at", data.weekStart + "T00:00:00")
        .lte("clock_in_at", endStr)
        .order("clock_in_at", { ascending: true }),
      supabase.from("profiles").select("id, display_name"),
    ]);
    const pmap = new Map<string, string>((profiles ?? []).map((p: any) => [p.id, p.display_name ?? "Crew"]));
    const empMap = new Map<string, any[]>();
    for (const punch of punches ?? []) {
      const eid = punch.employee_id;
      if (!empMap.has(eid)) empMap.set(eid, []);
      empMap.get(eid)!.push(punch);
    }
    return {
      weekStart: data.weekStart,
      employees: Array.from(empMap.entries()).map(([id, ps]) => ({ id, name: pmap.get(id) ?? "Crew", punches: ps })),
    };
  });

export const listAllRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    trailerId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);

    let corrQ = supabase.from("time_corrections").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(100);
    let toQ = supabase.from("time_off_requests").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(100);
    let notesQ = supabase.from("shift_notes").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(100);
    if (data.trailerId) {
      corrQ = corrQ.eq("trailer_id", data.trailerId);
      toQ = toQ.eq("trailer_id", data.trailerId);
      notesQ = notesQ.eq("trailer_id", data.trailerId);
    }
    const [{ data: corrections }, { data: timeoff }, { data: notes }, { data: profiles }] = await Promise.all([
      corrQ, toQ, notesQ,
      supabase.from("profiles").select("id, display_name"),
    ]);
    const pmap = new Map<string, string>((profiles ?? []).map((p: any) => [p.id, p.display_name ?? "Crew"]));

    // Fetch current punch snapshots so the review UI can show what's on record
    // vs what the employee is requesting.
    const punchIds = (corrections ?? []).map((c: any) => c.punch_id).filter(Boolean) as string[];
    const punchMap = new Map<string, any>();
    if (punchIds.length > 0) {
      const { data: punches } = await supabase
        .from("time_punches")
        .select("id, clock_in_at, clock_out_at, break_minutes, status")
        .in("id", punchIds);
      for (const p of punches ?? []) punchMap.set((p as any).id, p);
    }

    const enrich = (rows: any[]) => rows.map((r) => ({ ...r, employee_name: pmap.get(r.employee_id) ?? "Crew" }));
    const enrichCorrections = (rows: any[]) => rows.map((r) => ({
      ...r,
      employee_name: pmap.get(r.employee_id) ?? "Crew",
      current_punch: r.punch_id ? (punchMap.get(r.punch_id) ?? null) : null,
    }));
    return {
      corrections: enrichCorrections(corrections ?? []),
      timeoff: enrich(timeoff ?? []),
      notes: enrich(notes ?? []),
    };
  });
