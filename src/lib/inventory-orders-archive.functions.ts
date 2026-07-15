// Phase 8 — canonical archive/restore + dependency scan for Inventory Orders
// and Order Guide entities:
//   inventory_orders, inventory_order_items, inventory_receipts,
//   inventory_change_requests.
//
// Archive: manager-only, audit-logged.
// Restore: owner-only.
// Hard delete blocked unless `force: true` AND no live dependencies.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ENTITY = z.enum([
  "inventory_orders",
  "inventory_order_items",
  "inventory_receipts",
  "inventory_change_requests",
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

// Dependency map: entity -> [child_table, fk_column, label][]
const DEPS: Record<Entity, Array<{ table: string; column: string; label: string }>> = {
  inventory_orders: [{ table: "inventory_order_items", column: "order_id", label: "Order items" }],
  inventory_order_items: [],
  inventory_receipts: [],
  inventory_change_requests: [],
};

export const scanInventoryOrdersDependencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

export const archiveInventoryOrdersEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        entity: ENTITY,
        id: z.string().uuid(),
        reason: z.string().max(300).optional(),
        cascade: z.boolean().optional(), // also archive children
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb: any = supabase;
    await assertManager(supabase, userId);

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

export const restoreInventoryOrdersEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entity: ENTITY, id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb: any = supabase;
    await assertOwner(supabase, userId);
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

export const deleteInventoryOrdersEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    await assertOwner(supabase, userId);
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
