import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireManager } from "@/lib/auth-guards";
import { z } from "zod";

async function isOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r: any) => r.role === "owner");
}

const ACTION = ["create", "update", "delete", "archive"] as const;

export const submitInventoryChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    action: z.enum(ACTION),
    targetItemId: z.string().uuid().nullable().optional(),
    trailerId: z.string().uuid().nullable().optional(),
    payload: z.record(z.string(), z.any()).default({}),
    reason: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let trailerId = data.trailerId ?? null;
    if (!trailerId) {
      const { data: p } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
      trailerId = p?.trailer_id ?? null;
    }
    const { data: row, error } = await supabase.from("inventory_change_requests").insert({
      requested_by: userId,
      trailer_id: trailerId,
      target_item_id: data.targetItemId ?? null,
      action: data.action,
      payload: data.payload,
      reason: data.reason ?? null,
    }).select("id").single();
    if (error) throw error;

    // Owner-tier alert
    await supabase.from("alerts").insert({
      type: "manager_note",
      title: `Inventory ${data.action} request`,
      description: (data.payload?.name ? String(data.payload.name) + " · " : "") + (data.reason ?? ""),
      source_module: "inventory",
      source_id: row.id,
      trailer_id: trailerId,
      created_by: userId,
      assigned_role: "owner",
      priority: "normal",
      status: "pending",
      payload: { change_request_id: row.id, action: data.action },
    } as any);
    return { id: row.id };
  });

export const listInventoryChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { data, error } = await supabase
      .from("inventory_change_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const decideInventoryChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    decision: z.enum(["approved", "declined"]),
    note: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (!(await isOwner(supabase, userId))) throw new Error("Owner role required");

    const { data: req, error: ge } = await supabase
      .from("inventory_change_requests").select("*").eq("id", data.id).single();
    if (ge) throw ge;
    if (req.status !== "pending") throw new Error("Request already decided");

    if (data.decision === "approved") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const p: any = req.payload ?? {};
      if (req.action === "create") {
        const { data: store } = await supabase.from("stores").select("id").order("created_at").limit(1).maybeSingle();
        if (!store?.id) throw new Error("No store configured");
        await supabaseAdmin.from("inventory_items").insert({
          name: p.name, category: p.category, unit: p.unit ?? "unit",
          par_level: p.parLevel ?? 0, low_threshold: p.lowThreshold ?? 0,
          cost_per_unit: p.costPerUnit ?? 0, current_qty: p.currentQty ?? 0,
          store_id: store.id, trailer_id: req.trailer_id,
          image_url: p.imageUrl ?? null,
          count_instructions: p.countInstructions ?? null,
          storage_location: p.storageLocation ?? null,
        });
      } else if (req.action === "update" && req.target_item_id) {
        const camelToSnake: Record<string, string> = {
          parLevel: "par_level", lowThreshold: "low_threshold",
          costPerUnit: "cost_per_unit", storageLocation: "storage_location",
          countInstructions: "count_instructions", packSize: "pack_size",
          minimumQty: "minimum_qty", preferredOrderQty: "preferred_order_qty",
          estimatedCost: "estimated_cost", imageUrl: "image_url",
        };
        const ALLOWED_UPDATE_FIELDS = new Set([
          "name","category","unit","par_level","low_threshold","cost_per_unit",
          "storage_location","count_instructions","pack_size","vendor",
          "minimum_qty","preferred_order_qty","estimated_cost","image_url",
        ]);
        const patch: any = { updated_at: new Date().toISOString() };
        for (const [k, v] of Object.entries(p)) {
          const col = camelToSnake[k] ?? k;
          if (!ALLOWED_UPDATE_FIELDS.has(col)) continue;
          patch[col] = v;
        }
        await supabaseAdmin.from("inventory_items").update(patch).eq("id", req.target_item_id);
      } else if (req.action === "archive" && req.target_item_id) {
        await supabaseAdmin.from("inventory_items").update({ archived_at: new Date().toISOString() }).eq("id", req.target_item_id);
      } else if (req.action === "delete" && req.target_item_id) {
        await supabaseAdmin.from("inventory_items").delete().eq("id", req.target_item_id);
      }
    }

    await supabase.from("inventory_change_requests").update({
      status: data.decision,
      decided_by: userId, decided_at: new Date().toISOString(),
      decision_note: data.note ?? null,
    }).eq("id", data.id);

    // Resolve linked alert
    await supabase.from("alerts").update({
      status: data.decision === "approved" ? "approved" : "declined",
      resolved_by: userId, resolved_at: new Date().toISOString(),
    }).eq("source_id", data.id).eq("source_module", "inventory");

    // Employee-tier follow-up alert
    await supabase.from("alerts").insert({
      type: "manager_note",
      title: `Inventory request ${data.decision}`,
      description: data.note ?? null,
      source_module: "inventory",
      source_id: req.id,
      created_by: userId,
      assigned_user_id: req.requested_by,
      assigned_role: "all",
      priority: "normal",
      status: "pending",
      payload: { change_request_id: req.id, decision: data.decision },
    } as any);

    return { ok: true };
  });
