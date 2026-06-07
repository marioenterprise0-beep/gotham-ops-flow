import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireManager as requireManagerRole, requireOwner as requireOwnerRole, requireTabAccess } from "./auth-guards";

const ROLE = z.enum(["owner", "manager", "shift_lead", "grill", "prep", "cashier"]);
const SEGMENT = z.enum(["open", "mid", "close", "custom"]);

async function requireManager(supabase: any, userId: string) {
  await requireManagerRole(supabase, userId);
  await requireTabAccess(supabase, userId, "schedule", "edit");
}
async function requireOwner(supabase: any, userId: string) {
  await requireOwnerRole(supabase, userId);
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
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    trailerId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let shiftsQ = supabase.from("schedule_shifts").select("*")
      .eq("schedule_id", data.id).order("shift_date").order("start_time");
    // Include null-trailer shifts (e.g. generated coverage with no trailer scope)
    // alongside the scoped ones so they don't get hidden from the board.
    if (data.trailerId) shiftsQ = shiftsQ.or(`trailer_id.eq.${data.trailerId},trailer_id.is.null`);
    const [{ data: schedule, error: sErr }, { data: shifts, error: shErr }] = await Promise.all([
      supabase.from("schedules").select("*").eq("id", data.id).maybeSingle(),
      shiftsQ,
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

    // --- Alert wiring: notify owner on submit; resolve alerts on approve/revert/lock/publish ---
    try {
      if (data.action === "submit") {
        const { data: sched } = await supabase
          .from("schedules")
          .select("id, name, trailer_id, start_date, end_date")
          .eq("id", data.id)
          .maybeSingle();
        const { data: trailer } = sched?.trailer_id
          ? await supabase.from("trailers").select("name").eq("id", sched.trailer_id).maybeSingle()
          : { data: null as any };
        const trailerName = (trailer as any)?.name ?? "Company";
        const range = sched ? `${sched.start_date} → ${sched.end_date}` : "";
        // De-dupe: don't stack alerts if one is already pending for this schedule
        const { data: existing } = await supabase
          .from("alerts")
          .select("id")
          .eq("source_module", "schedule")
          .eq("source_id", data.id)
          .in("status", ["pending", "open"])
          .limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("alerts").insert({
            type: "schedule_approval",
            title: `Schedule submitted for approval — ${trailerName}`,
            description: `${(sched as any)?.name ?? "Schedule"} · ${range}`,
            source_module: "schedule",
            source_id: data.id,
            trailer_id: sched?.trailer_id ?? null,
            created_by: userId,
            assigned_role: "owner",
            priority: "high",
            status: "pending",
            payload: { schedule_id: data.id, action: "awaiting_owner_approval" },
          } as any);
        }
      } else if (["approve", "revert_draft", "lock", "publish"].includes(data.action)) {
        // Resolve any pending schedule_approval alerts for this schedule
        const resolution =
          data.action === "approve" ? "approved" :
          data.action === "revert_draft" ? "sent back to draft" :
          data.action === "lock" ? "locked" : "published";
        await supabase
          .from("alerts")
          .update({
            status: "resolved",
            resolved_at: now,
            resolved_by: userId,
            resolution: `Schedule ${resolution}${data.reason ? `: ${data.reason}` : ""}`,
          } as any)
          .eq("source_module", "schedule")
          .eq("source_id", data.id)
          .in("status", ["pending", "open"]);
      }
    } catch (e) {
      console.error("[schedule] alert wiring failed", e);
    }

    return { ok: true };
  });

export const listEmployees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trailerId: z.string().uuid().nullable().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let profilesQ = supabase.from("profiles").select("id, display_name, active, trailer_id").eq("active", true);
    if (data?.trailerId) profilesQ = profilesQ.eq("trailer_id", data.trailerId);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      profilesQ,
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
      targetHours: 40,
    }));
  });


// Find a schedule whose range overlaps the given week; create a draft if none.
export const getOrCreateScheduleForRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    startDate: z.string(),
    endDate: z.string(),
    name: z.string().min(1).max(120).optional(),
    autoCreate: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Pick the most recent overlapping schedule
    const { data: existing, error: e1 } = await supabase
      .from("schedules")
      .select("*")
      .lte("start_date", data.endDate)
      .gte("end_date", data.startDate)
      .order("created_at", { ascending: false })
      .limit(1);
    if (e1) throw new Error(e1.message);
    if (existing && existing.length > 0) return existing[0];
    if (!data.autoCreate) return null;
    await requireManager(supabase, userId);
    const name = data.name ?? `Week of ${data.startDate}`;
    const { data: row, error } = await supabase.from("schedules").insert({
      name, start_date: data.startDate, end_date: data.endDate, created_by: userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const duplicateShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    targetDate: z.string().optional(),
    targetEmployeeId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { data: src, error } = await supabase
      .from("schedule_shifts").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { id, created_at, updated_at, ...rest } = src as any;
    const insertRow = {
      ...rest,
      shift_date: data.targetDate ?? src.shift_date,
      employee_id: data.targetEmployeeId !== undefined ? data.targetEmployeeId : src.employee_id,
      created_by: userId,
    };
    const { data: saved, error: e2 } = await supabase
      .from("schedule_shifts").insert(insertRow).select("*").single();
    if (e2) throw new Error(e2.message);
    return saved;
  });

// Auto-coverage: for each day of the schedule, ensure one open/mid/close
// unassigned shift exists. Existing matching shifts are kept so the button
// is safe to click repeatedly without piling up duplicates.
export const generateCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scheduleId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { data: sched } = await supabase.from("schedules").select("*").eq("id", data.scheduleId).single();
    if (!sched) throw new Error("Schedule not found");
    if (sched.status === "locked" || sched.status === "published") throw new Error("Schedule is locked");
    const days: string[] = [];
    const start = new Date(sched.start_date + "T00:00:00");
    const end = new Date(sched.end_date + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().slice(0, 10));
    }
    const segs = [
      { segment: "open" as const, start_time: "09:00", end_time: "14:00", role: "prep" as const },
      { segment: "mid" as const, start_time: "11:00", end_time: "19:00", role: "cashier" as const },
      { segment: "close" as const, start_time: "16:00", end_time: "23:00", role: "grill" as const },
    ];

    // Skip combinations that already have an unassigned shift for the same
    // date + segment so repeat clicks don't create duplicates.
    const { data: existing } = await supabase
      .from("schedule_shifts")
      .select("shift_date, segment, employee_id")
      .eq("schedule_id", data.scheduleId)
      .is("employee_id", null);
    const taken = new Set<string>((existing ?? []).map((r: any) => `${r.shift_date}|${r.segment}`));

    const rows = days.flatMap((d) => segs
      .filter((s) => !taken.has(`${d}|${s.segment}`))
      .map((s) => ({
        schedule_id: data.scheduleId,
        employee_id: null,
        trailer_id: sched.trailer_id ?? null,
        role: s.role,
        segment: s.segment,
        shift_date: d,
        start_time: s.start_time,
        end_time: s.end_time,
        break_minutes: 30,
        created_by: userId,
      })));

    if (rows.length === 0) return { inserted: 0, skipped: days.length * segs.length };
    // upsert on the partial-unique index so concurrent clicks can't double-insert
    const { data: saved, error } = await supabase
      .from("schedule_shifts")
      .upsert(rows, { onConflict: "schedule_id,shift_date,segment", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    const inserted = saved?.length ?? 0;
    return { inserted, skipped: days.length * segs.length - inserted };
  });

