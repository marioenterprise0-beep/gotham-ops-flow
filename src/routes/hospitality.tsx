import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hospitality")({
  head: () => ({ meta: [{ title: "Hospitality · Gotham OS" }] }),
  component: Hospitality,
});

const BREAKDOWN = [
  { label: "Greeting",             pct: 92 },
  { label: "Order Accuracy",       pct: 88 },
  { label: "Upselling",            pct: 71 },
  { label: "Wait Time Acknowledgement", pct: 85 },
  { label: "Guest Recovery",       pct: 95 },
];

const RECOVERIES = [
  { time: "12:14", emp: "Carlos",  issue: "Wrong sauce on order",           res: "Remade burger, comp drink",        outcome: "Resolved"  as const },
  { time: "13:02", emp: "Priya",   issue: "Guest waited 6 min without ack", res: "Apologized, offered sample fries", outcome: "Resolved"  as const },
  { time: "13:41", emp: "Marcus",  issue: "Cold fries complaint",           res: "Manager notified, full refund",    outcome: "Escalated" as const },
];

const STANDARDS = [
  { t: "Greeting",        d: "Within 5 seconds. \"Welcome to Gotham Halal!\" — eye contact, smile." },
  { t: "Upsell",          d: "Suggest drink or combo on every order." },
  { t: "Wait Acknowledgement", d: "Update guest if wait exceeds 3 minutes." },
  { t: "Recovery",        d: "Acknowledge, Apologize, Act — within 60 seconds." },
];

function Hospitality() {
  const [showLog, setShowLog] = useState(false);
  const [showRec, setShowRec] = useState(false);
  const score = Math.round(BREAKDOWN.reduce((a, b) => a + b.pct, 0) / BREAKDOWN.length);

  return (
    <AppShell>
      {/* Hero score */}
      <Card dark>
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="text-center md:text-left">
            <div className="label-caps text-white/55">Today's Hospitality Score</div>
            <div className="mt-1 flex items-baseline justify-center md:justify-start gap-2">
              <span className="font-display text-6xl text-[var(--color-gold)]">{score}</span>
              <span className="text-white/60 text-lg">/100</span>
            </div>
            <StatusPill tone="gold">Above target</StatusPill>
          </div>
          <div className="space-y-2.5">
            {BREAKDOWN.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-xs mb-1.5 text-white/80">
                  <span>{b.label}</span><span className="font-semibold text-[var(--color-gold)]">{b.pct}%</span>
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

      <SectionHeader eyebrow="Today" title="Guest Recovery Log" action={<StatusPill tone="neutral">{RECOVERIES.length} incidents</StatusPill>} />
      <Card className="p-0 overflow-hidden">
        <div className="hidden md:grid grid-cols-[80px_120px_1.4fr_1.4fr_120px] gap-3 px-4 py-2.5 label-caps text-muted-foreground bg-[#FAFAF5] border-b border-border">
          <div>Time</div><div>Employee</div><div>Issue</div><div>Resolution</div><div>Outcome</div>
        </div>
        {RECOVERIES.map((r, i) => (
          <div key={i} className={cn("grid grid-cols-1 md:grid-cols-[80px_120px_1.4fr_1.4fr_120px] gap-3 px-4 py-3 text-sm", i && "border-t border-border")}>
            <div className="text-muted-foreground">{r.time}</div>
            <div className="font-medium">{r.emp}</div>
            <div>{r.issue}</div>
            <div className="text-muted-foreground">{r.res}</div>
            <div><StatusPill tone={r.outcome === "Resolved" ? "success" : "danger"}>{r.outcome}</StatusPill></div>
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

      {showLog && <ObsModal onClose={() => setShowLog(false)} />}
      {showRec && <RecModal onClose={() => setShowRec(false)} />}

      <div className="h-6" />
    </AppShell>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 card-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl">{title.toUpperCase()}</h3>
          <button onClick={onClose} className="text-muted-foreground text-sm">✕</button>
        </div>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm border border-border">Cancel</button>
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold bg-[var(--color-gold)] text-[#0A0A0A]">Save</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block mb-3"><div className="label-caps text-muted-foreground mb-1">{label}</div>{children}</label>;
}
function Select({ children }: { children: React.ReactNode }) {
  return <select className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">{children}</select>;
}
function Text({ placeholder }: { placeholder?: string }) {
  return <input placeholder={placeholder} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />;
}

function ObsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Log Observation" onClose={onClose}>
      <Field label="Employee"><Select><option>Carlos</option><option>Priya</option><option>DeShawn</option><option>Marcus</option></Select></Field>
      <Field label="Category"><Select><option>Greeting</option><option>Accuracy</option><option>Upsell</option><option>Recovery</option><option>Energy</option></Select></Field>
      <Field label="Result"><Select><option>Pass</option><option>Fail</option></Select></Field>
      <Field label="Notes"><Text placeholder="What you saw…" /></Field>
      <div className="text-xs text-muted-foreground">Timestamp auto-recorded at save.</div>
    </Modal>
  );
}

function RecModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Log Recovery" onClose={onClose}>
      <Field label="Employee"><Select><option>Carlos</option><option>Priya</option><option>Marcus</option></Select></Field>
      <Field label="Issue description"><Text /></Field>
      <Field label="Resolution"><Text /></Field>
      <Field label="Outcome"><Select><option>Resolved</option><option>Escalated</option></Select></Field>
    </Modal>
  );
}

