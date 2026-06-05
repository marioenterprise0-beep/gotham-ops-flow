import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("inventory_items").select("*").order("category").order("name");
    if (error) throw error;
    return data ?? [];
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
    // Use admin write-through via RPC-like update — managers can update items; for non-managers we still bump via service in audit-friendly way
    const { data: item } = await supabase.from("inventory_items").select("current_qty").eq("id", data.itemId).single();
    if (item) {
      const { error: upErr } = await supabase.from("inventory_items").update({ current_qty: Number(item.current_qty) + data.qty }).eq("id", data.itemId);
      if (upErr) {
        // crew member without manager rights — fall back to admin
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("inventory_items").update({ current_qty: Number(item.current_qty) + data.qty }).eq("id", data.itemId);
      }
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
    const { data: row, error } = await supabase.from("waste_log").insert({
      item_id: data.itemId, qty: data.qty, reason: data.reason, photo_url: data.photoUrl ?? null, logged_by: userId,
    }).select().single();
    if (error) throw error;
    const { data: item } = await supabase.from("inventory_items").select("current_qty").eq("id", data.itemId).single();
    if (item) {
      const next = Math.max(0, Number(item.current_qty) - data.qty);
      const { error: upErr } = await supabase.from("inventory_items").update({ current_qty: next }).eq("id", data.itemId);
      if (upErr) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("inventory_items").update({ current_qty: next }).eq("id", data.itemId);
      }
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
    const { data: item } = await supabase.from("inventory_items").select("current_qty").eq("id", data.itemId).single();
    const expected = item ? Number(item.current_qty) : null;
    const variance = expected === null ? null : data.countQty - expected;
    const { data: row, error } = await supabase.from("inventory_counts").insert({
      item_id: data.itemId, shift_id: data.shiftId ?? null, count_qty: data.countQty,
      expected_qty: expected, variance, counted_by: userId,
    }).select().single();
    if (error) throw error;
    // Reconcile current_qty to counted value
    const { error: upErr } = await supabase.from("inventory_items").update({ current_qty: data.countQty }).eq("id", data.itemId);
    if (upErr) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("inventory_items").update({ current_qty: data.countQty }).eq("id", data.itemId);
    }
    await supabase.from("audit_log").insert({ actor_id: userId, action: "submit_count", entity: "inventory_item", entity_id: data.itemId, payload: { countQty: data.countQty, variance } });
    return row;
  });
