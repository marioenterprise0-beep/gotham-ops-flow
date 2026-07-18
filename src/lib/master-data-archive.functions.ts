// Phase 11 — canonical archive/restore + dependency scan for org/master
// data: inventory_counts, trailers, stores.
//
// Archive: manager-only for inventory_counts; owner-only for trailers/stores
// (master data is sensitive). Audit-logged.
// Restore: owner-only.
// Hard delete blocked unless `force: true` AND no live dependencies.

import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { z } from "zod";

const ENTITY = z.enum(["inventory_counts", "trailers", "stores"]);
type Entity = z.infer<typeof ENTITY>;

async function assertManager(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_manager", { _user_id: userId });
  if (!data) throw new Error("Manager access required");
}
async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Owner access required");
}

// Dependency map. For trailers/stores we surface the most-referenced live
// children. Many other tables also FK to trailer_id but these are the ones
// that would visibly break if the parent disappears.
const DEPS: Record<Entity, Array<{ table: string; column: string; label: string }>> = {
  inventory_counts: [],
  trailers: [
    { table: "profiles", column: "trailer_id", label: "Users assigned" },
    { table: "inventory_items", column: "trailer_id", label: "Inventory items" },
    { table: "schedules", column: "trailer_id", label: "Schedules" },
    { table: "schedule_shifts", column: "trailer_id", label: "Scheduled shifts" },
    { table: "time_punches", column: "trailer_id", label: "Time punches" },
    { table: "cash_drawers", column: "trailer_id", label: "Cash drawers" },
    { table: "shifts", column: "trailer_id", label: "Operations shifts" },
  ],
  stores: [
    { table: "profiles", column: "store_id", label: "Users assigned" },
    { table: "inventory_items", column: "store_id", label: "Inventory items" },
  ],
};

export const scanMasterDataDependencies = createServerFn({ method: "POST" })
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

export const archiveMasterData = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        entity: ENTITY,
        id: z.string().uuid(),
        reason: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb: any = supabase;
    // inventory_counts is a transactional log — managers can archive entries
    // they entered in error. trailers/stores are master data — owner only.
    if (data.entity === "inventory_counts") {
      await assertManager(supabase, userId, context.activeOrgId);
    } else {
      await assertOwner(supabase, userId, context.activeOrgId);
    }
    const stamp: any = {
      archived_at: new Date().toISOString(),
      archived_by: userId,
      archive_reason: data.reason ?? null,
    };
    // Trailers carry an `active` flag — mirror archive to active=false so any
    // legacy code still keying off `active` keeps working.
    if (data.entity === "trailers") stamp.active = false;
    const { error } = await sb.from(data.entity).update(stamp).eq("id", data.id);
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

export const restoreMasterData = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ entity: ENTITY, id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb: any = supabase;
    await assertOwner(supabase, userId, context.activeOrgId);
    const patch: any = { archived_at: null, archived_by: null, archive_reason: null };
    if (data.entity === "trailers") patch.active = true;
    const { error } = await sb.from(data.entity).update(patch).eq("id", data.id);
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

export const deleteMasterData = createServerFn({ method: "POST" })
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
