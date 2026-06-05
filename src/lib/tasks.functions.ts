import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shiftId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("tasks").select("*")
      .eq("shift_id", data.shiftId)
      .order("created_at");
    if (error) throw error;
    return rows ?? [];
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
    // Verify manager
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
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tasks").select("*")
      .eq("status", "done").eq("requires_signoff", true)
      .order("completed_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data ?? [];
  });
