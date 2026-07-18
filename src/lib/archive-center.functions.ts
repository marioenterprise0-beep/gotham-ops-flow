// Unified archive-center server functions. Operate on any table in ARCHIVE_TABLES
// using the canonical archive columns (archived_at, archived_by, archive_reason).
// Manager-only archive (except trailers/stores → owner). Owner-only restore/delete.

import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { z } from "zod";
import {
  ARCHIVE_TABLES,
  DOMAIN_BY_TABLE,
  DEFAULT_RETENTION_DAYS,
  type ArchiveDomain,
} from "./archive-registry";

const TABLE = z.enum(ARCHIVE_TABLES as [string, ...string[]]);

async function assertManager(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_manager", { _user_id: userId });
  if (!data) throw new Error("Manager access required");
}
async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Owner access required");
}

async function countLiveDeps(sb: any, domain: ArchiveDomain, id: string) {
  let liveTotal = 0;
  const breakdown: Array<{ table: string; label: string; live: number; archived: number }> = [];
  for (const dep of domain.deps) {
    const { count: total } = await sb
      .from(dep.table)
      .select("id", { count: "exact", head: true })
      .eq(dep.column, id);
    const { count: live } = await sb
      .from(dep.table)
      .select("id", { count: "exact", head: true })
      .eq(dep.column, id)
      .is("archived_at", null);
    const liveN = live ?? 0;
    liveTotal += liveN;
    breakdown.push({
      table: dep.table,
      label: dep.label,
      live: liveN,
      archived: (total ?? 0) - liveN,
    });
  }
  return { liveTotal, breakdown };
}

export const listArchived = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        table: TABLE,
        limit: z.number().int().min(1).max(500).default(100),
        search: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId, context.activeOrgId);
    const domain = DOMAIN_BY_TABLE[data.table];
    const cols = ["id", "archived_at", "archived_by", "archive_reason"];
    if (domain.nameColumn) cols.push(domain.nameColumn);
    let q = (supabase as any)
      .from(data.table)
      .select(cols.join(", "))
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(data.limit);
    if (data.search && domain.nameColumn) q = q.ilike(domain.nameColumn, `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const actorIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.archived_by).filter(Boolean)),
    );
    const { data: profiles } = actorIds.length
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", actorIds as string[])
      : { data: [] };
    const nameById = new Map<string, string>(
      (profiles ?? []).map((p: any) => [p.id, p.display_name]),
    );
    return (rows ?? []).map((r: any) => ({
      ...r,
      archived_by_name: r.archived_by ? (nameById.get(r.archived_by) ?? "Unknown") : null,
      display_name: domain.nameColumn
        ? (r[domain.nameColumn] ?? r.id.slice(0, 8))
        : r.id.slice(0, 8),
    }));
  });

export const scanRowDependencies = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ table: TABLE, id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId, context.activeOrgId);
    const domain = DOMAIN_BY_TABLE[data.table];
    const result = await countLiveDeps(supabase as any, domain, data.id);
    return { ...result, hasLive: result.liveTotal > 0 };
  });

export const restoreRow = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ table: TABLE, id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, context.activeOrgId);
    const patch: any = { archived_at: null, archived_by: null, archive_reason: null };
    if (data.table === "trailers" || data.table === "stores") patch.active = true;
    const { error } = await (supabase as any).from(data.table).update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: `${data.table}_restored`,
      entity: data.table,
      entity_id: data.id,
      payload: {},
    });
    return { ok: true };
  });

export const deleteArchivedRow = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        table: TABLE,
        id: z.string().uuid(),
        force: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, context.activeOrgId);
    const domain = DOMAIN_BY_TABLE[data.table];
    if (!data.force) {
      const { liveTotal, breakdown } = await countLiveDeps(supabase as any, domain, data.id);
      if (liveTotal > 0) {
        const err: any = new Error("HAS_DEPENDENCIES");
        err.code = "HAS_DEPENDENCIES";
        err.dependencies = breakdown;
        throw err;
      }
    }
    const { error } = await (supabase as any).from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: `${data.table}_purged`,
      entity: data.table,
      entity_id: data.id,
      payload: { force: data.force },
    });
    return { ok: true };
  });

// Bulk purge: hard-delete archived rows older than N days that have no live deps.
// Owner-only when called interactively. Cron caller bypasses auth via service role.
export const purgeArchivedOlderThan = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        table: TABLE.optional(),
        days: z.number().int().min(1).max(3650).default(DEFAULT_RETENTION_DAYS),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, context.activeOrgId);
    const cutoff = new Date(Date.now() - data.days * 86400_000).toISOString();
    const tables = data.table ? [data.table] : ARCHIVE_TABLES;
    const report: Array<{ table: string; purged: number; blocked: number }> = [];
    for (const t of tables) {
      const domain = DOMAIN_BY_TABLE[t];
      const { data: rows } = await (supabase as any)
        .from(t)
        .select("id")
        .not("archived_at", "is", null)
        .lt("archived_at", cutoff)
        .limit(500);
      let purged = 0,
        blocked = 0;
      for (const r of rows ?? []) {
        const { liveTotal } = await countLiveDeps(supabase as any, domain, r.id);
        if (liveTotal > 0) {
          blocked++;
          continue;
        }
        const { error } = await (supabase as any).from(t).delete().eq("id", r.id);
        if (!error) purged++;
      }
      if (purged || blocked) report.push({ table: t, purged, blocked });
    }
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "archive_purge_run",
      entity: "archive",
      entity_id: null,
      payload: { days: data.days, report },
    });
    return { cutoff, report };
  });
