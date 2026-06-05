import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Task template — server seeds these into the DB on first task fetch for a shift.
const TEMPLATES = {
  opening: [
    { section: "TRAILER",  title: "Power on and confirmed",       assignee_role: "shift_lead", requires_signoff: false },
    { section: "TRAILER",  title: "Generator stable",             assignee_role: "shift_lead", requires_signoff: false },
    { section: "KITCHEN",  title: "Flat top preheated (≥400°F)",  assignee_role: "grill",      requires_signoff: true  },
    { section: "KITCHEN",  title: "Cold storage temp (34-38°F)",  assignee_role: "grill",      requires_signoff: true  },
    { section: "KITCHEN",  title: "Prep station organized",       assignee_role: "prep",       requires_signoff: false },
    { section: "FRONT",    title: "POS test transaction",         assignee_role: "cashier",    requires_signoff: false },
    { section: "FRONT",    title: "Counter stocked",              assignee_role: "cashier",    requires_signoff: false },
    { section: "TEAM",     title: "Pre-shift huddle",             assignee_role: "shift_lead", requires_signoff: true  },
  ],
  mid: [
    { section: "FRONT",    title: "Counter wipe-down",            assignee_role: "cashier",    requires_signoff: false },
    { section: "KITCHEN",  title: "Grill scrape & re-season",     assignee_role: "grill",      requires_signoff: false },
    { section: "KITCHEN",  title: "Cold storage spot check",      assignee_role: "grill",      requires_signoff: true  },
  ],
  closing: [
    { section: "KITCHEN",  title: "Deep clean flat top",          assignee_role: "grill",      requires_signoff: true  },
    { section: "KITCHEN",  title: "Final cold storage temp",      assignee_role: "grill",      requires_signoff: true  },
    { section: "FRONT",    title: "Cash drop & reconciliation",   assignee_role: "shift_lead", requires_signoff: true  },
    { section: "FRONT",    title: "Trash to dumpster",            assignee_role: "cashier",    requires_signoff: false },
    { section: "TRAILER",  title: "Power down sequence",          assignee_role: "shift_lead", requires_signoff: true  },
  ],
  emergency: [
    { section: "PROTOCOL", title: "Fire suppression check",       assignee_role: "shift_lead", requires_signoff: true  },
    { section: "PROTOCOL", title: "First aid kit sealed",         assignee_role: "shift_lead", requires_signoff: false },
  ],
} as const;

export const getActiveShift = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: store } = await supabase.from("stores").select("id, name").order("created_at").limit(1).maybeSingle();
    if (!store) return { shift: null, store: null };
    const { data: shift } = await supabase
      .from("shifts").select("*")
      .eq("store_id", store.id).eq("status", "active")
      .order("opened_at", { ascending: false }).limit(1).maybeSingle();
    return { shift, store };
  });

export const openShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phase: z.enum(["opening", "mid", "closing", "emergency"]).default("opening") }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").order("created_at").limit(1).maybeSingle();
    if (!store) throw new Error("No store configured");

    // Reuse an active shift if one already exists
    const { data: existing } = await supabase
      .from("shifts").select("*")
      .eq("store_id", store.id).eq("status", "active").maybeSingle();
    if (existing) return existing;

    const { data: shift, error } = await supabase
      .from("shifts").insert({ store_id: store.id, phase: data.phase, opened_by: userId, status: "active" })
      .select().single();
    if (error) throw error;

    // Seed tasks from template
    const tasks = TEMPLATES[data.phase].map((t) => ({
      shift_id: shift.id, phase: data.phase, title: t.title, description: t.section,
      assignee_role: t.assignee_role, requires_signoff: t.requires_signoff, status: "todo" as const,
    }));
    await supabase.from("tasks").insert(tasks);

    await supabase.from("audit_log").insert({ actor_id: userId, action: "open_shift", entity: "shift", entity_id: shift.id, payload: { phase: data.phase } });
    return shift;
  });

export const closeShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shiftId: z.string().uuid(), notes: z.string().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: shift, error } = await supabase
      .from("shifts").update({ status: "closed", closed_by: userId, closed_at: new Date().toISOString(), notes: data.notes })
      .eq("id", data.shiftId).select().single();
    if (error) throw error;
    await supabase.from("audit_log").insert({ actor_id: userId, action: "close_shift", entity: "shift", entity_id: shift.id });
    return shift;
  });

export const ensureShiftPhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shiftId: z.string().uuid(), phase: z.enum(["opening", "mid", "closing", "emergency"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true })
      .eq("shift_id", data.shiftId).eq("phase", data.phase);
    if ((count ?? 0) > 0) return { seeded: 0 };
    const rows = TEMPLATES[data.phase].map((t) => ({
      shift_id: data.shiftId, phase: data.phase, title: t.title, description: t.section,
      assignee_role: t.assignee_role, requires_signoff: t.requires_signoff, status: "todo" as const,
    }));
    await supabase.from("tasks").insert(rows);
    await supabase.from("shifts").update({ phase: data.phase }).eq("id", data.shiftId);
    await supabase.from("audit_log").insert({ actor_id: userId, action: "seed_phase", entity: "shift", entity_id: data.shiftId, payload: { phase: data.phase } });
    return { seeded: rows.length };
  });
