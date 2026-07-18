import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { z } from "zod";
import { requireTabAccess } from "./auth-guards";

async function getRoles(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role as string);
  return {
    isOwner: roles.includes("owner"),
    isManager: roles.includes("owner") || roles.includes("manager"),
  };
}

const URGENCY = ["normal", "needed_soon", "critical", "emergency"] as const;
const STATUS = [
  "draft",
  "submitted",
  "pending_owner_review",
  "approved",
  "declined",
  "changes_requested",
  "ordered",
  "received",
  "cancelled",
] as const;

export const createInventoryOrder = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        trailerId: z.string().uuid().nullable().optional(),
        notes: z.string().max(2000).optional(),
        submit: z.boolean().optional(),
        items: z
          .array(
            z.object({
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
            }),
          )
          .min(1)
          .max(100),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Any authenticated crew member may create/submit an inventory order
    // for their trailer. Approval still requires owner (see decideInventoryOrder).

    let trailerId = data.trailerId ?? null;
    if (!trailerId) {
      const { data: p } = await supabase
        .from("profiles")
        .select("trailer_id")
        .eq("id", userId)
        .maybeSingle();
      trailerId = p?.trailer_id ?? null;
    }

    const { data: order, error } = await supabase
      .from("inventory_orders")
      .insert({
        trailer_id: trailerId,
        created_by: userId,
        notes: data.notes ?? null,
        status: data.submit ? "submitted" : "draft",
      })
      .select("*")
      .single();
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
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        scope: z.enum(["mine", "all"]).default("all"),
        status: z.enum(STATUS).optional(),
        includeArchived: z.boolean().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isOwner } = await getRoles(supabase, userId);
    let q = supabase
      .from("inventory_orders")
      .select("*, items:inventory_order_items(*)")
      .order("created_at", { ascending: false });
    if (!(data?.includeArchived && isOwner)) q = q.is("archived_at", null);
    if (data?.scope === "mine") q = q.eq("created_by", userId);
    if (data?.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    // Filter out archived items in nested array (even when parent is live)
    return (rows ?? []).map((r: any) => ({
      ...r,
      items: (r.items ?? []).filter((i: any) => i.archived_at == null),
    }));
  });

export const getInventoryOrder = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: order, error } = await context.supabase
      .from("inventory_orders")
      .select("*, items:inventory_order_items(*)")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    return {
      ...order,
      items: (order.items ?? []).filter((i: any) => i.archived_at == null),
    };
  });

// Apply a received order to inventory: insert receipts + increment current_qty.
// Idempotent-ish: skipped if already received.
export async function applyOrderReceipt(supabase: any, userId: string, orderId: string) {
  const { data: items, error } = await supabase
    .from("inventory_order_items")
    .select("item_id, item_name, requested_qty")
    .eq("order_id", orderId)
    .is("archived_at", null);
  if (error) throw error;
  for (const it of items ?? []) {
    if (!it.item_id) continue; // skip free-text items not linked to inventory
    await supabase.from("inventory_receipts").insert({
      item_id: it.item_id,
      qty: it.requested_qty,
      received_by: userId,
      notes: `Auto-received from order ${orderId}`,
    });
    const { data: row } = await supabase
      .from("inventory_items")
      .select("current_qty")
      .eq("id", it.item_id)
      .single();
    if (row) {
      const next = Number(row.current_qty) + Number(it.requested_qty);
      const { error: upErr } = await supabase
        .from("inventory_items")
        .update({ current_qty: next })
        .eq("id", it.item_id);
      if (upErr) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("inventory_items")
          .update({ current_qty: next })
          .eq("id", it.item_id);
      }
    }
  }
}

export const decideInventoryOrder = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum([
          "approved",
          "declined",
          "changes_requested",
          "ordered",
          "received",
          "cancelled",
        ]),
        comment: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isOwner, isManager } = await getRoles(supabase, userId);
    if (!isManager) throw new Error("Manager role required");
    await requireTabAccess(supabase, userId, context.activeOrgId, "order-guide", "edit");

    const { data: order, error: ge } = await supabase
      .from("inventory_orders")
      .select("created_by, status")
      .eq("id", data.id)
      .single();
    if (ge) throw ge;

    const approvalDecisions = ["approved", "declined", "changes_requested"];
    if (approvalDecisions.includes(data.decision)) {
      if (!isOwner) throw new Error("Only owners can approve/decline orders");
      if (order.created_by === userId) throw new Error("Cannot approve your own order");
    }
    // ordered/received: must be owner OR the order must already be owner-approved
    if (data.decision === "ordered" && !isOwner && order.status !== "approved") {
      throw new Error("Order must be approved by the owner before marking ordered");
    }
    if (
      data.decision === "received" &&
      !isOwner &&
      !["approved", "ordered"].includes(order.status)
    ) {
      throw new Error("Order must be approved before it can be received");
    }
    // cancel: only creator (when still in draft/submitted/pending) or owner
    if (data.decision === "cancelled" && !isOwner && order.created_by !== userId) {
      throw new Error("Only the creator or owner can cancel an order");
    }
    // Block double-receipt
    if (data.decision === "received" && order.status === "received") {
      return { ok: true, alreadyReceived: true };
    }

    const patch: any = { status: data.decision, owner_comment: data.comment ?? null };
    if (approvalDecisions.includes(data.decision)) {
      patch.decided_by = userId;
      patch.decided_at = new Date().toISOString();
    }
    if (data.decision === "ordered") patch.ordered_at = new Date().toISOString();
    if (data.decision === "received") patch.received_at = new Date().toISOString();

    const { error: ue } = await supabase.from("inventory_orders").update(patch).eq("id", data.id);
    if (ue) throw ue;

    // Apply receipt to inventory when marked received
    if (data.decision === "received") {
      await applyOrderReceipt(supabase, userId, data.id);
    }

    // Update related alert
    const alertStatus =
      data.decision === "approved"
        ? "approved"
        : data.decision === "declined"
          ? "declined"
          : data.decision === "received"
            ? "resolved"
            : "pending";
    await supabase
      .from("alerts")
      .update({
        status: alertStatus,
        resolution: data.decision === "received" ? "received" : null,
        resolved_at: data.decision === "received" ? new Date().toISOString() : null,
        resolved_by: data.decision === "received" ? userId : null,
      })
      .eq("source_id", data.id)
      .eq("type", "inventory_order");

    return { ok: true };
  });

// Owner-only: force a draft order into "submitted" so the DB trigger fires
// the owner alert + email dispatch. Used when a crew member accidentally
// saved as draft instead of submitting.
export const submitDraftInventoryOrder = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isOwner } = await getRoles(supabase, userId);
    if (!isOwner) throw new Error("Owner role required");

    const { data: order, error: ge } = await supabase
      .from("inventory_orders")
      .select("status")
      .eq("id", data.id)
      .single();
    if (ge) throw ge;
    if (order.status !== "draft") {
      throw new Error(`Order is already ${order.status}; only drafts can be submitted here.`);
    }

    // BEFORE UPDATE trigger flips status → 'pending_owner_review' and inserts
    // the alert; alert-email-dispatch then sends the owner email.
    const { error: ue } = await supabase
      .from("inventory_orders")
      .update({ status: "submitted" })
      .eq("id", data.id);
    if (ue) throw ue;

    return { ok: true };
  });
