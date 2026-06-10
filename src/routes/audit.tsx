import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canSee, useRole } from "@/lib/role";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { listAuditLogFiltered, auditLogFilterOptions } from "@/lib/audit-log.functions";
import { cn } from "@/lib/utils";
import { Download, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { EmptyState } from "@/components/gotham/EmptyState";

export const Route = createFileRoute("/audit")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Audit Log · Gotham OS" }] }),
  component: AuditPage,
});

const TONE: Record<string, "success" | "warning" | "danger" | "info" | "gold"> = {
  complete_task: "success", signoff_task: "success", reject_task: "warning",
  create_action_task: "gold", receive_stock: "info", log_waste: "warning",
  submit_count: "info", reorder_request: "gold", acknowledge_alert: "info",
  update_role: "warning",
};

function toneFor(action: string): "success" | "warning" | "danger" | "info" | "gold" {
  if (TONE[action]) return TONE[action];
  if (action.endsWith("_archived")) return "warning";
  if (action.endsWith("_restored")) return "success";
  if (action.endsWith("_purged") || action.endsWith("_deleted") || action.includes("purge")) return "danger";
  return "info";
}

const PAGE_SIZE = 50;

function csvEscape(v: any) {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function AuditPage() {
  const { roleId } = useRole();
  if (!canSee(roleId, "manager")) return <Navigate to="/" />;
  const fetchLog = useServerFn(listAuditLogFiltered);
  const fetchOpts = useServerFn(auditLogFilterOptions);

  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const [payloadView, setPayloadView] = useState<any | null>(null);

  const { data: opts } = useQuery({ queryKey: ["audit-opts"], queryFn: () => fetchOpts() });

  const filter = { action: action || undefined, entity: entity || undefined, fromDate: fromDate || undefined, toDate: toDate || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE };
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", filter],
    queryFn: () => fetchLog({ data: filter }),
    refetchInterval: 60_000,
  });

  const rows: any[] = (data?.rows ?? []) as any[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function exportCsv() {
    const headers = ["created_at", "actor_name", "actor_email", "action", "entity", "entity_id", "payload"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(headers.map((h) => csvEscape((r as any)[h])).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <SectionHeader
        eyebrow="Activity"
        title="Audit Log"
        action={<div className="flex gap-2 items-center">
          <StatusPill tone="gold">{total} events</StatusPill>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3 w-3 mr-1" /> CSV</Button>
        </div>}
      />

      <Card className="p-3 mb-3 grid grid-cols-2 md:grid-cols-5 gap-2">
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}
          className="text-sm bg-background border border-border rounded-md px-2 py-1.5">
          <option value="">All actions</option>
          {opts?.actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(0); }}
          className="text-sm bg-background border border-border rounded-md px-2 py-1.5">
          <option value="">All entities</option>
          {opts?.entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(0); }} placeholder="From" />
        <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(0); }} placeholder="To" />
        <Button variant="ghost" size="sm" onClick={() => { setAction(""); setEntity(""); setFromDate(""); setToDate(""); setPage(0); }}>
          Reset
        </Button>
      </Card>

      {!isLoading && rows.length === 0 && (
        <EmptyState icon={Activity} title="Activity will appear here" hint="Every meaningful action — punches, approvals, edits — gets logged here for review." />
      )}
      {(isLoading || rows.length > 0) && (
      <Card className="p-0 overflow-hidden">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {rows.map((r, i) => {
          const payloadStr = r.payload ? Object.entries(r.payload).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ") : "";
          return (
            <button key={r.id} onClick={() => setPayloadView(r)}
              className={cn("w-full text-left p-4 grid grid-cols-1 md:grid-cols-[160px_160px_1fr_auto] gap-3 items-start hover:bg-muted/40", i && "border-t border-border")}>
              <div className="text-xs text-muted-foreground">
                <div>{new Date(r.created_at).toLocaleDateString()}</div>
                <div>{new Date(r.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</div>
              </div>
              <div className="text-sm font-medium truncate">{r.actor_name}</div>
              <div className="text-sm min-w-0">
                <span className="font-semibold">{r.action.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground"> · {r.entity}</span>
                {payloadStr && <div className="text-xs text-muted-foreground mt-1 truncate">{payloadStr}</div>}
              </div>
              <StatusPill tone={toneFor(r.action)}>{r.action.split("_")[0]}</StatusPill>
            </button>
          );
        })}
      </Card>

      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Dialog open={!!payloadView} onOpenChange={(v) => !v && setPayloadView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{payloadView?.action} · {payloadView?.entity}</DialogTitle></DialogHeader>
          {payloadView && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">When:</span> {new Date(payloadView.created_at).toLocaleString()}</div>
              <div><span className="text-muted-foreground">Actor:</span> {payloadView.actor_name} {payloadView.actor_email && <span className="text-xs text-muted-foreground">({payloadView.actor_email})</span>}</div>
              <div><span className="text-muted-foreground">Entity ID:</span> <code className="text-xs">{payloadView.entity_id ?? "—"}</code></div>
              <div>
                <div className="text-muted-foreground mb-1">Payload</div>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-[50vh]">{JSON.stringify(payloadView.payload, null, 2)}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="h-6" />
    </AppShell>
  );
}
