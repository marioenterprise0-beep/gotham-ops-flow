import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { randomInt } from "crypto";
import { requireManager as requireManagerRole, requireTabAccess } from "./auth-guards";

type RoleId = "owner" | "manager" | "shift_lead" | "grill" | "prep" | "cashier";

function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "GH-";
  for (let i = 0; i < 4; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

async function requireManager(supabase: any, userId: string) {
  await requireManagerRole(supabase, userId);
  await requireTabAccess(supabase, userId, "users", "edit");
}

export const listTrailers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("trailers").select("id, name, location, active").order("created_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const generateInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    role: z.enum(["owner", "manager", "shift_lead", "grill", "prep", "cashier"]),
    trailerId: z.string().uuid().optional(),
    expiresHours: z.number().int().min(1).max(24 * 30),
    note: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const code = newCode();
    const expires_at = new Date(Date.now() + data.expiresHours * 3600 * 1000).toISOString();
    const { data: row, error } = await supabase
      .from("invite_codes")
      .insert({
        code,
        role: data.role,
        trailer_id: data.trailerId ?? null,
        expires_hours: data.expiresHours,
        expires_at,
        note: data.note ?? null,
        created_by: userId,
      })
      .select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "invite_created", entity: "invite_code",
      entity_id: row.id, payload: { code: row.code, role: data.role, expires_hours: data.expiresHours },
    });
    return row;
  });

export const listInvitesV2 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { data, error } = await supabase
      .from("invite_codes")
      .select("id, code, role, note, trailer_id, expires_at, expires_hours, used_by, used_at, disabled_at, created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((inv: any) => ({
      ...inv,
      status:
        inv.used_by ? "used"
        : inv.disabled_at ? "disabled"
        : new Date(inv.expires_at) < new Date() ? "expired"
        : "active",
    }));
  });

export const disableInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { error } = await supabase
      .from("invite_codes")
      .update({ disabled_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "invite_disabled", entity: "invite_code", entity_id: data.id, payload: {},
    });
    return { ok: true };
  });

export const deleteInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { error } = await supabase.from("invite_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "invite_deleted", entity: "invite_code", entity_id: data.id, payload: {},
    });
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }, { data: trailers }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, trailer_id, last_login_at, sop_accepted_at, training_completed_at, active, created_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("trailers").select("id, name"),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);
    const trailerMap = new Map((trailers ?? []).map((t: any) => [t.id, t.name]));
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get((r as any).user_id) ?? [];
      arr.push((r as any).role); roleMap.set((r as any).user_id, arr);
    }
    return (profiles ?? []).map((p: any) => ({
      ...p,
      roles: roleMap.get(p.id) ?? [],
      trailer_name: p.trailer_id ? (trailerMap.get(p.trailer_id) ?? null) : null,
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    role: z.enum(["owner", "manager", "shift_lead", "grill", "prep", "cashier"]),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    // Use admin client for the privileged write — manager check already passed.
    // (Avoids RLS edge case where actor delete+insert can flip is_manager mid-transaction.)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "user_role_changed", entity: "user", entity_id: data.userId, payload: { role: data.role },
    });
    return { ok: true };
  });

export const setUserTrailer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    trailerId: z.string().uuid().nullable(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { error } = await supabase
      .from("profiles").update({ trailer_id: data.trailerId }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "user_trailer_changed", entity: "user", entity_id: data.userId, payload: { trailer_id: data.trailerId },
    });
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(), active: z.boolean(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { error } = await supabase.from("profiles").update({ active: data.active }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await supabase.from("access_log").insert({
      user_id: data.userId, event: data.active ? "access_restored" : "access_revoked",
      payload: { by: userId },
    });
    return { ok: true };
  });

export const listAccessLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { data, error } = await supabase
      .from("access_log")
      .select("id, user_id, event, ip, user_agent, payload, created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const logAccessEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    event: z.enum(["login", "logout", "sop_accepted", "training_completed"]),
    payload: z.record(z.string(), z.any()).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    if (data.event === "login") {
      await supabase.from("profiles").update({ last_login_at: now }).eq("id", userId);
    } else if (data.event === "sop_accepted") {
      await supabase.from("profiles").update({ sop_accepted_at: now }).eq("id", userId);
    } else if (data.event === "training_completed") {
      await supabase.from("profiles").update({ training_completed_at: now }).eq("id", userId);
    }
    await supabase.from("access_log").insert({
      user_id: userId, event: data.event, payload: data.payload ?? null,
    });
    return { ok: true };
  });

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("sop_accepted_at, training_completed_at, active, trailer_id")
      .eq("id", userId).maybeSingle();
    return data ?? null;
  });
