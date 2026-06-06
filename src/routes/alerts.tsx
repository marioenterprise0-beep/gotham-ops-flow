import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { markAlertsSeen } from "@/hooks/use-unread-alerts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Bell, CheckCircle2, Clock, XCircle, MessageSquare, Check, Loader2 } from "lucide-react";
import { listAlerts, actOnAlert, getAlertDetail, createAnnouncement, listCategoryReads, markCategoryRead } from "@/lib/alerts.functions";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alerts")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Alerts · Gotham OS" }] }),
  component: AlertsPage,
});

type Alert = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  source_module: string;
  source_id: string | null;
  trailer_id: string | null;
  created_by: string | null;
  assigned_role: "manager" | "owner" | "all";
  priority: "critical" | "high" | "normal" | "low";
  status: "open" | "pending" | "approved" | "declined" | "resolved";
  created_at: string;
  payload?: any;
  synthetic?: boolean;
};

const CATEGORIES = [
  { key: "", label: "All" },
  { key: "announcements", label: "Announcements" },
  { key: "tasks", label: "Tasks" },
  { key: "inventory", label: "Inventory" },
  { key: "labor", label: "Labor" },
  { key: "scheduling", label: "Scheduling" },
  { key: "operations", label: "Operations" },
  { key: "maintenance", label: "Maintenance" },
  { key: "hospitality", label: "Hospitality" },
];

const CATEGORY_TYPES: Record<string, string[]> = {
  inventory: ["inventory_order","low_stock","critical_stock"],
  labor: ["missed_clock_in","missed_clock_out","time_adjustment","time_off"],
  scheduling: ["schedule_approval"],
  operations: ["checklist_failure","manager_note"],
  maintenance: ["maintenance"],
  hospitality: ["manager_note"],
};

function categoryOf(a: { type: string; source_module?: string | null }): string[] {
  const cats: string[] = [];
  if (a.source_module === "announcements" || a.type === "announcement") cats.push("announcements");
  if (a.source_module === "tasks") cats.push("tasks");
  for (const [key, types] of Object.entries(CATEGORY_TYPES)) {
    if (types.includes(a.type)) cats.push(key);
  }
  return cats;
}

const STATUSES = ["open", "pending", "approved", "declined", "resolved"] as const;

function priorityTone(p: string): "danger" | "warning" | "info" | "neutral" {
  if (p === "critical") return "danger";
  if (p === "high") return "warning";
  if (p === "normal") return "info";
  return "neutral";
}

function AnnouncementComposer({ onPosted }: { onPosted: () => void }) {
  const post = useServerFn(createAnnouncement);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "critical">("normal");
  const mut = useMutation({
    mutationFn: () => post({ data: { title, description: desc || undefined, priority } }) as any,
    onSuccess: () => {
      toast.success("Announcement sent to the whole company");
      setTitle(""); setDesc(""); setPriority("normal"); setOpen(false);
      onPosted();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to post"),
  });
  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[var(--color-gold)]" />
          <div>
            <div className="font-medium text-sm">Company Announcement</div>
            <div className="text-xs text-muted-foreground">Owner broadcast — visible to every signed-in user</div>
          </div>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>New announcement</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post company announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Title</label>
              <input
                className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Friday all-hands at 4pm"
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Message (optional)</label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} maxLength={2000} placeholder="Details, links, expectations…" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Priority</label>
              <div className="flex gap-2 mt-1">
                {(["low", "normal", "high", "critical"] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className={cn("px-3 py-1 rounded text-xs font-medium uppercase tracking-wide border",
                      priority === p ? "bg-foreground text-background border-foreground" : "bg-background text-foreground/70 border-border hover:bg-secondary")}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => mut.mutate()} disabled={!title.trim() || mut.isPending}>
              {mut.isPending ? "Posting…" : "Post to company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AlertsPage() {
  const qc = useQueryClient();
  const { roleId, session, loading } = useRole();
  const isOwner = roleId === "owner";
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<typeof STATUSES[number]>("open");
  const [openAlertId, setOpenAlertId] = useState<string | null>(null);

  const list = useServerFn(listAlerts);
  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["alerts", category, status],
    queryFn: () => list({ data: { category: category || undefined, status } }) as any,
    enabled: !loading && !!session?.access_token,
  });

  useEffect(() => {
    if (loading || !session?.access_token) return;
    const channel = supabase
      .channel("alerts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        qc.invalidateQueries({ queryKey: ["alerts"] });
        qc.invalidateQueries({ queryKey: ["alert-detail"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loading, session?.access_token, qc]);

  const fetchReads = useServerFn(listCategoryReads);
  const { data: reads = [] } = useQuery<{ category: string; last_seen_at: string }[]>({
    queryKey: ["alert-category-reads"],
    enabled: !loading && !!session?.access_token,
    queryFn: () => fetchReads() as any,
  });

  const seenByCat = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of reads) m[r.category] = r.last_seen_at;
    return m;
  }, [reads]);

  const { data: unreadAll = [] } = useQuery<{ type: string; source_module: string | null; created_at: string }[]>({
    queryKey: ["alerts", "unread-by-cat"],
    enabled: !loading && !!session?.access_token,
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("type, source_module, created_at")
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(500);
      return (data as any) ?? [];
    },
  });

  const unreadByCat = useMemo(() => {
    const counts: Record<string, number> = {};
    const allSeen = seenByCat["all"] ?? new Date(0).toISOString();
    for (const a of unreadAll) {
      const cats = categoryOf(a as any);
      // "all" chip counts alerts newer than the user's last "all" mark
      if (a.created_at > allSeen) counts[""] = (counts[""] ?? 0) + 1;
      for (const k of cats) {
        const seen = seenByCat[k] ?? new Date(0).toISOString();
        if (a.created_at > seen) counts[k] = (counts[k] ?? 0) + 1;
      }
    }
    return counts;
  }, [unreadAll, seenByCat]);

  const markRead = useServerFn(markCategoryRead);
  const readsKey = ["alert-category-reads"] as const;
  const markMut = useMutation({
    mutationFn: (cat: string) => markRead({ data: { category: (cat || "all") as any } }) as any,
    onMutate: async (cat: string) => {
      await qc.cancelQueries({ queryKey: readsKey });
      const previous = qc.getQueryData<{ category: string; last_seen_at: string }[]>(readsKey);
      const key = cat || "all";
      const nowIso = new Date().toISOString();
      qc.setQueryData<{ category: string; last_seen_at: string }[]>(readsKey, (old) => {
        const list = old ? [...old] : [];
        const idx = list.findIndex((r) => r.category === key);
        if (idx >= 0) list[idx] = { ...list[idx], last_seen_at: nowIso };
        else list.push({ category: key, last_seen_at: nowIso });
        return list;
      });
      if (!cat) markAlertsSeen(); // optimistic global bell clear
      return { previous };
    },
    onSuccess: (_d, cat) => {
      qc.invalidateQueries({ queryKey: readsKey });
      toast.success(`Marked ${cat || "all"} as read`);
    },
    onError: (e: any, cat, ctx) => {
      if (ctx?.previous) qc.setQueryData(readsKey, ctx.previous);
      toast.error(e?.message ?? "Failed to mark read", {
        action: { label: "Retry", onClick: () => markMut.mutate(cat) },
      });
    },
  });
  const pendingCat = markMut.isPending ? (markMut.variables as string | undefined) : undefined;


  // Keep realtime in sync — refresh reads on any alert_category_reads change too
  useEffect(() => {
    if (loading || !session?.access_token) return;
    const ch = supabase
      .channel("alert-reads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "alert_category_reads" }, () => {
        qc.invalidateQueries({ queryKey: ["alert-category-reads"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loading, session?.access_token, qc]);

  const stats = useMemo(() => {
    const open = alerts.filter((a) => a.status === "open" || a.status === "pending").length;
    const critical = alerts.filter((a) => a.priority === "critical" && a.status !== "resolved").length;
    const pending = alerts.filter((a) => a.status === "pending").length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const resolvedToday = alerts.filter((a) => a.status === "resolved" && new Date(a.created_at) >= today).length;
    return { open, critical, pending, resolvedToday };
  }, [alerts]);

  if (loading) return <AppShell><Card>Loading…</Card></AppShell>;

  return (
    <AppShell>
      <SectionHeader eyebrow="Action Center" title="Alerts" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Open" value={stats.open} icon={Bell} tone="info" />
        <StatCard label="Critical" value={stats.critical} icon={AlertTriangle} tone="danger" />
        <StatCard label="Pending Approval" value={stats.pending} icon={Clock} tone="warning" />
        <StatCard label="Resolved Today" value={stats.resolvedToday} icon={CheckCircle2} tone="success" />
      </div>

      {isOwner && <AnnouncementComposer onPosted={() => qc.invalidateQueries({ queryKey: ["alerts"] })} />}

      <Card className="mb-4">

        <div className="flex flex-wrap gap-2 mb-3">
          {CATEGORIES.map((c) => {
            const n = unreadByCat[c.key] ?? 0;
            const isActive = category === c.key;
            return (
              <div key={c.key} className={cn("inline-flex items-stretch rounded-full border transition-colors overflow-hidden",
                isActive ? "bg-foreground border-foreground" : "bg-background border-border")}>
                <button onClick={() => setCategory(c.key)}
                  className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium",
                    isActive ? "text-background" : "text-foreground/70 hover:bg-secondary")}>
                  {c.label}
                  {n > 0 && (
                    <span className={cn("min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-[18px] text-center",
                      isActive ? "bg-background text-foreground" : "bg-red-600 text-white")}>
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                </button>
                {n > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markMut.mutate(c.key); }}
                    disabled={markMut.isPending}
                    title={`Mark ${c.label} as read`}
                    className={cn("px-2 border-l text-xs inline-flex items-center justify-center",
                      isActive ? "border-background/30 text-background/80 hover:bg-background/10" : "border-border text-foreground/50 hover:bg-secondary hover:text-foreground")}>
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={cn("px-3 py-1 rounded text-xs font-medium uppercase tracking-wide",
                status === s ? "bg-[var(--color-gold)] text-black" : "bg-secondary text-foreground/60 hover:text-foreground")}>
              {s}
            </button>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {isLoading ? <Card>Loading alerts…</Card>
          : alerts.length === 0 ? <Card><div className="text-center py-8 text-muted-foreground">No alerts in this view</div></Card>
          : alerts.map((a) => (
            <button key={a.id} onClick={() => !a.synthetic && setOpenAlertId(a.id)}
              className="text-left w-full">
              <Card className={cn("transition-colors", !a.synthetic && "hover:bg-secondary cursor-pointer")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusPill tone={priorityTone(a.priority)}>{a.priority}</StatusPill>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{a.type.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">· {a.assigned_role}</span>
                    </div>
                    <div className="font-medium text-sm">{a.title}</div>
                    {a.description && <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <StatusPill tone={a.status === "resolved" ? "success" : a.status === "declined" ? "danger" : "neutral"}>{a.status}</StatusPill>
                    <div className="text-[10px] text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                </div>
              </Card>
            </button>
          ))}
      </div>

      {openAlertId && (
        <AlertDetailDialog
          alertId={openAlertId}
          isOwner={isOwner}
          onClose={() => setOpenAlertId(null)}
          onDone={() => { setOpenAlertId(null); qc.invalidateQueries({ queryKey: ["alerts"] }); }}
        />
      )}
    </AppShell>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: "info" | "danger" | "warning" | "success" }) {
  const toneClass = tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-600" : tone === "success" ? "text-emerald-600" : "text-[var(--color-gold)]";
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
        <Icon className={cn("h-6 w-6", toneClass)} />
      </div>
    </Card>
  );
}

function AlertDetailDialog({ alertId, isOwner, onClose, onDone }: { alertId: string; isOwner: boolean; onClose: () => void; onDone: () => void }) {
  const getDetail = useServerFn(getAlertDetail);
  const act = useServerFn(actOnAlert);
  const [note, setNote] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["alert-detail", alertId],
    queryFn: () => getDetail({ data: { alertId } }) as any,
  });

  const mutation = useMutation({
    mutationFn: (action: string) => act({ data: { alertId, action: action as any, note: note || undefined } }) as any,
    onSuccess: () => { toast.success("Action recorded"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const alert = data?.alert;
  const items = data?.order?.items ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{alert?.title ?? "Alert"}</DialogTitle>
        </DialogHeader>
        {isLoading || !alert ? <div className="py-6">Loading…</div> : (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <StatusPill tone={priorityTone(alert.priority)}>{alert.priority}</StatusPill>
              <StatusPill tone="neutral">{alert.status}</StatusPill>
              <span className="text-xs text-muted-foreground self-center">{new Date(alert.created_at).toLocaleString()}</span>
            </div>
            {alert.description && <p className="text-sm">{alert.description}</p>}

            {data?.order && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Order Items</div>
                <div className="border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary text-left">
                      <tr><th className="p-2">Item</th><th className="p-2">Current</th><th className="p-2">PAR</th><th className="p-2">Req</th><th className="p-2">Urgency</th></tr>
                    </thead>
                    <tbody>
                      {items.map((it: any) => (
                        <tr key={it.id} className="border-t">
                          <td className="p-2">{it.item_name}{it.reason && <div className="text-muted-foreground text-[10px]">{it.reason}</div>}</td>
                          <td className="p-2">{it.current_qty}</td>
                          <td className="p-2">{it.par_qty}</td>
                          <td className="p-2 font-medium">{it.requested_qty} {it.unit ?? ""}</td>
                          <td className="p-2"><StatusPill tone={it.urgency === "critical" || it.urgency === "emergency" ? "danger" : it.urgency === "needed_soon" ? "warning" : "neutral"}>{it.urgency.replace("_", " ")}</StatusPill></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data?.actions?.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">History</div>
                <div className="space-y-1 text-xs">
                  {data.actions.map((a: any) => (
                    <div key={a.id} className="flex gap-2"><MessageSquare className="h-3 w-3 mt-0.5" /><span className="font-medium">{a.action}</span><span className="text-muted-foreground">{a.note ?? ""}</span><span className="ml-auto text-muted-foreground">{new Date(a.created_at).toLocaleTimeString()}</span></div>
                  ))}
                </div>
              </div>
            )}

            <Textarea placeholder="Add a note / comment" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        )}
        <DialogFooter className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => mutation.mutate("comment")} disabled={mutation.isPending}>Comment</Button>
          {isOwner && alert?.status !== "resolved" && (
            <>
              {alert?.type === "inventory_order" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => mutation.mutate("mark_ordered")} disabled={mutation.isPending}>Mark Ordered</Button>
                  <Button size="sm" variant="outline" onClick={() => mutation.mutate("mark_received")} disabled={mutation.isPending}>Mark Received</Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => mutation.mutate("request_changes")} disabled={mutation.isPending}>Request Changes</Button>
              <Button size="sm" variant="destructive" onClick={() => mutation.mutate("decline")} disabled={mutation.isPending}><XCircle className="h-3 w-3 mr-1" />Decline</Button>
              <Button size="sm" onClick={() => mutation.mutate("approve")} disabled={mutation.isPending}><CheckCircle2 className="h-3 w-3 mr-1" />Approve</Button>
            </>
          )}
          {!isOwner && alert?.status !== "resolved" && (
            <>
              <Button size="sm" variant="outline" onClick={() => mutation.mutate("review")} disabled={mutation.isPending}>Mark Reviewed</Button>
              <Button size="sm" variant="outline" onClick={() => mutation.mutate("escalate")} disabled={mutation.isPending}>Escalate to Owner</Button>
              <Button size="sm" onClick={() => mutation.mutate("resolve")} disabled={mutation.isPending}>Resolve</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
