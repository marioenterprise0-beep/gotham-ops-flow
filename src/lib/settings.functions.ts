import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireManager, requireTabAccess } from "./auth-guards";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }, { data: store }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, store_id, created_at").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("stores").select("id, name, location").order("created_at").limit(1).maybeSingle(),
    ]);
    return { profile, roles: (roles ?? []).map((r) => r.role), store };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ displayName: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update({ display_name: data.displayName }).eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const updateStoreInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    storeId: z.string().uuid(),
    name: z.string().min(1).max(120),
    location: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isMgr = (roles ?? []).some((r) => r.role === "owner" || r.role === "manager");
    if (!isMgr) throw new Error("Manager role required");
    const { error } = await supabase.from("stores").update({ name: data.name, location: data.location ?? null }).eq("id", data.storeId);
    if (error) throw error;
    return { ok: true };
  });
