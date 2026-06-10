import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireManager, requireTabAccess } from "./auth-guards";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => r.role === "owner");
  if (!ok) throw new Error("Owner role required for inventory structure changes");
  await requireTabAccess(supabase, userId, "inventory", "edit");
}
// Kept for receive/waste/count (crew-legitimate quantity flows). Not used for structural writes.
async function assertManager(supabase: any, userId: string) {
  await requireManager(supabase, userId);
  await requireTabAccess(supabase, userId, "inventory", "edit");
}

async function resolveTrailer(supabase: any, userId: string, trailerId?: string | null) {
  if (trailerId) return trailerId;
  const { data: profile } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
  return profile?.trailer_id ?? null;
}

// Crew mutation gate for inventory_items writes that happen via admin client:
// the caller must have inventory tab access AND the item must belong to the
// caller's own trailer (managers bypass the trailer check).
async function assertCrewTrailerAccess(supabase: any, userId: string, itemId: string) {
  await requireTabAccess(supabase, userId, "inventory", "edit");
  const [{ data: profile }, { data: item }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle(),
    supabase.from("inventory_items").select("trailer_id").eq("id", itemId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isManager = (roleRows ?? []).some((r: any) => r.role === "owner" || r.role === "manager");
  if (isManager) return;
  if (!item) throw new Error("Inventory item not found");
  if (!profile?.trailer_id || profile.trailer_id !== item.trailer_id) {
    throw new Error("Not authorized for this trailer's inventory");
  }
}

// Categories are now stored in `inventory_categories` and managed at runtime
// by owners. Item writes accept any non-empty string (server validates it
// against the live category list below).
const CATEGORY_KEY = z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/i, "letters, numbers, _ or - only");

async function assertCategoryExists(supabase: any, key: string) {
  const { data, error } = await supabase
    .from("inventory_categories")
    .select("key, archived_at")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Unknown category: ${key}`);
  if (data.archived_at) throw new Error(`Category "${key}" is archived`);
}

export const listInventoryCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ includeArchived: z.boolean().optional() }).optional().parse(d ?? {}))
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("inventory_categories")
      .select("id, key, label, sort_order, archived_at, archive_reason")
      .order("sort_order")
      .order("label");
    if (!data?.includeArchived) q = q.is("archived_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createInventoryCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    key: CATEGORY_KEY,
    label: z.string().min(1).max(60),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const key = data.key.toLowerCase();
    const { data: row, error } = await supabase
      .from("inventory_categories")
      .insert({
        key,
        label: data.label.trim(),
        sort_order: data.sortOrder ?? 100,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.code === "23505" ? `Category "${key}" already exists` : error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "inventory_category_created",
      entity: "inventory_category", entity_id: row.id,
      payload: { key, label: row.label },
    });
    return row;
  });

export const updateInventoryCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    label: z.string().min(1).max(60).optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const patch: any = {};
    if (data.label !== undefined) patch.label = data.label.trim();
    if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder;
    const { error } = await supabase.from("inventory_categories").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archiveInventoryCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    reason: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { data: cat } = await supabase
      .from("inventory_categories").select("key").eq("id", data.id).maybeSingle();
    if (!cat) throw new Error("Category not found");
    const { count } = await (supabase as any)
      .from("inventory_items")
      .select("id", { count: "exact", head: true })
      .eq("category", cat.key)
      .is("archived_at", null);
    if ((count ?? 0) > 0) throw new Error(`Move or archive the ${count} item(s) in this category first.`);
    const { error } = await supabase
      .from("inventory_categories")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId,
        archive_reason: data.reason ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "inventory_category_archived",
      entity: "inventory_category", entity_id: data.id, payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreInventoryCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error } = await supabase
      .from("inventory_categories")
      .update({ archived_at: null, archived_by: null, archive_reason: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    trailerId: z.string().uuid().nullable().optional(),
    includeArchived: z.boolean().optional(),
  }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const tid = data?.trailerId;
    let q = context.supabase.from("inventory_items").select("*").order("category").order("name");
    if (tid) q = q.eq("trailer_id", tid);
    if (!data?.includeArchived) q = q.is("archived_at", null);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const upsertInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    category: CATEGORY_KEY,
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
    imageUrl: z.string().max(1000).nullable().optional(),
    countInstructions: z.string().max(2000).nullable().optional(),
    storageLocation: z.string().max(200).nullable().optional(),
    archived: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const category = String(data.category).toLowerCase();
    await assertCategoryExists(supabase, category);
    const { data: store } = await supabase.from("stores").select("id").order("created_at").limit(1).maybeSingle();
    if (!store) throw new Error("No store configured");
    const trailerId = await resolveTrailer(supabase, userId, data.trailerId);
    if (!trailerId) throw new Error("No trailer assigned");

    // Structural fields (global) — propagated across every per-trailer copy.
    const structural: any = {
      name: data.name, category, unit: data.unit,
      par_level: data.parLevel, low_threshold: data.lowThreshold,
      cost_per_unit: data.costPerUnit ?? 0, store_id: store.id,
      updated_at: new Date().toISOString(),
    };
    if (data.vendor !== undefined) structural.vendor = data.vendor;
    if (data.packSize !== undefined) structural.pack_size = data.packSize;
    if (data.minimumQty !== undefined) structural.minimum_qty = data.minimumQty;
    if (data.preferredOrderQty !== undefined) structural.preferred_order_qty = data.preferredOrderQty;
    if (data.estimatedCost !== undefined) structural.estimated_cost = data.estimatedCost;
    if (data.imageUrl !== undefined) structural.image_url = data.imageUrl;
    if (data.countInstructions !== undefined) structural.count_instructions = data.countInstructions;
    if (data.storageLocation !== undefined) structural.storage_location = data.storageLocation;
    if (data.archived !== undefined) structural.archived_at = data.archived ? new Date().toISOString() : null;

    if (data.id) {
      // Update the targeted row, then propagate structural fields to sibling rows (same store + name).
      const targetedPayload: any = { ...structural, trailer_id: trailerId };
      if (data.currentQty !== undefined) targetedPayload.current_qty = data.currentQty; // local-only
      const { error } = await supabase.from("inventory_items").update(targetedPayload).eq("id", data.id);
      if (error) throw error;
      // Propagate to siblings — exclude current_qty so local counts stay independent.
      const { error: pErr } = await supabase
        .from("inventory_items").update(structural)
        .eq("store_id", store.id).eq("name", data.name).neq("id", data.id);
      if (pErr) throw pErr;
    } else {
      // New master item — fan out to every active trailer in the store with current_qty = 0.
      const { data: trailers } = await supabase.from("trailers").select("id").eq("active", true);
      const seed = (trailers ?? []).length > 0 ? trailers! : [{ id: trailerId }];
      const rows = seed.map((t: any) => ({
        ...structural,
        trailer_id: t.id,
        current_qty: t.id === trailerId ? (data.currentQty ?? 0) : 0,
      }));
      const { error } = await supabase.from("inventory_items").insert(rows);
      if (error) throw error;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId, action: data.id ? "update_item" : "create_item", entity: "inventory_item",
      entity_id: data.id ?? null, payload: { name: data.name, category, trailer_id: trailerId, propagated: true },
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
    await assertOwner(supabase, userId);
    const patch: any = { ...data.patch, updated_at: new Date().toISOString() };
    // Apply to the targeted item, then propagate to all sibling rows (same name + store).
    const { data: target } = await supabase.from("inventory_items")
      .select("name, store_id").eq("id", data.id).maybeSingle();
    const { error } = await supabase.from("inventory_items").update(patch).eq("id", data.id);
    if (error) throw error;
    if (target?.name && target?.store_id) {
      const { error: pErr } = await supabase.from("inventory_items").update(patch)
        .eq("store_id", target.store_id).eq("name", target.name).neq("id", data.id);
      if (pErr) throw pErr;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "update_order_guide", entity: "inventory_item",
      entity_id: data.id, payload: { ...data.patch, propagated: true },
    });
    return { ok: true };
  });


// ---------- Lifecycle: scan / archive / restore / hard delete ----------

async function countItemRefs(supabase: any, itemId: string) {
  const tables: Array<{ table: string; col: string; label: string }> = [
    { table: "inventory_order_items",      col: "item_id",        label: "orders" },
    { table: "inventory_counts",           col: "item_id",        label: "counts" },
    { table: "inventory_receipts",         col: "item_id",        label: "receipts" },
    { table: "waste_log",                  col: "item_id",        label: "waste" },
    { table: "inventory_change_requests",  col: "target_item_id", label: "requests" },
    { table: "alerts",                     col: "source_id",      label: "alerts" },
  ];
  const counts: Record<string, number> = {};
  let total = 0;
  for (const t of tables) {
    const { count } = await supabase.from(t.table)
      .select("*", { head: true, count: "exact" })
      .eq(t.col, itemId);
    counts[t.label] = count ?? 0;
    total += count ?? 0;
  }
  return { counts, total };
}

export const scanInventoryDependencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { counts, total } = await countItemRefs(context.supabase, data.id);
    return { counts, total };
  });

export const archiveInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { data: target } = await supabase.from("inventory_items").select("name, store_id").eq("id", data.id).maybeSingle();
    const archived_at = new Date().toISOString();
    const filter = target?.name && target?.store_id
      ? supabase.from("inventory_items").update({ archived_at }).eq("store_id", target.store_id).eq("name", target.name)
      : supabase.from("inventory_items").update({ archived_at }).eq("id", data.id);
    const { error } = await filter;
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "archive_item", entity: "inventory_item",
      entity_id: data.id, payload: { propagated: true },
    });
    return { ok: true, archived: true as const };
  });

export const restoreInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { data: target } = await supabase.from("inventory_items").select("name, store_id").eq("id", data.id).maybeSingle();
    const filter = target?.name && target?.store_id
      ? supabase.from("inventory_items").update({ archived_at: null }).eq("store_id", target.store_id).eq("name", target.name)
      : supabase.from("inventory_items").update({ archived_at: null }).eq("id", data.id);
    const { error } = await filter;
    if (error) throw error;

    await supabase.from("audit_log").insert({
      actor_id: userId, action: "restore_item", entity: "inventory_item",
      entity_id: data.id, payload: {},
    });
    return { ok: true, restored: true as const };
  });

/** Hard delete — only when there are zero references. Otherwise throw HAS_DEPENDENCIES. */
export const deleteInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { counts, total } = await countItemRefs(supabase, data.id);
    if (total > 0) {
      const summary = Object.entries(counts).filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${k}`).join(" · ");
      throw new Error(`HAS_DEPENDENCIES:${total}:${summary}`);
    }
    const { error } = await supabase.from("inventory_items").delete().eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "delete_item", entity: "inventory_item", entity_id: data.id, payload: {},
    });
    return { ok: true, deleted: true as const };
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
    await assertCrewTrailerAccess(supabase, userId, data.itemId);
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
    await assertCrewTrailerAccess(supabase, userId, data.itemId);
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
    await assertCrewTrailerAccess(supabase, userId, data.itemId);
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
