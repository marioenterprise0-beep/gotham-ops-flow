import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// Note: supabaseAdmin is imported dynamically inside handler bodies that need it.
import { z } from "zod";
import {
  ensureActiveShiftForTrailer,
  instantiatePersonalTasks,
  closeUserIncompleteTasks,
  phaseFromHour,
} from "./shifts.server";


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
      .is("archived_at", null)
      .order("clock_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

// Haversine distance in meters between two lat/lng points.
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const clockIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    deviceInfo: z.record(z.string(), z.any()).optional(),
    scheduleShiftId: z.string().uuid().optional().nullable(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    accuracy: z.number().min(0).max(100000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
    // Block double clock-in
    const { data: open } = await supabase.from("time_punches")
      .select("id").eq("employee_id", userId).eq("status", "open").is("archived_at", null).limit(1).maybeSingle();
    if (open) {
      return {
        ok: false as const,
        message: "You are already clocked in.",
      };
    }

    // Geofence: when the trailer has coordinates configured, require the
    // caller to be within geofence_radius_m of the trailer. The server
    // re-checks distance so a tampered client can't bypass the limit.
    // Reads via supabaseAdmin: geofence_* columns are no longer
    // SELECT-granted to authenticated (see migration 20260621280000) —
    // every crew member calling clock-in would otherwise need to read raw
    // trailer GPS coordinates just to get a distance check. Only the
    // computed distance/name is ever returned to the client below.
    const trailerId = profile?.trailer_id ?? null;
    if (trailerId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: trailer } = await supabaseAdmin.from("trailers")
        .select("geofence_lat, geofence_lng, geofence_radius_m, name")
        .eq("id", trailerId).maybeSingle();
      if (trailer?.geofence_lat != null && trailer?.geofence_lng != null) {
        if (data.lat == null || data.lng == null) {
          return {
            ok: false as const,
            message: "Location required to clock in. Enable location access and try again.",
          };
        }
        const radius = trailer.geofence_radius_m ?? 25;
        const dist = distanceMeters(data.lat, data.lng, trailer.geofence_lat, trailer.geofence_lng);
        // Allow GPS accuracy (capped) as edge tolerance so a good reading near the boundary isn't rejected.
        const tolerance = Math.min(50, data.accuracy ?? 0);
        if (dist - tolerance > radius) {
          return {
            ok: false as const,
            message: `You are too far from ${trailer.name ?? "the trailer"} (${Math.round(dist)} m away, must be within ${radius} m). Clock in once you arrive.`,
          };
        }
      }
    }

    let scheduleShiftId = data.scheduleShiftId ?? null;
    if (!scheduleShiftId) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: todaysShift } = await supabase.from("schedule_shifts")
        .select("id, schedules!inner(archived_at)").is("schedules.archived_at", null)
        .is("archived_at", null)
        .eq("employee_id", userId).eq("shift_date", today)
        .order("start_time").limit(1).maybeSingle();
      if (todaysShift) scheduleShiftId = todaysShift.id;
    }

    // Early clock-in prevention: block punching in more than 15 minutes before shift start.
    if (scheduleShiftId) {
      const { data: shiftInfo } = await supabase
        .from("schedule_shifts")
        .select("shift_date, start_time")
        .eq("id", scheduleShiftId)
        .maybeSingle();
      if (shiftInfo) {
        const shiftStart = new Date(`${shiftInfo.shift_date}T${shiftInfo.start_time}`);
        const minutesBefore = (shiftStart.getTime() - Date.now()) / 60000;
        if (minutesBefore > 15) {
          return {
            ok: false as const,
            message: `Your shift doesn't start for ${Math.round(minutesBefore)} more minutes. You can clock in up to 15 minutes early.`,
          };
        }
      }
    }
    const deviceInfo = {
      ...(data.deviceInfo ?? {}),
      ...(data.lat != null && data.lng != null
        ? { geo: { lat: data.lat, lng: data.lng, accuracy: data.accuracy ?? null } }
        : {}),
    };
    const { data: row, error } = await supabase.from("time_punches").insert({
      employee_id: userId,
      trailer_id: trailerId,
      schedule_shift_id: scheduleShiftId,
      clock_in_at: new Date().toISOString(),
      status: "open",
      device_info: Object.keys(deviceInfo).length ? deviceInfo : null,
      created_by: userId,
    }).select("*").single();
    if (error) {
      if (
        error.message.includes("You are too far from") ||
        error.message.includes("Location required to clock in")
      ) {
        return {
          ok: false as const,
          message: error.message,
        };
      }
      throw new Error(error.message);
    }

    // Auto-open the trailer's shift if there isn't one yet, then materialize
    // this employee's personal tasks from the task_templates catalog matching
    // their roles + the shift's phase. Both steps are best-effort: a failure
    // here never blocks the clock-in itself.
    let assignedTaskCount = 0;
    let shiftId: string | null = null;
    if (trailerId) {
      try {
        const ensured = await ensureActiveShiftForTrailer(supabase, trailerId, userId);
        if (ensured) {
          shiftId = ensured.shift.id;
          const phase = ensured.shift.phase ?? phaseFromHour();
          const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
          const roles = (roleRows ?? []).map((r: any) => r.role as string);
          assignedTaskCount = await instantiatePersonalTasks(supabase, ensured.shift.id, trailerId, userId, roles, phase);
        }
      } catch {
        // swallow — punch already saved, automation is non-critical
      }
    }

    return {
      ok: true as const,
      punch: row,
      shiftId,
      assignedTaskCount,
    };
  });


// Owner-only: configure geofence coordinates / radius for a trailer.
export const setTrailerGeofence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    trailerId: z.string().uuid(),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    radiusM: z.number().int().min(10).max(2000).default(25),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
    if (!isOwner) throw new Error("Only owners can configure trailer geofences.");
    // Use supabaseAdmin for the write — geofence columns are not granted to authenticated
    // and the trailers UPDATE policy allows any manager, so we enforce owner-only at app layer above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("trailers").update({
      geofence_lat: data.lat,
      geofence_lng: data.lng,
      geofence_radius_m: data.radiusM,
    }).eq("id", data.trailerId);
    if (error) throw new Error(error.message);
    const { data: rows, error: readErr } = await supabaseAdmin.rpc("get_trailer_geofence", { _trailer_id: data.trailerId });
    if (readErr) throw new Error(readErr.message);
    return rows?.[0] ?? null;
  });

export const listTrailerGeofences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("list_trailer_geofences");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Owner-only: geocode a street address to lat/lng using OpenStreetMap Nominatim.
// Free, no API key. The owner reviews the returned coords before saving.
export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ address: z.string().min(5).max(300) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
    if (!isOwner) throw new Error("Only owners can geocode addresses.");
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(data.address)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, { headers: { "User-Agent": "gotham-os/1.0 (timeclock-geofence)" } });
    if (!res.ok) throw new Error(`Geocoding failed (${res.status}).`);
    const arr = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!arr || arr.length === 0) throw new Error("Address not found. Try adding city/state/ZIP.");
    const hit = arr[0];
    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      label: hit.display_name,
    };
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
        .select("id").eq("employee_id", userId).eq("status", "open").is("archived_at", null)
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

    // Auto-close this employee's still-open personal tasks on the punch's shift.
    let missedTaskCount = 0;
    if (row?.trailer_id) {
      const { data: activeShift } = await supabase
        .from("shifts").select("id")
        .eq("trailer_id", row.trailer_id).eq("status", "active")
        .order("opened_at", { ascending: false }).limit(1).maybeSingle();
      if (activeShift?.id) {
        try {
          missedTaskCount = await closeUserIncompleteTasks(supabase, activeShift.id, userId);
        } catch {
          // best effort
        }
      }
    }
    return { ...row, missedTaskCount };
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
      supabase.from("time_punches").select("*").is("archived_at", null)
        .eq("employee_id", userId)
        .gte("clock_in_at", start.toISOString())
        .lt("clock_in_at", end.toISOString())
        .order("clock_in_at"),
      supabase.from("schedule_shifts").select("*, schedules!inner(archived_at)")
        .is("schedules.archived_at", null)
        .is("archived_at", null)
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
    // Flag any closed punch over 5h with no break logged (labor compliance)
    const hasLongShiftNoBreak = (punches ?? []).some((p) => {
      if (!p.clock_out_at) return false;
      const diffMin = (new Date(p.clock_out_at).getTime() - new Date(p.clock_in_at).getTime()) / 60000;
      return diffMin > 5 * 60 && (p.break_minutes ?? 0) === 0;
    });
    if (hasLongShiftNoBreak) flags.push("no_break_on_long_shift");

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

    await supabase.from("alerts").insert({
      type: "time_adjustment",
      title: "Time adjustment request",
      description: `${data.forDate} · ${data.reason}`,
      source_module: "time_corrections",
      source_id: row.id,
      trailer_id: profile?.trailer_id ?? null,
      created_by: userId,
      assigned_role: "manager",
      priority: "normal",
      status: "pending",
      payload: {
        reason: data.reason,
        original: data.requestedIn ? `Requested in: ${data.requestedIn}` : undefined,
        requested: data.requestedOut ? `Requested out: ${data.requestedOut}` : undefined,
      },
    } as any);

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

    await supabase.from("alerts").insert({
      type: "time_off",
      title: "Time off request",
      description: `${data.startDate}${data.endDate !== data.startDate ? ` – ${data.endDate}` : ""} · ${data.reason}`,
      source_module: "time_off",
      source_id: row.id,
      trailer_id: profile?.trailer_id ?? null,
      created_by: userId,
      assigned_role: "manager",
      priority: "normal",
      status: "pending",
      payload: { request_id: row.id, start_date: data.startDate, end_date: data.endDate, reason: data.reason },
    } as any);

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
      supabase.from("time_corrections").select("*").is("archived_at", null).eq("employee_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("time_off_requests").select("*").is("archived_at", null).eq("employee_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("shift_notes").select("*").is("archived_at", null).eq("employee_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);
    return { corrections: corrections ?? [], timeOff: timeOff ?? [], notes: notes ?? [] };
  });

// ---------------------------------------------------------------------------
// Phase 5 — canonical archive/restore + dependency scan for time records
// ---------------------------------------------------------------------------

async function assertManager(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_manager", { _user_id: userId });
  if (!data) throw new Error("Manager access required");
}
async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Owner access required");
}

export const scanPunchDependencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [corr, audit] = await Promise.all([
      supabase.from("time_corrections").select("id").eq("punch_id", data.id),
      supabase.from("time_audit").select("id").eq("entity", "time_punch").eq("entity_id", data.id),
    ]);
    const c = corr.data?.length ?? 0;
    const a = audit.data?.length ?? 0;
    return { corrections: c, auditEntries: a, total: c + a, hasDependencies: c > 0 || a > 0 };
  });

export const archivePunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { error } = await supabase.from("time_punches").update({
      archived_at: new Date().toISOString(), archived_by: userId, archive_reason: data.reason ?? null,
    } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "punch_archived", entity: "time_punch", entity_id: data.id, payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restorePunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error } = await supabase.from("time_punches").update({
      archived_at: null, archived_by: null, archive_reason: null,
    } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "punch_restored", entity: "time_punch", entity_id: data.id, payload: {},
    });
    return { ok: true };
  });

export const archiveCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { error } = await supabase.from("time_corrections").update({
      archived_at: new Date().toISOString(), archived_by: userId, archive_reason: data.reason ?? null,
    } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "correction_archived", entity: "time_correction", entity_id: data.id, payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error } = await supabase.from("time_corrections").update({
      archived_at: null, archived_by: null, archive_reason: null,
    } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archiveTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { error } = await supabase.from("time_off_requests").update({
      archived_at: new Date().toISOString(), archived_by: userId, archive_reason: data.reason ?? null,
    } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "time_off_archived", entity: "time_off_request", entity_id: data.id, payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error } = await supabase.from("time_off_requests").update({
      archived_at: null, archived_by: null, archive_reason: null,
    } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Manager / Owner punch management — manual clock in/out + edit any punch.
// Used by the Time Clock "Manage punches" panel so owners can correct missed
// punches and adjust existing ones without going through the request workflow.
// ---------------------------------------------------------------------------

// Synthesize a geo payload that satisfies the enforce_clock_in_geofence trigger
// when a manager is entering a punch manually (no real device location).
async function buildManagerGeoPayload(_supabase: any, trailerId: string | null) {
  const base: Record<string, any> = { manual_entry: true };
  if (!trailerId) return base;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("trailers")
    .select("geofence_lat, geofence_lng")
    .eq("id", trailerId)
    .maybeSingle();
  if (data?.geofence_lat != null && data?.geofence_lng != null) {
    base.geo = { lat: data.geofence_lat, lng: data.geofence_lng, accuracy: 0, source: "manager_override" };
  }
  return base;
}

export const listEmployeesForPunchAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trailerId: z.string().uuid().optional().nullable() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    let q = supabase
      .from("profiles")
      .select("id, display_name, email, trailer_id, archived_at")
      .is("archived_at", null)
      .order("display_name", { ascending: true });
    if (data.trailerId) q = q.or(`trailer_id.eq.${data.trailerId},trailer_id.is.null`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listPunchesForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    employeeId: z.string().uuid().optional().nullable(),
    trailerId: z.string().uuid().optional().nullable(),
    startDate: z.string(),
    endDate: z.string(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    let q = supabase
      .from("time_punches")
      .select("id, employee_id, trailer_id, clock_in_at, clock_out_at, break_minutes, status, notes, schedule_shift_id")
      .is("archived_at", null)
      .gte("clock_in_at", new Date(data.startDate + "T00:00:00").toISOString())
      .lt("clock_in_at", new Date(data.endDate + "T23:59:59.999").toISOString())
      .order("clock_in_at", { ascending: false })
      .limit(500);
    if (data.employeeId) q = q.eq("employee_id", data.employeeId);
    if (data.trailerId) q = q.eq("trailer_id", data.trailerId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const managerClockInEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    employeeId: z.string().uuid(),
    trailerId: z.string().uuid().optional().nullable(),
    clockInAt: z.string().datetime(),
    clockOutAt: z.string().datetime().optional().nullable(),
    breakMinutes: z.number().int().min(0).max(480).optional(),
    notes: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);

    // Resolve a trailer if none provided (employee's home trailer).
    let trailerId = data.trailerId ?? null;
    if (!trailerId) {
      const { data: prof } = await supabase
        .from("profiles").select("trailer_id").eq("id", data.employeeId).maybeSingle();
      trailerId = prof?.trailer_id ?? null;
    }

    // Block creating a second open punch for the same employee.
    if (!data.clockOutAt) {
      const { data: existing } = await supabase
        .from("time_punches").select("id")
        .eq("employee_id", data.employeeId).eq("status", "open")
        .is("archived_at", null).limit(1).maybeSingle();
      if (existing) throw new Error("Employee already has an open punch. Close it first or set a clock-out time.");
    }

    const device_info = await buildManagerGeoPayload(supabase, trailerId);
    const insertRow: any = {
      employee_id: data.employeeId,
      trailer_id: trailerId,
      clock_in_at: data.clockInAt,
      clock_out_at: data.clockOutAt ?? null,
      status: data.clockOutAt ? "closed" : "open",
      break_minutes: data.breakMinutes ?? 0,
      notes: data.notes ? `[Manager entry] ${data.notes}` : "[Manager entry]",
      device_info,
      created_by: userId,
    };
    const { data: row, error } = await supabase.from("time_punches").insert(insertRow).select("*").single();
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert({
      actor_id: userId, action: "manager_clock_in", entity: "time_punch", entity_id: row.id,
      payload: { for_employee: data.employeeId, clock_in_at: data.clockInAt, clock_out_at: data.clockOutAt ?? null },
    } as any);
    return row;
  });

export const managerClockOutEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    punchId: z.string().uuid().optional(),
    employeeId: z.string().uuid().optional(),
    clockOutAt: z.string().datetime(),
    breakMinutes: z.number().int().min(0).max(480).optional(),
    notes: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    let punchId = data.punchId;
    if (!punchId) {
      if (!data.employeeId) throw new Error("punchId or employeeId required");
      const { data: open } = await supabase.from("time_punches").select("id")
        .eq("employee_id", data.employeeId).eq("status", "open").is("archived_at", null)
        .order("clock_in_at", { ascending: false }).limit(1).maybeSingle();
      if (!open) throw new Error("No open punch found for this employee.");
      punchId = open.id;
    }
    const patch: any = { clock_out_at: data.clockOutAt, status: "closed" };
    if (data.breakMinutes !== undefined) patch.break_minutes = data.breakMinutes;
    if (data.notes) patch.notes = `[Manager close] ${data.notes}`;
    const { data: row, error } = await supabase.from("time_punches").update(patch).eq("id", punchId).select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "manager_clock_out", entity: "time_punch", entity_id: row.id,
      payload: { clock_out_at: data.clockOutAt, break_minutes: data.breakMinutes ?? null },
    } as any);
    return row;
  });

export const managerEditPunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    clockInAt: z.string().datetime().optional(),
    clockOutAt: z.string().datetime().nullable().optional(),
    breakMinutes: z.number().int().min(0).max(480).optional(),
    status: z.enum(["open", "closed", "auto_closed"]).optional(),
    notes: z.string().max(1000).optional().nullable(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);

    const patch: Record<string, any> = {};
    if (data.clockInAt !== undefined) patch.clock_in_at = data.clockInAt;
    if (data.clockOutAt !== undefined) patch.clock_out_at = data.clockOutAt;
    if (data.breakMinutes !== undefined) patch.break_minutes = data.breakMinutes;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status !== undefined) {
      patch.status = data.status;
    } else if (data.clockOutAt !== undefined) {
      patch.status = data.clockOutAt ? "closed" : "open";
    }
    if (Object.keys(patch).length === 0) throw new Error("No changes provided");

    // Validate: if both timestamps present, end must be >= start.
    if (patch.clock_in_at && patch.clock_out_at) {
      if (new Date(patch.clock_out_at).getTime() < new Date(patch.clock_in_at).getTime()) {
        throw new Error("Clock-out time must be after clock-in time.");
      }
    }

    const { data: row, error } = await supabase.from("time_punches").update(patch as any).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "manager_edit_punch", entity: "time_punch", entity_id: row.id, payload: patch,
    } as any);
    return row;
  });
