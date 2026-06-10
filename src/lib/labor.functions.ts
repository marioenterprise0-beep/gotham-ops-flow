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

    let profilesQ = supabase.from("profiles").select("id, display_name, trailer_id, active").eq("active", true).is("archived_at", null);
    if (data.trailerId) profilesQ = profilesQ.eq("trailer_id", data.trailerId);
    const { data: profiles } = await profilesQ;
    const empIds = (profiles ?? []).map((p: any) => p.id);

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

    // Seed employee map from profiles so every scoped employee appears
    const empMap = new Map<string, { id: string; name: string; trailerId: string | null; scheduledMin: number; workedMin: number; flags: string[]; openPunch: boolean }>();
    for (const p of profiles ?? []) {
      empMap.set((p as any).id, {
        id: (p as any).id, name: (p as any).display_name ?? "Crew", trailerId: (p as any).trailer_id ?? null,
        scheduledMin: 0, workedMin: 0, flags: [], openPunch: false,
      });
    }
    const ensure = (id: string) => empMap.get(id);

    for (const s of shifts ?? []) {
      if (!s.employee_id) continue;
      const e = ensure(s.employee_id); if (!e) continue;
      const [sh, sm] = (s.start_time as string).split(":").map(Number);
      const [eh, em] = (s.end_time as string).split(":").map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm) - (s.break_minutes ?? 0);
      e.scheduledMin += Math.max(0, mins);
    }

    let openShifts = 0;
    for (const s of shifts ?? []) if (!s.employee_id) openShifts++;

    let missedClockOuts = 0;
    for (const p of punches ?? []) {
      const e = ensure(p.employee_id); if (!e) continue;
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
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId);
    const { data: row, error } = await supabase.from("time_corrections").update({
      status: data.decision,
      decided_by: userId,
      decided_at: new Date().toISOString(),
      decision_note: data.note ?? null,
    }).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);

    if (data.decision === "approved") {
      // Apply correction: create or update a punch
      if (row.punch_id && (row.requested_in || row.requested_out)) {
        const patch: any = { status: "edited", edited_by: userId, edited_at: new Date().toISOString() };
        if (row.requested_in) patch.clock_in_at = row.requested_in;
        if (row.requested_out) { patch.clock_out_at = row.requested_out; patch.status = "closed"; }
        await supabase.from("time_punches").update(patch).eq("id", row.punch_id);
      } else if (row.requested_in) {
        await supabase.from("time_punches").insert({
          employee_id: row.employee_id,
          trailer_id: row.trailer_id,
          schedule_shift_id: row.schedule_shift_id,
          clock_in_at: row.requested_in,
          clock_out_at: row.requested_out ?? null,
          status: row.requested_out ? "closed" : "open",
          edited_by: userId,
          edited_at: new Date().toISOString(),
        });
      }
    }
    await supabase.from("time_audit").insert({
      actor_id: userId, entity: "time_correction", entity_id: data.id,
      action: `decision_${data.decision}`, reason: data.note ?? null,
    });
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
    return row;
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
    let notesQ = supabase.from("shift_notes").select("*").order("created_at", { ascending: false }).limit(100);
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
    const enrich = (rows: any[]) => rows.map((r) => ({ ...r, employee_name: pmap.get(r.employee_id) ?? "Crew" }));
    return {
      corrections: enrich(corrections ?? []),
      timeoff: enrich(timeoff ?? []),
      notes: enrich(notes ?? []),
    };
  });
