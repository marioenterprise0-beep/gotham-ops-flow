import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => r.role === "owner");
  if (!ok) throw new Error("Owner role required");
}

export const listAllTabPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const [{ data: perms }, { data: profiles }, { data: roles }] = await Promise.all([
      context.supabase.from("tab_permissions").select("id, scope_type, scope_id, tab_key, enabled, updated_at"),
      context.supabase.from("profiles").select("id, display_name"),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    return {
      perms: perms ?? [],
      profiles: profiles ?? [],
      roles: roles ?? [],
    };
  });

export const listMyTabPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    const { data: perms } = await supabase
      .from("tab_permissions")
      .select("scope_type, scope_id, tab_key, enabled");
    const mine = (perms ?? []).filter((p: any) =>
      (p.scope_type === "user" && p.scope_id === userId) ||
      (p.scope_type === "role" && roles.includes(p.scope_id))
    );
    return mine;
  });

export const setTabPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    scopeType: z.enum(["role", "user"]),
    scopeId: z.string().min(1).max(80),
    tabKey: z.string().min(1).max(60),
    enabled: z.boolean(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("tab_permissions")
      .upsert({
        scope_type: data.scopeType,
        scope_id: data.scopeId,
        tab_key: data.tabKey,
        enabled: data.enabled,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "scope_type,scope_id,tab_key" });
    if (error) throw error;
    return { ok: true };
  });
