import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function getRoles(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role as string);
  return {
    isOwner: roles.includes("owner"),
    isManager: roles.includes("owner") || roles.includes("manager"),
  };
}

const URGENCY = ["normal", "needed_soon", "critical", "emergency"] as const;
const STATUS = ["draft","submitted","pending_owner_review","approved","declined","changes_requested","ordered","received","cancelled"] as const;

export const createInventoryOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    trailerId: z.string().uuid().nullable().optional(),
    notes: z.string().max(2000).optional(),
    submit: z.boolean().optional(),
    items: z.array(z.object({
      itemId: z.string().uuid().nullable().optional(),
      itemName: z.string().min(1).max(120),
      category: z.string().max(40).optional(),
      unit: z.string().max(20).optional(),
      currentQty: z.number().nonnegative(),
      parQty: z.number().nonnegative(),
      requestedQty: z.number().positive(),
      urgency: z.enum(URGENCY),
      reason: z.string().max(500).optional(),
      notes: z.string().max(500).optional(),
    })).min(1).max(100),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isManager } = await getRoles(supabase, userId);
    if (!isManager) throw new Error("Manager role required");

    let trailerId = data.trailerId ?? null;
    if (!trailerId) {
      const { data: p } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
      trailerId = p?.trailer_id ?? null;
    }

    const { data: order, error } = await supabase.from("inventory_orders").insert({
      trailer_id: trailerId,
      created_by: userId,
      notes: data.notes ?? null,
      status: data.submit ? "submitted" : "draft",
    }).select("*").single();
    if (error) throw error;

    const rows = data.items.map((it) => ({
      order_id: order.id,
      item_id: it.itemId ?? null,
      item_name: it.itemName,
      category: it.category ?? null,
      unit: it.unit ?? null,
      current_qty: it.currentQty,
      par_qty: it.parQty,
      requested_qty: it.requestedQty,
      urgency: it.urgency,
      reason: it.reason ?? null,
      notes: it.notes ?? null,
    }));
    const { error: ie } = await supabase.from("inventory_order_items").insert(rows);
    if (ie) throw ie;

    return { id: order.id, status: order.status };
  });

export const listInventoryOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    scope: z.enum(["mine","all"]).default("all"),
    status: z.enum(STATUS).optional(),
  }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase.from("inventory_orders").select("*, items:inventory_order_items(*)").order("created_at", { ascending: false });
    if (data?.scope === "mine") q = q.eq("created_by", userId);
    if (data?.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const getInventoryOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: order, error } = await context.supabase
      .from("inventory_orders").select("*, items:inventory_order_items(*)").eq("id", data.id).single();
    if (error) throw error;
    return order;
  });

export const decideInventoryOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    decision: z.enum(["approved","declined","changes_requested","ordered","received","cancelled"]),
    comment: z.string().max(2000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isOwner, isManager } = await getRoles(supabase, userId);
    if (!isManager) throw new Error("Manager role required");

    const { data: order, error: ge } = await supabase.from("inventory_orders").select("created_by, status").eq("id", data.id).single();
    if (ge) throw ge;

    // Managers cannot approve/decline their own orders — only owners can
    const approvalDecisions = ["approved","declined","changes_requested"];
    if (approvalDecisions.includes(data.decision)) {
      if (!isOwner) throw new Error("Only owners can approve/decline orders");
      if (order.created_by === userId) throw new Error("Cannot approve your own order");
    }

    const patch: any = { status: data.decision, owner_comment: data.comment ?? null };
    if (["approved","declined","changes_requested"].includes(data.decision)) {
      patch.decided_by = userId; patch.decided_at = new Date().toISOString();
    }
    if (data.decision === "ordered") patch.ordered_at = new Date().toISOString();
    if (data.decision === "received") patch.received_at = new Date().toISOString();

    const { error: ue } = await supabase.from("inventory_orders").update(patch).eq("id", data.id);
    if (ue) throw ue;

    // Update related alert
    const alertStatus = data.decision === "approved" ? "approved"
      : data.decision === "declined" ? "declined"
      : data.decision === "received" ? "resolved"
      : "pending";
    await supabase.from("alerts").update({
      status: alertStatus,
      resolution: data.decision === "received" ? "received" : null,
      resolved_at: data.decision === "received" ? new Date().toISOString() : null,
      resolved_by: data.decision === "received" ? userId : null,
    }).eq("source_id", data.id).eq("type", "inventory_order");

    return { ok: true };
  });
