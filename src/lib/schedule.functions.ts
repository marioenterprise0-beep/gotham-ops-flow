import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { z } from "zod";
import {
  requireManager as requireManagerRole,
  requireOwner as requireOwnerRole,
  requireTabAccess,
} from "./auth-guards";
import { DEFAULT_TRAILER_TZ, zonedDateToUtcISO } from "./timezone";

const ROLE = z.enum(["owner", "manager", "shift_lead", "grill", "prep", "cashier"]);
const SEGMENT = z.enum(["open", "mid", "close", "custom"]);
const MS_PER_DAY = 86_400_000;

function isoToDay(iso: string) {
  return Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / MS_PER_DAY);
}

function dayToIso(day: number) {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number) {
  return dayToIso(isoToDay(iso) + days);
}

function effectiveScheduleWindow(row: { start_date: string; end_date: string }) {
  const startDay = isoToDay(row.start_date);
  const endDay = isoToDay(row.end_date);
  const startsOnSunday = new Date(`${row.start_date}T00:00:00Z`).getUTCDay() === 0;
  // Existing schedules were originally created Sun→Sat. The UI is now Mon→Sun,
  // so treat those legacy rows as the Mon→Sun week that follows their stored
  // Sunday start. Newer Monday-start schedules use their stored dates as-is.
  if (startsOnSunday && endDay - startDay === 6) {
    return { start_date: addDaysIso(row.start_date, 1), end_date: addDaysIso(row.end_date, 1) };
  }
  return { start_date: row.start_date, end_date: row.end_date };
}

function scheduleCoversDate(row: { start_date: string; end_date: string }, iso: string) {
  const win = effectiveScheduleWindow(row);
  return iso >= win.start_date && iso <= win.end_date;
}

function overlapDays(
  row: { start_date: string; end_date: string },
  reqStart: string,
  reqEnd: string,
) {
  const win = effectiveScheduleWindow(row);
  const start = Math.max(isoToDay(reqStart), isoToDay(win.start_date));
  const end = Math.min(isoToDay(reqEnd), isoToDay(win.end_date));
  return Math.max(0, end - start + 1);
}

async function requireManager(supabase: any, userId: string, orgId: string) {
  await requireManagerRole(supabase, userId, orgId);
  await requireTabAccess(supabase, userId, orgId, "schedule", "edit");
}
async function requireOwner(supabase: any, userId: string, orgId: string) {
  await requireOwnerRole(supabase, userId, orgId);
}

export const listSchedules = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ includeArchived: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("schedules")
      .select(
        "id, name, trailer_id, start_date, end_date, status, notes, locked_at, locked_by, lock_reason, published_at, approved_at, submitted_at, created_at, archived_at, archived_by, archive_reason",
      )
      .order("start_date", { ascending: false })
      .limit(50);
    if (!data.includeArchived) q = q.is("archived_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Scan downstream dependencies before archiving/deleting a schedule.
export const scanScheduleDependencies = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [shifts, sched] = await Promise.all([
      supabase
        .from("schedule_shifts")
        .select("id")
        .eq("schedule_id", data.id)
        .is("archived_at", null),
      supabase
        .from("schedules")
        .select("trailer_id, start_date, end_date, status")
        .eq("id", data.id)
        .maybeSingle(),
    ]);
    let punchCount = 0;
    if (sched.data?.start_date && sched.data?.end_date) {
      const { count } = await supabase
        .from("time_punches")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .gte("clock_in_at", `${sched.data.start_date}T00:00:00`)
        .lte("clock_in_at", `${sched.data.end_date}T23:59:59`);
      punchCount = count ?? 0;
    }
    const shiftCount = shifts.data?.length ?? 0;
    return {
      shifts: shiftCount,
      punches: punchCount,
      total: shiftCount + punchCount,
      hasDependencies: shiftCount > 0 || punchCount > 0,
      status: sched.data?.status ?? null,
    };
  });

export const archiveSchedule = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { error } = await supabase
      .from("schedules")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId,
        archive_reason: data.reason ?? null,
      } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "schedule_archived",
      entity: "schedule",
      entity_id: data.id,
      payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreSchedule = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId, context.activeOrgId);
    const { error } = await supabase
      .from("schedules")
      .update({
        archived_at: null,
        archived_by: null,
        archive_reason: null,
      } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "schedule_restored",
      entity: "schedule",
      entity_id: data.id,
      payload: {},
    });
    return { ok: true };
  });

export const createSchedule = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(120),
        trailerId: z.string().uuid().nullable().optional(),
        startDate: z.string(),
        endDate: z.string(),
        notes: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { data: row, error } = await supabase
      .from("schedules")
      .insert({
        name: data.name,
        trailer_id: data.trailerId ?? null,
        start_date: data.startDate,
        end_date: data.endDate,
        notes: data.notes ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "schedule_created",
      entity: "schedule",
      entity_id: row.id,
      payload: { name: data.name },
    });
    return row;
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), force: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId, context.activeOrgId);
    if (!data.force) {
      const [{ data: shifts }, { data: sched }] = await Promise.all([
        supabase
          .from("schedule_shifts")
          .select("id")
          .eq("schedule_id", data.id)
          .is("archived_at", null)
          .limit(1),
        supabase.from("schedules").select("start_date, end_date").eq("id", data.id).maybeSingle(),
      ]);
      let punches = 0;
      if (sched?.start_date && sched?.end_date) {
        const { count } = await supabase
          .from("time_punches")
          .select("id", { count: "exact", head: true })
          .is("archived_at", null)
          .gte("clock_in_at", `${sched.start_date}T00:00:00`)
          .lte("clock_in_at", `${sched.end_date}T23:59:59`);
        punches = count ?? 0;
      }
      if ((shifts?.length ?? 0) > 0 || punches > 0) {
        const err: any = new Error("HAS_DEPENDENCIES");
        err.code = "HAS_DEPENDENCIES";
        err.dependencies = { shifts: shifts?.length ?? 0, punches };
        throw err;
      }
    }
    const { error } = await supabase.from("schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "schedule_deleted",
      entity: "schedule",
      entity_id: data.id,
      payload: { force: data.force },
    });
    return { ok: true };
  });

export const getSchedule = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        trailerId: z.string().uuid().nullable().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    // Managers/owners see the full grid (including shifts assigned to other
    // owners or to disabled employees) so they can audit and clean up.
    // Crew get the filtered view so old/owner records never leak into theirs.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isPrivileged = (callerRoles ?? []).some(
      (r: any) => r.role === "owner" || r.role === "manager",
    );

    const { data: schedule, error: sErr } = await supabase
      .from("schedules")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);

    // Keep the board tied to the selected schedule. Legacy Sun→Sat schedules
    // are treated as Mon→Sun in the write/copy logic, so their Sunday rows stay
    // with this schedule instead of being pulled from an adjacent draft.
    let shiftsQ = supabase
      .from("schedule_shifts")
      .select("*")
      .eq("schedule_id", data.id)
      .is("archived_at", null);
    if (data.startDate && data.endDate) {
      shiftsQ = shiftsQ.gte("shift_date", data.startDate).lte("shift_date", data.endDate);
    }
    shiftsQ = shiftsQ.order("shift_date").order("start_time");

    const [{ data: shiftsRaw, error: shErr }, ownerRolesRes, hiddenProfilesRes] = await Promise.all(
      [
        shiftsQ,
        isPrivileged
          ? Promise.resolve({ data: [] as Array<{ user_id: string }> })
          : supabaseAdmin.from("user_roles").select("user_id").eq("role", "owner"),
        isPrivileged
          ? Promise.resolve({ data: [] as Array<{ id: string }> })
          : supabaseAdmin
              .from("profiles")
              .select("id")
              .or("active.eq.false,archived_at.not.is.null"),
      ],
    );
    if (shErr) throw new Error(shErr.message);
    const hiddenIds = new Set<string>([
      ...(((ownerRolesRes as any).data ?? []) as any[]).map((r) => r.user_id),
      ...(((hiddenProfilesRes as any).data ?? []) as any[]).map((p) => p.id),
    ]);
    const shifts = isPrivileged
      ? (shiftsRaw ?? [])
      : (shiftsRaw ?? []).filter((s: any) => !s.employee_id || !hiddenIds.has(s.employee_id));

    // Pull punches in the schedule window so the grid can show actual clocked hours
    // alongside scheduled hours per employee. The window is anchored to the
    // trailer's local timezone so the same day boundaries are used regardless
    // of where the viewer's device is.
    let punches: Array<{
      employee_id: string;
      clock_in_at: string;
      clock_out_at: string | null;
      break_minutes: number | null;
    }> = [];
    let timezone: string = DEFAULT_TRAILER_TZ;
    if (schedule?.trailer_id) {
      const { data: tr } = await supabase
        .from("trailers")
        .select("timezone")
        .eq("id", schedule.trailer_id)
        .maybeSingle();
      if (tr?.timezone) timezone = tr.timezone as string;
    }
    const visibleStart = data.startDate ?? (schedule?.start_date as string | undefined);
    const visibleEnd = data.endDate ?? (schedule?.end_date as string | undefined);
    if (visibleStart && visibleEnd) {
      const startISO = zonedDateToUtcISO(visibleStart, timezone, false);
      const endISO = zonedDateToUtcISO(visibleEnd, timezone, true);
      const { data: pRows } = await supabase
        .from("time_punches")
        .select("employee_id, clock_in_at, clock_out_at, break_minutes")
        .is("archived_at", null)
        .gte("clock_in_at", startISO)
        .lte("clock_in_at", endISO);
      punches = (pRows ?? []) as typeof punches;
    }
    return { schedule, shifts, punches, timezone };
  });

export const upsertShift = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
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
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { data: sched } = await supabase
      .from("schedules")
      .select("status, start_date, end_date")
      .eq("id", data.scheduleId)
      .maybeSingle();
    if (sched?.status === "locked" || sched?.status === "published") {
      throw new Error("Schedule is locked — unlock it before making changes");
    }
    let targetScheduleId = data.scheduleId;
    if (sched && !scheduleCoversDate(sched as any, data.shiftDate)) {
      let candidatesQ = supabase
        .from("schedules")
        .select("id, status, trailer_id, start_date, end_date, created_at")
        .is("archived_at", null)
        .lte("start_date", data.shiftDate)
        .gte("end_date", addDaysIso(data.shiftDate, -1));
      if (data.trailerId) {
        candidatesQ = candidatesQ.or(`trailer_id.eq.${data.trailerId},trailer_id.is.null`);
      }
      const { data: candidateSchedules, error: destErr } = await candidatesQ;
      if (destErr) throw new Error(destErr.message);
      const destSchedule = ((candidateSchedules ?? []) as any[])
        .filter((row) => scheduleCoversDate(row, data.shiftDate))
        .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
      if (!destSchedule) {
        throw new Error("No schedule covers that date. Open or create that week's schedule first.");
      }
      if (destSchedule?.status === "locked" || destSchedule?.status === "published") {
        throw new Error(
          "Target week's schedule is locked — unlock it before making changes there.",
        );
      }
      targetScheduleId = destSchedule.id;
    }

    const shiftId = data.id ?? crypto.randomUUID();
    const row = {
      schedule_id: targetScheduleId,
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
    const q = supabase
      .from("schedule_shifts")
      .upsert({ id: shiftId, ...row }, { onConflict: "id" })
      .select("*")
      .maybeSingle();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    if (saved) return saved;
    // RLS may hide the RETURNING row even though the write succeeded — re-fetch.
    const { data: refetched } = await supabase
      .from("schedule_shifts")
      .select("*")
      .eq("id", shiftId)
      .maybeSingle();
    if (refetched) return refetched;
    return { id: shiftId, ...row };
  });

export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { data: existing } = await supabase
      .from("schedule_shifts")
      .select("schedule_id, schedules!inner(status)")
      .eq("id", data.id)
      .maybeSingle();
    const st = (existing as any)?.schedules?.status;
    if (st === "locked" || st === "published") {
      throw new Error("Schedule is locked — unlock it before making changes");
    }
    const { error } = await supabase.from("schedule_shifts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const transitionSchedule = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["submit", "approve", "lock", "unlock", "publish", "revert_draft"]),
        reason: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
    await requireManager(supabase, userId, context.activeOrgId);
    const now = new Date().toISOString();
    const patch: Record<string, any> = {};

    switch (data.action) {
      case "submit":
        patch.status = "submitted";
        patch.submitted_by = userId;
        patch.submitted_at = now;
        break;
      case "approve":
        if (!isOwner) throw new Error("Only owners can approve");
        patch.status = "approved";
        patch.approved_by = userId;
        patch.approved_at = now;
        break;
      case "lock":
        if (!isOwner) throw new Error("Only owners can lock");
        patch.status = "locked";
        patch.locked_by = userId;
        patch.locked_at = now;
        patch.lock_reason = data.reason ?? null;
        break;
      case "unlock":
        if (!isOwner) throw new Error("Only owners can unlock");
        patch.status = "approved";
        patch.locked_by = null;
        patch.locked_at = null;
        patch.lock_reason = null;
        break;
      case "publish":
        if (!isOwner) throw new Error("Only owners can publish");
        patch.status = "published";
        patch.published_by = userId;
        patch.published_at = now;
        break;
      case "revert_draft":
        if (!isOwner) throw new Error("Only owners can revert");
        patch.status = "draft";
        break;
    }
    const { error } = await supabase
      .from("schedules")
      .update(patch as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: `schedule_${data.action}`,
      entity: "schedule",
      entity_id: data.id,
      payload: { reason: data.reason ?? null },
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
          data.action === "approve"
            ? "approved"
            : data.action === "revert_draft"
              ? "sent back to draft"
              : data.action === "lock"
                ? "locked"
                : "published";
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

    // On lock: email every assigned employee their personal shifts
    if (data.action === "lock") {
      try {
        const { enqueueAlertEmail } = await import("@/lib/email/enqueue.server");
        const { data: sched } = await supabase
          .from("schedules")
          .select("name, start_date, end_date, trailer_id")
          .eq("id", data.id)
          .maybeSingle();
        const { data: trailer } = sched?.trailer_id
          ? await supabase.from("trailers").select("name").eq("id", sched.trailer_id).maybeSingle()
          : { data: null as any };
        const location = (trailer as any)?.name ?? "Dip N Shake";
        const weekRange = sched ? `${sched.start_date} – ${sched.end_date}` : "";

        const { data: lockedByProfile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", userId)
          .maybeSingle();
        const lockedByName = (lockedByProfile as any)?.display_name ?? "Manager";

        const { data: shifts } = await supabase
          .from("schedule_shifts")
          .select("employee_id, shift_date, start_time, end_time, role")
          .eq("schedule_id", data.id)
          .not("employee_id", "is", null)
          .is("archived_at", null);

        if (shifts && shifts.length > 0) {
          const empMap = new Map<string, any[]>();
          for (const s of shifts as any[]) {
            const arr = empMap.get(s.employee_id) ?? [];
            arr.push(s);
            empMap.set(s.employee_id, arr);
          }
          const empIds = Array.from(empMap.keys());
          // Use admin client to read emails (bypasses RLS on profiles.email)
          const { createClient } = await import("@supabase/supabase-js");
          const adminSb = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } },
          );
          const { data: profiles } = await adminSb
            .from("profiles")
            .select("id, display_name, email")
            .in("id", empIds);
          const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          for (const p of (profiles ?? []) as any[]) {
            if (!p.email) continue;
            const empShifts = (empMap.get(p.id) ?? [])
              .sort((a: any, b: any) => a.shift_date.localeCompare(b.shift_date))
              .map((s: any) => {
                const d = new Date(s.shift_date + "T00:00:00");
                return {
                  date: s.shift_date,
                  day: DAYS[d.getDay()],
                  start: s.start_time.slice(0, 5),
                  end: s.end_time.slice(0, 5),
                  role: s.role,
                };
              });
            await enqueueAlertEmail({
              alertId: null,
              templateName: "schedule-locked",
              templateData: {
                recipient_name: p.display_name ?? undefined,
                week_range: weekRange,
                location,
                locked_by: lockedByName,
                lock_reason: data.reason ?? undefined,
                shifts: empShifts,
              },
              recipients: [
                {
                  user_id: p.id,
                  email: p.email,
                  display_name: p.display_name ?? "Crew",
                  role: "crew" as any,
                },
              ],
              category: "schedule",
              priority: "normal",
              subject: `Your schedule is locked — ${weekRange}`,
              sourceModule: "schedule",
              sourceId: data.id,
            });
          }
        }
      } catch (e) {
        console.error("[schedule] lock email error", e);
      }
    }

    return { ok: true };
  });

export const listEmployees = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z.object({ trailerId: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Determine caller role. Crew view must hide owners AND managers so
    // co-workers only see fellow crew on the schedule/shift grid.
    const [{ data: isMgrRow }, { data: isOwnerRow }] = await Promise.all([
      supabase.rpc("is_manager", { _user_id: userId }),
      supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
    ]);
    const isMgr = !!isMgrRow;
    const isOwner = !!isOwnerRow;

    // Always use admin for the role lookup so filtering is reliable —
    // RLS on user_roles hides other users' rows from crew, which caused
    // owners/managers to leak into the crew's employee list.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let profilesQ = supabaseAdmin
      .from("profiles")
      .select("id, display_name, active, trailer_id, weekly_hours, archived_at")
      .eq("active", true)
      .is("archived_at", null);
    if (data?.trailerId) {
      profilesQ = profilesQ.or(`trailer_id.eq.${data.trailerId},trailer_id.is.null`);
    }
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      profilesQ,
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get((r as any).user_id) ?? [];
      arr.push((r as any).role);
      roleMap.set((r as any).user_id, arr);
    }
    return (profiles ?? [])
      .filter((p: any) => {
        const rs = roleMap.get(p.id) ?? [];
        // Owners are never on the schedule.
        if (rs.includes("owner")) return false;
        // For crew, also hide managers — they only see fellow crew.
        if (!isMgr && !isOwner && rs.includes("manager")) return false;
        return true;
      })
      .map((p: any) => ({
        id: p.id,
        name: p.display_name ?? "Crew",
        roles: roleMap.get(p.id) ?? [],
        targetHours: p.weekly_hours ?? 40,
      }));
  });

// Find a schedule whose range overlaps the given week; create a draft if none.
export const getOrCreateScheduleForRange = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        startDate: z.string(),
        endDate: z.string(),
        name: z.string().min(1).max(120).optional(),
        autoCreate: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Pick the overlapping schedule that covers the most days in the requested
    // view. This keeps existing Sun→Sat built schedules visible after the UI
    // switched to Mon→Sun; otherwise the newer next-week schedule can overlap
    // by one Sunday and incorrectly "steal" the current week view.
    const { data: existing, error: e1 } = await supabase
      .from("schedules")
      .select("*")
      .is("archived_at", null)
      .lte("start_date", data.endDate)
      .gte("end_date", addDaysIso(data.startDate, -1))
      .order("start_date", { ascending: false });
    if (e1) throw new Error(e1.message);
    if (existing && existing.length > 0) {
      const overlapping = (existing as any[]).filter(
        (row) => overlapDays(row, data.startDate, data.endDate) > 0,
      );
      if (overlapping.length > 0) {
        return overlapping.sort((a: any, b: any) => {
          const byOverlap =
            overlapDays(b, data.startDate, data.endDate) -
            overlapDays(a, data.startDate, data.endDate);
          if (byOverlap !== 0) return byOverlap;
          return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
        })[0];
      }
    }
    // Fallback for legacy Sun→Sat rows after the UI moved to Mon→Sun: the
    // requested week may be exactly one day after the stored schedule range.
    const { data: legacyRows, error: legacyErr } = await supabase
      .from("schedules")
      .select("*")
      .is("archived_at", null)
      .lte("start_date", addDaysIso(data.endDate, -1))
      .gte("end_date", addDaysIso(data.startDate, -1))
      .order("start_date", { ascending: false });
    if (legacyErr) throw new Error(legacyErr.message);
    const legacyMatch = ((legacyRows ?? []) as any[])
      .filter((row) => overlapDays(row, data.startDate, data.endDate) > 0)
      .sort(
        (a, b) =>
          overlapDays(b, data.startDate, data.endDate) -
          overlapDays(a, data.startDate, data.endDate),
      )[0];
    if (legacyMatch) return legacyMatch;
    if (!data.autoCreate) return null;
    await requireManager(supabase, userId, context.activeOrgId);
    const name = data.name ?? `Week of ${data.startDate}`;
    const { data: row, error } = await supabase
      .from("schedules")
      .insert({
        name,
        start_date: data.startDate,
        end_date: data.endDate,
        created_by: userId,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    let created = row;
    if (!created) {
      // RLS may hide the RETURNING row — re-fetch by the natural key.
      const { data: refetched } = await supabase
        .from("schedules")
        .select("*")
        .eq("start_date", data.startDate)
        .eq("end_date", data.endDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      created = refetched;
    }

    // Seed from prior week's repeat_weekly=true shifts (+7 days).
    if (created) {
      const shiftDays = (iso: string, delta: number) => {
        const d = new Date(iso + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + delta);
        return d.toISOString().slice(0, 10);
      };
      const priorStart = shiftDays(data.startDate, -7);
      const priorEnd = shiftDays(data.endDate, -7);
      const { data: priorShifts } = await supabase
        .from("schedule_shifts")
        .select(
          "employee_id, trailer_id, role, segment, shift_date, start_time, end_time, break_minutes, notes, repeat_weekly",
        )
        .eq("repeat_weekly", true)
        .is("archived_at", null)
        .gte("shift_date", priorStart)
        .lte("shift_date", priorEnd);
      if (priorShifts && priorShifts.length > 0) {
        const { data: existingShifts } = await supabase
          .from("schedule_shifts")
          .select("shift_date, segment, employee_id")
          .eq("schedule_id", created.id);
        const taken = new Set<string>(
          (existingShifts ?? []).map(
            (r: any) => `${r.shift_date}|${r.segment}|${r.employee_id ?? "null"}`,
          ),
        );
        const newRows = priorShifts
          .map((s: any) => ({
            schedule_id: created.id,
            employee_id: s.employee_id,
            trailer_id: s.trailer_id,
            role: s.role,
            segment: s.segment,
            shift_date: shiftDays(s.shift_date, 7),
            start_time: s.start_time,
            end_time: s.end_time,
            break_minutes: s.break_minutes ?? 30,
            notes: s.notes ?? null,
            repeat_weekly: true,
            created_by: userId,
          }))
          .filter((r) => !taken.has(`${r.shift_date}|${r.segment}|${r.employee_id ?? "null"}`));
        if (newRows.length > 0) {
          await supabase.from("schedule_shifts").insert(newRows);
        }
      }
    }
    return created;
  });

export const duplicateShift = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        targetDate: z.string().optional(),
        targetEmployeeId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { data: src, error } = await supabase
      .from("schedule_shifts")
      .select("*, schedules!inner(status, start_date, end_date)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const sch = (src as any)?.schedules ?? {};
    const st = sch.status;
    if (st === "locked" || st === "published") {
      throw new Error("Schedule is locked — unlock it before making changes");
    }
    const { id, created_at, updated_at, schedules: _sch, ...rest } = src as any;
    const newDate = data.targetDate ?? src.shift_date;
    // If pasting outside the source week, re-parent the copy to the schedule
    // that owns the target date (same trailer) so it doesn't orphan.
    let targetScheduleId: string = (rest as any).schedule_id;
    if (sch.start_date && !scheduleCoversDate(sch as any, newDate)) {
      let candidatesQ = supabase
        .from("schedules")
        .select("id, status, trailer_id, start_date, end_date, created_at")
        .is("archived_at", null)
        .lte("start_date", newDate)
        .gte("end_date", addDaysIso(newDate, -1));
      if ((rest as any).trailer_id) {
        candidatesQ = candidatesQ.or(
          `trailer_id.eq.${(rest as any).trailer_id},trailer_id.is.null`,
        );
      }
      const { data: candidateSchedules, error: destErr } = await candidatesQ;
      if (destErr) throw new Error(destErr.message);
      const destSchedule = ((candidateSchedules ?? []) as any[])
        .filter((row) => scheduleCoversDate(row, newDate))
        .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
      const destId: string | null = destSchedule?.id ?? null;
      if (destSchedule?.status === "locked" || destSchedule?.status === "published") {
        throw new Error("Target week's schedule is locked — unlock it before duplicating there.");
      }
      if (!destId) {
        throw new Error("No schedule covers that date. Open or create that week's schedule first.");
      }
      targetScheduleId = destId;
    }
    const newId = crypto.randomUUID();
    const insertRow = {
      id: newId,
      ...rest,
      schedule_id: targetScheduleId,
      shift_date: newDate,
      employee_id: data.targetEmployeeId !== undefined ? data.targetEmployeeId : src.employee_id,
      // Never inherit repeat_weekly on a duplicate — that flag is what makes
      // new-week seeding recreate the shift every week. Duplicating a shift
      // must produce a one-off copy unless the user opts in explicitly.
      repeat_weekly: false,
      created_by: userId,
    };

    const { data: saved, error: e2 } = await supabase
      .from("schedule_shifts")
      .insert(insertRow)
      .select("*")
      .maybeSingle();
    if (e2) throw new Error(e2.message);
    if (saved) return saved;
    const { data: refetched } = await supabase
      .from("schedule_shifts")
      .select("*")
      .eq("id", newId)
      .maybeSingle();
    return refetched ?? insertRow;
  });

// Auto-coverage: for each day of the schedule, ensure one open/mid/close
// unassigned shift exists. Existing matching shifts are kept so the button
// is safe to click repeatedly without piling up duplicates.
export const generateCoverage = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ scheduleId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { data: sched } = await supabase
      .from("schedules")
      .select("*")
      .eq("id", data.scheduleId)
      .single();
    if (!sched) throw new Error("Schedule not found");
    if (sched.status === "locked" || sched.status === "published")
      throw new Error("Schedule is locked");
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
      .is("archived_at", null)
      .is("employee_id", null);
    const taken = new Set<string>((existing ?? []).map((r: any) => `${r.shift_date}|${r.segment}`));

    const rows = days.flatMap((d) =>
      segs
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
        })),
    );

    if (rows.length === 0) return { inserted: 0, skipped: days.length * segs.length };
    // The pre-filter above plus the partial unique index
    // (schedule_shifts_unassigned_unique) make this idempotent under repeat
    // clicks. Concurrent clicks fall back to the unique index for safety.
    const { data: saved, error } = await supabase.from("schedule_shifts").insert(rows).select("id");
    if (error) throw new Error(error.message);
    const inserted = saved?.length ?? 0;
    return { inserted, skipped: days.length * segs.length - inserted };
  });

// Crew-safe: list only the caller's own assigned shifts from non-archived schedules.
// Used by the dashboard "My Schedule" view and the schedule page when role is crew.
export const listMyScheduleShifts = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const from = data?.from ?? new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const to = data?.to ?? new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const { data: rows, error } = await supabase
      .from("schedule_shifts")
      .select(
        "id, schedule_id, shift_date, start_time, end_time, role, segment, trailer_id, break_minutes, notes",
      )
      .eq("employee_id", userId)
      .is("archived_at", null)
      .gte("shift_date", from)
      .lte("shift_date", to)
      .order("shift_date")
      .order("start_time");
    if (error) throw new Error(error.message);
    // Only show shifts from published schedules
    const schedIds = Array.from(new Set((rows ?? []).map((r: any) => r.schedule_id)));
    if (schedIds.length === 0) return [];
    const { data: scheds } = await supabase
      .from("schedules")
      .select("id, status, name")
      .in("id", schedIds);
    const published = new Set(
      (scheds ?? []).filter((s: any) => s.status === "published").map((s: any) => s.id),
    );
    const schedNames: Record<string, string> = Object.fromEntries(
      (scheds ?? []).map((s: any) => [s.id, s.name]),
    );
    return (rows ?? [])
      .filter((r: any) => published.has(r.schedule_id))
      .map((r: any) => ({ ...r, schedule_name: schedNames[r.schedule_id] ?? null }));
  });

// ---------- Shift Swap Requests ----------

export const requestShiftSwap = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        scheduleShiftId: z.string().uuid(),
        targetEmployeeId: z.string().uuid().nullable().optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("trailer_id")
      .eq("id", userId)
      .maybeSingle();
    const trailerId = (profile as any)?.trailer_id ?? null;
    // Prevent duplicate pending request for same shift
    const { data: existing } = await supabase
      .from("shift_swap_requests")
      .select("id")
      .eq("schedule_shift_id", data.scheduleShiftId)
      .eq("requester_id", userId)
      .eq("status", "pending")
      .is("archived_at", null)
      .maybeSingle();
    if (existing) throw new Error("You already have a pending swap request for this shift.");
    const { data: row, error } = await supabase
      .from("shift_swap_requests")
      .insert({
        requester_id: userId,
        target_employee_id: data.targetEmployeeId ?? null,
        schedule_shift_id: data.scheduleShiftId,
        trailer_id: trailerId,
        reason: data.reason ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("alerts").insert({
      type: "schedule_approval",
      title: "Shift swap requested",
      description: `An employee needs a shift covered.${data.reason ? ` Reason: ${data.reason}` : ""}`,
      source_module: "schedule",
      source_id: row.id,
      trailer_id: trailerId,
      created_by: userId,
      assigned_role: "manager",
      priority: "normal",
      status: "open",
    } as any);
    return row;
  });

export const listSwapRequests = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        trailerId: z.string().uuid().nullable().optional(),
        status: z.enum(["pending", "accepted", "declined", "approved", "cancelled"]).optional(),
      })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    let q = supabase
      .from("shift_swap_requests")
      .select("*, schedule_shifts(shift_date, start_time, end_time, segment)")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data?.trailerId) q = q.eq("trailer_id", data.trailerId);
    if (data?.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(
      new Set(
        [
          ...(rows ?? []).map((r: any) => r.requester_id),
          ...(rows ?? [])
            .filter((r: any) => r.target_employee_id)
            .map((r: any) => r.target_employee_id),
        ].filter(Boolean),
      ),
    );
    let nameMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      nameMap = Object.fromEntries(
        (profs ?? []).map((p: any) => [p.id, (p as any).display_name ?? "Crew"]),
      );
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      requester_name: nameMap[r.requester_id] ?? "Crew",
      target_name: r.target_employee_id ? (nameMap[r.target_employee_id] ?? "Crew") : null,
    }));
  });

export const decideSwapRequest = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "declined"]),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { data: swap } = await supabase
      .from("shift_swap_requests")
      .select("schedule_shift_id, target_employee_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabase
      .from("shift_swap_requests")
      .update({
        status: data.decision,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        decision_note: data.note ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.decision === "approved" && swap) {
      await supabase
        .from("schedule_shifts")
        .update({ employee_id: swap.target_employee_id ?? null })
        .eq("id", swap.schedule_shift_id);
    }
    return { ok: true };
  });

export const mySwapRequests = createServerFn({ method: "GET" })
  .middleware([requireActiveOrg])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("shift_swap_requests")
      .select("*, schedule_shifts(shift_date, start_time, end_time, segment)")
      .is("archived_at", null)
      .eq("requester_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Employee Availability ----------

// RLS handles filtering: crew see only their own, managers see all.
export const listAvailabilityForRange = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ startDate: z.string(), endDate: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("availability_blocks")
      .select(
        "id, user_id, block_date, all_day, reason, status, decided_by, decided_at, decision_note, trailer_id, schedule_id",
      )
      .gte("block_date", data.startDate)
      .lte("block_date", data.endDate);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertAvailability = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        blockDate: z.string(),
        reason: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("trailer_id, display_name")
      .eq("id", userId)
      .maybeSingle();
    const trailerId: string | null = profile?.trailer_id ?? null;

    // If a published/locked schedule covers this date, mark as pending
    // (owner/manager must approve). Otherwise auto-approve.
    let activeSched: { id: string; status: string; name: string | null } | null = null;
    {
      let q = supabase
        .from("schedules")
        .select("id, status, name, trailer_id")
        .is("archived_at", null)
        .in("status", ["published", "locked"])
        .lte("start_date", data.blockDate)
        .gte("end_date", data.blockDate);
      if (trailerId) q = q.or(`trailer_id.eq.${trailerId},trailer_id.is.null`);
      const { data: rows } = await q.limit(1);
      if (rows && rows.length > 0) activeSched = rows[0] as any;
    }

    const requiresApproval = !!activeSched;

    // Atomic: availability_blocks upsert + companion alert commit or roll back together.
    const { error } = await supabase.rpc("request_availability_atomic" as any, {
      _block_date: data.blockDate,
      _reason: data.reason ?? "",
      _requires_approval: requiresApproval,
      _trailer_id: trailerId,
      _schedule_id: activeSched?.id ?? null,
      _schedule_name: activeSched?.name ?? null,
      _schedule_status: activeSched?.status ?? null,
      _employee_name: profile?.display_name ?? "Employee",
    });
    if (error) throw new Error(error.message);

    return {
      ok: true,
      status: requiresApproval ? ("pending" as const) : ("approved" as const),
      requiresApproval,
    };
  });

export const deleteAvailability = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ blockDate: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("availability_blocks")
      .delete()
      .eq("user_id", userId)
      .eq("block_date", data.blockDate);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Availability approval (owner/manager) ----------

export const listPendingAvailability = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ trailerId: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    let q = supabase
      .from("availability_blocks")
      .select(
        "id, user_id, block_date, reason, status, trailer_id, schedule_id, created_at, decided_by, decided_at, decision_note",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.trailerId) q = q.eq("trailer_id", data.trailerId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] as any[] };
    const pmap = new Map<string, string>(
      (profs ?? []).map((p: any) => [p.id, p.display_name ?? "Crew"]),
    );
    return (rows ?? []).map((r: any) => ({ ...r, employee_name: pmap.get(r.user_id) ?? "Crew" }));
  });

export const decideAvailability = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "declined"]),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);

    // Atomic: block update + decision alert commit or roll back together.
    const { data: row, error } = await supabase.rpc("decide_availability_atomic" as any, {
      _id: data.id,
      _decision: data.decision,
      _note: data.note ?? "",
    });
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- Sales target ----------

export const setScheduleSalesTarget = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), salesTarget: z.number().positive() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { error } = await supabase
      .from("schedules")
      .update({ sales_target: data.salesTarget })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Per-employee weekly hours ----------

export const setEmployeeWeeklyHours = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({ employeeId: z.string().uuid(), weeklyHours: z.number().int().min(0).max(80) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { error } = await supabase
      .from("profiles")
      .update({ weekly_hours: data.weeklyHours })
      .eq("id", data.employeeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Open shift claiming ----------

export const claimShift = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        scheduleShiftId: z.string().uuid(),
        reason: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Use admin client to read the shift — crew's RLS scopes schedule_shifts
    // to their trailer, which would block reading unassigned shifts at other trailers.
    const { data: shift } = await supabaseAdmin
      .from("schedule_shifts")
      .select("employee_id, trailer_id")
      .eq("id", data.scheduleShiftId)
      .maybeSingle();
    if (!shift) throw new Error("Shift not found");
    if (shift.employee_id) throw new Error("This shift is already assigned");
    // Prevent duplicate pending claim
    const { data: existing } = await supabaseAdmin
      .from("shift_claim_requests")
      .select("id")
      .eq("schedule_shift_id", data.scheduleShiftId)
      .eq("claimant_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) throw new Error("You already have a pending claim for this shift");
    const { data: row, error } = await supabase
      .from("shift_claim_requests")
      .insert({
        schedule_shift_id: data.scheduleShiftId,
        claimant_id: userId,
        trailer_id: shift.trailer_id ?? null,
        reason: data.reason ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("alerts").insert({
      type: "schedule_approval",
      title: "Open shift claim request",
      description: `A crew member wants to claim an open shift.${data.reason ? ` Reason: ${data.reason}` : ""}`,
      source_module: "schedule",
      source_id: row.id,
      trailer_id: shift.trailer_id ?? null,
      created_by: userId,
      assigned_role: "manager",
      priority: "normal",
      status: "open",
    } as any);
    return row;
  });

export const listClaimRequests = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({ status: z.string().optional() })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    let q = supabase
      .from("shift_claim_requests")
      .select("*, schedule_shifts(shift_date, start_time, end_time, role, segment)")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data?.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids: string[] = Array.from(
      new Set((rows ?? []).map((r: any) => r.claimant_id as string).filter(Boolean)),
    );
    let nameMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      nameMap = Object.fromEntries(
        (profs ?? []).map((p: any) => [p.id, (p as any).display_name ?? "Crew"]),
      );
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      claimant_name: nameMap[r.claimant_id] ?? "Crew",
    }));
  });

export const decideClaimRequest = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "declined"]),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { data: claim } = await supabase
      .from("shift_claim_requests")
      .select("claimant_id, schedule_shift_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!claim) throw new Error("Claim not found");
    const { error } = await supabase
      .from("shift_claim_requests")
      .update({
        status: data.decision,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        decision_note: data.note ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // On approval, assign the shift to the claimant
    if (data.decision === "approved") {
      await supabase
        .from("schedule_shifts")
        .update({ employee_id: claim.claimant_id })
        .eq("id", claim.schedule_shift_id);
    }
    return { ok: true };
  });

export const myClaimRequests = createServerFn({ method: "GET" })
  .middleware([requireActiveOrg])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("shift_claim_requests")
      .select("*, schedule_shifts(shift_date, start_time, end_time, role, segment)")
      .is("archived_at", null)
      .eq("claimant_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Shift reminders ----------

export const sendShiftReminders = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({ reminderFor: z.enum(["today", "tomorrow"]).default("tomorrow") })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enqueueAlertEmail } = await import("@/lib/email/enqueue.server");

    const reminderFor = data?.reminderFor ?? "tomorrow";
    const targetDate = new Date();
    if (reminderFor === "tomorrow") targetDate.setDate(targetDate.getDate() + 1);
    const dateStr = targetDate.toISOString().slice(0, 10);

    const { data: shifts } = await supabaseAdmin
      .from("schedule_shifts")
      .select(
        "id, employee_id, shift_date, start_time, end_time, role, segment, schedules!inner(status, trailer_id, trailers(name))",
      )
      .eq("shift_date", dateStr)
      .not("employee_id", "is", null)
      .in("schedules.status", ["published", "locked"]);

    if (!shifts || shifts.length === 0) return { sent: 0 };

    const byEmployee = new Map<string, typeof shifts>();
    for (const s of shifts) {
      const empId = s.employee_id as string;
      if (!byEmployee.has(empId)) byEmployee.set(empId, []);
      byEmployee.get(empId)!.push(s);
    }

    const empIds = Array.from(byEmployee.keys());
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", empIds);
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailMap = new Map<string, string>(
      (authUsers?.users ?? []).map((u: any) => [u.id, u.email as string]),
    );
    const nameMap = new Map<string, string>(
      (profiles ?? []).map((p: any) => [p.id as string, (p.display_name ?? "Crew") as string]),
    );

    let sent = 0;
    for (const [empId, empShifts] of byEmployee) {
      const email = emailMap.get(empId);
      if (!email) continue;
      const name = nameMap.get(empId) ?? "Crew";
      const location = (empShifts[0] as any).schedules?.trailers?.name ?? "Dip N Shake";
      const shiftRows = empShifts
        .sort((a: any, b: any) => (a.start_time as string).localeCompare(b.start_time as string))
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

      await enqueueAlertEmail({
        alertId: null,
        templateName: "shift-reminder",
        templateData: {
          recipient_name: name,
          location,
          shifts: shiftRows,
          reminder_for: reminderFor,
        },
        recipients: [{ user_id: empId, email, display_name: name, role: "crew" as const }],
        category: "schedule",
        priority: "normal",
        subject:
          reminderFor === "today"
            ? `You're on today — ${location}`
            : `Shift tomorrow — ${location}`,
      });
      sent++;
    }

    return { sent, date: dateStr };
  });
