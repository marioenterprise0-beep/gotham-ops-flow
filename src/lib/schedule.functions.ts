import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ROLE = z.enum(["owner", "manager", "shift_lead", "grill", "prep", "cashier"]);
const SEGMENT = z.enum(["open", "mid", "close", "custom"]);

async function requireManager(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_manager", { _user_id: userId });
  if (!data) throw new Error("Manager access required");
}
async function requireOwner(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Owner access required");
}

export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("schedules")
      .select("id, name, trailer_id, start_date, end_date, status, notes, locked_at, locked_by, lock_reason, published_at, approved_at, submitted_at, created_at")
      .order("start_date", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    name: z.string().min(1).max(120),
    trailerId: z.string().uuid().nullable().optional(),
    startDate: z.string(),
    endDate: z.string(),
    notes: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { data: row, error } = await supabase.from("schedules").insert({
      name: data.name,
      trailer_id: data.trailerId ?? null,
      start_date: data.startDate,
      end_date: data.endDate,
      notes: data.notes ?? null,
      created_by: userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "schedule_created", entity: "schedule", entity_id: row.id, payload: { name: data.name },
    });
    return row;
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId);
    const { error } = await supabase.from("schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "schedule_deleted", entity: "schedule", entity_id: data.id, payload: {},
    });
    return { ok: true };
  });

export const getSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [{ data: schedule, error: sErr }, { data: shifts, error: shErr }] = await Promise.all([
      supabase.from("schedules").select("*").eq("id", data.id).maybeSingle(),
      supabase.from("schedule_shifts").select("*").eq("schedule_id", data.id).order("shift_date").order("start_time"),
    ]);
    if (sErr) throw new Error(sErr.message);
    if (shErr) throw new Error(shErr.message);
    return { schedule, shifts: shifts ?? [] };
  });

export const upsertShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    scheduleId: z.string().uuid(),
    employeeId: z.string().uuid().nullable(),
    trailerId: z.string().uuid().nullable().optional(),
    role: ROLE,
    segment: SEGMENT,
    shiftDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    breakMinutes: z.number().int().min(0).max(240).default(30),
    notes: z.string().max(300).optional(),
    repeatWeekly: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { data: sched } = await supabase.from("schedules").select("status").eq("id", data.scheduleId).maybeSingle();
    if (sched?.status === "locked" || sched?.status === "published") {
      const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
      if (!isOwner) throw new Error("Schedule is locked");
    }
    const row = {
      schedule_id: data.scheduleId,
      employee_id: data.employeeId,
      trailer_id: data.trailerId ?? null,
      role: data.role,
      segment: data.segment,
      shift_date: data.shiftDate,
      start_time: data.startTime,
      end_time: data.endTime,
      break_minutes: data.breakMinutes,
      notes: data.notes ?? null,
      repeat_weekly: data.repeatWeekly,
      created_by: userId,
    };
    const q = data.id
      ? supabase.from("schedule_shifts").update(row).eq("id", data.id).select("*").single()
      : supabase.from("schedule_shifts").insert(row).select("*").single();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { error } = await supabase.from("schedule_shifts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const transitionSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    action: z.enum(["submit", "approve", "lock", "unlock", "publish", "revert_draft"]),
    reason: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
    await requireManager(supabase, userId);
    const now = new Date().toISOString();
    const patch: Record<string, any> = {};

    switch (data.action) {
      case "submit":
        patch.status = "submitted"; patch.submitted_by = userId; patch.submitted_at = now; break;
      case "approve":
        if (!isOwner) throw new Error("Only owners can approve");
        patch.status = "approved"; patch.approved_by = userId; patch.approved_at = now; break;
      case "lock":
        if (!isOwner) throw new Error("Only owners can lock");
        patch.status = "locked"; patch.locked_by = userId; patch.locked_at = now; patch.lock_reason = data.reason ?? null; break;
      case "unlock":
        if (!isOwner) throw new Error("Only owners can unlock");
        patch.status = "approved"; patch.locked_by = null; patch.locked_at = null; patch.lock_reason = null; break;
      case "publish":
        if (!isOwner) throw new Error("Only owners can publish");
        patch.status = "published"; patch.published_by = userId; patch.published_at = now; break;
      case "revert_draft":
        if (!isOwner) throw new Error("Only owners can revert");
        patch.status = "draft"; break;
    }
    const { error } = await supabase.from("schedules").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: `schedule_${data.action}`, entity: "schedule", entity_id: data.id, payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, active").eq("active", true),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get((r as any).user_id) ?? [];
      arr.push((r as any).role); roleMap.set((r as any).user_id, arr);
    }
    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      name: p.display_name ?? "Crew",
      roles: roleMap.get(p.id) ?? [],
    }));
  });
