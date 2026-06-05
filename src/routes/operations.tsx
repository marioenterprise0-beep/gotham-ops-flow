import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, ProgressBar, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Camera, Check, Timer, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/operations")({
  head: () => ({ meta: [{ title: "Operations · Gotham OS" }] }),
  component: Operations,
});

type Task = { id: string; label: string; owner: string; section: string };

const initial: Task[] = [
  { id: "t1", label: "Power on generator · check fuel", owner: "Shift Lead", section: "Trailer Ready" },
  { id: "t2", label: "Boot POS · run test transaction", owner: "Cashier", section: "Trailer Ready" },
  { id: "t3", label: "Sanitize counter & order window", owner: "Cashier", section: "Front Ready" },
  { id: "t4", label: "Stock packaging · 100 burger boxes", owner: "Prep", section: "Front Ready" },
  { id: "t5", label: "Pre-heat flat top to 425°F", owner: "Grill Master", section: "Kitchen Ready" },
  { id: "t6", label: "Confirm walk-in temps 34–38°F", owner: "Grill Master", section: "Kitchen Ready" },
  { id: "t7", label: "Prep 80 smash patties (5oz)", owner: "Prep", section: "Kitchen Ready" },
  { id: "t8", label: "Uniform check · clean apron + cap", owner: "Shift Lead", section: "Team Ready" },
  { id: "t9", label: "Position assignment posted", owner: "Shift Lead", section: "Team Ready" },
];

const phases = ["Opening", "Mid Shift", "Closing", "Emergency"] as const;

function Operations() {
  const [phase, setPhase] = useState<(typeof phases)[number]>("Opening");
  const [done, setDone] = useState<Record<string, boolean>>({ t1: true, t2: true, t3: true, t4: true, t5: true });

  const total = initial.length;
  const completed = initial.filter((t) => done[t.id]).length;
  const pct = Math.round((completed / total) * 100);
  const sections = Array.from(new Set(initial.map((t) => t.section)));

  return (
    <AppShell>
      <Card dark>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/60">Operations</div>
            <h1 className="font-display text-2xl font-semibold mt-1">{phase} Checklist</h1>
            <div className="mt-1 text-xs text-sidebar-foreground/60 flex items-center gap-2">
              <Timer className="h-3.5 w-3.5" /> Target 20:00 · 12:48 elapsed
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl font-semibold text-gold">{pct}%</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">{completed}/{total} tasks</div>
          </div>
        </div>
        <div className="mt-4"><ProgressBar value={pct} /></div>
      </Card>

      {/* Phase tabs */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {phases.map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            className={cn(
              "rounded-lg px-2 py-2 text-[11px] uppercase tracking-[0.14em] font-medium border transition",
              p === phase
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {sections.map((section) => {
        const tasks = initial.filter((t) => t.section === section);
        const sDone = tasks.filter((t) => done[t.id]).length;
        return (
          <div key={section}>
            <SectionHeader
              eyebrow={section}
              title={`${sDone}/${tasks.length} complete`}
              action={<StatusPill tone={sDone === tasks.length ? "success" : sDone > 0 ? "gold" : "neutral"}>{sDone === tasks.length ? "Verified" : sDone > 0 ? "Active" : "Pending"}</StatusPill>}
            />
            <Card className="p-0 overflow-hidden">
              {tasks.map((t, i) => {
                const isDone = !!done[t.id];
                return (
                  <div key={t.id} className={cn("flex items-center gap-3 p-3.5", i && "border-t border-border")}>
                    <button
                      onClick={() => setDone((d) => ({ ...d, [t.id]: !d[t.id] }))}
                      className={cn(
                        "h-7 w-7 rounded-md border grid place-items-center transition shrink-0",
                        isDone ? "shimmer-gold border-transparent" : "border-border bg-card hover:border-foreground/40",
                      )}
                    >
                      {isDone && <Check className="h-4 w-4" strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={cn("font-medium leading-tight", isDone && "line-through text-muted-foreground")}>{t.label}</div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5">{t.owner}</div>
                    </div>
                    <button className="h-8 w-8 rounded-md border border-border grid place-items-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition shrink-0">
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </Card>
          </div>
        );
      })}

      <SectionHeader eyebrow="Live Board" title="Alerts" />
      <Card className="border-l-4 border-l-warning">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning-foreground mt-0.5" />
          <div>
            <div className="font-medium">Walk-in temp logged 39°F at 11:14</div>
            <div className="text-xs text-muted-foreground mt-1">Auto-flagged. Manager notified. Re-check in 10 minutes.</div>
          </div>
        </div>
      </Card>

      <SectionHeader eyebrow="Approval" title="Manager Signoff" />
      <Card dark className="flex items-center justify-between">
        <div>
          <div className="text-sm text-sidebar-foreground/70">Submit when checklist is 100%.</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50 mt-0.5">Audit trail recorded</div>
        </div>
        <button disabled={pct < 100} className="shimmer-gold disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-4 py-2.5 font-display text-sm font-semibold tracking-tight">
          Request Signoff
        </button>
      </Card>

      <div className="h-6" />
    </AppShell>
  );
}
