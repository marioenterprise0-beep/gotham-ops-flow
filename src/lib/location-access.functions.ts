import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function getRoles(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role as string);
  return { isOwner: roles.includes("owner"), isManager: roles.includes("owner") || roles.includes("manager") };
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generate6DigitCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 1000000).toString().padStart(6, "0");
}

export const submitLocationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    requestedTrailerId: z.string().uuid(),
    reason: z.string().min(1).max(1000),
    durationMinutes: z.number().int().min(15).max(480).default(60),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isManager, isOwner } = await getRoles(supabase, userId);
    if (!isManager) throw new Error("Managers only");
    if (isOwner) throw new Error("Owners don't need a request");
    const { data: profile } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
    if (profile?.trailer_id === data.requestedTrailerId) {
      throw new Error("Already at this location");
    }
    const { data: row, error } = await supabase.from("location_access_requests").insert({
      requested_by: userId,
      current_trailer_id: profile?.trailer_id ?? null,
      requested_trailer_id: data.requestedTrailerId,
      reason: data.reason,
      duration_minutes: data.durationMinutes,
    }).select("id").single();
    if (error) throw error;

    await supabase.from("alerts").insert({
      type: "manager_note",
      title: "Temporary location access request",
      description: data.reason,
      source_module: "location",
      source_id: row.id,
      trailer_id: data.requestedTrailerId,
      created_by: userId,
      assigned_role: "owner",
      priority: "high",
      status: "pending",
      payload: { location_request_id: row.id, requested_trailer: data.requestedTrailerId },
    } as any);
    return { id: row.id };
  });

export const listLocationRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("location_access_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const approveLocationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    note: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isOwner } = await getRoles(supabase, userId);
    if (!isOwner) throw new Error("Owner only");

    const { data: req, error: ge } = await supabase
      .from("location_access_requests").select("*").eq("id", data.id).single();
    if (ge) throw ge;
    if (req.status !== "pending") throw new Error("Request already decided");

    const code = generate6DigitCode();
    const code_hash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await supabase.from("location_access_requests").update({
      status: "approved",
      approved_by: userId,
      approved_at: new Date().toISOString(),
      code_hash,
      code_expires_at: expiresAt,
      decision_note: data.note ?? null,
    }).eq("id", data.id);

    await supabase.from("alerts").update({
      status: "approved", resolved_by: userId, resolved_at: new Date().toISOString(),
    }).eq("source_id", data.id).eq("source_module", "location");

    // Notify manager (employee-tier alert, with code in payload)
    await supabase.from("alerts").insert({
      type: "manager_note",
      title: "Location access approved",
      description: `Your one-time code is ${code} (expires in 30 min)`,
      source_module: "location",
      source_id: req.id,
      created_by: userId,
      assigned_user_id: req.requested_by,
      assigned_role: "all",
      priority: "high",
      status: "pending",
      payload: { location_request_id: req.id, code, expires_at: expiresAt },
    } as any);

    return { ok: true, code, expiresAt };
  });

export const declineLocationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), note: z.string().max(500).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isOwner } = await getRoles(supabase, userId);
    if (!isOwner) throw new Error("Owner only");
    await supabase.from("location_access_requests").update({
      status: "declined", approved_by: userId, approved_at: new Date().toISOString(),
      decision_note: data.note ?? null,
    }).eq("id", data.id);
    await supabase.from("alerts").update({
      status: "declined", resolved_by: userId, resolved_at: new Date().toISOString(),
    }).eq("source_id", data.id).eq("source_module", "location");
    return { ok: true };
  });

export const redeemLocationCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    requestId: z.string().uuid(),
    code: z.string().regex(/^\d{6}$/),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: req, error } = await supabase
      .from("location_access_requests").select("*").eq("id", data.requestId).single();
    if (error) throw error;
    if (req.requested_by !== userId) throw new Error("Not your request");
    if (req.status !== "approved") throw new Error("Request not approved");
    if (!req.code_expires_at || new Date(req.code_expires_at) < new Date()) {
      throw new Error("Code expired");
    }
    const hash = await sha256Hex(data.code);
    if (hash !== req.code_hash) throw new Error("Invalid code");

    const expiresAt = new Date(Date.now() + (req.duration_minutes ?? 60) * 60 * 1000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Clear any expired grants for this user
    await supabaseAdmin.from("active_location_grants").delete()
      .eq("user_id", userId).lt("expires_at", new Date().toISOString());
    await supabaseAdmin.from("active_location_grants").insert({
      user_id: userId,
      trailer_id: req.requested_trailer_id,
      request_id: req.id,
      expires_at: expiresAt,
    });
    await supabase.from("location_access_requests").update({
      status: "used", used_at: new Date().toISOString(),
    }).eq("id", data.requestId);
    return { ok: true, expiresAt, trailerId: req.requested_trailer_id };
  });

export const getActiveLocationGrant = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("active_location_grants")
      .select("trailer_id, expires_at")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1).maybeSingle();
    return data ?? null;
  });

export const listActiveLocationGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { isOwner } = await getRoles(supabase, userId);
    if (!isOwner) throw new Error("Owner only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("active_location_grants")
      .select("id, user_id, trailer_id, expires_at, created_at, request_id")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const userIds = Array.from(new Set((data ?? []).map((g: any) => g.user_id)));
    let profiles: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles")
        .select("id, display_name").in("id", userIds);
      profiles = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name]));
    }
    return (data ?? []).map((g: any) => ({ ...g, user_name: profiles[g.user_id] ?? "Crew" }));
  });

export const revokeLocationGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isOwner } = await getRoles(supabase, userId);
    if (!isOwner) throw new Error("Owner only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("active_location_grants").delete().eq("id", data.id);
    return { ok: true };
  });
