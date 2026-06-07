import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireManager, requireOwner } from "@/lib/auth-guards";
import { z } from "zod";

export type AutomationSettings = {
  id: string;
  scope: string;
  rollover_enabled: boolean;
  rollover_hour: number;
  auto_clock_out_enabled: boolean;
  manager_self_approval: boolean;
  email_enabled: boolean;
  updated_at: string;
};

export const getAutomationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { data, error } = await supabase
      .from("automation_settings")
      .select("*")
      .eq("scope", "global")
      .maybeSingle();
    if (error) throw error;
    return data as AutomationSettings | null;
  });

export const updateAutomationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        rolloverEnabled: z.boolean().optional(),
        rolloverHour: z.number().int().min(0).max(23).optional(),
        autoClockOutEnabled: z.boolean().optional(),
        managerSelfApproval: z.boolean().optional(),
        emailEnabled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId);
    const patch: Record<string, unknown> = { updated_by: userId };
    if (data.rolloverEnabled !== undefined) patch.rollover_enabled = data.rolloverEnabled;
    if (data.rolloverHour !== undefined) patch.rollover_hour = data.rolloverHour;
    if (data.autoClockOutEnabled !== undefined) patch.auto_clock_out_enabled = data.autoClockOutEnabled;
    if (data.managerSelfApproval !== undefined) patch.manager_self_approval = data.managerSelfApproval;
    if (data.emailEnabled !== undefined) patch.email_enabled = data.emailEnabled;
    const { data: row, error } = await supabase
      .from("automation_settings")
      .update(patch as any)
      .eq("scope", "global")
      .select()
      .single();
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "update_automation_settings", entity: "automation_settings", entity_id: row.id, payload: data as any,
    });
    return row as AutomationSettings;
  });

export const listRolloverRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("rollover_runs")
      .select("*")
      .order("ran_at", { ascending: false })
      .limit(data.limit ?? 20);
    if (error) throw error;
    return rows ?? [];
  });
