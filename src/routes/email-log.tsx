import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader } from "@/components/gotham/primitives";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { listEmailDeliveryLog, emailDeliveryStats, resendEmailFromLog } from "@/lib/notifications.functions";
import { useRole } from "@/lib/role";
import { toast } from "sonner";

export const Route = createFileRoute("/email-log")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Email Delivery Log · Gotham OS" }] }),
  component: EmailLogPage,
});

const RANGES = [
  { label: "24h", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
];

const STATUSES = ["all", "sent", "queued", "failed", "dlq", "suppressed"];

function EmailLogPage() {
  const { roleId } = useRole();
  if (roleId && roleId !== "owner") {
    throw redirect({ to: "/" });
  }

  const listFn = useServerFn(listEmailDeliveryLog);
  const statsFn = useServerFn(emailDeliveryStats);
  const resendFn = useServerFn(resendEmailFromLog);
  const qc = useQueryClient();
  const [hours, setHours] = useState(24 * 7);
  const [template, setTemplate] = useState<string>("");
  const [status, setStatus] = useState<string>("all");

  const { data: rows = [] } = useQuery({
    queryKey: ["email-log", hours, template, status],
    queryFn: () =>
      listFn({
        data: {
          sinceHours: hours,
          template: template || undefined,
          status: status === "all" ? undefined : status,
          limit: 200,
        },
      }),
  });
  const { data: stats } = useQuery({
    queryKey: ["email-stats", hours],
    queryFn: () => statsFn({ data: { sinceHours: hours } }),
  });

  const templates = Array.from(new Set(rows.map((r: any) => r.template_name))).sort();

  const resend = useMutation({
    mutationFn: (logId: string) => resendFn({ data: { logId } }),
    onSuccess: () => {
      toast.success("Re-queued for delivery");
      qc.invalidateQueries({ queryKey: ["email-log"] });
      qc.invalidateQueries({ queryKey: ["email-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Resend failed"),
  });

  return (
    <AppShell>
      <SectionHeader eyebrow="Notifications" title="Email Delivery Log" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats?.total ?? 0} />
        <StatCard label="Sent" value={stats?.sent ?? 0} tone="ok" />
        <StatCard label="Queued" value={stats?.queued ?? 0} />
        <StatCard label="Failed" value={(stats?.failed ?? 0) + (stats?.dlq ?? 0)} tone="bad" />
        <StatCard label="Suppressed" value={stats?.suppressed ?? 0} tone="warn" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setHours(r.hours)}
                className={`px-3 h-9 text-xs font-semibold uppercase tracking-[1.2px] ${
                  hours === r.hours ? "bg-[var(--color-gold)] text-[#0A0A0A]" : "bg-card text-muted-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm"
          >
            <option value="">All templates</option>
            {templates.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {rows.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">No emails in this window.</div>
        )}
        {rows.map((r: any, i: number) => (
          <div key={r.id} className={i ? "border-t border-border p-3 text-sm" : "p-3 text-sm"}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium truncate">{r.subject || r.template_name}</div>
              <StatusBadge status={r.status} />
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between gap-2">
              <span className="truncate">{r.template_name} · {r.recipient_email}</span>
              <span className="shrink-0">{new Date(r.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
            {r.error_message && (
              <div className="text-xs text-[var(--color-danger)] mt-1 truncate">{r.error_message}</div>
            )}
          </div>
        ))}
      </Card>

      <div className="h-6" />
    </AppShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "ok" | "bad" | "warn" }) {
  const color =
    tone === "ok" ? "text-[var(--color-success)]" :
    tone === "bad" ? "text-[var(--color-danger)]" :
    tone === "warn" ? "text-[var(--color-gold)]" : "text-foreground";
  return (
    <Card className="text-center">
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: "bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30",
    queued: "bg-[var(--color-gold)]/15 text-[var(--color-gold)] border-[var(--color-gold)]/30",
    failed: "bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/30",
    dlq: "bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/30",
    suppressed: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center px-2 h-5 rounded text-[10px] font-semibold uppercase tracking-[1px] border ${map[status] ?? "bg-card border-border"}`}>
      {status}
    </span>
  );
}
