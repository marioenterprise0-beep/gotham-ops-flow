import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, ProgressBar, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { AlertTriangle, Camera, Check, ChevronDown, ChevronRight, ClipboardSignature, Hash, Lock, MessageSquare, Pencil, ShieldCheck, ThumbsUp, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/operations")({
  head: () => ({ meta: [{ title: "Operations · Gotham OS" }] }),
  component: Operations,
});

type RespType = "pass" | "number" | "photo" | "signature" | "notes" | "time";
type Task = {
  id: string;
  section: string;
  label: string;
  role: string;
  type: RespType;
  standard?: string;
  unit?: string;
  corrective?: string;
  escalate?: string;
};

const PHASES = ["Opening", "Mid-Shift", "Closing", "Emergency"] as const;
type Phase = (typeof PHASES)[number];

const OPENING_TASKS: Task[] = [
  // Trailer Ready
  { id: "o1", section: "TRAILER READY", label: "Power on and confirmed",        role: "Shift Lead",   type: "pass",      standard: "Main power on. No breaker faults." },
  { id: "o2", section: "TRAILER READY", label: "Generator running / stable",     role: "Shift Lead",   type: "pass",      standard: "Fuel above 1/2. No alarms." },
  { id: "o3", section: "TRAILER READY", label: "Equipment startup verified",     role: "Grill Master", type: "pass" },
  { id: "o4", section: "TRAILER READY", label: "POS system online & tested",     role: "Cashier",      type: "pass",      standard: "Test sale processed and voided." },
  // Front Ready
  { id: "o5", section: "FRONT READY",   label: "Counter stocked (napkins/sauces/cups)", role: "Cashier", type: "pass" },
  { id: "o6", section: "FRONT READY",   label: "Packaging inventory at station", role: "Cashier",      type: "number", unit: "boxes" },
  { id: "o7", section: "FRONT READY",   label: "Customer area clean",            role: "Cashier",      type: "photo" },
  // Kitchen Ready
  { id: "o8",  section: "KITCHEN READY", label: "Grill preheated",               role: "Grill Master", type: "number", unit: "°F", standard: "Target ≥ 400°F. Below 400°F = Fail.", corrective: "Allow additional 5 min preheat. Re-check.", escalate: "Below 380°F after 10 min → notify Manager." },
  { id: "o9",  section: "KITCHEN READY", label: "Prep station organized",        role: "Prep",         type: "photo",  standard: "All sauces racked. Mise en place visible." },
  { id: "o10", section: "KITCHEN READY", label: "Cold storage temp verified",    role: "Grill Master", type: "number", unit: "°F", standard: "34–38°F. Outside = Fail.", corrective: "Re-check after 5 min. Move product if needed." },
  { id: "o11", section: "KITCHEN READY", label: "Ingredients stocked & labeled", role: "Prep",         type: "pass" },
  // Team Ready
  { id: "o12", section: "TEAM READY",    label: "Full crew present",             role: "Shift Lead",   type: "number", unit: "ppl" },
  { id: "o13", section: "TEAM READY",    label: "Uniforms inspected",            role: "Shift Lead",   type: "pass",   standard: "Clean apron, hat, gloves available." },
  { id: "o14", section: "TEAM READY",    label: "Positions assigned",            role: "Shift Lead",   type: "signature" },
  { id: "o15", section: "TEAM READY",    label: "Pre-shift huddle completed",    role: "Shift Lead",   type: "time" },
];

const TASKS_BY_PHASE: Record<Phase, Task[]> = {
  "Opening": OPENING_TASKS,
  "Mid-Shift": [
    { id: "m1", section: "FRONT CYCLE", label: "Counter wipe-down (15-min cycle)", role: "Cashier",     type: "time" },
    { id: "m2", section: "FRONT CYCLE", label: "Trash rotation",                   role: "Cashier",     type: "pass" },
    { id: "m3", section: "KITCHEN",     label: "Grill scrape & re-season",         role: "Grill Master",type: "pass" },
    { id: "m4", section: "KITCHEN",     label: "Cold storage spot check",          role: "Grill Master",type: "number", unit: "°F" },
  ],
  "Closing": [
    { id: "c1", section: "KITCHEN", label: "Deep clean flat top",                role: "Grill Master", type: "photo" },
    { id: "c2", section: "KITCHEN", label: "Final cold storage temp",             role: "Grill Master", type: "number", unit: "°F" },
    { id: "c3", section: "FRONT",   label: "Cash drop & reconciliation",          role: "Shift Lead",   type: "signature" },
    { id: "c4", section: "FRONT",   label: "Trash to dumpster",                   role: "Cashier",      type: "pass" },
    { id: "c5", section: "TRAILER", label: "Power down sequence",                 role: "Shift Lead",   type: "pass" },
  ],
  "Emergency": [
    { id: "e1", section: "PROTOCOL", label: "Fire suppression check",             role: "Shift Lead",   type: "pass" },
    { id: "e2", section: "PROTOCOL", label: "First aid kit sealed & stocked",     role: "Shift Lead",   type: "pass" },
    { id: "e3", section: "PROTOCOL", label: "Emergency contacts posted",          role: "Manager",      type: "pass" },
  ],
};

const RESP_ICON: Record<RespType, typeof Hash> = {
  pass: ThumbsUp, number: Hash, photo: Camera, signature: ClipboardSignature, notes: MessageSquare, time: Timer,
};

function Operations() {
  const [phase, setPhase] = useState<Phase>("Opening");
  const tasks = TASKS_BY_PHASE[phase];
  const [done, setDone] = useState<Record<string, { ok: boolean; at: string; value?: string; fail?: boolean }>>({
    o1: { ok: true, at: "10:02" }, o2: { ok: true, at: "10:03" }, o3: { ok: true, at: "10:08" },
    o4: { ok: true, at: "10:22" }, o5: { ok: true, at: "10:25" }, o8: { ok: true, at: "10:14", value: "412" },
    o10: { ok: true, at: "10:18", value: "36" }, o12: { ok: true, at: "10:00", value: "4" }, o13: { ok: true, at: "10:08" },
    o15: { ok: true, at: "10:30" },
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const sections = useMemo(() => Array.from(new Set(tasks.map((t) => t.section))), [tasks]);
  const total = tasks.length;
  const completed = tasks.filter((t) => done[t.id]?.ok).length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const complete = (id: string, payload: { ok: boolean; value?: string; fail?: boolean }) => {
    setDone((d) => ({ ...d, [id]: { ...payload, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) } }));
    setOpenId(null);
  };

  const anyFail = Object.values(done).some((d) => d.fail);

  return (
    <AppShell>
      {anyFail && (
        <div className="mb-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] px-4 py-3 flex items-center gap-2 text-sm text-[var(--color-danger)]">
          <AlertTriangle className="h-4 w-4" /> Escalation triggered. Manager review required before signoff.
        </div>
      )}

      <Card dark>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="label-caps text-white/55">Operations</div>
            <h1 className="font-display text-3xl mt-1 text-white">{phase.toUpperCase()} CHECKLIST</h1>
            <div className="mt-1 text-xs text-white/60 flex items-center gap-2"><Timer className="h-3.5 w-3.5" /> Target 20:00 · 8 min remaining</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold text-[var(--color-gold)]">{pct}%</div>
            <div className="label-caps text-white/55">{completed}/{total} tasks</div>
          </div>
        </div>
      </Card>

      {/* Phase Tabs */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {PHASES.map((p) => (
          <button key={p} onClick={() => setPhase(p)}
            className={cn(
              "rounded-lg px-2 py-2.5 text-xs font-semibold uppercase tracking-[1.2px] border transition",
              p === phase
                ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]"
                : "bg-card text-muted-foreground border-border hover:text-foreground",
            )}>
            {p}
          </button>
        ))}
      </div>

      {sections.map((section) => {
        const list = tasks.filter((t) => t.section === section);
        const sDone = list.filter((t) => done[t.id]?.ok).length;
        const isCollapsed = !!collapsed[section];
        return (
          <div key={section}>
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [section]: !c[section] }))}
              className="mt-5 w-full flex items-center justify-between rounded-lg surface-dark px-4 py-3 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="font-display text-[var(--color-gold)] tracking-wider">{section}</span>
                <span className="label-caps text-white/55">{sDone}/{list.length} complete</span>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-white/70 transition", isCollapsed && "-rotate-90")} />
            </button>

            {!isCollapsed && (
              <Card className="p-0 overflow-hidden mt-2">
                {list.map((t, i) => {
                  const state = done[t.id];
                  const isOpen = openId === t.id;
                  const Icon = RESP_ICON[t.type];
                  return (
                    <div key={t.id} className={cn(i && "border-t border-border")}>
                      <div className="flex items-center gap-3 p-3.5">
                        <button
                          onClick={() => {
                            if (state?.ok) return;
                            if (t.type === "pass") complete(t.id, { ok: true });
                            else setOpenId(isOpen ? null : t.id);
                          }}
                          disabled={!!state?.ok}
                          className={cn(
                            "h-6 w-6 rounded-md border-2 grid place-items-center shrink-0",
                            state?.ok ? "bg-[var(--color-gold)] border-[var(--color-gold)]" : "border-border hover:border-foreground/40",
                          )}
                        >
                          {state?.ok && <Check className="h-3.5 w-3.5 text-[#0A0A0A]" strokeWidth={3} />}
                        </button>
                        <button onClick={() => setOpenId(isOpen ? null : t.id)} className="flex-1 min-w-0 text-left">
                          <div className={cn("text-[15px] font-semibold leading-tight", state?.ok && "line-through text-muted-foreground")}>{t.label}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <RoleBadge role={t.role} />
                            <span className="inline-flex items-center gap-1 label-caps text-muted-foreground">
                              <Icon className="h-3 w-3" /> {t.type}
                            </span>
                            {state?.at && <span className="text-[10px] text-muted-foreground">· {state.at}</span>}
                            {state?.fail && <StatusPill tone="danger">Fail</StatusPill>}
                          </div>
                        </button>
                        {state?.ok ? (
                          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <button onClick={() => setOpenId(isOpen ? null : t.id)} className="h-8 w-8 grid place-items-center rounded-md border border-border hover:border-foreground/40 shrink-0">
                            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition", isOpen && "rotate-90")} />
                          </button>
                        )}
                      </div>

                      {isOpen && !state?.ok && (
                        <TaskDetail task={t} onComplete={complete} />
                      )}
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        );
      })}

      {/* Progress footer */}
      <div className="sticky bottom-20 lg:bottom-4 mt-6">
        <Card className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{phase}: {completed}/{total} complete · 8 min remaining</div>
            <div className="mt-2"><ProgressBar value={pct} /></div>
          </div>
          <button
            disabled={pct < 100}
            className="hidden md:inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-[var(--color-gold)] text-[#0A0A0A] font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
            <ShieldCheck className="h-4 w-4" /> Manager Signoff
          </button>
        </Card>
      </div>

      <div className="h-6" />
    </AppShell>
  );
}

function TaskDetail({ task, onComplete }: { task: Task; onComplete: (id: string, p: { ok: boolean; value?: string; fail?: boolean }) => void }) {
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [failed, setFailed] = useState(false);

  return (
    <div className="bg-[#FAFAF5] border-t border-border px-4 py-4">
      <div className="text-sm text-foreground/80">{task.standard ?? "Complete this task to standard."}</div>
      {task.standard && (
        <div className="mt-3 rounded-md bg-[var(--color-gold-light)] border border-[var(--color-gold)]/40 px-3 py-2 text-xs text-[#5A4318]">
          <span className="font-semibold">Standard: </span>{task.standard}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {task.type === "number" && (
          <label className="block">
            <div className="label-caps text-muted-foreground mb-1">Value{task.unit ? ` (${task.unit})` : ""}</div>
            <input value={value} onChange={(e) => setValue(e.target.value)} type="number" className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-[var(--color-gold)] outline-none" />
          </label>
        )}
        {task.type === "photo" && (
          <button className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-border py-6 text-sm text-muted-foreground hover:text-foreground hover:border-[var(--color-gold)]">
            <Camera className="h-5 w-5" /> Tap to capture
          </button>
        )}
        {task.type === "signature" && (
          <button className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-border py-6 text-sm text-muted-foreground hover:text-foreground hover:border-[var(--color-gold)]">
            <Pencil className="h-5 w-5" /> Tap to sign
          </button>
        )}
        {task.type === "time" && (
          <div className="rounded-md border border-border bg-card px-3 py-3 text-sm">Auto-stamp on completion: <span className="font-semibold">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
        )}
        <label className="block md:col-span-1">
          <div className="label-caps text-muted-foreground mb-1">Notes (optional)</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-[var(--color-gold)] outline-none" />
        </label>
      </div>

      {failed && (
        <>
          {task.corrective && (
            <div className="mt-3 rounded-md bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/40 px-3 py-2 text-xs text-[#7C3A00]">
              <span className="font-semibold">Corrective action: </span>{task.corrective}
            </div>
          )}
          {task.escalate && (
            <div className="mt-2 rounded-md bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/40 px-3 py-2 text-xs text-[var(--color-danger)]">
              <span className="font-semibold">Escalate: </span>{task.escalate}
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button onClick={() => { setFailed(true); onComplete(task.id, { ok: true, fail: true, value }); }}
          className="text-xs font-semibold uppercase tracking-[1.2px] text-[var(--color-danger)] hover:underline">
          Mark Fail
        </button>
        <button onClick={() => onComplete(task.id, { ok: true, value })}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-[var(--color-gold)] text-[#0A0A0A] font-semibold text-sm hover:brightness-95">
          <Check className="h-4 w-4" /> Mark Complete
        </button>
      </div>
    </div>
  );
}
