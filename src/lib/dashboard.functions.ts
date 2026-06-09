import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardStats = createServerFn({ method: "GET" })
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

    let totalTasks = 0, doneTasks = 0;
    if (shift) {
      const { data: tasks } = await supabase.from("tasks")
        .select("status").eq("shift_id", shift.id);
      totalTasks = tasks?.length ?? 0;
      doneTasks = (tasks ?? []).filter((t) => t.status === "done" || t.status === "signed_off").length;
    }

    const { data: items } = await supabase.from("inventory_items")
      .select("id, name, category, current_qty, par_level, low_threshold")
      .is("archived_at", null);
    const lowItems = (items ?? [])
      .filter((i) => Number(i.low_threshold) > 0 && Number(i.current_qty) <= Number(i.low_threshold))
      .map((i) => ({
        id: i.id, name: i.name,
        pct: i.par_level > 0 ? Math.round((Number(i.current_qty) / Number(i.par_level)) * 100) : 0,
        critical: Number(i.current_qty) <= Number(i.low_threshold) * 0.5,
      }));

    // Pull real pending alerts (orders, corrections, recaps, etc.) so the
    // dashboard reflects the same alerts surface as the alerts page.
    const { data: pendingAlerts } = await supabase.from("alerts")
      .select("id, type, title, priority")
      .in("status", ["open", "pending"])
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: crew } = await supabase
      .from("profiles").select("id, display_name").is("archived_at", null).limit(20);

    return {
      store, shift,
      tasks: { total: totalTasks, done: doneTasks, remaining: Math.max(0, totalTasks - doneTasks) },
      alerts: {
        count: lowItems.length + (pendingAlerts ?? []).length,
        lowStock: lowItems.slice(0, 5),
        pending: pendingAlerts ?? [],
        items: lowItems.slice(0, 5), // legacy field, kept for existing UI
      },
      crew: crew ?? [],
    };
  });
