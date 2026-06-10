// Phase 7 — canonical archive/restore + dependency scan for Operations entities:
// daily_recaps, shifts, tasks, task_templates, checklist_sessions,
// hospitality_incidents, waste_log.
//
// All archive actions: manager-only, audit-logged.
// All restore actions: owner-only.
// Hard delete blocked unless `force: true` AND no live dependencies.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ENTITY = z.enum([
  "daily_recaps",
  "shifts",
  "tasks",
  "task_templates",
  "checklist_sessions",
  "hospitality_incidents",
  "waste_log",
]);
type Entity = z.infer<typeof ENTITY>;

async function assertManager(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_manager", { _user_id: userId });
  if (!data) throw new Error("Manager access required");
}
async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Owner access required");
}

// Dependency map: entity -> [child_table, fk_column][]
const DEPS: Record<Entity, Array<{ table: string; column: string; label: string }>> = {
  daily_recaps: [],
  shifts: [
    { table: "tasks", column: "shift_id", label: "Tasks" },
    { table: "checklist_sessions", column: "shift_id", label: "Checklist sessions" },
    { table: "shift_notes", column: "shift_id", label: "Shift notes" },
    { table: "time_punches", column: "shift_id", label: "Time punches" },
  ],
  tasks: [],
  task_templates: [
    { table: "tasks", column: "template_id", label: "Tasks generated" },
    { table: "task_template_versions", column: "template_id", label: "Version history" },
  ],
  checklist_sessions: [],
  hospitality_incidents: [],
  waste_log: [],
};

export const scanOperationsDependencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entity: ENTITY, id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const out: Array<{ table: string; label: string; count: number }> = [];
    let total = 0;
    let liveTotal = 0;
    for (const dep of DEPS[data.entity]) {
      const { count } = await (context.supabase as any)
        .from(dep.table)
        .select("id", { count: "exact", head: true })
        .eq(dep.column, data.id);
      const c = count ?? 0;
      out.push({ table: dep.table, label: dep.label, count: c });
      total += c;
      // For block-on-delete, consider only non-archived children "live"
      const { count: live } = await (context.supabase as any)
        .from(dep.table)
        .select("id", { count: "exact", head: true })
        .eq(dep.column, data.id)
        .is("archived_at", null);
      liveTotal += live ?? 0;
    }
    return {
      entity: data.entity,
      id: data.id,
      dependencies: out,
      total,
      liveTotal,
      hasDependencies: liveTotal > 0,
    };
  });

export const archiveOperationsEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    entity: ENTITY,
    id: z.string().uuid(),
    reason: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { error } = await (supabase as any).from(data.entity).update({
      archived_at: new Date().toISOString(),
      archived_by: userId,
      archive_reason: data.reason ?? null,
    } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: `${data.entity}_archived`,
      entity: data.entity,
      entity_id: data.id,
      payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreOperationsEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entity: ENTITY, id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error } = await (supabase as any).from(data.entity).update({
      archived_at: null, archived_by: null, archive_reason: null,
    } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: `${data.entity}_restored`,
      entity: data.entity,
      entity_id: data.id,
      payload: {},
    });
    return { ok: true };
  });

export const deleteOperationsEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    entity: ENTITY,
    id: z.string().uuid(),
    force: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    if (!data.force) {
      let liveTotal = 0;
      for (const dep of DEPS[data.entity]) {
        const { count } = await (supabase as any)
          .from(dep.table)
          .select("id", { count: "exact", head: true })
          .eq(dep.column, data.id)
          .is("archived_at", null);
        liveTotal += count ?? 0;
      }
      if (liveTotal > 0) {
        const err: any = new Error("HAS_DEPENDENCIES");
        err.code = "HAS_DEPENDENCIES";
        err.dependencies = { liveTotal };
        throw err;
      }
    }
    const { error } = await (supabase as any).from(data.entity).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: `${data.entity}_deleted`,
      entity: data.entity,
      entity_id: data.id,
      payload: { force: data.force },
    });
    return { ok: true };
  });
