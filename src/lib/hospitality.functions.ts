import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CATEGORIES = ["greeting", "accuracy", "upsell", "wait_ack", "recovery", "other"] as const;

export const listHospitality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let start: Date, end: Date;
    if (data.month) {
      const [y, m] = data.month.split("-").map((n) => parseInt(n, 10));
      start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      end = new Date(y, m, 0, 23, 59, 59, 999);
    } else {
      start = new Date(); start.setHours(0, 0, 0, 0);
      end = new Date();
    }
    const { data: rows, error } = await supabase
      .from("hospitality_incidents")
      .select("id, type, severity, notes, recovery_action, logged_at, logged_by")
      .gte("logged_at", start.toISOString())
      .lte("logged_at", end.toISOString())
      .order("logged_at", { ascending: false });
    if (error) throw error;

    const cats: Record<string, { count: number; penalty: number }> = {};
    for (const c of CATEGORIES) cats[c] = { count: 0, penalty: 0 };
    for (const r of rows ?? []) {
      const c = (r.type as string) in cats ? (r.type as string) : "other";
      const sev = r.severity === "high" ? 15 : r.severity === "medium" ? 8 : 3;
      cats[c].count += 1;
      cats[c].penalty += sev;
    }
    const breakdown = CATEGORIES.map((c) => ({
      key: c,
      label: ({ greeting: "Greeting", accuracy: "Order Accuracy", upsell: "Upselling", wait_ack: "Wait Acknowledgement", recovery: "Guest Recovery", other: "Other" } as any)[c],
      pct: Math.max(0, 100 - cats[c].penalty),
      count: cats[c].count,
    }));
    const score = Math.round(breakdown.reduce((s, b) => s + b.pct, 0) / breakdown.length);
    return { rows: rows ?? [], breakdown, score };
  });

// Backwards-compatible alias used elsewhere.
export const listHospitalityToday = listHospitality;

export const logHospitalityIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    type: z.enum(CATEGORIES),
    severity: z.enum(["low", "medium", "high"]).default("low"),
    notes: z.string().trim().max(500).optional(),
    recovery_action: z.string().trim().max(500).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
    const { error } = await supabase.from("hospitality_incidents").insert({
      type: data.type,
      severity: data.severity,
      notes: data.notes ?? null,
      recovery_action: data.recovery_action ?? null,
      logged_by: userId,
      trailer_id: prof?.trailer_id ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });
