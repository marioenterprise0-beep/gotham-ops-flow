import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertManager(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (roles ?? []).some((r: any) => r.role === "owner" || r.role === "manager");
  if (!ok) throw new Error("Manager role required");
}

export const getManagerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data: store } = await supabase
      .from("stores").select("id, name").order("created_at").limit(1).maybeSingle();

    const { data: shift } = store
      ? await supabase.from("shifts").select("*")
          .eq("store_id", store.id).eq("status", "active")
          .order("opened_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null };

    const [{ data: profiles }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("id, display_name").limit(50),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const rolesByUser = new Map<string, string>();
    for (const r of roleRows ?? []) {
      // keep highest role roughly: owner/manager beats others
      const cur = rolesByUser.get(r.user_id);
      if (!cur || r.role === "owner" || (r.role === "manager" && cur !== "owner")) {
        rolesByUser.set(r.user_id, r.role);
      }
    }

    let crewStats: Array<{ id: string; name: string; role: string; done: number; pending: number }> = [];
    let openTasks: any[] = [];

    if (shift) {
      const { data: tasks } = await supabase.from("tasks")
        .select("id, title, phase, status, owner_id, created_at, requires_signoff, completed_at")
        .eq("shift_id", shift.id);

      const doneByOwner = new Map<string, number>();
      for (const t of tasks ?? []) {
        if ((t.status === "done" || t.status === "signed_off") && t.owner_id) {
          doneByOwner.set(t.owner_id, (doneByOwner.get(t.owner_id) ?? 0) + 1);
        }
      }

      crewStats = (profiles ?? []).map((p) => ({
        id: p.id,
        name: p.display_name,
        role: rolesByUser.get(p.id) ?? "cashier",
        done: doneByOwner.get(p.id) ?? 0,
        pending: 0,
      }));

      openTasks = (tasks ?? [])
        .filter((t) => t.status === "todo")
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
        .slice(0, 10);
    } else {
      crewStats = (profiles ?? []).map((p) => ({
        id: p.id,
        name: p.display_name,
        role: rolesByUser.get(p.id) ?? "cashier",
        done: 0,
        pending: 0,
      }));
    }

    return { store, shift, crew: crewStats, openTasks };
  });

const ROLE_VALUES = ["owner", "manager", "shift_lead", "grill", "prep", "cashier"] as const;
const PHASE_VALUES = ["opening", "mid", "closing", "emergency"] as const;

export const createActionTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(500).optional(),
    assigneeRole: z.enum(ROLE_VALUES).optional(),
    phase: z.enum(PHASE_VALUES).default("mid"),
    requiresSignoff: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);

    const { data: store } = await supabase
      .from("stores").select("id").order("created_at").limit(1).maybeSingle();
    if (!store) throw new Error("No store configured");

    const { data: shift } = await supabase.from("shifts")
      .select("id").eq("store_id", store.id).eq("status", "active")
      .order("opened_at", { ascending: false }).limit(1).maybeSingle();
    if (!shift) throw new Error("No active shift. Open a shift first.");

    const { data: task, error } = await supabase.from("tasks").insert({
      shift_id: shift.id,
      title: data.title,
      description: data.description ?? null,
      assignee_role: data.assigneeRole ?? null,
      phase: data.phase,
      requires_signoff: data.requiresSignoff,
      status: "todo",
    }).select().single();
    if (error) throw error;

    await supabase.from("audit_log").insert({
      actor_id: userId, action: "create_action_task", entity: "task", entity_id: task.id,
      payload: { title: data.title, assignee_role: data.assigneeRole, phase: data.phase },
    });

    return task;
  });
