import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireManager } from "@/lib/auth-guards";
import { z } from "zod";

export type MaintenanceStatus = "open" | "in_progress" | "resolved";
export type MaintenanceRequest = {
  id: string;
  trailer_id: string | null;
  reported_by: string;
  title: string;
  description: string | null;
  priority: "critical" | "high" | "normal" | "low";
  photo_url: string | null;
  status: MaintenanceStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export const submitMaintenanceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(2000).optional(),
        priority: z.enum(["critical", "high", "normal", "low"]).default("normal"),
        photoUrl: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
    const { data: row, error } = await (supabase as any)
      .from("maintenance_requests")
      .insert({
        reported_by: userId,
        trailer_id: profile?.trailer_id ?? null,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        // Only a bare storage path is accepted, never an arbitrary URL —
        // same rule as inventory item images, for the same reason.
        photo_url: data.photoUrl && !data.photoUrl.includes("://") ? data.photoUrl : null,
      } as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as MaintenanceRequest;
  });

export const listMaintenanceRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ includeResolved: z.boolean().optional(), includeArchived: z.boolean().optional() }).optional().parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = (supabase as any).from("maintenance_requests").select("*").order("created_at", { ascending: false });
    if (!data?.includeArchived) q = q.is("archived_at", null);
    if (!data?.includeResolved) q = q.neq("status", "resolved");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as MaintenanceRequest[];
  });

export const updateMaintenanceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "in_progress", "resolved"]),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "resolved") {
      patch.resolved_by = userId;
      patch.resolved_at = new Date().toISOString();
      patch.resolution_note = data.note ?? null;
    }
    const { error } = await (supabase as any).from("maintenance_requests").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId, action: `maintenance_${data.status}`, entity: "maintenance_request", entity_id: data.id,
      payload: { note: data.note ?? null },
    });
    return { ok: true };
  });

export const archiveMaintenanceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { error } = await (supabase as any)
      .from("maintenance_requests")
      .update({ archived_at: new Date().toISOString(), archived_by: userId, archive_reason: data.reason ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restoreMaintenanceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { error } = await (supabase as any)
      .from("maintenance_requests")
      .update({ archived_at: null, archived_by: null, archive_reason: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
