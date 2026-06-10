import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ROLE = z.enum(["owner", "manager", "shift_lead", "grill", "prep", "cashier"]);
const PHASE = z.enum(["opening", "mid", "closing", "emergency"]);

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "owner").maybeSingle();
  if (!data) throw new Error("Owner role required");
}

export const listTaskTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ includeArchived: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("task_templates")
      .select("id, trailer_id, role, phase, title, description, requires_signoff, position, active, created_at, archived_at, archived_by, archive_reason")
      .order("trailer_id", { ascending: true, nullsFirst: true })
      .order("phase").order("role").order("position").order("title");
    if (!data.includeArchived) q = q.is("archived_at", null);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
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
  .inputValidator((d) => z.object({ id: z.string().uuid(), force: z.boolean().default(false) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    if (!data.force) {
      const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("template_id", data.id);
      if ((count ?? 0) > 0) {
        const err: any = new Error("HAS_DEPENDENCIES");
        err.code = "HAS_DEPENDENCIES";
        err.dependencies = { tasks: count };
        throw err;
      }
    }
    const { error } = await supabase.from("task_templates").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const scanTaskTemplateDependencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { count: tasksCount } = await context.supabase.from("tasks").select("id", { count: "exact", head: true }).eq("template_id", data.id);
    const { count: versionsCount } = await context.supabase.from("task_template_versions").select("id", { count: "exact", head: true }).eq("template_id", data.id);
    const t = tasksCount ?? 0, v = versionsCount ?? 0;
    return { tasks: t, versions: v, total: t + v, hasDependencies: t > 0 };
  });

export const archiveTaskTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { error } = await supabase.from("task_templates").update({
      archived_at: new Date().toISOString(), archived_by: userId, archive_reason: data.reason ?? null, active: false,
    } as any).eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "task_template_archived", entity: "task_template", entity_id: data.id, payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreTaskTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { error } = await supabase.from("task_templates").update({
      archived_at: null, archived_by: null, archive_reason: null, active: true,
    } as any).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listTemplateVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ templateId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { data: rows, error } = await supabase
      .from("task_template_versions")
      .select("id, version, action, actor_id, changed_at, before, after, changed_fields")
      .eq("template_id", data.templateId)
      .order("version", { ascending: false });
    if (error) throw error;
    const actorIds = Array.from(new Set((rows ?? []).map((r: any) => r.actor_id).filter(Boolean)));
    let actors: Record<string, string> = {};
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, display_name, email").in("id", actorIds);
      actors = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name || p.email || "—"]));
    }
    return (rows ?? []).map((r: any) => ({ ...r, actor_name: r.actor_id ? actors[r.actor_id] ?? "—" : "System" }));
  });

