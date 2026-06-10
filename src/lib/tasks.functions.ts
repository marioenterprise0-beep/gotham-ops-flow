import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shiftId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("tasks").select("*").is("archived_at", null)
      .eq("shift_id", data.shiftId)
      .order("created_at");
    if (error) throw error;
    return rows ?? [];
  });

// Personal task list — tasks across all active shifts where:
//   - the task is directly assigned to me, OR
//   - the task is assigned to my role at my trailer and not claimed
export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("trailer_id, display_name").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const myRoles = (roleRows ?? []).map((r: any) => r.role as string);
    const trailerId = profile?.trailer_id as string | null;

    // Pull all in-flight tasks for active shifts at my trailer + tasks assigned directly to me
    const activeShifts = await supabase
      .from("shifts").select("id, trailer_id, phase")
      .eq("status", "active");

    const myShiftIds = (activeShifts.data ?? [])
      .filter((s: any) => !trailerId || s.trailer_id === trailerId)
      .map((s: any) => s.id);

    if (myShiftIds.length === 0) {
      // Only direct assignments
      const { data } = await supabase.from("tasks")
        .select("id, title, description, phase, status, assignee_role, assignee_user_id, requires_signoff, completed_at, signed_off_at, trailer_id, shift_id, created_at")
        .eq("assignee_user_id", userId).neq("status", "signed_off").order("created_at");
      return data ?? [];
    }

    const { data: rows } = await supabase.from("tasks")
      .select("id, title, description, phase, status, assignee_role, assignee_user_id, requires_signoff, completed_at, signed_off_at, trailer_id, shift_id, created_at")
      .in("shift_id", myShiftIds)
      .neq("status", "signed_off")
      .order("created_at");

    const mine = (rows ?? []).filter((t: any) =>
      t.assignee_user_id === userId
      || (!t.assignee_user_id && t.assignee_role && myRoles.includes(t.assignee_role))
    );

    // Also include direct assignments at other trailers (rare but possible)
    const { data: direct } = await supabase.from("tasks")
      .select("id, title, description, phase, status, assignee_role, assignee_user_id, requires_signoff, completed_at, signed_off_at, trailer_id, shift_id, created_at")
      .eq("assignee_user_id", userId).neq("status", "signed_off");

    const seen = new Set(mine.map((t: any) => t.id));
    for (const t of direct ?? []) if (!seen.has(t.id)) mine.push(t);

    return mine;
  });

export const completeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    taskId: z.string().uuid(),
    numericValue: z.number().optional(),
    textValue: z.string().optional(),
    photoUrl: z.string().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Authorization: caller must be the direct assignee, hold the task's
    // assignee_role at the same trailer, or be a manager.
    const { data: task0, error: te } = await supabase.from("tasks")
      .select("id, assignee_user_id, assignee_role, trailer_id").eq("id", data.taskId).maybeSingle();
    if (te) throw te;
    if (!task0) throw new Error("Task not found");
    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const myRoles = (roleRows ?? []).map((r: any) => r.role as string);
    const isManager = myRoles.some((r) => r === "owner" || r === "manager");
    const directAssignee = task0.assignee_user_id === userId;
    const roleMatchSameTrailer =
      !task0.assignee_user_id
      && !!task0.assignee_role
      && myRoles.includes(task0.assignee_role)
      && (!task0.trailer_id || task0.trailer_id === profile?.trailer_id);
    if (!directAssignee && !roleMatchSameTrailer && !isManager) {
      throw new Error("Not authorized to complete this task");
    }
    const { data: task, error } = await supabase.from("tasks").update({
      status: "done",
      owner_id: userId,
      numeric_value: data.numericValue ?? null,
      text_value: data.textValue ?? null,
      photo_url: data.photoUrl ?? null,
      completed_at: new Date().toISOString(),
    }).eq("id", data.taskId).select().single();
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "complete_task", entity: "task", entity_id: task.id,
      payload: { numericValue: data.numericValue ?? null, textValue: data.textValue ?? null },
    });
    return task;
  });

export const signOffTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const ok = (roles ?? []).some((r) => r.role === "owner" || r.role === "manager");
    if (!ok) throw new Error("Manager role required to sign off");
    if (data.approve) {
      const { data: task, error } = await supabase.from("tasks").update({
        status: "signed_off", signed_off_by: userId, signed_off_at: new Date().toISOString(),
      }).eq("id", data.taskId).select().single();
      if (error) throw error;
      await supabase.from("audit_log").insert({ actor_id: userId, action: "signoff_task", entity: "task", entity_id: task.id });
      return task;
    } else {
      const { data: task, error } = await supabase.from("tasks").update({ status: "todo", completed_at: null }).eq("id", data.taskId).select().single();
      if (error) throw error;
      await supabase.from("audit_log").insert({ actor_id: userId, action: "reject_task", entity: "task", entity_id: task.id });
      return task;
    }
  });

export const listPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trailerId: z.string().uuid().nullable().optional() }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isManager = (roles ?? []).some((r) => r.role === "owner" || r.role === "manager");
    if (!isManager) throw new Error("Manager role required");
    let q = supabase
      .from("tasks").select("*")
      .eq("status", "done").eq("requires_signoff", true)
      .order("completed_at", { ascending: false }).limit(50);
    if (data?.trailerId) q = q.eq("trailer_id", data.trailerId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

// Soft-delete (archive) a task. Managers and owners only.
export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().uuid(), reason: z.string().max(200).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const ok = (roles ?? []).some((r) => r.role === "owner" || r.role === "manager");
    if (!ok) throw new Error("Manager role required to delete tasks");
    const { error } = await supabase
      .from("tasks")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId,
        archive_reason: data.reason ?? null,
      })
      .eq("id", data.taskId);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "delete_task", entity: "task", entity_id: data.taskId,
      payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });
