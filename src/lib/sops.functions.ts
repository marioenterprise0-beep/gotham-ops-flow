import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertManager(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (roles ?? []).some((r: any) => r.role === "owner" || r.role === "manager");
  if (!ok) throw new Error("Manager role required");
}

const ROLE_VALUES = ["owner", "manager", "shift_lead", "grill", "prep", "cashier"] as const;

export const listSops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sops")
      .select("id, title, category, role, body, pass_standard, version, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const upsertSop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    category: z.string().min(1).max(60),
    role: z.enum(ROLE_VALUES).optional(),
    body: z.string().min(1).max(8000),
    passStandard: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const payload: any = {
      title: data.title,
      category: data.category,
      role: data.role ?? null,
      body: data.body,
      pass_standard: data.passStandard ?? null,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabase.from("sops").update(payload).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("sops").insert(payload);
      if (error) throw error;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId, action: data.id ? "update_sop" : "create_sop", entity: "sop",
      entity_id: data.id ?? null, payload: { title: data.title, category: data.category },
    });
    return { ok: true };
  });

export const deleteSop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { error } = await supabase.from("sops").delete().eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "delete_sop", entity: "sop", entity_id: data.id, payload: {},
    });
    return { ok: true };
  });
