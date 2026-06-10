import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { canSee, useRole } from "@/lib/role";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { ARCHIVE_DOMAINS } from "@/lib/archive-registry";
import { listArchived, scanRowDependencies, restoreRow, deleteArchivedRow, purgeArchivedOlderThan } from "@/lib/archive-center.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RotateCcw, Trash2, Search, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/archive-center")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Archive Center · Gotham OS" }] }),
  component: ArchiveCenterPage,
});

function ArchiveCenterPage() {
  const { roleId } = useRole();
  if (!canSee(roleId, "manager")) return <Navigate to="/" />;
  const isOwner = roleId === "owner";
  const qc = useQueryClient();
  const [activeTable, setActiveTable] = useState(ARCHIVE_DOMAINS[0].table);
  const [search, setSearch] = useState("");
  const [depsRow, setDepsRow] = useState<{ table: string; id: string; name: string } | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);

  const fetchList = useServerFn(listArchived);
  const fetchDeps = useServerFn(scanRowDependencies);
  const doRestore = useServerFn(restoreRow);
  const doDelete = useServerFn(deleteArchivedRow);
  const doPurge = useServerFn(purgeArchivedOlderThan);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["archive-center", activeTable, search],
    queryFn: () => fetchList({ data: { table: activeTable, search: search || undefined, limit: 100 } }),
  });

  const { data: deps } = useQuery({
    queryKey: ["archive-deps", depsRow?.table, depsRow?.id],
    queryFn: () => fetchDeps({ data: { table: depsRow!.table, id: depsRow!.id } }),
    enabled: !!depsRow,
  });

  const restoreM = useMutation({
    mutationFn: (row: any) => doRestore({ data: { table: activeTable, id: row.id } }),
    onSuccess: () => { toast.success("Restored"); refetch(); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e?.message ?? "Restore failed"),
  });
  const deleteM = useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) => doDelete({ data: { table: activeTable, id, force } }),
    onSuccess: () => { toast.success("Deleted"); setDepsRow(null); refetch(); qc.invalidateQueries(); },
    onError: (e: any) => {
      if (e?.message === "HAS_DEPENDENCIES") toast.error("Has live dependencies — review before forcing");
      else toast.error(e?.message ?? "Delete failed");
    },
  });
  const purgeM = useMutation({
    mutationFn: (days: number) => doPurge({ data: { days } }),
    onSuccess: (r: any) => {
      const totalPurged = r.report.reduce((a: number, x: any) => a + x.purged, 0);
      const totalBlocked = r.report.reduce((a: number, x: any) => a + x.blocked, 0);
      toast.success(`Purged ${totalPurged} rows · ${totalBlocked} blocked`);
      setPurgeOpen(false); refetch(); qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Purge failed"),
  });

  return (
    <AppShell>
      <SectionHeader
        eyebrow="Data hygiene"
        title="Archive Center"
        action={isOwner ? (
          <Button variant="outline" size="sm" onClick={() => setPurgeOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Bulk purge
          </Button>
        ) : null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <Card className="p-2 max-h-[70vh] overflow-y-auto">
          {ARCHIVE_DOMAINS.map((d) => (
            <button
              key={d.table}
              onClick={() => { setActiveTable(d.table); setSearch(""); }}
              className={cn(
                "w-full text-left text-sm rounded-md px-3 py-2 hover:bg-muted",
                activeTable === d.table && "bg-muted font-semibold"
              )}
            >
              {d.label}
            </button>
          ))}
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search archived rows…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
            <StatusPill tone="info">{rows.length} rows</StatusPill>
          </div>

          <Card className="p-0 overflow-hidden">
            {isLoading && <div className="p-6 text-sm text-muted-foreground text-center">Loading…</div>}
            {!isLoading && rows.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No archived rows.</div>}
            {rows.map((r: any, i: number) => (
              <div key={r.id} className={cn("p-3 grid grid-cols-1 md:grid-cols-[1fr_160px_180px_auto] gap-2 items-center", i && "border-t border-border")}>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.display_name}</div>
                  {r.archive_reason && <div className="text-xs text-muted-foreground truncate">{r.archive_reason}</div>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.archived_at).toLocaleDateString()} {new Date(r.archived_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
                <div className="text-xs text-muted-foreground truncate">{r.archived_by_name ?? "—"}</div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setDepsRow({ table: activeTable, id: r.id, name: r.display_name })}>
                    Deps
                  </Button>
                  {isOwner && (
                    <Button size="sm" variant="outline" onClick={() => restoreM.mutate(r)}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Restore
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <Dialog open={!!depsRow} onOpenChange={(v) => !v && setDepsRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dependencies — {depsRow?.name}</DialogTitle></DialogHeader>
          {!deps && <div className="text-sm text-muted-foreground">Scanning…</div>}
          {deps && deps.breakdown.length === 0 && <div className="text-sm text-muted-foreground">No child references defined.</div>}
          {deps && deps.breakdown.length > 0 && (
            <div className="space-y-2">
              {deps.breakdown.map((d) => (
                <div key={d.table} className="flex justify-between text-sm border-b border-border pb-2">
                  <span>{d.label}</span>
                  <span>
                    <StatusPill tone={d.live > 0 ? "danger" : "success"}>{d.live} live</StatusPill>
                    {d.archived > 0 && <span className="ml-2 text-xs text-muted-foreground">{d.archived} archived</span>}
                  </span>
                </div>
              ))}
              {deps.hasLive && (
                <div className="flex gap-2 items-center text-amber-600 text-xs">
                  <AlertTriangle className="h-4 w-4" /> Hard delete blocked while live children exist.
                </div>
              )}
            </div>
          )}
          {isOwner && depsRow && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => deleteM.mutate({ id: depsRow.id, force: false })} disabled={deleteM.isPending}>
                Delete (safe)
              </Button>
              {deps?.hasLive && (
                <Button variant="destructive" onClick={() => {
                  if (confirm("Force delete will cascade orphan references. Continue?")) deleteM.mutate({ id: depsRow.id, force: true });
                }}>
                  Force delete
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk purge archived rows</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Permanently deletes archived rows older than the selected retention window, across every domain. Rows with live dependencies are skipped.</p>
            <p className="text-xs">A nightly cron also runs this automatically.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => purgeM.mutate(180)} disabled={purgeM.isPending}>180 days</Button>
            <Button variant="outline" onClick={() => purgeM.mutate(90)} disabled={purgeM.isPending}>90 days</Button>
            <Button variant="destructive" onClick={() => purgeM.mutate(30)} disabled={purgeM.isPending}>30 days</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="h-6" />
    </AppShell>
  );
}
