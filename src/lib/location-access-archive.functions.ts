// Phase 12 — canonical archive/restore for auxiliary flow tables:
//   location_access_requests.
//
// Other auxiliary tables intentionally not covered:
//  - invite_codes:           already has `disabled_at` (functional archive).
//  - automation_settings:    singleton config row.
//  - notification_preferences: per-user singleton.
//  - tab_permissions:        access-control rules; use delete, not archive.
//  - email_send_log / email_*: append-only log streams.
//  - audit_log / change_log: immutable history.
//
// Archive: manager-only, audit-logged.
// Restore: owner-only.
// Hard delete owner-only (no dependent rows for this table).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertManager(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_manager", { _user_id: userId });
  if (!data) throw new Error("Manager access required");
}
async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Owner access required");
}

export const scanLocationRequestDependencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb: any = context.supabase;
    // Linked alert is the only soft dependency.
    const { count } = await sb
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("source_id", data.id)
      .eq("source_module", "location")
      .is("archived_at", null);
    const c = count ?? 0;
    return {
      entity: "location_access_requests",
      id: data.id,
      dependencies: [{ table: "alerts", label: "Linked alerts", count: c }],
      total: c,
      liveTotal: c,
      hasDependencies: c > 0,
    };
  });

export const archiveLocationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    reason: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb: any = supabase;
    await assertManager(supabase, userId);
    const { error } = await sb.from("location_access_requests").update({
      archived_at: new Date().toISOString(),
      archived_by: userId,
      archive_reason: data.reason ?? null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    // Also resolve any open linked alert so it disappears from the alert center.
    await sb.from("alerts").update({
      status: "resolved",
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
    }).eq("source_id", data.id).eq("source_module", "location").in("status", ["pending", "open"]);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "location_access_requests_archived",
      entity: "location_access_requests",
      entity_id: data.id,
      payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreLocationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb: any = supabase;
    await assertOwner(supabase, userId);
    const { error } = await sb.from("location_access_requests").update({
      archived_at: null, archived_by: null, archive_reason: null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "location_access_requests_restored",
      entity: "location_access_requests",
      entity_id: data.id,
      payload: {},
    });
    return { ok: true };
  });

export const deleteLocationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    force: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb: any = supabase;
    await assertOwner(supabase, userId);
    const { error } = await sb.from("location_access_requests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "location_access_requests_deleted",
      entity: "location_access_requests",
      entity_id: data.id,
      payload: { force: !!data.force },
    });
    return { ok: true };
  });
