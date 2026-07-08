import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { markAlertsSeen } from "@/hooks/use-unread-alerts";
import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, Clock, XCircle, MessageSquare, Check, ArrowUp, UserPlus, Megaphone, Inbox, Loader2 } from "lucide-react";
import { listAlerts, actOnAlert, getAlertDetail, createAnnouncement, markCategoryRead } from "@/lib/alerts.functions";
import { syncDomains } from "@/lib/sync-bus";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/gotham/EmptyState";

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

type QueueKey = "critical" | "approvals" | "mine" | "announcements" | "resolved";

const QUEUES: { key: QueueKey; label: string; icon: any; tone: string; blurb: string }[] = [
  { key: "critical", label: "Critical", icon: AlertTriangle, tone: "text-red-600", blurb: "Highest priority, act now" },
  { key: "approvals", label: "Approvals", icon: Clock, tone: "text-amber-600", blurb: "Waiting on owner / manager" },
  { key: "mine", label: "Assigned to me", icon: Inbox, tone: "text-[var(--color-gold)]", blurb: "Your queue" },
  { key: "announcements", label: "Announcements", icon: Megaphone, tone: "text-[var(--color-gold)]", blurb: "Company broadcasts" },
  { key: "resolved", label: "Resolved", icon: CheckCircle2, tone: "text-emerald-600", blurb: "Last 7 days" },
];

function actionLabelFor(a: Alert): string {
  if (a.type === "announcement") return "Read";
  if (a.type === "inventory_order") return a.status === "pending" ? "Approve order" : "Review order";
  if (a.type === "low_stock" || a.type === "critical_stock") return "Place order";
  if (a.type === "missed_clock_in" || a.type === "missed_clock_out") return "Correct punch";
  if (a.type === "time_adjustment" || a.type === "time_off") return "Approve request";
  if (a.type === "schedule_approval") return "Approve schedule";
  if (a.type === "checklist_failure") return "Resolve checklist";
  if (a.type === "maintenance") return "Schedule fix";
  if (a.type === "manager_note") return "Acknowledge";
  return "Review";
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function AlertsPage() {
  const qc = useQueryClient();
  const { roleId, session, loading, trailerScope } = useRole();
  const isOwner = roleId === "owner";
  const [queue, setQueue] = useState<QueueKey>("critical");
  const [openAlertId, setOpenAlertId] = useState<string | null>(null);

  const PAGE_SIZE = 50;
  const list = useServerFn(listAlerts);

  const openQuery = useInfiniteQuery<Alert[]>({
    queryKey: ["alerts", "open", trailerScope ?? "all"],
    queryFn: ({ pageParam = 0 }) =>
      list({ data: { status: "open", trailerId: trailerScope ?? null, limit: PAGE_SIZE, offset: pageParam as number } }) as any,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
    initialPageParam: 0,
    enabled: !loading && !!session?.access_token,
  });
  const openAlerts: Alert[] = openQuery.data?.pages.flat() ?? [];
  const isLoading = openQuery.isLoading;

  const resolvedQuery = useInfiniteQuery<Alert[]>({
    queryKey: ["alerts", "resolved", trailerScope ?? "all"],
    queryFn: ({ pageParam = 0 }) =>
      list({ data: { status: "resolved", trailerId: trailerScope ?? null, limit: PAGE_SIZE, offset: pageParam as number } }) as any,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
    initialPageParam: 0,
    enabled: !loading && !!session?.access_token && queue === "resolved",
  });
  const resolvedAlerts: Alert[] = resolvedQuery.data?.pages.flat() ?? [];
  const loadingResolved = resolvedQuery.isLoading;

  useEffect(() => {
    if (loading || !session?.access_token) return;
    const channel = supabase
      .channel("alerts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        syncDomains(qc, "alerts"); qc.invalidateQueries({ queryKey: ["alert-detail"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loading, session?.access_token, qc]);

  const markRead = useServerFn(markCategoryRead);
  useEffect(() => {
    if (loading || !session?.access_token) return;
    markRead({ data: { category: "all" } }).catch(() => {});
    markAlertsSeen();
  }, [loading, session?.access_token, queue]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const myRole = roleId ?? "all";
  const buckets = useMemo(() => {
    const critical: Alert[] = [];
    const approvals: Alert[] = [];
    const mine: Alert[] = [];
    const announcements: Alert[] = [];
    for (const a of openAlerts) {
      const isAnn = a.source_module === "announcements" || a.type === "announcement";
      if (isAnn) { announcements.push(a); continue; }
      if (a.priority === "critical") critical.push(a);
      if (a.status === "pending" || a.type === "inventory_order" || a.type === "schedule_approval" || a.type === "time_off" || a.type === "time_adjustment") approvals.push(a);
      if (a.assigned_role === myRole || a.assigned_role === "all" || (isOwner && a.assigned_role === "owner")) mine.push(a);
    }
    return { critical, approvals, mine, announcements };
  }, [openAlerts, myRole, isOwner]);

  const visible: Alert[] = queue === "resolved" ? resolvedAlerts : (buckets as any)[queue];
  const queueLoading = queue === "resolved" ? loadingResolved : isLoading;

  const stats = {
    critical: buckets.critical.length,
    approvals: buckets.approvals.length,
    mine: buckets.mine.length,
    announcements: buckets.announcements.length,
  };

  if (loading) return <AppShell><Card>Loading…</Card></AppShell>;

  return (
    <AppShell>
      <SectionHeader eyebrow="Action Center" title="Alerts" />

      {isOwner && <AnnouncementComposer onPosted={() => syncDomains(qc, "alerts")} />}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {QUEUES.map((q) => {
          const count = q.key === "resolved" ? resolvedAlerts.length : (stats as any)[q.key] ?? 0;
          const Icon = q.icon;
          const active = queue === q.key;
          return (
            <button key={q.key} onClick={() => setQueue(q.key)}
              className={cn("text-left rounded-xl border p-3 transition-colors",
                active ? "border-[var(--color-gold)] bg-card" : "border-border bg-card hover:border-foreground/30")}>
              <div className="flex items-center justify-between">
                <Icon className={cn("h-4 w-4", q.tone)} />
                <span className={cn("text-xl font-bold", active && "text-[var(--color-gold)]")}>{count}</span>
              </div>
              <div className="mt-2 text-xs font-semibold uppercase tracking-wide">{q.label}</div>
              <div className="text-[10px] text-muted-foreground truncate">{q.blurb}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {queueLoading ? <Card>Loading alerts…</Card>
          : visible.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title={queue === "critical" ? "No critical alerts" :
                     queue === "approvals" ? "Nothing waiting for approval" :
                     queue === "mine" ? "Inbox zero" :
                     queue === "announcements" ? "No announcements" :
                     "No resolved alerts yet"}
              hint={queue === "critical" ? "All clear — urgent items will surface here first."
                  : queue === "approvals" ? "Approval requests from the team will land here."
                  : queue === "mine" ? "When something needs you, it shows up here."
                  : queue === "announcements" ? (isOwner ? "Post one with the New announcement button above." : "Owner posts will appear here.")
                  : "Resolve an alert to see it in the history."}
            />
          )
          : visible.map((a) => (
            <AlertRow key={a.id} alert={a} isOwner={isOwner} onOpen={() => !a.synthetic && setOpenAlertId(a.id)} />
          ))}

        {/* Load more button — only shown for the resolved queue which can be large */}
        {queue === "resolved" && resolvedQuery.hasNextPage && (
          <button
            onClick={() => resolvedQuery.fetchNextPage()}
            disabled={resolvedQuery.isFetchingNextPage}
            className="mt-2 w-full rounded-lg border border-border py-2.5 text-sm font-medium text-foreground/70 hover:text-foreground hover:border-foreground/30 transition inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {resolvedQuery.isFetchingNextPage
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
              : "Load more"}
          </button>
        )}
        {queue !== "resolved" && openQuery.hasNextPage && (
          <button
            onClick={() => openQuery.fetchNextPage()}
            disabled={openQuery.isFetchingNextPage}
            className="mt-2 w-full rounded-lg border border-border py-2.5 text-sm font-medium text-foreground/70 hover:text-foreground hover:border-foreground/30 transition inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {openQuery.isFetchingNextPage
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
              : "Load more"}
          </button>
        )}
      </div>

      {openAlertId && (
        <AlertDetailDialog
          alertId={openAlertId}
          isOwner={isOwner}
          onClose={() => setOpenAlertId(null)}
          onDone={() => { setOpenAlertId(null); syncDomains(qc, "alerts"); }}
        />
      )}
    </AppShell>
  );
}

function AlertRow({ alert: a, isOwner, onOpen }: { alert: Alert; isOwner: boolean; onOpen: () => void }) {
  const qc = useQueryClient();
  const act = useServerFn(actOnAlert);
  const mut = useMutation({
    mutationFn: (action: "resolve" | "escalate") => act({ data: { alertId: a.id, action } }) as any,
    onSuccess: (_d, action) => {
      toast.success(action === "resolve" ? "Marked resolved" : "Escalated to owner");
      syncDomains(qc, "alerts");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const owner = a.source_module ? a.source_module.replace(/_/g, " ") : "system";
  return (
    <Card className={cn("transition-colors", !a.synthetic && "hover:bg-secondary")}>
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="text-left flex-1 min-w-0" disabled={a.synthetic}>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusPill tone={priorityTone(a.priority)}>{a.priority}</StatusPill>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{a.type.replace(/_/g, " ")}</span>
          </div>
          <div className="font-medium text-sm">{a.title}</div>
          {a.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</div>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span><span className="uppercase tracking-wide opacity-70">Owner</span> · {owner} ({a.assigned_role})</span>
            <span><span className="uppercase tracking-wide opacity-70">Time</span> · {timeAgo(a.created_at)}</span>
            <span><span className="uppercase tracking-wide opacity-70">Action</span> · {actionLabelFor(a)}</span>
          </div>
        </button>
        {!a.synthetic && a.status !== "resolved" && (
          <div className="flex flex-col gap-1 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => mut.mutate("resolve")} disabled={mut.isPending}>
              <Check className="h-3 w-3 mr-1" />Resolve
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onOpen}>
              <UserPlus className="h-3 w-3 mr-1" />Assign
            </Button>
            {!isOwner && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => mut.mutate("escalate")} disabled={mut.isPending}>
                <ArrowUp className="h-3 w-3 mr-1" />Escalate
              </Button>
            )}
          </div>
        )}
        {a.status === "resolved" && (
          <StatusPill tone="success">resolved</StatusPill>
        )}
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
                    <div key={a.id} className="flex gap-2"><MessageSquare className="h-3 w-3 mt-0.5" /><span className="font-medium">{a.action}</span><span className="text-muted-foreground">{a.note ?? ""}</span><span className="ml-auto text-muted-foreground">{new Date(a.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</span></div>
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
                  <Button size="sm" variant="outline" onClick={() => mutation.mutate("mark_ordered")} disabled={mutation.isPending}>Mark Picked Up</Button>
                  <Button size="sm" variant="outline" onClick={() => mutation.mutate("mark_received")} disabled={mutation.isPending}>Mark Delivered</Button>
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
