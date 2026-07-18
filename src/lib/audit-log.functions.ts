// Extended audit-log reader with filters + CSV export.
// Manager-only.

import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

async function assertManager(supabase: any, userId: string, orgId: string) {
  const { data } = await supabase.rpc("is_manager", { _user_id: userId, _org_id: orgId });
  if (!data) throw new Error("Manager access required");
}

const FILTER = z.object({
  action: z.string().optional(),
  entity: z.string().optional(),
  actorId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0),
  search: z.string().optional(),
});

export const listAuditLogFiltered = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => FILTER.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId, context.activeOrgId);
    let q = (supabase as any)
      .from("audit_log")
      .select("id, created_at, actor_id, action, entity, entity_id, payload", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    if (data.entity) q = q.eq("entity", data.entity);
    if (data.actorId) q = q.eq("actor_id", data.actorId);
    if (data.fromDate) q = q.gte("created_at", data.fromDate);
    if (data.toDate) q = q.lte("created_at", data.toDate);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.actor_id).filter(Boolean)));
    // email is no longer SELECT-granted to authenticated (see migration
    // 20260621280000) — this read is already behind assertManager above,
    // so the admin client is the right way to get it, not a broader grant.
    const { data: profiles } = ids.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, display_name, email")
          .in("id", ids as string[])
      : { data: [] };
    const nameById = new Map<string, { name: string; email: string }>(
      (profiles ?? []).map((p: any) => [p.id, { name: p.display_name, email: p.email }]),
    );
    return {
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        actor_name: r.actor_id ? (nameById.get(r.actor_id)?.name ?? "Unknown") : "System",
        actor_email: r.actor_id ? (nameById.get(r.actor_id)?.email ?? null) : null,
      })),
      total: count ?? 0,
    };
  });

export const auditLogFilterOptions = createServerFn({ method: "GET" })
  .middleware([requireActiveOrg])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId, context.activeOrgId);
    const { data } = await (supabase as any).from("audit_log").select("action, entity").limit(2000);
    const actions = Array.from(
      new Set((data ?? []).map((r: any) => r.action as string)),
    ).sort() as string[];
    const entities = Array.from(
      new Set((data ?? []).map((r: any) => r.entity as string).filter(Boolean)),
    ).sort() as string[];
    return { actions, entities };
  });
