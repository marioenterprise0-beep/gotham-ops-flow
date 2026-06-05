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
      .select("id, name, category, current_qty, par_level, low_threshold");
    const lowItems = (items ?? [])
      .filter((i) => Number(i.current_qty) <= Number(i.low_threshold))
      .map((i) => ({
        id: i.id, name: i.name,
        pct: i.par_level > 0 ? Math.round((Number(i.current_qty) / Number(i.par_level)) * 100) : 0,
        critical: Number(i.current_qty) <= Number(i.low_threshold) * 0.5,
      }));

    const { data: crew } = await supabase
      .from("profiles").select("id, display_name").limit(20);

    return {
      store, shift,
      tasks: { total: totalTasks, done: doneTasks, remaining: Math.max(0, totalTasks - doneTasks) },
      alerts: { count: lowItems.length, items: lowItems.slice(0, 5) },
      crew: crew ?? [],
    };
  });
