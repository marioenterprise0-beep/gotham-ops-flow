import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill, MetricStat } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Banknote, Plus, Download, FileText, ShieldCheck, AlertTriangle, Check, X, Clock, TrendingUp, TrendingDown, FileDown, Trash2, Pencil } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { toast } from "sonner";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import {
  listCashDrawers, addCashDrawer, openDrawerSession, closeDrawerSession,
  getDrawerSession, listDrawerSessions, submitCashDrop, verifyCashDrop, reviewDrawerSession,
  editDrawerSession, archiveDrawer, scanDrawerDependencies, renameCashDrawer,
  attachDrawerClosePdf, getDrawerClosePdfUrl, sendDrawerCloseAlertEmail,
} from "@/lib/cash.functions";
import { openPrintablePDF, kpiBlock, htmlTable, escapeHTML, downloadCSV } from "@/lib/exports";
import { buildDrawerClosePdf, uploadDrawerClosePdf } from "@/lib/cash-pdf";
import { supabase } from "@/integrations/supabase/client";
import { syncDomains } from "@/lib/sync-bus";

export const Route = createFileRoute("/cash")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Cash Management · Gotham OS" }] }),
  component: CashPage,
});

const money = (n: number | string | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function CashPage() {
  const qc = useQueryClient();
  const { roleId, trailerScope, homeTrailerId, trailers, session, loading } = useRole();
  const isManager = roleId === "owner" || roleId === "manager";
  const isOwner = roleId === "owner";
  const trailerId = trailerScope ?? homeTrailerId ?? null;
  const trailerName = trailers.find((t) => t.id === trailerId)?.name ?? "—";

  const listDrawersFn = useServerFn(listCashDrawers);
  const listSessionsFn = useServerFn(listDrawerSessions);

  const { data: drawers = [] } = useQuery<any[]>({
    queryKey: ["cash-drawers", trailerId ?? "none"],
    queryFn: () => listDrawersFn({ data: trailerId ? { trailerId } : {} }) as Promise<any[]>,
    enabled: !loading && !!session?.access_token,
    refetchInterval: 30000,
  });

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["cash-sessions", trailerId ?? "all"],
    queryFn: () => listSessionsFn({ data: { trailerId: trailerId ?? undefined, limit: 50 } }) as Promise<any[]>,
    enabled: !loading && !!session?.access_token,
    refetchInterval: 30000,
  });

  const openCount = drawers.filter((d) => d.open_session).length;
  const cashInDrawers = drawers.reduce((s, d) => s + (d.open_session ? Number(d.open_session.starting_float) : 0), 0);

  // EOD summary — sessions opened or closed today
  const todayStr = new Date().toLocaleDateString();
  const todaySessions = sessions.filter((s) => new Date(s.opened_at).toLocaleDateString() === todayStr);
  const todayClosed = todaySessions.filter((s) => s.status !== "open");
  const todaySales = todayClosed.reduce((sum, s) => sum + Number(s.total_cash_sales ?? 0), 0);
  const todayVariance = todayClosed.reduce((sum, s) => sum + Number(s.variance ?? 0), 0);
  const todayFlagged = todayClosed.filter((s) => s.owner_review === "flagged").length;

  // Variance trend data (last 30 closed sessions, oldest→newest)
  const trendData = sessions
    .filter((s) => s.status !== "open" && s.variance != null && s.closed_at)
    .slice(-30)
    .map((s) => ({
      label: new Date(s.closed_at).toLocaleDateString([], { month: "short", day: "numeric" }),
      variance: Math.round(Number(s.variance) * 100) / 100,
      drawer: drawers.find((d) => d.id === s.drawer_id)?.name ?? "?",
    }));

  const exportCSV = () => {
    const headers = ["Date", "Drawer", "Status", "Opened", "Closed", "Cash Sales", "Float", "Counted", "Variance", "Review"];
    const rows = sessions.map((s) => {
      const d = drawers.find((dr) => dr.id === s.drawer_id);
      return [
        s.opened_at ? new Date(s.opened_at).toLocaleDateString() : "",
        d?.name ?? "",
        s.status,
        s.opened_at ? new Date(s.opened_at).toLocaleString() : "",
        s.closed_at ? new Date(s.closed_at).toLocaleString() : "",
        s.total_cash_sales ?? "",
        s.starting_float ?? "",
        s.counted_amount ?? "",
        s.variance ?? "",
        s.owner_review ?? "",
      ];
    });
    downloadCSV(`cash-sessions-${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const [addOpen, setAddOpen] = useState(false);
  const [openFor, setOpenFor] = useState<any | null>(null);
  const [closeFor, setCloseFor] = useState<any | null>(null);
  const [dropFor, setDropFor] = useState<any | null>(null);
  const [detailFor, setDetailFor] = useState<string | null>(null);

  return (
    <AppShell>
      <SectionHeader eyebrow="Module" title="Cash Management" action={
        <div className="flex items-center gap-2">
          <StatusPill tone="gold">{trailerName}</StatusPill>
        </div>
      } />

      <Card className="mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricStat label="Open Drawers" value={String(openCount)} />
          <MetricStat label="Float In Drawers" value={money(cashInDrawers)} tone="gold" />
          <MetricStat label="Drawers Configured" value={String(drawers.length)} />
          <MetricStat label="Recent Sessions" value={String(sessions.length)} />
        </div>
      </Card>

      {todaySessions.length > 0 && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-1.5">
              Today's Summary
            </h3>
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              {" · "}{todayClosed.length} closed
              {todaySessions.length - todayClosed.length > 0 && `, ${todaySessions.length - todayClosed.length} open`}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricStat label="Cash Sales Today" value={money(todaySales)} tone="gold" />
            <MetricStat
              label="Net Variance"
              value={`${todayVariance >= 0 ? "+" : ""}${money(todayVariance)}`}
              tone={todayVariance === 0 ? undefined : todayVariance > 0 ? "success" : "danger"}
            />
            <MetricStat label="Sessions Today" value={String(todaySessions.length)} />
            <MetricStat
              label="Flagged"
              value={String(todayFlagged)}
              tone={todayFlagged > 0 ? "danger" : undefined}
            />
          </div>
        </Card>
      )}

      <SectionHeader title="Drawers" action={
        trailerId && isManager ? (
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Add Drawer
          </Button>
        ) : null
      } />

      {!trailerId && <Card>Select a trailer scope to manage drawers.</Card>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {drawers.map((d) => (
          <DrawerCard
            key={d.id}
            drawer={d}
            isOwner={isOwner}
            onRequestOpen={() => setOpenFor(d)}
            onClose={() => setCloseFor(d)}
            onDrop={() => setDropFor(d)}
            onView={(sid) => setDetailFor(sid)}
            onDeleted={() => syncDomains(qc, "cash", "dashboard", "history", "alerts", "recaps")}
          />
        ))}
      </div>

      {trendData.length > 1 && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Variance Trend</h3>
            <span className="text-xs text-muted-foreground">Last {trendData.length} closed sessions</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={trendData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={38} />
              <Tooltip
                formatter={(v: any) => [`${Number(v) >= 0 ? "+" : ""}$${Math.abs(Number(v)).toFixed(2)}`, "Variance"]}
                labelFormatter={(l: any, p: any) => `${l} · ${p?.[0]?.payload?.drawer ?? ""}`}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="variance" radius={[3, 3, 0, 0]}>
                {trendData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.variance === 0 ? "#16a34a" : Math.abs(entry.variance) > 5 ? "#dc2626" : "#d97706"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#16a34a" }} />Exact</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#d97706" }} />Small variance (&lt;$5)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#dc2626" }} />Large variance (&gt;$5)</span>
          </div>
        </Card>
      )}

      <SectionHeader title="Store Activities" action={
        sessions.length > 0 ? (
          <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1">
            <FileDown className="h-4 w-4" /> Export CSV
          </Button>
        ) : null
      } />
      <StoreActivitiesTable
        sessions={sessions}
        drawers={drawers}
        onOpenSession={(sid) => setDetailFor(sid)}
      />


      {addOpen && trailerId && (
        <AddDrawerDialog trailerId={trailerId} onClose={() => setAddOpen(false)} onSaved={() => {
          setAddOpen(false);
          syncDomains(qc, "cash");
        }} />
      )}
      {openFor && (
        <OpenDrawerDialog
          drawer={openFor}
          onClose={() => setOpenFor(null)}
          onSaved={() => {
            setOpenFor(null);
            syncDomains(qc, "cash");
          }}
        />
      )}
      {closeFor && (
        <CloseDrawerDialog
          drawer={closeFor}
          session={closeFor.open_session}
          onClose={() => setCloseFor(null)}
          onSaved={(sid) => {
            setCloseFor(null);
            syncDomains(qc, "cash");
            setDetailFor(sid);
          }}
        />
      )}
      {dropFor && (
        <CashDropDialog
          drawer={dropFor}
          session={dropFor.open_session}
          onClose={() => setDropFor(null)}
          onSaved={() => {
            setDropFor(null);
            syncDomains(qc, "cash");
          }}
        />
      )}
      {detailFor && (
        <SessionDetailDialog
          sessionId={detailFor}
          isManager={isManager}
          isOwner={isOwner}
          onClose={() => setDetailFor(null)}
          onChanged={() => {
            syncDomains(qc, "cash");
          }}
        />
      )}
    </AppShell>
  );
}

function StoreActivitiesTable({ sessions, drawers, onOpenSession }: {
  sessions: any[];
  drawers: any[];
  onOpenSession: (sid: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const drawerName = (id: string) => drawers.find((d) => d.id === id)?.name ?? "—";

  // Group sessions by calendar day (based on opened_at)
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; sessions: any[] }>();
    for (const s of sessions) {
      const d = new Date(s.opened_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      if (!map.has(key)) map.set(key, { key, label, sessions: [] });
      map.get(key)!.sessions.push(s);
    }
    // sort newest first
    return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        No drawer sessions yet.
      </Card>
    );
  }

  const sumBy = (arr: any[], k: string) => arr.reduce((s, x) => s + Number(x?.[k] ?? 0), 0);

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        // Group day's sessions by drawer name (so renames like "morning shift"/"closing shift" show cleanly)
        const byDrawer = new Map<string, any[]>();
        for (const s of g.sessions) {
          const name = drawerName(s.drawer_id);
          if (!byDrawer.has(name)) byDrawer.set(name, []);
          byDrawer.get(name)!.push(s);
        }
        const dayClosed = g.sessions.filter((s) => s.status !== "open");
        const daySales = sumBy(dayClosed, "total_cash_sales");
        const dayCounted = sumBy(dayClosed, "counted_amount");
        const dayVariance = sumBy(dayClosed, "variance");
        const isOpen = !!expanded[g.key];
        const vTone = dayVariance === 0 ? "success" : Math.abs(dayVariance) > 5 ? "danger" : "warning";
        return (
          <Card key={g.key} className="overflow-hidden">
            <button
              onClick={() => setExpanded((p) => ({ ...p, [g.key]: !p[g.key] }))}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                <div className="min-w-0">
                  <div className="font-semibold">{g.label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {Array.from(byDrawer.keys()).join(" • ")} · {g.sessions.length} session{g.sessions.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sales</div>
                  <div className="font-semibold">{money(daySales)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Counted</div>
                  <div className="font-semibold">{money(dayCounted)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Variance</div>
                  <StatusPill tone={vTone as any}>{dayVariance >= 0 ? "+" : ""}{money(dayVariance)}</StatusPill>
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border bg-muted/20 divide-y divide-border/60">
                {Array.from(byDrawer.entries()).map(([name, arr]) => {
                  const closed = arr.filter((s) => s.status !== "open");
                  const sSales = sumBy(closed, "total_cash_sales");
                  const sCounted = sumBy(closed, "counted_amount");
                  const sVar = sumBy(closed, "variance");
                  const sTone = sVar === 0 ? "success" : Math.abs(sVar) > 5 ? "danger" : "warning";
                  return (
                    <div key={name} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="font-medium capitalize">{name}</div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">Sales <span className="text-foreground font-semibold">{money(sSales)}</span></span>
                          <span className="text-muted-foreground">Counted <span className="text-foreground font-semibold">{money(sCounted)}</span></span>
                          <StatusPill tone={sTone as any}>{sVar >= 0 ? "+" : ""}{money(sVar)}</StatusPill>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                              <th className="py-1 pr-3">Status</th>
                              <th className="py-1 pr-3">Opened</th>
                              <th className="py-1 pr-3">Closed</th>
                              <th className="py-1 pr-3">Sales</th>
                              <th className="py-1 pr-3">Counted</th>
                              <th className="py-1 pr-3">Variance</th>
                              <th className="py-1 pr-3">Review</th>
                              <th className="py-1 pr-3"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {arr.map((s) => {
                              const v = Number(s.variance ?? 0);
                              const tone = s.status === "open" ? "info" : v === 0 ? "success" : Math.abs(v) > 5 ? "danger" : "warning";
                              return (
                                <tr key={s.id} className="border-t border-border/40">
                                  <td className="py-1.5 pr-3"><StatusPill tone={s.status === "open" ? "info" : s.status === "pending" ? "warning" : "neutral"}>{s.status}</StatusPill></td>
                                  <td className="py-1.5 pr-3 text-muted-foreground">{new Date(s.opened_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td>
                                  <td className="py-1.5 pr-3 text-muted-foreground">{s.closed_at ? new Date(s.closed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}</td>
                                  <td className="py-1.5 pr-3">{s.total_cash_sales != null ? money(s.total_cash_sales) : "—"}</td>
                                  <td className="py-1.5 pr-3">{s.counted_amount != null ? money(s.counted_amount) : "—"}</td>
                                  <td className="py-1.5 pr-3">{s.variance != null ? <StatusPill tone={tone as any}>{v >= 0 ? "+" : ""}{money(v)}</StatusPill> : "—"}</td>
                                  <td className="py-1.5 pr-3">
                                    {s.status !== "open" ? <StatusPill tone={
                                      s.owner_review === "approved" ? "success" :
                                      s.owner_review === "correction" ? "warning" :
                                      s.owner_review === "flagged" ? "danger" : "neutral"
                                    }>{s.owner_review}</StatusPill> : "—"}
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    <button onClick={() => onOpenSession(s.id)} className="text-[11px] underline text-foreground/70 hover:text-foreground">Open</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}


function DrawerCard({ drawer, isOwner, onRequestOpen, onClose, onDrop, onView, onDeleted }: {
  drawer: any;
  isOwner: boolean;
  onRequestOpen: () => void;
  onClose: () => void;
  onDrop: () => void;
  onView: (sid: string) => void;
  onDeleted: () => void;
}) {
  const isOpen = !!drawer.open_session;
  const scanFn = useServerFn(scanDrawerDependencies);
  const archiveFn = useServerFn(archiveDrawer);
  const renameFn = useServerFn(renameCashDrawer);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const handleRename = async () => {
    const next = window.prompt(`Rename drawer "${drawer.name}"`, drawer.name)?.trim();
    if (!next || next === drawer.name) return;
    if (!/^[a-zA-Z0-9 _-]+$/.test(next) || next.length > 40) {
      toast.error("Name must be 1–40 chars: letters, numbers, spaces, _ or -");
      return;
    }
    try {
      setRenaming(true);
      await renameFn({ data: { drawerId: drawer.id, name: next } });
      toast.success("Drawer renamed");
      onDeleted();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to rename drawer");
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    try {
      const scan = await scanFn({ data: { id: drawer.id } });
      const msg = scan.hasDependencies
        ? `Delete "${drawer.name}"? It has ${scan.sessions} past session${scan.sessions === 1 ? "" : "s"}. The drawer will be archived and hidden; historical sessions stay in the audit log.`
        : `Delete "${drawer.name}"? This drawer has no sessions.`;
      if (!confirm(msg)) return;
      setDeleting(true);
      await archiveFn({ data: { id: drawer.id, reason: "Deleted by owner" } });
      toast.success("Drawer deleted");
      onDeleted();
    } catch (e: any) {
      if (e?.message === "HAS_OPEN_SESSION" || String(e?.message ?? "").includes("HAS_OPEN_SESSION")) {
        toast.error("Close the drawer session before deleting.");
      } else {
        toast.error(e?.message ?? "Failed to delete drawer");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-[var(--color-gold)]" />
            <h3 className="font-semibold text-lg">{drawer.name}</h3>
            {isOwner && (
              <button
                type="button"
                onClick={handleRename}
                disabled={renaming}
                title="Rename drawer"
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Float {money(drawer.starting_float)}</p>
        </div>
        <StatusPill tone={isOpen ? "success" : drawer.enabled ? "neutral" : "danger"}>
          {isOpen ? "Open" : drawer.enabled ? "Closed" : "Disabled"}
        </StatusPill>
      </div>

      {isOpen ? (
        <div className="text-xs text-muted-foreground border-t border-border pt-2">
          Opened {new Date(drawer.open_session.opened_at).toLocaleString()}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!isOpen && (
          <Button size="sm" variant="default" disabled={!drawer.enabled} onClick={onRequestOpen}>
            Open Drawer
          </Button>
        )}
        {isOpen && (
          <>
            <Button size="sm" variant="default" onClick={onClose}>Close Drawer</Button>
            <Button size="sm" variant="outline" onClick={onDrop}>Cash Drop</Button>
            <Button size="sm" variant="ghost" onClick={() => onView(drawer.open_session.id)}>Activity</Button>
          </>
        )}
        {isOwner && !isOpen && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              disabled={renaming}
              onClick={handleRename}
            >
              <Pencil className="h-4 w-4 mr-1" />
              {renaming ? "Renaming…" : "Rename"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function AddDrawerDialog({ trailerId, onClose, onSaved }: { trailerId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [float, setFloat] = useState("150");
  const addFn = useServerFn(addCashDrawer);
  const mu = useMutation({
    mutationFn: () => addFn({ data: { trailerId, name: name.trim(), startingFloat: Number(float) || 0 } }),
    onSuccess: () => { toast.success("Drawer added"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Cash Drawer</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Drawer Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="pos1" maxLength={40} />
          </div>
          <div>
            <Label>Starting Float ($)</Label>
            <Input type="number" inputMode="decimal" value={float} onChange={(e) => setFloat(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mu.mutate()} disabled={!name.trim() || mu.isPending}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CashDropDialog({ drawer, session, onClose, onSaved }: { drawer: any; session: any; onClose: () => void; onSaved: () => void }) {
  const { user } = useRole();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const submit = useServerFn(submitCashDrop);
  const [savedDrop, setSavedDrop] = useState<any | null>(null);
  const mu = useMutation({
    mutationFn: () => submit({ data: { sessionId: session.id, amount: Number(amount), reason: reason || undefined, notes: notes || undefined } }),
    onSuccess: (drop: any) => {
      setSavedDrop(drop);
      toast.success(`Cash drop ${drop.drop_code} recorded`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const downloadSlip = () => {
    if (!savedDrop) return;
    printCashDropSlip({
      drop: savedDrop,
      drawerName: drawer.name,
      trailerName: drawer.trailer_id, // placeholder; full name resolved in detail view
      submittedBy: user,
      verifiedBy: null,
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && (savedDrop ? onSaved() : onClose())}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cash Drop — {drawer.name}</DialogTitle></DialogHeader>
        {!savedDrop ? (
          <div className="space-y-3">
            <div>
              <Label>Cash Drop Amount ($)</Label>
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Mid-shift drop" maxLength={200} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} />
            </div>
            <div className="text-xs text-muted-foreground">
              Submitted by <b>{user}</b> · Drawer <b>{drawer.name}</b> · {new Date().toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="rounded-md border border-border p-3 bg-secondary">
              <div className="text-xs text-muted-foreground">Drop ID</div>
              <div className="font-mono font-semibold text-lg">{savedDrop.drop_code}</div>
              <div className="mt-2 text-xs">Amount: <b>{money(savedDrop.amount)}</b></div>
            </div>
            <p className="text-xs text-muted-foreground">Drop saved and expected drawer amount updated.</p>
          </div>
        )}
        <DialogFooter>
          {!savedDrop ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => mu.mutate()} disabled={!Number(amount) || mu.isPending}>Submit Cash Drop</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={downloadSlip} className="gap-1">
                <Download className="h-4 w-4" /> Download Slip PDF
              </Button>
              <Button onClick={onSaved}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseDrawerDialog({ drawer, session, onClose, onSaved }: {
  drawer: any; session: any; onClose: () => void; onSaved: (sid: string) => void;
}) {
  const { user } = useRole();
  const [sales, setSales] = useState("");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [verification, setVerification] = useState<"self" | "requested">("self");

  const detailFn = useServerFn(getDrawerSession);
  const { data: detail } = useQuery<any>({
    queryKey: ["cash-session-pre", session.id],
    queryFn: () => detailFn({ data: { sessionId: session.id } }),
  });
  const drops = detail?.drops ?? [];
  const totalDrops = drops.reduce((s: number, d: any) => s + Number(d.amount), 0);

  const starting = Number(session.starting_float);
  const salesNum = Number(sales) || 0;
  const countedNum = Number(counted) || 0;
  // Correct model: float stays in drawer and is counted with the cash.
  const expectedDrawerTotal = starting + salesNum;
  const variance = countedNum - expectedDrawerTotal;
  const dropAmount = countedNum - starting;
  const remainingFloat = starting;
  const belowFloat = counted !== "" && countedNum < starting;
  const needsReason = variance !== 0;
  const canSubmit =
    sales !== "" && counted !== "" &&
    (!needsReason || reason.trim().length > 0) &&
    (!belowFloat || verification === "requested");

  const closeFn = useServerFn(closeDrawerSession);
  const attachFn = useServerFn(attachDrawerClosePdf);
  const emailFn = useServerFn(sendDrawerCloseAlertEmail);
  const mu = useMutation({
    mutationFn: () => closeFn({ data: {
      sessionId: session.id,
      totalCashSales: salesNum,
      countedAmount: countedNum,
      varianceReason: reason || undefined,
      varianceNotes: notes || undefined,
      verification,
    } }),
    onSuccess: async () => {
      toast.success("Drawer closed");
      // Build, upload, attach PDF — non-blocking for the UX flow.
      try {
        const detail = await detailFn({ data: { sessionId: session.id } }) as any;
        const { blob, filename } = buildDrawerClosePdf(detail);
        const path = await uploadDrawerClosePdf(supabase, session.id, detail.session.trailer_id, blob);
        await attachFn({ data: { sessionId: session.id, path } });
        // Offer the file to the submitter immediately.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        toast.success("Drawer Close PDF attached");
        // Fire-and-forget: email managers/owners with PDF attached via Resend.
        emailFn({ data: { sessionId: session.id } })
          .then((r: any) => { if (r?.sent) toast.success(`Alert email sent to ${r.sent} recipient(s)`); })
          .catch((e: any) => toast.error(`Email failed: ${e?.message ?? "unknown"}`));
      } catch (e: any) {
        toast.error(`PDF attach failed: ${e?.message ?? "unknown"}`);
      }
      onSaved(session.id);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Close Drawer — {drawer.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Card className="bg-secondary">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Starting Float</div><div className="font-semibold">{money(starting)}</div></div>
              <div><div className="text-xs text-muted-foreground">Mid-shift Drops</div><div className="font-semibold">{drops.length} · {money(totalDrops)}</div></div>
              <div><div className="text-xs text-muted-foreground">Remaining Float (target)</div><div className="font-semibold">{money(remainingFloat)}</div></div>
            </div>
          </Card>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Total Cash Sales From POS</Label>
              <Input type="number" inputMode="decimal" value={sales} onChange={(e) => setSales(e.target.value)} placeholder="550.00" autoFocus />
            </div>
            <div>
              <Label>Actual Cash Counted (includes float)</Label>
              <Input type="number" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="750.00" />
              <p className="text-[11px] text-muted-foreground mt-1">Tip: use Money Count below to total bills + coins automatically.</p>
            </div>
          </div>

          <MoneyCount title="Money Count" onTotalChange={(t) => setCounted(t.toFixed(2))} />


          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3 bg-[#E8F0FE]">
              <div className="text-[10px] uppercase tracking-wider text-[#2D6CDF]">Actual Count</div>
              <div className="text-xl font-bold text-[#2D6CDF]">{money(countedNum)}</div>
            </div>
            <div className="rounded-lg border border-border p-3 bg-[var(--color-success-bg)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-success)]">Expected Drawer Total</div>
              <div className="text-xl font-bold text-[var(--color-success)]">{money(expectedDrawerTotal)}</div>
            </div>
            <div className={`rounded-lg border p-3 ${variance === 0 ? "border-border bg-secondary" : "border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)]"}`}>
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-danger)]">Variance</div>
              <div className={`text-xl font-bold ${variance === 0 ? "text-foreground" : "text-[var(--color-danger)]"}`}>
                {variance >= 0 ? "+" : ""}{money(variance)}
              </div>
            </div>
            <div className="rounded-lg border border-border p-3 bg-[var(--color-warning-bg,#FFF8E1)]">
              <div className="text-[10px] uppercase tracking-wider">Drop Amount</div>
              <div className="text-xl font-bold">{money(Math.max(0, dropAmount))}</div>
              <div className="text-[10px] text-muted-foreground">Remaining float {money(remainingFloat)}</div>
            </div>
          </div>

          {belowFloat && (
            <div className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)] p-3 text-sm text-[var(--color-danger)]">
              <b>Drawer below starting float.</b> Owner review is required — Request Verification is enforced.
            </div>
          )}

          {needsReason && (
            <>
              <div>
                <Label>Variance Reason {variance !== 0 && <span className="text-[var(--color-danger)]">*</span>}</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Short cause (e.g. wrong change given)" />
              </div>
              <div>
                <Label>Variance Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} />
              </div>
            </>
          )}

          <div>
            <Label>Verification</Label>
            <div className="flex gap-2 mt-1">
              <Button size="sm" variant={verification === "self" ? "default" : "outline"} disabled={belowFloat} onClick={() => setVerification("self")}>Self-Verify</Button>
              <Button size="sm" variant={verification === "requested" ? "default" : "outline"} onClick={() => setVerification("requested")}>Request Verification</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Closed by <b>{user}</b> · {new Date().toLocaleString()}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Go Back</Button>
          <Button onClick={() => mu.mutate()} disabled={!canSubmit || mu.isPending}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionDetailDialog({ sessionId, isManager, isOwner, onClose, onChanged }: {
  sessionId: string; isManager: boolean; isOwner: boolean; onClose: () => void; onChanged: () => void;
}) {
  const detailFn = useServerFn(getDrawerSession);
  const { data, refetch } = useQuery<any>({
    queryKey: ["cash-session", sessionId],
    queryFn: () => detailFn({ data: { sessionId } }),
  });

  const verifyFn = useServerFn(verifyCashDrop);
  const reviewFn = useServerFn(reviewDrawerSession);
  const [reviewNote, setReviewNote] = useState("");

  const verifyMu = useMutation({
    mutationFn: (dropId: string) => verifyFn({ data: { dropId } }),
    onSuccess: () => { toast.success("Drop verified"); refetch(); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const reviewMu = useMutation({
    mutationFn: (decision: "approved"|"correction"|"flagged") => reviewFn({ data: { sessionId, decision, note: reviewNote || undefined } }),
    onSuccess: () => { toast.success("Review saved"); refetch(); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (!data) return null;
  const { session: s, drawer, trailer, drops, names } = data;
  const totalDrops = drops.reduce((acc: number, d: any) => acc + Number(d.amount), 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Drawer Session — {drawer?.name ?? "—"}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <Card className="bg-secondary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Field label="Status" value={s.status} />
              <Field label="Trailer" value={trailer?.name ?? "—"} />
              <Field label="Opened" value={new Date(s.opened_at).toLocaleString()} />
              <Field label="Closed" value={s.closed_at ? new Date(s.closed_at).toLocaleString() : "—"} />
              <Field label="Opened By" value={names[s.opened_by] ?? "—"} />
              <Field label="Closed By" value={s.closed_by ? (names[s.closed_by] ?? "—") : "—"} />
              <Field label="Verification" value={s.verification} />
              <Field label="Owner Review" value={s.owner_review} />
            </div>
          </Card>

          {s.status !== "open" && (
            <Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Field label="Starting Float" value={money(s.starting_float)} />
                <Field label="Total Cash Sales From POS" value={money(s.total_cash_sales)} />
                <Field label="Expected Drawer Total" value={money(s.expected_amount)} />
                <Field label="Actual Cash Counted" value={money(s.counted_amount)} />
                <Field label="Variance" value={`${Number(s.variance) >= 0 ? "+" : ""}${money(s.variance)}`} />
                <Field label="Drop Amount" value={money(Math.max(0, Number(s.counted_amount ?? 0) - Number(s.starting_float)))} />
                <Field label="Remaining Float" value={money(s.starting_float)} />
                <Field label="Mid-shift Drops" value={`${drops.length} · ${money(totalDrops)}`} />
              </div>
              {s.variance_reason && (
                <div className="mt-2 text-sm text-muted-foreground">Reason / Notes: {s.variance_reason}</div>
              )}
            </Card>
          )}

          {isOwner && s.status !== "open" && (
            <EditDrawerSessionInline session={s} onSaved={() => { refetch(); onChanged(); }} />
          )}



          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Cash Drops ({drops.length})</h4>
              {s.status !== "open" && (
                <div className="flex gap-2">
                  {s.pdf_path && (
                    <StoredPdfButton sessionId={s.id} />
                  )}
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => printDrawerClose({
                    session: s, drawer, trailer, drops, names, totalDrops,
                  })}>
                    <FileText className="h-4 w-4" /> Drawer Close PDF
                  </Button>
                </div>
              )}
            </div>
            {drops.length === 0 ? (
              <Card className="text-sm text-muted-foreground">No cash drops in this session.</Card>
            ) : (
              <div className="space-y-2">
                {drops.map((d: any) => (
                  <Card key={d.id} className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-mono text-xs text-muted-foreground">{d.drop_code}</div>
                      <div className="font-semibold">{money(d.amount)} <span className="text-xs text-muted-foreground font-normal">· {d.reason || "—"}</span></div>
                      <div className="text-xs text-muted-foreground">
                        By {names[d.submitted_by] ?? "—"} · {new Date(d.submitted_at).toLocaleString()}
                        {d.verified_by && <> · ✅ Verified by {names[d.verified_by] ?? "—"}</>}
                      </div>
                      {d.notes && <div className="text-xs mt-1">{d.notes}</div>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => printCashDropSlip({
                        drop: d, drawerName: drawer?.name ?? "—",
                        trailerName: trailer?.name ?? "—",
                        submittedBy: names[d.submitted_by] ?? "—",
                        verifiedBy: d.verified_by ? (names[d.verified_by] ?? null) : null,
                      })}>
                        <Download className="h-3 w-3" /> Slip
                      </Button>
                      {isManager && !d.verified_by && (
                        <Button size="sm" className="gap-1" onClick={() => verifyMu.mutate(d.id)}>
                          <ShieldCheck className="h-3 w-3" /> Verify
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {isManager && s.status !== "open" && (() => {
            const absVar = Math.abs(Number(s.variance ?? 0));
            const needsOwner = absVar > 50;
            const canApprove = isOwner || !needsOwner;
            return (
              <Card goldAccent>
                <h4 className="font-semibold mb-2">
                  {isOwner ? "Owner Approval" : needsOwner ? "Manager Review (Owner approval required)" : "Manager Verification"}
                </h4>
                {!isOwner && needsOwner && (
                  <p className="text-xs text-[var(--color-warning,#9a6b00)] mb-2">
                    Variance is over $50 — final approval is locked to the owner. You can still request a correction or flag.
                  </p>
                )}
                <Textarea placeholder="Note (optional)" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} maxLength={1000} />
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button size="sm" className="gap-1" disabled={!canApprove} onClick={() => reviewMu.mutate("approved")}>
                    <Check className="h-3 w-3" /> {isOwner ? "Approve Variance" : "Verify Drawer"}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => reviewMu.mutate("correction")}><Clock className="h-3 w-3" /> Request Recount</Button>
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => reviewMu.mutate("flagged")}><AlertTriangle className="h-3 w-3" /> Flag / Escalate</Button>
                </div>
                {s.owner_note && <p className="text-xs text-muted-foreground mt-2">Last note: {s.owner_note}</p>}
              </Card>
            );
          })()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="h-4 w-4 mr-1" /> Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StoredPdfButton({ sessionId }: { sessionId: string }) {
  const getUrlFn = useServerFn(getDrawerClosePdfUrl);
  const [loading, setLoading] = useState(false);
  return (
    <Button size="sm" variant="outline" className="gap-1" disabled={loading} onClick={async () => {
      setLoading(true);
      try {
        const r = await getUrlFn({ data: { sessionId } }) as { url: string | null };
        if (r?.url) window.open(r.url, "_blank", "noopener");
        else toast.error("Stored PDF not found");
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load PDF");
      } finally { setLoading(false); }
    }}>
      <Download className="h-4 w-4" /> Stored PDF
    </Button>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}

// ---------------- PDFs ----------------

function printCashDropSlip(p: {
  drop: any; drawerName: string; trailerName: string; submittedBy: string; verifiedBy: string | null;
}) {
  const d = p.drop;
  const when = new Date(d.submitted_at);
  const body = `
    <h1>Cash Drop Slip</h1>
    <div class="meta">Gotham Halal · Cash Management</div>
    ${kpiBlock([
      { label: "Drop ID", value: d.drop_code },
      { label: "Amount", value: `$${Number(d.amount).toFixed(2)}`, tone: "warn" },
      { label: "Date", value: when.toLocaleDateString() },
      { label: "Time", value: when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }) },
    ])}
    <h2>Details</h2>
    ${htmlTable(
      ["Field", "Value"],
      [
        ["Business", "Gotham Halal"],
        ["Module", "Cash Management"],
        ["Type", "Cash Drop Slip"],
        ["Location / Trailer", p.trailerName],
        ["Drawer", p.drawerName],
        ["Cash Drop Amount", `$${Number(d.amount).toFixed(2)}`],
        ["Reason", d.reason || "—"],
        ["Notes", d.notes || "—"],
        ["Submitted By", p.submittedBy],
        ["Manager Verified By", p.verifiedBy || "— Not yet verified —"],
        ["Unique Drop ID", d.drop_code],
      ],
    )}
    <h2>Signature / Confirmation</h2>
    <div style="margin-top:24px; display:flex; gap:40px;">
      <div style="flex:1;"><div style="border-top:1px solid #000; padding-top:4px; font-size:10px;">Submitter Signature</div></div>
      <div style="flex:1;"><div style="border-top:1px solid #000; padding-top:4px; font-size:10px;">Manager Signature</div></div>
    </div>
  `;
  openPrintablePDF(`Cash Drop Slip — ${d.drop_code}`, body);
}

function printDrawerClose(p: { session: any; drawer: any; trailer: any; drops: any[]; names: Record<string, string>; totalDrops: number }) {
  const s = p.session;
  const v = Number(s.variance ?? 0);
  const starting = Number(s.starting_float);
  const counted = Number(s.counted_amount ?? 0);
  const expected = Number(s.expected_amount ?? 0);
  const dropAmount = Math.max(0, counted - starting);
  const dropRows = p.drops.map((d) => [
    d.drop_code,
    `$${Number(d.amount).toFixed(2)}`,
    new Date(d.submitted_at).toLocaleString(),
    p.names[d.submitted_by] ?? "—",
    d.verified_by ? (p.names[d.verified_by] ?? "—") : "—",
    d.reason || "—",
    d.notes || "—",
  ]);
  const body = `
    <h1>Drawer Close Report</h1>
    <div class="meta">Gotham Halal · ${escapeHTML(p.trailer?.name ?? "—")} · Drawer ${escapeHTML(p.drawer?.name ?? "—")}</div>
    ${kpiBlock([
      { label: "Starting Float", value: `$${starting.toFixed(2)}` },
      { label: "Total Cash Sales From POS", value: `$${Number(s.total_cash_sales ?? 0).toFixed(2)}` },
      { label: "Expected Drawer Total", value: `$${expected.toFixed(2)}` },
      { label: "Actual Cash Counted", value: `$${counted.toFixed(2)}` },
    ])}
    ${kpiBlock([
      { label: "Variance", value: `${v >= 0 ? "+" : ""}$${v.toFixed(2)}`, tone: v === 0 ? "ok" : "danger" },
      { label: "Drop Amount", value: `$${dropAmount.toFixed(2)}` },
      { label: "Remaining Float", value: `$${starting.toFixed(2)}` },
      { label: "Owner Review", value: String(s.owner_review) },
    ])}
    <h2>Session</h2>
    ${htmlTable(["Field","Value"], [
      ["Opened At", new Date(s.opened_at).toLocaleString()],
      ["Opened By", p.names[s.opened_by] ?? "—"],
      ["Closed At", s.closed_at ? new Date(s.closed_at).toLocaleString() : "—"],
      ["Submitted By (Closed By)", s.closed_by ? (p.names[s.closed_by] ?? "—") : "—"],
      ["Verified By (Owner Reviewer)", s.owner_reviewed_by ? (p.names[s.owner_reviewed_by] ?? "—") : "—"],
      ["Verification", String(s.verification)],
      ["Variance Reason / Notes", s.variance_reason ?? "—"],
      ["Owner Note", s.owner_note ?? "—"],
      ["Owner Review Status", String(s.owner_review)],
    ])}
    <h2>Mid-shift Cash Drops (${p.drops.length})</h2>
    ${p.drops.length ? htmlTable(["Drop ID","Amount","Time","Submitted By","Verified By","Reason","Notes"], dropRows) : '<p style="color:#666;font-size:11px;">No mid-shift drops in this session.</p>'}
  `;
  openPrintablePDF(`Drawer Close — ${p.drawer?.name ?? "drawer"}`, body);
}

// ---------------- Money Count (Bills + Coins denominations) ----------------

const BILL_DENOMS: { label: string; value: number }[] = [
  { label: "$100", value: 100 },
  { label: "$50", value: 50 },
  { label: "$20", value: 20 },
  { label: "$10", value: 10 },
  { label: "$5", value: 5 },
  { label: "$2", value: 2 },
  { label: "$1", value: 1 },
];
const COIN_DENOMS: { label: string; value: number }[] = [
  { label: "$1", value: 1 },
  { label: "50¢", value: 0.5 },
  { label: "25¢", value: 0.25 },
  { label: "10¢", value: 0.1 },
  { label: "5¢", value: 0.05 },
  { label: "1¢", value: 0.01 },
];

function MoneyCount({
  title = "Money Count",
  onTotalChange,
  target,
}: {
  title?: string;
  onTotalChange?: (total: number, bills: number, coins: number) => void;
  target?: number;
}) {
  const [bills, setBills] = useState<Record<string, number>>({});
  const [coins, setCoins] = useState<Record<string, number>>({});

  const billsTotal = BILL_DENOMS.reduce((s, d) => s + (bills[d.label] || 0) * d.value, 0);
  const coinsTotal = COIN_DENOMS.reduce((s, d) => s + (coins[d.label] || 0) * d.value, 0);
  const total = billsTotal + coinsTotal;

  useEffect(() => {
    onTotalChange?.(total, billsTotal, coinsTotal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, billsTotal, coinsTotal]);


  const reset = () => { setBills({}); setCoins({}); };

  const Row = ({
    denom, state, set,
  }: { denom: { label: string; value: number }; state: Record<string, number>; set: (s: Record<string, number>) => void }) => {
    const qty = state[denom.label] || 0;
    const update = (n: number) => set({ ...state, [denom.label]: Math.max(0, Math.min(9999, n)) });
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-14 h-8 rounded-md bg-foreground text-background text-xs font-semibold flex items-center justify-center">
          {denom.label}
        </div>
        <button type="button" onClick={() => update(qty - 1)} className="h-8 w-8 rounded-md border border-border hover:bg-secondary text-lg leading-none">−</button>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={qty || ""}
          onChange={(e) => update(Number(e.target.value) || 0)}
          placeholder="x Amount"
          className="h-8 w-20 text-center"
        />
        <button type="button" onClick={() => update(qty + 1)} className="h-8 w-8 rounded-md border border-border hover:bg-secondary text-lg leading-none text-[var(--color-success,#16a34a)]">+</button>
        <div className="ml-auto text-xs text-muted-foreground tabular-nums">{money(qty * denom.value)}</div>
      </div>
    );
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">{title}</h4>
        <Button type="button" size="sm" variant="ghost" onClick={reset}>Reset Count</Button>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <Banknote className="h-3 w-3" /> Bills
          </div>
          <div className="space-y-2">
            {BILL_DENOMS.map((d) => <Row key={d.label} denom={d} state={bills} set={setBills} />)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Coins</div>
          <div className="space-y-2">
            {COIN_DENOMS.map((d) => <Row key={d.label} denom={d} state={coins} set={setCoins} />)}
          </div>
        </div>
        <div className="rounded-lg p-4 bg-[var(--color-success,#16a34a)] text-white flex flex-col justify-center min-h-[140px]">
          <div className="text-3xl font-bold tabular-nums">{money(total)}</div>
          <div className="mt-3 text-xs opacity-90 flex items-center gap-1"><Banknote className="h-3 w-3" /> Bills</div>
          <div className="text-sm font-semibold tabular-nums">{money(billsTotal)}</div>
          <div className="mt-1 text-xs opacity-90">Coins</div>
          <div className="text-sm font-semibold tabular-nums">{money(coinsTotal)}</div>
          {typeof target === "number" && (
            <div className="mt-2 text-[11px] opacity-90">
              Target {money(target)} · {total === target ? "✓ matches" : `${total > target ? "+" : ""}${money(total - target)}`}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------- Open Drawer Dialog ----------------

function OpenDrawerDialog({ drawer, onClose, onSaved }: { drawer: any; onClose: () => void; onSaved: () => void }) {
  const { user } = useRole();
  const target = Number(drawer.starting_float);
  const [counted, setCounted] = useState(0);
  const openFn = useServerFn(openDrawerSession);
  const mu = useMutation({
    mutationFn: () => openFn({ data: { drawerId: drawer.id } }),
    onSuccess: () => { toast.success("Drawer opened"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to open"),
  });

  const matches = Math.abs(counted - target) < 0.005;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Open Drawer — {drawer.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Card className="bg-secondary">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Starting Float (target)</div><div className="font-semibold">{money(target)}</div></div>
              <div><div className="text-xs text-muted-foreground">Counted</div><div className="font-semibold">{money(counted)}</div></div>
              <div><div className="text-xs text-muted-foreground">Diff</div>
                <div className={`font-semibold ${matches ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                  {counted - target >= 0 ? "+" : ""}{money(counted - target)}
                </div>
              </div>
            </div>
          </Card>

          <MoneyCount title="Opening Money Count" target={target} onTotalChange={(t) => setCounted(t)} />

          {!matches && counted > 0 && (
            <div className="rounded-md border border-[var(--color-warning,#f59e0b)]/40 bg-[var(--color-warning-bg,#FFF8E1)] p-3 text-sm">
              Counted total does not match the configured starting float. Recount or proceed anyway.
            </div>
          )}

          <p className="text-xs text-muted-foreground">Opened by <b>{user}</b> · {new Date().toLocaleString()}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mu.mutate()} disabled={mu.isPending}>Open Drawer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDrawerSessionInline({ session, onSaved }: { session: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [startingFloat, setStartingFloat] = useState<string>(String(session.starting_float ?? 0));
  const [sales, setSales] = useState<string>(String(session.total_cash_sales ?? 0));
  const [counted, setCounted] = useState<string>(String(session.counted_amount ?? 0));
  const [reason, setReason] = useState<string>(session.variance_reason ?? "");
  const [note, setNote] = useState("");
  const editFn = useServerFn(editDrawerSession);
  const mu = useMutation({
    mutationFn: () => editFn({ data: {
      sessionId: session.id,
      startingFloat: Number(startingFloat),
      totalCashSales: Number(sales),
      countedAmount: Number(counted),
      varianceReason: reason || null,
      editNote: note || undefined,
    }}),
    onSuccess: () => { toast.success("Drawer session updated"); setOpen(false); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const previewExpected = Number(startingFloat || 0) + Number(sales || 0);
  const previewVariance = Number(counted || 0) - previewExpected;

  return (
    <Card goldAccent>
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Owner Edit</h4>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Edit submitted values"}
        </Button>
      </div>
      {open && (
        <div className="space-y-3 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label>Starting Float</Label><Input type="number" step="0.01" value={startingFloat} onChange={(e) => setStartingFloat(e.target.value)} /></div>
            <div><Label>Total Cash Sales</Label><Input type="number" step="0.01" value={sales} onChange={(e) => setSales(e.target.value)} /></div>
            <div><Label>Actual Cash Counted</Label><Input type="number" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} /></div>
          </div>
          <div className="text-xs text-muted-foreground">
            New Expected: <b>{money(previewExpected)}</b> · New Variance: <b>{previewVariance >= 0 ? "+" : ""}{money(previewVariance)}</b>
          </div>
          <div><Label>Variance Reason / Notes</Label><Textarea rows={2} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div><Label>Audit Note (why are you editing?)</Label><Textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Recorded in the audit log" /></div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => mu.mutate()} disabled={mu.isPending}>
              {mu.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}


