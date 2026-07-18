// Phase 9 — canonical archive/restore + dependency scan for Alerts entities:
//   alerts, alert_actions.
//
// Note: alert_category_reads is per-user read-state; it does not need archiving
// (deleting a row simply marks the category unread).
//
// Archive: manager-only, audit-logged.
// Restore: owner-only.
// Hard delete blocked unless `force: true` AND no live dependencies.

import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { z } from "zod";

const ENTITY = z.enum(["alerts", "alert_actions"]);
type Entity = z.infer<typeof ENTITY>;

async function assertManager(supabase: any, userId: string, orgId: string) {
  const { data } = await supabase.rpc("is_manager", { _user_id: userId, _org_id: orgId });
  if (!data) throw new Error("Manager access required");
}
async function assertOwner(supabase: any, userId: string, orgId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _org_id: orgId, _role: "owner" });
  if (!data) throw new Error("Owner access required");
}

const DEPS: Record<Entity, Array<{ table: string; column: string; label: string }>> = {
  alerts: [{ table: "alert_actions", column: "alert_id", label: "Alert actions" }],
  alert_actions: [],
};

export const scanAlertDependencies = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ entity: ENTITY, id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb: any = context.supabase;
    const out: Array<{ table: string; label: string; count: number }> = [];
    let total = 0;
    let liveTotal = 0;
    for (const dep of DEPS[data.entity]) {
      const { count } = await sb
        .from(dep.table)
        .select("id", { count: "exact", head: true })
        .eq(dep.column, data.id);
      const c = count ?? 0;
      out.push({ table: dep.table, label: dep.label, count: c });
      total += c;
      const { count: live } = await sb
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

export const archiveAlert = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        entity: ENTITY,
        id: z.string().uuid(),
        reason: z.string().max(300).optional(),
        cascade: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb: any = supabase;
    await assertManager(supabase, userId, context.activeOrgId);

    const stamp = {
      archived_at: new Date().toISOString(),
      archived_by: userId,
      archive_reason: data.reason ?? null,
    };

    const { error } = await sb.from(data.entity).update(stamp).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.cascade) {
      for (const dep of DEPS[data.entity]) {
        await sb.from(dep.table).update(stamp).eq(dep.column, data.id).is("archived_at", null);
      }
    }

    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: `${data.entity}_archived`,
      entity: data.entity,
      entity_id: data.id,
      payload: { reason: data.reason ?? null, cascade: !!data.cascade },
    });
    return { ok: true };
  });

export const restoreAlert = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ entity: ENTITY, id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb: any = supabase;
    await assertOwner(supabase, userId, context.activeOrgId);
    const { error } = await sb
      .from(data.entity)
      .update({
        archived_at: null,
        archived_by: null,
        archive_reason: null,
      })
      .eq("id", data.id);
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

export const deleteAlert = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        entity: ENTITY,
        id: z.string().uuid(),
        force: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb: any = supabase;
    await assertOwner(supabase, userId, context.activeOrgId);
    if (!data.force) {
      let liveTotal = 0;
      for (const dep of DEPS[data.entity]) {
        const { count } = await sb
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
    const { error } = await sb.from(data.entity).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: `${data.entity}_deleted`,
      entity: data.entity,
      entity_id: data.id,
      payload: { force: !!data.force },
    });
    return { ok: true };
  });
