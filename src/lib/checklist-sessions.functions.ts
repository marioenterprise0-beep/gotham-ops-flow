import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Phase = z.enum(["opening", "mid", "closing", "emergency"]);

export const getChecklistSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shiftId: z.string().uuid(), phase: Phase }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("checklist_sessions")
      .select("*")
      .eq("shift_id", data.shiftId)
      .eq("phase", data.phase)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const upsertChecklistSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        shiftId: z.string().uuid(),
        phase: Phase,
        employeeName: z.string().trim().max(120).optional().nullable(),
        managerName: z.string().trim().max(120).optional().nullable(),
        managerInitials: z.string().trim().max(8).optional().nullable(),
        startAt: z.string().datetime().optional().nullable(),
        endAt: z.string().datetime().optional().nullable(),
        notes: z.string().trim().max(2000).optional().nullable(),
        trailerId: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("checklist_sessions")
      .select("id")
      .eq("shift_id", data.shiftId)
      .eq("phase", data.phase)
      .maybeSingle();

    const payload = {
      employee_name: data.employeeName ?? null,
      manager_name: data.managerName ?? null,
      manager_initials: data.managerInitials ?? null,
      start_at: data.startAt ?? null,
      end_at: data.endAt ?? null,
      notes: data.notes ?? null,
      trailer_id: data.trailerId ?? null,
    };

    if (existing) {
      const { data: row, error } = await supabase
        .from("checklist_sessions")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await supabase
      .from("checklist_sessions")
      .insert({
        shift_id: data.shiftId,
        phase: data.phase,
        created_by: userId,
        ...payload,
      })
      .select()
      .single();
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "open_checklist_session",
      entity: "checklist_session",
      entity_id: row.id,
      payload: { shift_id: data.shiftId, phase: data.phase },
    });
    return row;
  });
