import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireManager, requireTabAccess } from "./auth-guards";

async function assertManager(supabase: any, userId: string) {
  await requireManager(supabase, userId);
  await requireTabAccess(supabase, userId, "inventory", "edit");
}

async function resolveTrailer(supabase: any, userId: string, trailerId?: string | null) {
  if (trailerId) return trailerId;
  const { data: profile } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
  return profile?.trailer_id ?? null;
}

const CATEGORY_VALUES = ["protein", "bun", "sauce", "produce", "packaging", "supplies"] as const;

export const listInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trailerId: z.string().uuid().nullable().optional() }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const tid = data?.trailerId;
    let q = context.supabase.from("inventory_items").select("*").order("category").order("name");
    if (tid) q = q.eq("trailer_id", tid);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const upsertInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    category: z.enum(CATEGORY_VALUES),
    unit: z.string().min(1).max(20),
    parLevel: z.number().nonnegative(),
    lowThreshold: z.number().nonnegative(),
    costPerUnit: z.number().nonnegative().optional(),
    currentQty: z.number().nonnegative().optional(),
    trailerId: z.string().uuid().optional(),
    vendor: z.string().max(120).nullable().optional(),
    packSize: z.string().max(60).nullable().optional(),
    minimumQty: z.number().nonnegative().optional(),
    preferredOrderQty: z.number().nonnegative().optional(),
    estimatedCost: z.number().nonnegative().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { data: store } = await supabase.from("stores").select("id").order("created_at").limit(1).maybeSingle();
    if (!store) throw new Error("No store configured");
    const trailerId = await resolveTrailer(supabase, userId, data.trailerId);
    if (!trailerId) throw new Error("No trailer assigned");
    const payload: any = {
      name: data.name, category: data.category, unit: data.unit,
      par_level: data.parLevel, low_threshold: data.lowThreshold,
      cost_per_unit: data.costPerUnit ?? 0, store_id: store.id,
      trailer_id: trailerId,
      updated_at: new Date().toISOString(),
    };
    if (data.currentQty !== undefined) payload.current_qty = data.currentQty;
    if (data.vendor !== undefined) payload.vendor = data.vendor;
    if (data.packSize !== undefined) payload.pack_size = data.packSize;
    if (data.minimumQty !== undefined) payload.minimum_qty = data.minimumQty;
    if (data.preferredOrderQty !== undefined) payload.preferred_order_qty = data.preferredOrderQty;
    if (data.estimatedCost !== undefined) payload.estimated_cost = data.estimatedCost;
    if (data.id) {
      const { error } = await supabase.from("inventory_items").update(payload).eq("id", data.id);
      if (error) throw error;
    } else {
      payload.current_qty = data.currentQty ?? 0;
      const { error } = await supabase.from("inventory_items").insert(payload);
      if (error) throw error;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId, action: data.id ? "update_item" : "create_item", entity: "inventory_item",
      entity_id: data.id ?? null, payload: { name: data.name, category: data.category, trailer_id: trailerId },
    });
    return { ok: true };
  });

export const updateOrderGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    patch: z.object({
      vendor: z.string().max(120).nullable().optional(),
      pack_size: z.string().max(60).nullable().optional(),
      minimum_qty: z.number().nonnegative().optional(),
      preferred_order_qty: z.number().nonnegative().optional(),
      estimated_cost: z.number().nonnegative().optional(),
      par_level: z.number().nonnegative().optional(),
      low_threshold: z.number().nonnegative().optional(),
      cost_per_unit: z.number().nonnegative().optional(),
      unit: z.string().min(1).max(20).optional(),
      name: z.string().min(1).max(120).optional(),
    }),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const patch: any = { ...data.patch, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("inventory_items").update(patch).eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "update_order_guide", entity: "inventory_item",
      entity_id: data.id, payload: data.patch,
    });
    return { ok: true };
  });

export const deleteInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { error } = await supabase.from("inventory_items").delete().eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "delete_item", entity: "inventory_item", entity_id: data.id, payload: {},
    });
    return { ok: true };
  });

export const receiveStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    itemId: z.string().uuid(),
    qty: z.number().positive(),
    supplier: z.string().max(120).optional(),
    notes: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: receipt, error } = await supabase.from("inventory_receipts").insert({
      item_id: data.itemId, qty: data.qty, supplier: data.supplier ?? null, notes: data.notes ?? null, received_by: userId,
    }).select().single();
    if (error) throw error;
    const { data: item } = await supabase.from("inventory_items").select("current_qty").eq("id", data.itemId).single();
    if (item) {
      // Crew-legitimate quantity adjustment derived from a verified inventory_receipts insert.
      // Uses admin client because RLS on inventory_items restricts writes to managers;
      // the receipt row above is the auditable source of truth for this change.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: upErr } = await supabaseAdmin.from("inventory_items").update({ current_qty: Number(item.current_qty) + data.qty }).eq("id", data.itemId);
      if (upErr) throw upErr;
    }
    await supabase.from("audit_log").insert({ actor_id: userId, action: "receive_stock", entity: "inventory_item", entity_id: data.itemId, payload: { qty: data.qty, supplier: data.supplier } });
    return receipt;
  });

export const logWaste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    itemId: z.string().uuid(),
    qty: z.number().positive(),
    reason: z.string().min(1).max(200),
    photoUrl: z.string().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: item } = await supabase.from("inventory_items").select("current_qty, trailer_id").eq("id", data.itemId).single();
    const { data: row, error } = await supabase.from("waste_log").insert({
      item_id: data.itemId, qty: data.qty, reason: data.reason, photo_url: data.photoUrl ?? null, logged_by: userId,
      trailer_id: item?.trailer_id ?? null,
    }).select().single();
    if (error) throw error;
    if (item) {
      const next = Math.max(0, Number(item.current_qty) - data.qty);
      // Crew-legitimate decrement tied to the waste_log row inserted above (auditable).
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: upErr } = await supabaseAdmin.from("inventory_items").update({ current_qty: next }).eq("id", data.itemId);
      if (upErr) throw upErr;
    }
    await supabase.from("audit_log").insert({ actor_id: userId, action: "log_waste", entity: "inventory_item", entity_id: data.itemId, payload: { qty: data.qty, reason: data.reason } });
    return row;
  });

export const submitCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    itemId: z.string().uuid(),
    countQty: z.number().nonnegative(),
    shiftId: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: item } = await supabase.from("inventory_items").select("current_qty, trailer_id").eq("id", data.itemId).single();
    const expected = item ? Number(item.current_qty) : null;
    const variance = expected === null ? null : data.countQty - expected;
    const { data: row, error } = await supabase.from("inventory_counts").insert({
      item_id: data.itemId, shift_id: data.shiftId ?? null, count_qty: data.countQty,
      expected_qty: expected, variance, counted_by: userId,
      trailer_id: item?.trailer_id ?? null,
    }).select().single();
    if (error) throw error;
    // Crew-legitimate count reconciliation tied to the inventory_counts row inserted above (auditable).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.from("inventory_items").update({ current_qty: data.countQty }).eq("id", data.itemId);
    if (upErr) throw upErr;
    await supabase.from("audit_log").insert({ actor_id: userId, action: "submit_count", entity: "inventory_item", entity_id: data.itemId, payload: { countQty: data.countQty, variance } });
    return row;
  });
