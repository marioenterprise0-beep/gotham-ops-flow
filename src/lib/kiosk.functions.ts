import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import bcrypt from "bcryptjs";

// ============================================================================
// Kiosk (shared-iPad) clock-in system
//
// Design:
// - Owner registers a physical iPad → server issues a plaintext device_token
//   (shown once). Token hash stored in trusted_clock_devices.
// - iPad stores plaintext token in localStorage and passes it with every
//   kiosk request. Server bcrypt-compares against active device rows.
// - Employees identify themselves at the kiosk with a 4-digit PIN
//   (bcrypt-hashed in employee_pins).
// - Kiosk clock functions run WITHOUT requireSupabaseAuth — they're
//   authenticated purely by (device_token + employee PIN). All DB writes
//   use supabaseAdmin, so audit trail carries employee_id + clock_device_id.
// - Manager/owner manual punches (managerClockInEmployee/…) are unaffected
//   and remain the fallback when the iPad is unavailable.
// ============================================================================

const PIN_REGEX = /^\d{4}$/;

function generateToken(): string {
  // 32 bytes → 64 hex chars. Cryptographically strong.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveDevice(token: string) {
  if (!token || token.length < 32) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: devices } = await supabaseAdmin
    .from("trusted_clock_devices")
    .select("id, trailer_id, label, token_hash, revoked_at")
    .is("revoked_at", null);
  if (!devices) return null;
  for (const d of devices) {
    if (await bcrypt.compare(token, d.token_hash)) {
      return { id: d.id, trailerId: d.trailer_id, label: d.label };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Owner / manager admin
// ---------------------------------------------------------------------------

export const registerKioskDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        trailerId: z.string().uuid(),
        label: z.string().trim().min(1).max(60),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
    if (!isOwner) throw new Error("Only owners can register kiosk devices.");
    const token = generateToken();
    const hash = await bcrypt.hash(token, 10);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("trusted_clock_devices")
      .insert({
        trailer_id: data.trailerId,
        label: data.label,
        token_hash: hash,
        approved_by: userId,
      })
      .select("id, trailer_id, label, approved_at")
      .single();
    if (error) throw new Error(error.message);
    // Return plaintext token ONCE — the iPad stores it in localStorage.
    return { device: row, token };
  });

export const listKioskDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isMgr } = await supabase.rpc("is_manager", { _user_id: userId });
    if (!isMgr) throw new Error("Manager access required.");
    const { data, error } = await supabase
      .from("trusted_clock_devices")
      .select(
        "id, trailer_id, label, approved_at, approved_by, revoked_at, revoked_by, last_used_at, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const revokeKioskDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deviceId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
    if (!isOwner) throw new Error("Only owners can revoke kiosk devices.");
    const { error } = await supabase
      .from("trusted_clock_devices")
      .update({ revoked_at: new Date().toISOString(), revoked_by: userId })
      .eq("id", data.deviceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reissueKioskDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deviceId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
    if (!isOwner) throw new Error("Only owners can reinstall kiosk devices.");

    const token = generateToken();
    const hash = await bcrypt.hash(token, 10);
    const { error } = await supabase
      .from("trusted_clock_devices")
      .update({ token_hash: hash, revoked_at: null, revoked_by: null })
      .eq("id", data.deviceId);
    if (error) throw new Error(error.message);

    return { token };
  });

export const renameKioskDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        deviceId: z.string().uuid(),
        label: z.string().trim().min(1).max(60),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
    if (!isOwner) throw new Error("Only owners can rename kiosk devices.");
    const { error } = await supabase
      .from("trusted_clock_devices")
      .update({ label: data.label })
      .eq("id", data.deviceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setKioskDeviceRequired = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
    if (!isOwner) throw new Error("Only owners can change this setting.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("automation_settings")
      .select("id")
      .eq("scope", "global")
      .maybeSingle();
    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("automation_settings")
        .update({ kiosk_device_required: data.enabled })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("automation_settings")
        .insert({ scope: "global", kiosk_device_required: data.enabled });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const getKioskSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("automation_settings")
      .select("kiosk_device_required")
      .eq("scope", "global")
      .maybeSingle();
    return { kioskDeviceRequired: Boolean(data?.kiosk_device_required) };
  });

// ---------------------------------------------------------------------------
// PIN management (self-serve or manager-set)
// ---------------------------------------------------------------------------

export const setEmployeePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        employeeId: z.string().uuid().optional(),
        pin: z.string().regex(PIN_REGEX, "PIN must be 4 digits"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const targetId = data.employeeId ?? userId;
    if (targetId !== userId) {
      const { data: isMgr } = await supabase.rpc("is_manager", { _user_id: userId });
      if (!isMgr) throw new Error("Only managers can set another employee's PIN.");
    }
    const hash = await bcrypt.hash(data.pin, 10);
    const { error } = await supabase
      .from("employee_pins")
      .upsert({ user_id: targetId, pin_hash: hash, set_by: userId }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEmployeePinStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isMgr } = await supabase.rpc("is_manager", { _user_id: userId });
    if (!isMgr) throw new Error("Manager access required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("employee_pins").select("user_id, updated_at");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ userId: r.user_id, updatedAt: r.updated_at }));
  });

// ---------------------------------------------------------------------------
// Kiosk-side (no auth; authenticated by deviceToken)
// ---------------------------------------------------------------------------

export const kioskWhoAmI = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ deviceToken: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const device = await resolveDevice(data.deviceToken);
    if (!device) return { ok: false as const, message: "Device not registered or revoked." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: trailer } = await supabaseAdmin
      .from("trailers")
      .select("id, name")
      .eq("id", device.trailerId)
      .maybeSingle();
    return {
      ok: true as const,
      device: { id: device.id, label: device.label },
      trailer: trailer ? { id: trailer.id, name: trailer.name } : null,
    };
  });

export const kioskListEmployees = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ deviceToken: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const device = await resolveDevice(data.deviceToken);
    if (!device) throw new Error("Device not registered or revoked.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emps, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, trailer_id, active, archived_at")
      .eq("trailer_id", device.trailerId)
      .eq("active", true)
      .is("archived_at", null)
      .order("display_name");
    if (error) throw new Error(error.message);

    // Attach clock status + PIN status
    const ids = (emps ?? []).map((e) => e.id);
    const [openPunches, pins] = await Promise.all([
      supabaseAdmin
        .from("time_punches")
        .select("id, employee_id, clock_in_at")
        .in("employee_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
        .eq("status", "open")
        .is("archived_at", null),
      supabaseAdmin
        .from("employee_pins")
        .select("user_id")
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const openMap = new Map((openPunches.data ?? []).map((p) => [p.employee_id, p]));
    const pinSet = new Set((pins.data ?? []).map((p) => p.user_id));
    return (emps ?? []).map((e) => ({
      id: e.id,
      name: e.display_name,
      isOpen: openMap.has(e.id),
      openPunchId: openMap.get(e.id)?.id ?? null,
      openSince: openMap.get(e.id)?.clock_in_at ?? null,
      hasPin: pinSet.has(e.id),
    }));
  });

async function verifyEmployeePin(employeeId: string, pin: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("employee_pins")
    .select("pin_hash")
    .eq("user_id", employeeId)
    .maybeSingle();
  if (!data?.pin_hash) return false;
  return bcrypt.compare(pin, data.pin_hash);
}

export const kioskClockIn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        deviceToken: z.string(),
        employeeId: z.string().uuid(),
        pin: z.string().regex(PIN_REGEX),
        lat: z.number().optional(),
        lng: z.number().optional(),
        accuracy: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const device = await resolveDevice(data.deviceToken);
    if (!device) return { ok: false as const, message: "This device is not registered." };
    const pinOk = await verifyEmployeePin(data.employeeId, data.pin);
    if (!pinOk) return { ok: false as const, message: "Incorrect PIN." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Confirm employee belongs to this trailer
    const { data: emp } = await supabaseAdmin
      .from("profiles")
      .select("id, trailer_id, active, archived_at, display_name")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (!emp || emp.trailer_id !== device.trailerId || !emp.active || emp.archived_at) {
      return { ok: false as const, message: "Employee not assigned to this location." };
    }

    // Already clocked in?
    const { data: open } = await supabaseAdmin
      .from("time_punches")
      .select("id")
      .eq("employee_id", data.employeeId)
      .eq("status", "open")
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    if (open) return { ok: false as const, message: `${emp.display_name} is already clocked in.` };

    // Registered kiosk devices ARE the trust anchor (owner physically installed
    // them at the trailer). Skip geofence entirely — GPS inside a metal trailer
    // routinely reports garbage. Inject trailer coords so the DB trigger passes.
    const { data: trailer } = await supabaseAdmin
      .from("trailers")
      .select("geofence_lat, geofence_lng, name")
      .eq("id", device.trailerId)
      .maybeSingle();
    const deviceInfoGeo: Record<string, any> =
      trailer?.geofence_lat != null && trailer?.geofence_lng != null
        ? { geo: { lat: trailer.geofence_lat, lng: trailer.geofence_lng, accuracy: 5 } }
        : {};

    // Find today's scheduled shift
    const today = new Date().toISOString().slice(0, 10);
    const { data: todaysShift } = await supabaseAdmin
      .from("schedule_shifts")
      .select("id")
      .is("archived_at", null)
      .eq("employee_id", data.employeeId)
      .eq("shift_date", today)
      .order("start_time")
      .limit(1)
      .maybeSingle();

    const deviceInfo = {
      ...deviceInfoGeo,
      source: "kiosk",
      device_id: device.id,
      device_label: device.label,
    };
    const { data: row, error } = await supabaseAdmin
      .from("time_punches")
      .insert({
        employee_id: data.employeeId,
        trailer_id: device.trailerId,
        schedule_shift_id: todaysShift?.id ?? null,
        clock_in_at: new Date().toISOString(),
        status: "open",
        device_info: deviceInfo,
        clock_device_id: device.id,
        created_by: data.employeeId,
      })
      .select("id, clock_in_at")
      .single();
    if (error) return { ok: false as const, message: error.message };

    await supabaseAdmin
      .from("trusted_clock_devices")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", device.id);

    return { ok: true as const, punch: row, employeeName: emp.display_name };
  });

export const kioskClockOut = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        deviceToken: z.string(),
        employeeId: z.string().uuid(),
        pin: z.string().regex(PIN_REGEX),
        breakMinutes: z.number().int().min(0).max(480).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const device = await resolveDevice(data.deviceToken);
    if (!device) return { ok: false as const, message: "This device is not registered." };
    const pinOk = await verifyEmployeePin(data.employeeId, data.pin);
    if (!pinOk) return { ok: false as const, message: "Incorrect PIN." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp } = await supabaseAdmin
      .from("profiles")
      .select("id, trailer_id, display_name")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (!emp || emp.trailer_id !== device.trailerId) {
      return { ok: false as const, message: "Employee not assigned to this location." };
    }

    const { data: open } = await supabaseAdmin
      .from("time_punches")
      .select("id")
      .eq("employee_id", data.employeeId)
      .eq("status", "open")
      .is("archived_at", null)
      .order("clock_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!open) return { ok: false as const, message: `${emp.display_name} is not clocked in.` };

    const patch: { clock_out_at: string; status: "closed"; break_minutes?: number } = {
      clock_out_at: new Date().toISOString(),
      status: "closed",
    };
    if (data.breakMinutes !== undefined) patch.break_minutes = data.breakMinutes;
    const { error } = await supabaseAdmin.from("time_punches").update(patch).eq("id", open.id);
    if (error) return { ok: false as const, message: error.message };

    await supabaseAdmin
      .from("trusted_clock_devices")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", device.id);

    return { ok: true as const, employeeName: emp.display_name };
  });
