// Server-only helpers shared by shifts.functions.ts and timeclock.functions.ts.
// Never import from client/route code.

import { TEMPLATES } from "./shift-templates.server";
export { TEMPLATES };

type Phase = "opening" | "mid" | "closing" | "emergency";

export function phaseFromHour(date: Date = new Date()): Phase {
  const h = date.getHours();
  if (h >= 4 && h < 11) return "opening";
  if (h >= 11 && h < 16) return "mid";
  return "closing";
}

export async function seedPhaseIfMissing(
  supabase: any,
  shiftId: string,
  trailerId: string | null,
  phase: Phase,
  actorId?: string,
  trigger: "open_shift" | "reopen_shift" | "seed_phase" | "clock_in_auto_open" = "open_shift",
) {
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("shift_id", shiftId)
    .eq("phase", phase);
  if ((count ?? 0) > 0) return 0;
  const rows = TEMPLATES[phase].map((t: any) => ({
    shift_id: shiftId,
    phase,
    title: t.title,
    description: t.section,
    assignee_role: t.assignee_role,
    requires_signoff: t.requires_signoff,
    status: "todo" as const,
    trailer_id: trailerId,
  }));
  await supabase.from("tasks").insert(rows);
  if (rows.length > 0 && (phase === "opening" || phase === "closing")) {
    await supabase.from("audit_log").insert({
      actor_id: actorId ?? null,
      action: "seed_required_checklist",
      entity: "shift",
      entity_id: shiftId,
      payload: { phase, trigger, seeded: rows.length, trailer_id: trailerId },
    });
  }
  return rows.length;
}

/**
 * Find the trailer's active shift; if there is none, open one with the phase
 * implied by the current local hour and seed opening + closing + current-phase
 * checklists.
 */
export async function ensureActiveShiftForTrailer(
  supabase: any,
  trailerId: string,
  actorId: string,
): Promise<{ shift: any; created: boolean } | null> {
  const { data: existing } = await supabase
    .from("shifts")
    .select("*")
    .eq("trailer_id", trailerId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return { shift: existing, created: false };

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!store) return null;

  const phase = phaseFromHour();
  const { data: created, error } = await supabase
    .from("shifts")
    .insert({
      store_id: store.id,
      trailer_id: trailerId,
      phase,
      opened_by: actorId,
      status: "active",
    })
    .select()
    .single();
  if (error || !created) return null;

  for (const ph of ["opening", "closing", phase] as Phase[]) {
    await seedPhaseIfMissing(supabase, created.id, trailerId, ph, actorId, "clock_in_auto_open");
  }
  await supabase.from("audit_log").insert({
    actor_id: actorId,
    action: "auto_open_shift",
    entity: "shift",
    entity_id: created.id,
    payload: { phase, trailer_id: trailerId, trigger: "clock_in" },
  });
  return { shift: created, created: true };
}

/**
 * Materialize personal tasks for a user from `task_templates` matching their
 * trailer + any of their roles + the shift's current phase. Idempotent via
 * the (template_id, assignee_user_id, shift_id) unique index.
 */
export async function instantiatePersonalTasks(
  supabase: any,
  shiftId: string,
  trailerId: string | null,
  userId: string,
  roles: string[],
  phase: Phase,
): Promise<number> {
  if (roles.length === 0) return 0;
  let q = supabase
    .from("task_templates")
    .select("id, trailer_id, role, phase, title, description, requires_signoff, position")
    .eq("active", true)
    .eq("phase", phase)
    .in("role", roles);
  // Match templates scoped to this trailer OR global (trailer_id IS NULL).
  if (trailerId) q = q.or(`trailer_id.eq.${trailerId},trailer_id.is.null`);
  else q = q.is("trailer_id", null);
  const { data: templates } = await q;
  if (!templates || templates.length === 0) return 0;

  // Skip templates this user already has on this shift.
  const tplIds = templates.map((t: any) => t.id);
  const { data: existing } = await supabase
    .from("tasks")
    .select("template_id")
    .in("template_id", tplIds)
    .eq("assignee_user_id", userId)
    .eq("shift_id", shiftId);
  const seen = new Set((existing ?? []).map((r: any) => r.template_id));
  const toInsert = templates
    .filter((t: any) => !seen.has(t.id))
    .map((t: any) => ({
      template_id: t.id,
      shift_id: shiftId,
      phase,
      title: t.title,
      description: t.description,
      assignee_role: t.role,
      assignee_user_id: userId,
      requires_signoff: t.requires_signoff,
      status: "todo" as const,
      trailer_id: trailerId,
    }));
  if (toInsert.length === 0) return 0;
  const { error } = await supabase.from("tasks").insert(toInsert);
  if (error) return 0;
  await supabase.from("audit_log").insert({
    actor_id: userId,
    action: "assign_personal_tasks",
    entity: "shift",
    entity_id: shiftId,
    payload: { phase, count: toInsert.length, roles, trailer_id: trailerId },
  });
  return toInsert.length;
}

/**
 * Mark all of this user's still-open personal tasks on the shift as `missed`.
 * Returns the count closed.
 */
export async function closeUserIncompleteTasks(
  supabase: any,
  shiftId: string,
  userId: string,
): Promise<number> {
  const { data: rows } = await supabase
    .from("tasks")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("assignee_user_id", userId)
    .not("status", "in", "(done,signed_off,missed)");
  const ids = (rows ?? []).map((r: any) => r.id);
  if (ids.length === 0) return 0;
  await supabase.from("tasks").update({ status: "missed" }).in("id", ids);
  await supabase.from("audit_log").insert({
    actor_id: userId,
    action: "auto_miss_on_clock_out",
    entity: "shift",
    entity_id: shiftId,
    payload: { closed: ids.length },
  });
  return ids.length;
}
