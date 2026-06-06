import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Saturday-anchored payroll week
function weekStart(d: Date): string {
  const dt = new Date(d);
  const dow = dt.getDay(); // 0 Sun ... 6 Sat
  const back = (dow + 1) % 7; // distance back to Saturday
  dt.setDate(dt.getDate() - back);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

export const getMyActivePunch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("time_punches")
      .select("*")
      .eq("employee_id", userId)
      .eq("status", "open")
      .order("clock_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

export const clockIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    deviceInfo: z.record(z.string(), z.any()).optional(),
    scheduleShiftId: z.string().uuid().optional().nullable(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
    // Block double clock-in
    const { data: open } = await supabase.from("time_punches")
      .select("id").eq("employee_id", userId).eq("status", "open").limit(1).maybeSingle();
    if (open) throw new Error("You are already clocked in.");
    const { data: row, error } = await supabase.from("time_punches").insert({
      employee_id: userId,
      trailer_id: profile?.trailer_id ?? null,
      schedule_shift_id: data.scheduleShiftId ?? null,
      clock_in_at: new Date().toISOString(),
      status: "open",
      device_info: data.deviceInfo ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const clockOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    punchId: z.string().uuid().optional(),
    breakMinutes: z.number().int().min(0).max(480).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let punchId = data.punchId;
    if (!punchId) {
      const { data: open } = await supabase.from("time_punches")
        .select("id").eq("employee_id", userId).eq("status", "open")
        .order("clock_in_at", { ascending: false }).limit(1).maybeSingle();
      if (!open) throw new Error("No open punch found.");
      punchId = open.id;
    }
    const patch: any = {
      clock_out_at: new Date().toISOString(),
      status: "closed",
    };
    // Only overwrite break_minutes when the caller explicitly provides a value,
    // so manager-entered breaks are preserved on auto-clock-out.
    if (data.breakMinutes !== undefined) patch.break_minutes = data.breakMinutes;
    const { data: row, error } = await supabase.from("time_punches")
      .update(patch)
      .eq("id", punchId)
      .eq("employee_id", userId)
      .select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getMyWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ weekStart: z.string().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const ws = data.weekStart ?? weekStart(new Date());
    const start = new Date(ws + "T00:00:00");
    const end = new Date(start); end.setDate(end.getDate() + 7);

    const [{ data: punches }, { data: shifts }] = await Promise.all([
      supabase.from("time_punches").select("*")
        .eq("employee_id", userId)
        .gte("clock_in_at", start.toISOString())
        .lt("clock_in_at", end.toISOString())
        .order("clock_in_at"),
      supabase.from("schedule_shifts").select("*")
        .eq("employee_id", userId)
        .gte("shift_date", ws)
        .lt("shift_date", end.toISOString().slice(0, 10))
        .order("shift_date"),
    ]);

    let workedMin = 0;
    for (const p of punches ?? []) {
      if (p.clock_out_at) {
        const diff = (new Date(p.clock_out_at).getTime() - new Date(p.clock_in_at).getTime()) / 60000;
        workedMin += Math.max(0, diff - (p.break_minutes ?? 0));
      }
    }
    let scheduledMin = 0;
    for (const s of shifts ?? []) {
      const [sh, sm] = (s.start_time as string).split(":").map(Number);
      const [eh, em] = (s.end_time as string).split(":").map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm) - (s.break_minutes ?? 0);
      scheduledMin += Math.max(0, mins);
    }
    const flags: string[] = [];
    if ((punches ?? []).some((p) => p.status === "open")) flags.push("open_punch");
    if (workedMin > scheduledMin + 30) flags.push("over_scheduled");
    if (workedMin > 40 * 60) flags.push("overtime");

    return {
      weekStart: ws,
      scheduledMin,
      workedMin,
      diffMin: workedMin - scheduledMin,
      flags,
      punches: punches ?? [],
      shifts: shifts ?? [],
    };
  });

// Request submissions
export const submitCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    type: z.enum(["missed_in", "missed_out", "wrong_time", "extra_time", "left_early", "stayed_late", "other"]),
    forDate: z.string(),
    requestedIn: z.string().datetime().optional().nullable(),
    requestedOut: z.string().datetime().optional().nullable(),
    reason: z.string().min(3).max(500),
    punchId: z.string().uuid().optional().nullable(),
    scheduleShiftId: z.string().uuid().optional().nullable(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
    const { data: row, error } = await supabase.from("time_corrections").insert({
      employee_id: userId,
      trailer_id: profile?.trailer_id ?? null,
      type: data.type,
      for_date: data.forDate,
      requested_in: data.requestedIn ?? null,
      requested_out: data.requestedOut ?? null,
      reason: data.reason,
      punch_id: data.punchId ?? null,
      schedule_shift_id: data.scheduleShiftId ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const submitTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    startDate: z.string(),
    endDate: z.string(),
    fullDay: z.boolean().default(true),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
    reason: z.string().min(3).max(500),
    notes: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
    const { data: row, error } = await supabase.from("time_off_requests").insert({
      employee_id: userId,
      trailer_id: profile?.trailer_id ?? null,
      start_date: data.startDate,
      end_date: data.endDate,
      full_day: data.fullDay,
      start_time: data.startTime ?? null,
      end_time: data.endTime ?? null,
      reason: data.reason,
      notes: data.notes ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const submitShiftNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    note: z.string().min(2).max(2000),
    forDate: z.string().optional(),
    punchId: z.string().uuid().optional().nullable(),
    scheduleShiftId: z.string().uuid().optional().nullable(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
    const { data: row, error } = await supabase.from("shift_notes").insert({
      author_id: userId,
      employee_id: userId,
      trailer_id: profile?.trailer_id ?? null,
      note: data.note,
      for_date: data.forDate ?? new Date().toISOString().slice(0, 10),
      punch_id: data.punchId ?? null,
      schedule_shift_id: data.scheduleShiftId ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: corrections }, { data: timeOff }, { data: notes }] = await Promise.all([
      supabase.from("time_corrections").select("*").eq("employee_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("time_off_requests").select("*").eq("employee_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("shift_notes").select("*").eq("employee_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);
    return { corrections: corrections ?? [], timeOff: timeOff ?? [], notes: notes ?? [] };
  });
