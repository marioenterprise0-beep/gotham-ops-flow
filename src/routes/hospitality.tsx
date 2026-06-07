import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncDomains } from "@/lib/sync-bus";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listHospitality, logHospitalityIncident } from "@/lib/hospitality.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/hospitality")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Hospitality · Gotham OS" }] }),
  component: Hospitality,
});

const STANDARDS = [
  { t: "Greeting", d: "Within 5 seconds. \"Welcome to Gotham Halal!\" — eye contact, smile." },
  { t: "Upsell", d: "Suggest drink or combo on every order." },
  { t: "Wait Acknowledgement", d: "Update guest if wait exceeds 3 minutes." },
  { t: "Recovery", d: "Acknowledge, Apologize, Act — within 60 seconds." },
];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function shiftMonth(iso: string, delta: number) {
  const [y, m] = iso.split("-").map((n) => parseInt(n, 10));
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(iso: string) {
  const [y, m] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function Hospitality() {
  const [showLog, setShowLog] = useState(false);
  const [showRec, setShowRec] = useState(false);
  const [view, setView] = useState<"today" | "month">("today");
  const [month, setMonth] = useState<string>(thisMonth());
  const qc = useQueryClient();
  const fetchData = useServerFn(listHospitality);
  const monthArg = view === "month" ? month : null;
  const { data, isLoading } = useQuery({
    queryKey: ["hospitality", view, monthArg],
    queryFn: () => fetchData({ data: { month: monthArg } }),
    refetchInterval: view === "today" ? 30_000 : false,
  });

  const score = data?.score ?? 100;
  const breakdown = data?.breakdown ?? [];
  const incidents = data?.rows ?? [];
  const recoveries = incidents.filter((i: any) => i.recovery_action);
  const isHistorical = view === "month" && month !== thisMonth();

  const onSaved = () => syncDomains(qc, "hospitality");

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex gap-1 rounded-md border border-border bg-card p-1">
          <button onClick={() => setView("today")}
            className={cn("px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] rounded-sm",
              view === "today" ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "text-muted-foreground hover:text-foreground")}>Today</button>
          <button onClick={() => setView("month")}
            className={cn("px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] rounded-sm",
              view === "month" ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "text-muted-foreground hover:text-foreground")}>By Month</button>
        </div>
        {view === "month" && (
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(shiftMonth(month, -1))}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:border-[var(--color-gold)]">◀ Prev</button>
            <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] rounded-md bg-[#0A0A0A] text-[var(--color-gold)]">
              {monthLabel(month)}{isHistorical && " · archived"}
            </div>
            <button disabled={month === thisMonth()} onClick={() => setMonth(shiftMonth(month, 1))}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:border-[var(--color-gold)] disabled:opacity-40 disabled:cursor-not-allowed">Next ▶</button>
          </div>
        )}
      </div>
      <Card dark>
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="text-center md:text-left">
            <div className="label-caps text-white/55">{view === "today" ? "Today's Hospitality Score" : `${monthLabel(month)} Score`}</div>
            <div className="mt-1 flex items-baseline justify-center md:justify-start gap-2">
              <span className="font-display text-6xl text-[var(--color-gold)]">{score}</span>
              <span className="text-white/60 text-lg">/100</span>
            </div>
            <StatusPill tone={score >= 90 ? "gold" : score >= 75 ? "success" : "danger"}>
              {score >= 90 ? "Above target" : score >= 75 ? "On target" : "Below target"}
            </StatusPill>
          </div>
          <div className="space-y-2.5">
            {isLoading && <div className="text-white/60 text-sm">Loading…</div>}
            {!isLoading && breakdown.map((b: any) => (
              <div key={b.key}>
                <div className="flex justify-between text-xs mb-1.5 text-white/80">
                  <span>{b.label} {b.count > 0 && <span className="text-white/50">({b.count})</span>}</span>
                  <span className="font-semibold text-[var(--color-gold)]">{b.pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-[var(--color-gold)]" style={{ width: `${b.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => setShowLog(true)} className="rounded-lg bg-[var(--color-gold)] text-[#0A0A0A] font-semibold text-sm px-4 py-3 inline-flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" /> Log Observation
        </button>
        <button onClick={() => setShowRec(true)} className="rounded-lg border border-border bg-card font-semibold text-sm px-4 py-3 inline-flex items-center justify-center gap-2 hover:border-[var(--color-gold)]">
          <Star className="h-4 w-4" /> Log Recovery
        </button>
      </div>

      <SectionHeader eyebrow={view === "today" ? "Today" : monthLabel(month)} title="Guest Recovery Log" action={<StatusPill tone="neutral">{recoveries.length} recoveries</StatusPill>} />
      {isLoading && <div className="text-sm text-muted-foreground mb-2">Loading…</div>}
      <Card className="p-0 overflow-hidden">
        <div className="hidden md:grid grid-cols-[80px_120px_1.4fr_1.4fr_120px] gap-3 px-4 py-2.5 label-caps text-muted-foreground bg-[#FAFAF5] border-b border-border">
          <div>Time</div><div>Category</div><div>Issue</div><div>Resolution</div><div>Severity</div>
        </div>
        {recoveries.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">No recoveries logged today.</div>
        )}
        {recoveries.map((r: any, i: number) => (
          <div key={r.id} className={cn("grid grid-cols-1 md:grid-cols-[80px_120px_1.4fr_1.4fr_120px] gap-3 px-4 py-3 text-sm", i && "border-t border-border")}>
            <div className="text-muted-foreground">{fmtTime(r.logged_at)}</div>
            <div className="font-medium capitalize">{String(r.type).replace("_", " ")}</div>
            <div>{r.notes || "—"}</div>
            <div className="text-muted-foreground">{r.recovery_action}</div>
            <div><StatusPill tone={r.severity === "high" ? "danger" : r.severity === "medium" ? "gold" : "success"}>{r.severity}</StatusPill></div>
          </div>
        ))}
      </Card>

      <SectionHeader eyebrow="Reference" title="Hospitality Standards" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {STANDARDS.map((s) => (
          <Card key={s.t}>
            <div className="font-display text-lg text-foreground">{s.t.toUpperCase()}</div>
            <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.d}</div>
          </Card>
        ))}
      </div>

      {showLog && <LogModal kind="observation" onClose={() => setShowLog(false)} onSaved={onSaved} />}
      {showRec && <LogModal kind="recovery" onClose={() => setShowRec(false)} onSaved={onSaved} />}

      <div className="h-6" />
    </AppShell>
  );
}

function LogModal({ kind, onClose, onSaved }: { kind: "observation" | "recovery"; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<string>("greeting");
  const [severity, setSeverity] = useState<string>("low");
  const [notes, setNotes] = useState("");
  const [recovery, setRecovery] = useState("");
  const logFn = useServerFn(logHospitalityIncident);
  const mut = useMutation({
    mutationFn: () => logFn({ data: {
      type: type as any,
      severity: severity as any,
      notes: notes || undefined,
      recovery_action: kind === "recovery" ? (recovery || undefined) : undefined,
    } }),
    onSuccess: () => { toast.success(kind === "recovery" ? "Recovery logged" : "Observation logged"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 card-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl">{kind === "recovery" ? "LOG RECOVERY" : "LOG OBSERVATION"}</h3>
          <button onClick={onClose} className="text-muted-foreground text-sm">✕</button>
        </div>

        <label className="block mb-3">
          <div className="label-caps text-muted-foreground mb-1">Category</div>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
            <option value="greeting">Greeting</option>
            <option value="accuracy">Order Accuracy</option>
            <option value="upsell">Upsell</option>
            <option value="wait_ack">Wait Acknowledgement</option>
            <option value="recovery">Guest Recovery</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="block mb-3">
          <div className="label-caps text-muted-foreground mb-1">Severity</div>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label className="block mb-3">
          <div className="label-caps text-muted-foreground mb-1">{kind === "recovery" ? "Issue description" : "Notes"}</div>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500}
            placeholder={kind === "recovery" ? "What went wrong…" : "What you saw…"}
            className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
        </label>

        {kind === "recovery" && (
          <label className="block mb-3">
            <div className="label-caps text-muted-foreground mb-1">Resolution / Recovery Action</div>
            <input value={recovery} onChange={(e) => setRecovery(e.target.value)} maxLength={500}
              placeholder="What we did…"
              className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
          </label>
        )}

        <div className="text-xs text-muted-foreground">Timestamp auto-recorded at save. Counts feed the hospitality score and analytics.</div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm border border-border">Cancel</button>
          <button disabled={mut.isPending} onClick={() => mut.mutate()}
            className="rounded-md px-4 py-2 text-sm font-semibold bg-[var(--color-gold)] text-[#0A0A0A] disabled:opacity-60">
            {mut.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
