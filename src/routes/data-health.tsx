import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { EmbedShell } from "@/components/gotham/EmbedShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { canSee, useRole } from "@/lib/role";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { runAllDependencyScans } from "@/lib/data-health.functions";
import { RefreshCcw, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/data-health")({
  ssr: false,
  beforeLoad: () => { throw redirect({ to: "/admin", search: { tab: "system" } as any }); },
  head: () => ({ meta: [{ title: "Data Health · Gotham OS" }] }),
  component: DataHealthPage,
});

function ageDays(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
}

export function DataHealthPage() {
  const { roleId } = useRole();
  if (!canSee(roleId, "manager")) return <Navigate to="/" />;
  const [retention, setRetention] = useState(90);
  const fetchScans = useServerFn(runAllDependencyScans);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["data-health", retention],
    queryFn: () => fetchScans({ data: { retentionDays: retention } }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <EmbedShell>
      <SectionHeader
        eyebrow="Operations"
        title="Data Health"
        action={
          <div className="flex gap-2 items-center">
            <select value={retention} onChange={(e) => setRetention(Number(e.target.value))}
              className="text-sm bg-background border border-border rounded-md px-2 py-1">
              <option value={30}>30d retention</option>
              <option value={60}>60d retention</option>
              <option value={90}>90d retention</option>
              <option value={180}>180d retention</option>
              <option value={365}>1y retention</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCcw className={"h-3 w-3 mr-1 " + (isFetching ? "animate-spin" : "")} /> Scan
            </Button>
          </div>
        }
      />

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Total archived rows</div>
            <div className="text-2xl font-semibold">{data.totals.archived}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Past retention · purgeable</div>
            <div className="text-2xl font-semibold text-emerald-600">{data.totals.purgeable}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Past retention · blocked</div>
            <div className="text-2xl font-semibold text-amber-600">{data.totals.blocked}</div>
          </Card>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Scanning…</div>}
        {data?.domains.map((d, i) => {
          const age = ageDays(d.oldestArchivedAt);
          return (
            <div key={d.table} className={"p-3 grid grid-cols-1 md:grid-cols-[1fr_120px_120px_120px_1fr] gap-2 items-center " + (i ? "border-t border-border" : "")}>
              <div>
                <div className="text-sm font-medium">{d.label}</div>
                <div className="text-xs text-muted-foreground">{d.table}</div>
              </div>
              <div className="text-xs">
                <div className="text-muted-foreground">Archived</div>
                <div className="font-semibold">{d.totalArchived}</div>
              </div>
              <div className="text-xs">
                <div className="text-muted-foreground">Purgeable</div>
                <div className="font-semibold text-emerald-600">{d.purgeable}</div>
              </div>
              <div className="text-xs">
                <div className="text-muted-foreground">Blocked</div>
                <div className="font-semibold text-amber-600">{d.blocked}</div>
              </div>
              <div className="text-xs">
                {d.oldestArchivedAt && <div className="text-muted-foreground">Oldest {age}d ago</div>}
                {d.blockedSamples.length > 0 ? (
                  <div className="flex items-center gap-1 text-amber-600 mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="truncate">{d.blockedSamples.map((s) => s.name).join(", ")}</span>
                  </div>
                ) : d.totalArchived > 0 ? (
                  <div className="flex items-center gap-1 text-emerald-600 mt-1">
                    <CheckCircle2 className="h-3 w-3" /> No blockers
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </Card>

      <div className="h-6" />
    </EmbedShell>
  );
}
