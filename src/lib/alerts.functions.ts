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

const ALERT_TYPES = ["missed_clock_out","missed_clock_in","time_adjustment","time_off","inventory_order","low_stock","critical_stock","checklist_failure","manager_note","schedule_approval","maintenance"] as const;
const ALERT_STATUS = ["open","pending","approved","declined","resolved"] as const;

export const listAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    status: z.enum(ALERT_STATUS).optional(),
    type: z.enum(ALERT_TYPES).optional(),
    category: z.string().optional(),
  }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(500);
    if (data?.status) q = q.eq("status", data.status);
    if (data?.type) q = q.eq("type", data.type);
    const { data: rows, error } = await q;
    if (error) throw error;

    // Compute low/critical stock dynamically (not stored)
    const { data: items } = await supabase.from("inventory_items").select("id,name,current_qty,low_threshold,par_level,trailer_id").is("archived_at", null);
    const synthetic: any[] = [];
    for (const it of items ?? []) {
      const cur = Number(it.current_qty), low = Number(it.low_threshold), par = Number(it.par_level || 0);
      if (cur <= low && low > 0) {
        synthetic.push({
          id: `stock-${it.id}`,
          type: "critical_stock",
          title: `Critical Stock — ${it.name}`,
          description: `${cur} on hand (PAR ${par})`,
          source_module: "inventory",
          source_id: it.id,
          trailer_id: it.trailer_id,
          assigned_role: "manager",
          priority: "critical",
          status: "open",
          payload: { item: it.name, current: cur, par },
          created_at: new Date().toISOString(),
          synthetic: true,
        });
      } else if (par > 0 && cur < par * 0.5) {
        synthetic.push({
          id: `stock-low-${it.id}`,
          type: "low_stock",
          title: `Low Stock — ${it.name}`,
          description: `${cur} on hand (PAR ${par})`,
          source_module: "inventory",
          source_id: it.id,
          trailer_id: it.trailer_id,
          assigned_role: "manager",
          priority: "high",
          status: "open",
          payload: { item: it.name, current: cur, par },
          created_at: new Date().toISOString(),
          synthetic: true,
        });
      }
    }

    const combined = [...(rows ?? []), ...synthetic];
    if (data?.category) {
      if (data.category === "announcements") {
        return combined.filter((a: any) => a.source_module === "announcements" || a.type === "announcement");
      }
      if (data.category === "tasks") {
        return combined.filter((a: any) => a.source_module === "tasks");
      }
      const map: Record<string, string[]> = {
        inventory: ["inventory_order","low_stock","critical_stock"],
        labor: ["missed_clock_in","missed_clock_out","time_adjustment","time_off"],
        scheduling: ["schedule_approval"],
        operations: ["checklist_failure","manager_note"],
        maintenance: ["maintenance"],
        hospitality: ["manager_note"],
      };
      const allowed = map[data.category] ?? [];
      return combined.filter((a) => allowed.includes(a.type));
    }
    return combined;
  });

export const actOnAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    alertId: z.string().uuid(),
    action: z.enum(["comment","approve","decline","request_changes","mark_ordered","mark_received","escalate","resolve","review"]),
    note: z.string().max(2000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isOwner, isManager } = await getRoles(supabase, userId);

    const { data: alert, error: ge } = await supabase.from("alerts").select("*").eq("id", data.alertId).single();
    if (ge) throw ge;

    // Permissions: owner can do anything (including approving things they created themselves);
    // managers can only comment/review/escalate.
    const ownerOnly = ["approve","decline","request_changes"];
    if (ownerOnly.includes(data.action) && !isOwner) {
      throw new Error("Owner role required");
    }

    await supabase.from("alert_actions").insert({
      alert_id: data.alertId, actor_id: userId, action: data.action, note: data.note ?? null,
    });

    // Update alert status
    let patch: any = {};
    if (data.action === "approve") patch = { status: "approved" };
    else if (data.action === "decline") patch = { status: "declined" };
    else if (data.action === "request_changes") patch = { status: "pending" };
    else if (data.action === "resolve" || data.action === "mark_received") {
      patch = { status: "resolved", resolved_by: userId, resolved_at: new Date().toISOString(), resolution: data.note ?? data.action };
    } else if (data.action === "review") {
      patch = { status: alert.status === "open" ? "pending" : alert.status };
    } else if (data.action === "escalate") {
      patch = { assigned_role: "owner", priority: alert.priority === "low" ? "normal" : alert.priority };
    }
    if (Object.keys(patch).length) {
      await supabase.from("alerts").update(patch).eq("id", data.alertId);
    }

    // Cascade to source: inventory_order
    if (alert.type === "inventory_order" && alert.source_id) {
      const map: Record<string, any> = {
        approve: "approved", decline: "declined", request_changes: "changes_requested",
        mark_ordered: "ordered", mark_received: "received",
      };
      if (map[data.action]) {
        // Gate ordered/received behind prior owner approval unless caller is owner
        const { data: ord } = await supabase.from("inventory_orders")
          .select("status").eq("id", alert.source_id).single();
        if (data.action === "mark_ordered" && !isOwner && ord?.status !== "approved") {
          throw new Error("Order must be approved by the owner before marking ordered");
        }
        if (data.action === "mark_received" && !isOwner && !["approved","ordered"].includes(ord?.status ?? "")) {
          throw new Error("Order must be approved before it can be received");
        }
        const alreadyReceived = data.action === "mark_received" && ord?.status === "received";
        if (!alreadyReceived) {
          await supabase.from("inventory_orders").update({
            status: map[data.action], owner_comment: data.note ?? null,
            decided_by: userId, decided_at: new Date().toISOString(),
            ...(data.action === "mark_ordered" ? { ordered_at: new Date().toISOString() } : {}),
            ...(data.action === "mark_received" ? { received_at: new Date().toISOString() } : {}),
          } as any).eq("id", alert.source_id);
          if (data.action === "mark_received") {
            const { applyOrderReceipt } = await import("./inventory-orders.functions");
            await applyOrderReceipt(supabase, userId, alert.source_id);
          }
        }
      }
    }
    // Cascade to time_corrections
    if (alert.type === "time_adjustment" && alert.source_id) {
      const map: Record<string, any> = { approve: "approved", decline: "declined" };
      if (map[data.action]) {
        await supabase.from("time_corrections").update({
          status: map[data.action], decided_by: userId, decided_at: new Date().toISOString(), decision_note: data.note ?? null,
        } as any).eq("id", alert.source_id);
      }
    }
    // Cascade to time_off
    if (alert.type === "time_off" && alert.source_id) {
      const map: Record<string, any> = { approve: "approved", decline: "declined" };
      if (map[data.action]) {
        await supabase.from("time_off_requests").update({
          status: map[data.action], decided_by: userId, decided_at: new Date().toISOString(), decision_note: data.note ?? null,
        } as any).eq("id", alert.source_id);
      }
    }

    return { ok: true };
  });

export const getAlertDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ alertId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: alert, error } = await context.supabase.from("alerts").select("*").eq("id", data.alertId).single();
    if (error) throw error;
    const { data: actions } = await context.supabase.from("alert_actions").select("*").eq("alert_id", data.alertId).order("created_at");
    let order = null;
    if (alert.type === "inventory_order" && alert.source_id) {
      const { data: o } = await context.supabase.from("inventory_orders").select("*, items:inventory_order_items(*)").eq("id", alert.source_id).maybeSingle();
      order = o;
    }
    return { alert, actions: actions ?? [], order };
  });

// Owner-only: post a company-wide announcement that becomes a visible alert for every signed-in user.
export const createAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { isOwner } = await getRoles(supabase, userId);
    if (!isOwner) throw new Error("Only owners can post announcements");
    const { data: row, error } = await supabase.from("alerts").insert({
      type: "announcement",
      title: data.title,
      description: data.description ?? null,
      source_module: "announcements",
      created_by: userId,
      assigned_role: "all",
      priority: data.priority,
      status: "pending",
      payload: { announcement: true },
    } as any).select("id").single();
    if (error) throw error;
    return { ok: true, id: row?.id };
  });

const CATEGORY_KEYS = ["all","announcements","tasks","inventory","labor","scheduling","operations","maintenance","hospitality"] as const;

export const listCategoryReads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("alert_category_reads")
      .select("category, last_seen_at")
      .eq("user_id", userId);
    return (data ?? []) as { category: string; last_seen_at: string }[];
  });

export const markCategoryRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    category: z.enum(CATEGORY_KEYS),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const { error } = await supabase.from("alert_category_reads").upsert({
      user_id: userId, category: data.category, last_seen_at: now,
    } as any, { onConflict: "user_id,category" });
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "mark_alerts_read", entity: "alerts",
      payload: { category: data.category, at: now },
    } as any);
    return { ok: true, at: now };
  });
