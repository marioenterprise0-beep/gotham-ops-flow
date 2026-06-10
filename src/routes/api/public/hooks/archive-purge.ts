// Nightly cron — purges archived rows past retention. Uses service role.
// Caller authenticates via a dedicated secret in the `x-purge-key` header.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { ARCHIVE_DOMAINS, DEFAULT_RETENTION_DAYS, type ArchiveDomain } from "@/lib/archive-registry";

async function hasLive(sb: any, domain: ArchiveDomain, id: string): Promise<boolean> {
  for (const dep of domain.deps) {
    const { count } = await sb.from(dep.table).select("id", { count: "exact", head: true }).eq(dep.column, id).is("archived_at", null);
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

export const Route = createFileRoute("/api/public/hooks/archive-purge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ARCHIVE_PURGE_KEY;
        const provided = request.headers.get("x-purge-key");
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        const body = await request.json().catch(() => ({})) as { days?: number };
        const days = Math.min(3650, Math.max(1, body.days ?? DEFAULT_RETENTION_DAYS));
        const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const report: Array<{ table: string; purged: number; blocked: number; scanned: number }> = [];
        for (const domain of ARCHIVE_DOMAINS) {
          const { data: rows } = await (sb as any).from(domain.table)
            .select("id").not("archived_at", "is", null).lt("archived_at", cutoff).limit(500);
          let purged = 0, blocked = 0;
          for (const r of rows ?? []) {
            if (domain.deps.length && await hasLive(sb, domain, r.id)) { blocked++; continue; }
            const { error } = await (sb as any).from(domain.table).delete().eq("id", r.id);
            if (!error) purged++;
          }
          if ((rows?.length ?? 0) > 0) report.push({ table: domain.table, purged, blocked, scanned: rows!.length });
        }
        await (sb as any).from("audit_log").insert({
          actor_id: null, action: "archive_purge_cron", entity: "archive", entity_id: null,
          payload: { days, cutoff, report },
        });
        return new Response(JSON.stringify({ ok: true, cutoff, report }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
