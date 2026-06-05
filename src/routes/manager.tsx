import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, ProgressBar, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { canSee, useRole } from "@/lib/role";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/manager")({
  head: () => ({ meta: [{ title: "Manager Panel · Gotham OS" }] }),
  component: ManagerPage,
});

const CREW = [
  { name: "Marcus T.",  role: "Shift Lead",    assigned: 12, done: 9,  status: "ON TRACK" as const },
  { name: "DeShawn",    role: "Grill Master",  assigned: 8,  done: 5,  status: "BEHIND"   as const },
  { name: "Priya",      role: "Prep",          assigned: 6,  done: 6,  status: "COMPLETE" as const },
  { name: "Carlos",     role: "Cashier",       assigned: 7,  done: 4,  status: "BEHIND"   as const },
];

const APPROVALS = [
  { task: "Cold storage temp",   who: "DeShawn", at: "10:18", action: "Re-checked, opened condenser door briefly" },
  { task: "Counter cleanliness", who: "Carlos",  at: "12:42", action: "Re-wiped, restocked napkins" },
];

const ALERTS = [
  { item: "Halal smash patties", count: 18, par: 100, status: "CRITICAL" as const },
  { item: "Brioche buns",        count: 52, par: 240, status: "CRITICAL" as const },
  { item: "Garlic sauce",        count: 2,  par: 6,   status: "LOW"      as const },
];

const MISSED = [
  { task: "Pre-shift huddle",   who: "Marcus",  due: "10:10", missed: "20m" },
  { task: "Mid-shift trash",    who: "Carlos",  due: "13:00", missed: "12m" },
];

function ManagerPage() {
  const { roleId } = useRole();
  if (!canSee(roleId, "manager")) return <Navigate to="/" />;
  const [open, setOpen] = useState(false);

  return (
    <AppShell>
      <Card dark>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
          <div>
            <div className="label-caps text-white/55">Store Score · Today</div>
            <h1 className="font-display text-3xl mt-1 text-white">STORE PERFORMANCE</h1>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l: "Operations", v: 88 },
                { l: "Inventory",  v: 72 },
                { l: "Hospitality", v: 87 },
                { l: "Team",        v: 94 },
              ].map((b) => (
                <div key={b.l} className="rounded-md bg-[#1C1C1C] border border-[#2A2A2A] p-3">
                  <div className="label-caps text-white/55">{b.l}</div>
                  <div className="text-2xl font-semibold mt-1 text-[var(--color-gold)]">{b.v}<span className="text-white/40 text-sm">%</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center md:text-right">
            <div className="font-display text-7xl text-[var(--color-gold)] leading-none">85</div>
            <div className="label-caps text-white/55 mt-1">overall · /100</div>
          </div>
        </div>
      </Card>

      <SectionHeader eyebrow="Crew" title="Completion" action={<button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px]"><Plus className="h-3.5 w-3.5" /> Action Item</button>} />
      <Card className="p-0 overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.4fr_140px_90px_90px_80px_140px] gap-3 px-4 py-2.5 label-caps text-muted-foreground bg-[#FAFAF5] border-b border-border">
          <div>Employee</div><div>Role</div><div>Assigned</div><div>Done</div><div>%</div><div>Status</div>
        </div>
        {CREW.map((c, i) => {
          const pct = Math.round((c.done / c.assigned) * 100);
          return (
            <div key={c.name} className={cn("grid grid-cols-1 md:grid-cols-[1.4fr_140px_90px_90px_80px_140px] gap-3 px-4 py-3 text-sm items-center", i && "border-t border-border")}>
              <div className="font-medium">{c.name}</div>
              <div><RoleBadge role={c.role} /></div>
              <div>{c.assigned}</div>
              <div>{c.done}</div>
              <div>{pct}%</div>
              <div>
                <StatusPill tone={c.status === "COMPLETE" ? "success" : c.status === "ON TRACK" ? "gold" : "warning"}>{c.status}</StatusPill>
              </div>
            </div>
          );
        })}
      </Card>

      <SectionHeader eyebrow="Review" title="Pending Approvals" />
      <Card className="p-0 overflow-hidden">
        {APPROVALS.map((a, i) => (
          <div key={i} className={cn("p-4 flex items-start justify-between gap-3", i && "border-t border-border")}>
            <div className="min-w-0">
              <div className="font-semibold text-sm">{a.task}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Flagged by {a.who} · {a.at}</div>
              <div className="mt-2 text-sm rounded-md bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30 px-3 py-1.5 text-[#7C3A00]">
                Corrective: {a.action}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="rounded-md bg-[var(--color-success)] text-white px-3 py-2 text-xs font-semibold inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Approve</button>
              <button className="rounded-md border border-border px-3 py-2 text-xs font-semibold inline-flex items-center gap-1"><X className="h-3.5 w-3.5" /> Reject</button>
            </div>
          </div>
        ))}
      </Card>

      <SectionHeader eyebrow="Watch" title="Inventory Alerts" />
      <Card className="p-0 overflow-hidden">
        {ALERTS.map((a, i) => {
          const pct = Math.round((a.count / a.par) * 100);
          return (
            <div key={a.item} className={cn("grid grid-cols-1 md:grid-cols-[1.4fr_90px_90px_120px_180px] gap-3 px-4 py-3 items-center text-sm", i && "border-t border-border")}>
              <div className="font-medium">{a.item}</div>
              <div className="text-muted-foreground">{a.count}/{a.par}</div>
              <div><StatusPill tone={a.status === "CRITICAL" ? "danger" : "warning"}>{a.status}</StatusPill></div>
              <div className="hidden md:block"><ProgressBar value={pct} tone={a.status === "CRITICAL" ? "danger" : "gold"} /></div>
              <div className="flex gap-2">
                <button className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold">Reorder</button>
                <button className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Acknowledge</button>
              </div>
            </div>
          );
        })}
      </Card>

      <SectionHeader eyebrow="Accountability" title="Missed Tasks" />
      <Card className="p-0 overflow-hidden">
        {MISSED.map((m, i) => (
          <div key={i} className={cn("grid grid-cols-1 md:grid-cols-4 gap-3 px-4 py-3 text-sm", i && "border-t border-border")}>
            <div className="font-medium">{m.task}</div>
            <div className="text-muted-foreground">{m.who}</div>
            <div className="text-muted-foreground">Due {m.due}</div>
            <div><StatusPill tone="warning">Missed by {m.missed}</StatusPill></div>
          </div>
        ))}
      </Card>

      <SectionHeader eyebrow="Documentation" title="Photo Evidence" />
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-md border border-border bg-[#EAEAE5] grid place-items-center text-xs text-muted-foreground">Photo {i + 1}</div>
        ))}
      </div>

      {open && <ActionModal onClose={() => setOpen(false)} />}

      <div className="h-6" />
    </AppShell>
  );
}

function ActionModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 card-shadow" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-xl mb-4">CREATE ACTION ITEM</h3>
        <div className="space-y-3">
          <input placeholder="Title" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
          <select className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
            <option>Assign to Marcus</option><option>DeShawn</option><option>Priya</option><option>Carlos</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="time" className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
            <select className="h-10 rounded-md border border-border bg-card px-3 text-sm">
              <option>High priority</option><option>Medium</option><option>Low</option>
            </select>
          </div>
          <textarea rows={2} placeholder="Notes" className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm border border-border">Cancel</button>
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold bg-[var(--color-gold)] text-[#0A0A0A]">Create</button>
        </div>
      </div>
    </div>
  );
}
