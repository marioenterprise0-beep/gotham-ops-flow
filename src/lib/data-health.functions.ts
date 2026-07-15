// Cross-domain dependency dashboard.
// Manager-only. Aggregates per-domain archived counts, oldest age, and
// surfaces archived rows that still block hard delete (live children).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  ARCHIVE_DOMAINS,
  DOMAIN_BY_TABLE,
  DEFAULT_RETENTION_DAYS,
  type ArchiveDomain,
} from "./archive-registry";

async function assertManager(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_manager", { _user_id: userId });
  if (!data) throw new Error("Manager access required");
}

async function rowHasLiveDeps(sb: any, domain: ArchiveDomain, id: string): Promise<boolean> {
  for (const dep of domain.deps) {
    const { count } = await sb
      .from(dep.table)
      .select("id", { count: "exact", head: true })
      .eq(dep.column, id)
      .is("archived_at", null);
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

export const runAllDependencyScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ retentionDays: z.number().int().min(1).max(3650).default(DEFAULT_RETENTION_DAYS) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const cutoff = new Date(Date.now() - data.retentionDays * 86400_000).toISOString();
    const sb: any = supabase;

    const results = await Promise.all(
      ARCHIVE_DOMAINS.map(async (domain) => {
        const { count: totalArchived } = await sb
          .from(domain.table)
          .select("id", { count: "exact", head: true })
          .not("archived_at", "is", null);
        const { data: oldestRow } = await sb
          .from(domain.table)
          .select("archived_at")
          .not("archived_at", "is", null)
          .order("archived_at", { ascending: true })
          .limit(1);
        const oldest = oldestRow?.[0]?.archived_at ?? null;

        // Sample up to 200 archived rows past the retention window to estimate blocked vs purgeable
        const cols = ["id"];
        if (domain.nameColumn) cols.push(domain.nameColumn);
        const { data: candidates } = await sb
          .from(domain.table)
          .select(cols.join(", "))
          .not("archived_at", "is", null)
          .lt("archived_at", cutoff)
          .limit(200);

        let blocked = 0;
        let purgeable = 0;
        const blockedSamples: Array<{ id: string; name: string }> = [];
        for (const r of candidates ?? []) {
          if (domain.deps.length === 0) {
            purgeable++;
            continue;
          }
          const live = await rowHasLiveDeps(sb, domain, r.id);
          if (live) {
            blocked++;
            if (blockedSamples.length < 5) {
              blockedSamples.push({
                id: r.id,
                name: domain.nameColumn
                  ? (r[domain.nameColumn] ?? r.id.slice(0, 8))
                  : r.id.slice(0, 8),
              });
            }
          } else {
            purgeable++;
          }
        }
        return {
          table: domain.table,
          label: domain.label,
          totalArchived: totalArchived ?? 0,
          oldestArchivedAt: oldest,
          sampleSize: candidates?.length ?? 0,
          blocked,
          purgeable,
          blockedSamples,
        };
      }),
    );

    return {
      cutoff,
      retentionDays: data.retentionDays,
      domains: results,
      totals: {
        archived: results.reduce((a, r) => a + r.totalArchived, 0),
        blocked: results.reduce((a, r) => a + r.blocked, 0),
        purgeable: results.reduce((a, r) => a + r.purgeable, 0),
      },
    };
  });
