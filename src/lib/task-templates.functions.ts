import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ROLE = z.enum(["owner", "manager", "shift_lead", "grill", "prep", "cashier"]);
const PHASE = z.enum(["opening", "mid", "closing", "emergency"]);

async function assertManager(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_manager", { _user_id: userId });
  if (!data) throw new Error("Manager role required");
}

export const listTaskTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("task_templates")
      .select("id, trailer_id, role, phase, title, description, requires_signoff, position, active, created_at")
      .order("trailer_id", { ascending: true, nullsFirst: true })
      .order("phase").order("role").order("position").order("title");
    if (error) throw error;
    return data ?? [];
  });

export const upsertTaskTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    trailer_id: z.string().uuid().nullable(),
    role: ROLE,
    phase: PHASE,
    title: z.string().min(1).max(200),
    description: z.string().max(500).nullable().optional(),
    requires_signoff: z.boolean().default(false),
    position: z.number().int().min(0).max(9999).default(0),
    active: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const row = {
      trailer_id: data.trailer_id,
      role: data.role,
      phase: data.phase,
      title: data.title,
      description: data.description ?? null,
      requires_signoff: data.requires_signoff,
      position: data.position,
      active: data.active,
      created_by: userId,
    };
    if (data.id) {
      const { data: r, error } = await supabase.from("task_templates")
        .update(row).eq("id", data.id).select().single();
      if (error) throw error;
      return r;
    }
    const { data: r, error } = await supabase.from("task_templates").insert(row).select().single();
    if (error) throw error;
    return r;
  });

export const deleteTaskTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { error } = await supabase.from("task_templates").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });
