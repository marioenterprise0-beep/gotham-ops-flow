import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertManager(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (roles ?? []).some((r: any) => r.role === "owner" || r.role === "manager");
  if (!ok) throw new Error("Manager role required");
}

const ROLE_VALUES = ["owner", "manager", "shift_lead", "grill", "prep", "cashier"] as const;
const PHASE_VALUES = ["opening", "mid", "closing", "emergency"] as const;

export const getManagerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trailerId: z.string().uuid().nullable().optional() }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    const { data: store } = await supabase
      .from("stores").select("id, name").order("created_at").limit(1).maybeSingle();

    const trailerId = data?.trailerId ?? null;
    let shiftQ = supabase.from("shifts").select("*").eq("status", "active").order("opened_at", { ascending: false }).limit(1);
    if (trailerId) shiftQ = shiftQ.eq("trailer_id", trailerId);
    const { data: shift } = await shiftQ.maybeSingle();

    const profilesQ = trailerId
      ? supabase.from("profiles").select("id, display_name, trailer_id").eq("trailer_id", trailerId).limit(200)
      : supabase.from("profiles").select("id, display_name, trailer_id").limit(200);
    const itemsQ = trailerId
      ? supabase.from("inventory_items").select("current_qty, low_threshold, par_level").eq("trailer_id", trailerId)
      : supabase.from("inventory_items").select("current_qty, low_threshold, par_level");

    const [{ data: profiles }, { data: roleRows }, { data: items }] = await Promise.all([
      profilesQ, supabase.from("user_roles").select("user_id, role"), itemsQ,
    ]);

    const rolesByUser = new Map<string, string>();
    for (const r of roleRows ?? []) {
      const cur = rolesByUser.get(r.user_id);
      if (!cur || r.role === "owner" || (r.role === "manager" && cur !== "owner")) {
        rolesByUser.set(r.user_id, r.role);
      }
    }

    let crewStats: Array<{ id: string; name: string; role: string; done: number; pending: number }> = [];
    let openTasks: any[] = [];
    let opsScore = 0, teamScore = 0;

    if (shift) {
      const { data: tasks } = await supabase.from("tasks")
        .select("id, title, phase, status, owner_id, created_at, requires_signoff, completed_at")
        .eq("shift_id", shift.id);

      const totalTasks = (tasks ?? []).length;
      const doneTasks = (tasks ?? []).filter((t) => t.status === "done" || t.status === "signed_off").length;
      opsScore = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

      const doneByOwner = new Map<string, number>();
      for (const t of tasks ?? []) {
        if ((t.status === "done" || t.status === "signed_off") && t.owner_id) {
          doneByOwner.set(t.owner_id, (doneByOwner.get(t.owner_id) ?? 0) + 1);
        }
      }
      const active = Array.from(doneByOwner.values()).filter((n) => n > 0).length;
      teamScore = (profiles ?? []).length ? Math.round((active / (profiles ?? []).length) * 100) : 0;

      crewStats = (profiles ?? []).map((p) => ({
        id: p.id, name: p.display_name,
        role: rolesByUser.get(p.id) ?? "cashier",
        done: doneByOwner.get(p.id) ?? 0, pending: 0,
      }));

      openTasks = (tasks ?? [])
        .filter((t) => t.status === "todo")
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
        .slice(0, 10);
    } else {
      crewStats = (profiles ?? []).map((p) => ({
        id: p.id, name: p.display_name,
        role: rolesByUser.get(p.id) ?? "cashier",
        done: 0, pending: 0,
      }));
    }

    const itemCount = (items ?? []).length;
    const healthy = (items ?? []).filter((i) => Number(i.current_qty) > Number(i.low_threshold)).length;
    const inventoryScore = itemCount ? Math.round((healthy / itemCount) * 100) : 0;

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const incQ = trailerId
      ? supabase.from("hospitality_incidents").select("severity").eq("trailer_id", trailerId).gte("logged_at", since)
      : supabase.from("hospitality_incidents").select("severity").gte("logged_at", since);
    const { data: incidents } = await incQ;
    const penalty = (incidents ?? []).reduce((acc, i) => acc + (i.severity === "high" ? 15 : i.severity === "medium" ? 7 : 3), 0);
    const hospitalityScore = Math.max(0, 100 - penalty);

    const overall = Math.round((opsScore + inventoryScore + hospitalityScore + teamScore) / 4);

    // Cross-module pending counts so the owner sees what's waiting on them.
    let alertsQ = supabase.from("alerts").select("id", { count: "exact", head: true })
      .in("status", ["open", "pending"]);
    if (trailerId) alertsQ = alertsQ.eq("trailer_id", trailerId);
    let recapsQ = supabase.from("daily_recaps").select("id", { count: "exact", head: true })
      .eq("status", "submitted");
    if (trailerId) recapsQ = recapsQ.eq("trailer_id", trailerId);
    const [{ count: pendingAlerts }, { count: pendingRecaps }] = await Promise.all([alertsQ, recapsQ]);

    return {
      store, shift, crew: crewStats, openTasks,
      scores: { ops: opsScore, inventory: inventoryScore, hospitality: hospitalityScore, team: teamScore, overall },
      pending: { alerts: pendingAlerts ?? 0, recaps: pendingRecaps ?? 0 },
    };
  });

export const createActionTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(500).optional(),
    assigneeRole: z.enum(ROLE_VALUES).optional(),
    assigneeUserId: z.string().uuid().optional(),
    phase: z.enum(PHASE_VALUES).default("mid"),
    requiresSignoff: z.boolean().default(false),
    trailerId: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);

    // Resolve trailer
    let trailerId = data.trailerId;
    if (!trailerId) {
      const { data: prof } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
      trailerId = prof?.trailer_id ?? undefined;
    }
    // If we have an assignee, prefer their trailer
    if (data.assigneeUserId) {
      const { data: aprof } = await supabase.from("profiles").select("trailer_id").eq("id", data.assigneeUserId).maybeSingle();
      if (aprof?.trailer_id) trailerId = aprof.trailer_id;
    }
    if (!trailerId) throw new Error("No trailer assigned");

    const { data: shift } = await supabase.from("shifts")
      .select("id").eq("trailer_id", trailerId).eq("status", "active")
      .order("opened_at", { ascending: false }).limit(1).maybeSingle();
    if (!shift) throw new Error("No active shift at this trailer. Open a shift first.");

    const { data: task, error } = await supabase.from("tasks").insert({
      shift_id: shift.id,
      title: data.title,
      description: data.description ?? null,
      assignee_role: data.assigneeRole ?? null,
      assignee_user_id: data.assigneeUserId ?? null,
      phase: data.phase,
      requires_signoff: data.requiresSignoff,
      status: "todo",
      trailer_id: trailerId,
    }).select().single();
    if (error) throw error;

    await supabase.from("audit_log").insert({
      actor_id: userId, action: "create_action_task", entity: "task", entity_id: task.id,
      payload: { title: data.title, assignee_role: data.assigneeRole, assignee_user_id: data.assigneeUserId, trailer_id: trailerId, phase: data.phase },
    });

    return task;
  });

export const acknowledgeAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { data: item } = await supabase.from("inventory_items")
      .select("name, current_qty, low_threshold").eq("id", data.itemId).single();
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "acknowledge_alert", entity: "inventory_item", entity_id: data.itemId,
      payload: { name: item?.name, current_qty: item?.current_qty, low_threshold: item?.low_threshold },
    });
    return { ok: true };
  });

export const reorderItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);

    const { data: item } = await supabase.from("inventory_items")
      .select("name, par_level, current_qty, unit, store_id, trailer_id").eq("id", data.itemId).single();
    if (!item) throw new Error("Item not found");

    const qty = Math.max(0, Number(item.par_level) - Number(item.current_qty));

    const { data: shift } = item.trailer_id
      ? await supabase.from("shifts")
          .select("id").eq("trailer_id", item.trailer_id).eq("status", "active")
          .order("opened_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null as { id: string } | null };

    let taskId: string | null = null;
    if (shift) {
      const { data: task } = await supabase.from("tasks").insert({
        shift_id: shift.id,
        title: `Reorder ${qty} ${item.unit} of ${item.name}`,
        description: "REORDER",
        assignee_role: "manager",
        phase: "mid",
        status: "todo",
        requires_signoff: false,
        trailer_id: item.trailer_id,
      }).select().single();
      taskId = task?.id ?? null;
    }

    await supabase.from("audit_log").insert({
      actor_id: userId, action: "reorder_request", entity: "inventory_item", entity_id: data.itemId,
      payload: { qty, name: item.name, task_id: taskId },
    });
    return { ok: true, qty, taskId };
  });

export const listCrewRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trailerId: z.string().uuid().nullable().optional() }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const trailerId = data?.trailerId ?? null;
    const profQ = trailerId
      ? supabase.from("profiles").select("id, display_name, created_at, trailer_id").eq("trailer_id", trailerId).order("display_name")
      : supabase.from("profiles").select("id, display_name, created_at, trailer_id").order("display_name");
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      profQ, supabase.from("user_roles").select("user_id, role"),
    ]);
    const byUser = new Map<string, string>();
    for (const r of roles ?? []) {
      const cur = byUser.get(r.user_id);
      if (!cur || r.role === "owner" || (r.role === "manager" && cur !== "owner")) byUser.set(r.user_id, r.role);
    }
    return (profiles ?? []).map((p) => ({ id: p.id, name: p.display_name, role: byUser.get(p.id) ?? "cashier", joined: p.created_at, trailer_id: p.trailer_id }));
  });

export const updateCrewRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: z.enum(ROLE_VALUES) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    if (data.userId === userId && data.role !== "owner" && data.role !== "manager") {
      throw new Error("You cannot demote yourself");
    }
    await supabase.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "update_role", entity: "user", entity_id: data.userId, payload: { role: data.role },
    });
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { data, error } = await supabase.from("audit_log")
      .select("id, created_at, actor_id, action, entity, entity_id, payload")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const ids = Array.from(new Set((data ?? []).map((r) => r.actor_id).filter((x): x is string => !!x)));
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] };
    const nameById = new Map<string, string>((profiles ?? []).map((p) => [p.id, p.display_name]));
    return (data ?? []).map((r) => ({ ...r, actor_name: r.actor_id ? nameById.get(r.actor_id) ?? "Unknown" : "System" }));
  });
