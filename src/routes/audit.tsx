import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { listAuditLog } from "@/lib/manager.functions";
import { canSee, useRole } from "@/lib/role";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/audit")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Audit Log · Gotham OS" }] }),
  component: AuditPage,
});

const TONE: Record<string, "success" | "warning" | "danger" | "info" | "gold"> = {
  complete_task: "success",
  signoff_task: "success",
  reject_task: "warning",
  create_action_task: "gold",
  receive_stock: "info",
  log_waste: "warning",
  submit_count: "info",
  reorder_request: "gold",
  acknowledge_alert: "info",
  update_role: "warning",
};

function AuditPage() {
  const { roleId } = useRole();
  if (!canSee(roleId, "manager")) return <Navigate to="/" />;
  const fetchLog = useServerFn(listAuditLog);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["audit-log"], queryFn: () => fetchLog(), refetchInterval: 30_000 });

  return (
    <AppShell>
      <SectionHeader eyebrow="Activity" title="Audit Log" action={<StatusPill tone="gold">{rows.length} events</StatusPill>} />
      <Card className="p-0 overflow-hidden">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No activity yet.</div>}
        {rows.map((r: any, i: number) => {
          const payloadStr = r.payload ? Object.entries(r.payload).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ") : "";
          return (
            <div key={r.id} className={cn("p-4 grid grid-cols-1 md:grid-cols-[160px_140px_1fr_auto] gap-3 items-start", i && "border-t border-border")}>
              <div className="text-xs text-muted-foreground">
                <div>{new Date(r.created_at).toLocaleDateString()}</div>
                <div>{new Date(r.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</div>
              </div>
              <div className="text-sm font-medium truncate">{r.actor_name}</div>
              <div className="text-sm">
                <span className="font-semibold">{r.action.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground"> · {r.entity}</span>
                {payloadStr && <div className="text-xs text-muted-foreground mt-1 truncate">{payloadStr}</div>}
              </div>
              <StatusPill tone={TONE[r.action] ?? "info"}>{r.action.split("_")[0]}</StatusPill>
            </div>
          );
        })}
      </Card>
      <div className="h-6" />
    </AppShell>
  );
}
