import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { requireManager } from "@/lib/auth-guards";
import { z } from "zod";

async function isOwner(supabase: any, userId: string, orgId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId);
  return (data ?? []).some((r: any) => r.role === "owner");
}

const ACTION = ["create", "update", "delete", "archive"] as const;

// The legitimate upload flow (EditItemModal.onPickImage, owner-only)
// always produces a bare storage path like "inventory/<id>/<file>".
// `payload` here is otherwise-unvalidated client JSON (z.record(any)) —
// without this, any authenticated user could submit an arbitrary
// http(s) URL as imageUrl, which SignedImage renders directly via
// <img src>; once a manager approves the request, every later viewer's
// browser fetches that attacker-controlled URL (IP/UA leak / tracking).
function sanitizeImageUrl(v: unknown): string | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.includes("://") ? null : v;
}

function sanitizeChangePayload(payload: Record<string, any>): Record<string, any> {
  if (!("imageUrl" in payload)) return payload;
  return { ...payload, imageUrl: sanitizeImageUrl(payload.imageUrl) };
}

export const submitInventoryChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        action: z.enum(ACTION),
        targetItemId: z.string().uuid().nullable().optional(),
        trailerId: z.string().uuid().nullable().optional(),
        payload: z.record(z.string(), z.any()).default({}),
        reason: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let trailerId = data.trailerId ?? null;
    if (!trailerId) {
      const { data: p } = await supabase
        .from("profiles")
        .select("trailer_id")
        .eq("id", userId)
        .maybeSingle();
      trailerId = p?.trailer_id ?? null;
    }
    const payload = sanitizeChangePayload(data.payload);
    const { data: row, error } = await supabase
      .from("inventory_change_requests")
      .insert({
        requested_by: userId,
        trailer_id: trailerId,
        target_item_id: data.targetItemId ?? null,
        action: data.action,
        payload,
        reason: data.reason ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    // Owner-tier alert
    await supabase.from("alerts").insert({
      type: "manager_note",
      title: `Inventory ${data.action} request`,
      description:
        (data.payload?.name ? String(data.payload.name) + " · " : "") + (data.reason ?? ""),
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

export const listInventoryChangeRequests = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ includeArchived: z.boolean().optional() }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const showArchived = data?.includeArchived && (await isOwner(supabase, userId, context.activeOrgId));
    let q = supabase
      .from("inventory_change_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!showArchived) q = q.is("archived_at", null);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const decideInventoryChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "declined"]),
        note: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (!(await isOwner(supabase, userId, context.activeOrgId))) throw new Error("Owner role required");

    const { data: req, error: ge } = await supabase
      .from("inventory_change_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (ge) throw ge;
    if (req.status !== "pending") throw new Error("Request already decided");

    if (data.decision === "approved") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Re-sanitize defense-in-depth: covers any row inserted before this
      // check existed, or via any other path into this table.
      const p: any = sanitizeChangePayload((req.payload as Record<string, any>) ?? {});
      if (req.action === "create") {
        const { data: store } = await supabase
          .from("stores")
          .select("id")
          .order("created_at")
          .limit(1)
          .maybeSingle();
        if (!store?.id) throw new Error("No store configured");
        await supabaseAdmin.from("inventory_items").insert({
          name: p.name,
          category: p.category,
          unit: p.unit ?? "unit",
          par_level: p.parLevel ?? 0,
          low_threshold: p.lowThreshold ?? 0,
          cost_per_unit: p.costPerUnit ?? 0,
          current_qty: p.currentQty ?? 0,
          store_id: store.id,
          trailer_id: req.trailer_id,
          image_url: p.imageUrl ?? null,
          count_instructions: p.countInstructions ?? null,
          storage_location: p.storageLocation ?? null,
        });
      } else if (req.action === "update" && req.target_item_id) {
        const camelToSnake: Record<string, string> = {
          parLevel: "par_level",
          lowThreshold: "low_threshold",
          costPerUnit: "cost_per_unit",
          storageLocation: "storage_location",
          countInstructions: "count_instructions",
          packSize: "pack_size",
          minimumQty: "minimum_qty",
          preferredOrderQty: "preferred_order_qty",
          estimatedCost: "estimated_cost",
          imageUrl: "image_url",
        };
        const ALLOWED_UPDATE_FIELDS = new Set([
          "name",
          "category",
          "unit",
          "par_level",
          "low_threshold",
          "cost_per_unit",
          "storage_location",
          "count_instructions",
          "pack_size",
          "vendor",
          "minimum_qty",
          "preferred_order_qty",
          "estimated_cost",
          "image_url",
        ]);
        const patch: any = { updated_at: new Date().toISOString() };
        for (const [k, v] of Object.entries(p)) {
          const col = camelToSnake[k] ?? k;
          if (!ALLOWED_UPDATE_FIELDS.has(col)) continue;
          patch[col] = v;
        }
        await supabaseAdmin.from("inventory_items").update(patch).eq("id", req.target_item_id);
      } else if (req.action === "archive" && req.target_item_id) {
        await supabaseAdmin
          .from("inventory_items")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", req.target_item_id);
      } else if (req.action === "delete" && req.target_item_id) {
        await supabaseAdmin.from("inventory_items").delete().eq("id", req.target_item_id);
      }
    }

    await supabase
      .from("inventory_change_requests")
      .update({
        status: data.decision,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        decision_note: data.note ?? null,
      })
      .eq("id", data.id);

    // Resolve linked alert
    await supabase
      .from("alerts")
      .update({
        status: data.decision === "approved" ? "approved" : "declined",
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("source_id", data.id)
      .eq("source_module", "inventory");

    // Targeted at the requester (+ managers) only — NOT "all": this alert
    // carries the manager's free-text decision note about one specific
    // employee's request, which has no business being broadcast to the
    // entire crew. assigned_user_id alone doesn't restrict visibility
    // (the RLS policy ORs every clause), assigned_role does.
    await supabase.from("alerts").insert({
      type: "manager_note",
      title: `Inventory request ${data.decision}`,
      description: data.note ?? null,
      source_module: "inventory",
      source_id: req.id,
      created_by: userId,
      assigned_user_id: req.requested_by,
      assigned_role: "manager",
      priority: "normal",
      status: "pending",
      payload: { change_request_id: req.id, decision: data.decision },
    } as any);

    return { ok: true };
  });
