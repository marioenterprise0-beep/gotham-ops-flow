import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, ProgressBar, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Check, Play, ShieldCheck, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncDomains } from "@/lib/sync-bus";
import { getActiveShift, openShift, closeShift, ensureShiftPhase } from "@/lib/shifts.functions";
import { listTasks, completeTask, signOffTask, deleteTask } from "@/lib/tasks.functions";
import { createActionTask, listCrewRoster } from "@/lib/manager.functions";
import { getChecklistSession, upsertChecklistSession } from "@/lib/checklist-sessions.functions";
import { useRole } from "@/lib/role";
import { toast } from "sonner";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { Plus, Trash2 } from "lucide-react";


export const Route = createFileRoute("/operations")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Operations · Gotham OS" }] }),
  component: Operations,
});

type Task = {
  id: string; title: string; description: string | null; phase: string;
  assignee_role: string | null; status: string; requires_signoff: boolean;
  completed_at: string | null; signed_off_at: string | null;
};

const PHASES = ["opening", "mid", "closing", "emergency"] as const;
type Phase = (typeof PHASES)[number];

// Operating windows (local time, 24h). Opening 10a–4p, Closing 4p–12a.
const PHASE_WINDOWS: Record<Phase, { label: string; startHour: number; endHour: number } | null> = {
  opening: { label: "10:00 AM – 4:00 PM", startHour: 10, endHour: 16 },
  mid: { label: "12:00 PM – 6:00 PM", startHour: 12, endHour: 18 },
  closing: { label: "4:00 PM – 12:00 AM", startHour: 16, endHour: 24 },
  emergency: null,
};

function phaseForHour(h: number): Phase {
  if (h >= 10 && h < 16) return "opening";
  if (h >= 16 || h < 2) return "closing";
  return "mid";
}

function Operations() {
  const qc = useQueryClient();
  const { roleId, trailerScope, trailers } = useRole();
  const isManager = roleId === "owner" || roleId === "manager";
  const isOwner = roleId === "owner";
  const [phase, setPhase] = useState<Phase>(() => phaseForHour(new Date().getHours()));

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRole, setNewRole] = useState<string>("");
  const [newAssignee, setNewAssignee] = useState<string>("");
  const [newSignoff, setNewSignoff] = useState(false);

  // For managers in "Company" scope, server resolves to their own trailer
  const activeTrailer = trailerScope;
  const trailerLabel = activeTrailer
    ? (trailers.find((t) => t.id === activeTrailer)?.name ?? "Trailer")
    : "Your trailer";

  const shiftFn = useServerFn(getActiveShift);
  const { data: shiftData } = useQuery({
    queryKey: ["shift", activeTrailer ?? "own"],
    queryFn: () => shiftFn({ data: { trailerId: activeTrailer } }),
  });
  const shift = shiftData?.shift;

  const rosterFn = useServerFn(listCrewRoster);
  const { data: roster = [] } = useQuery<Array<{ id: string; name: string; role: string }>>({
    queryKey: ["roster", activeTrailer ?? "company"],
    queryFn: () => rosterFn({ data: { trailerId: activeTrailer } }) as any,
    enabled: isManager,
  });

  const tasksFn = useServerFn(listTasks);
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks", shift?.id],
    queryFn: () => tasksFn({ data: { shiftId: shift!.id } }) as Promise<Task[]>,
    enabled: !!shift?.id,
  });
  const tasks = allTasks.filter((t) => t.phase === phase);

  const openFn = useServerFn(openShift);
  const ensureFn = useServerFn(ensureShiftPhase);
  const closeFn = useServerFn(closeShift);
  const completeFn = useServerFn(completeTask);
  const signOffFn = useServerFn(signOffTask);

  const openM = useMutation({
    mutationFn: () => openFn({ data: { phase: "opening", trailerId: activeTrailer ?? undefined } }),
    onSuccess: () => { toast.success("Shift opened"); syncDomains(qc, "operations", "tasks", "labor"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const ensureM = useMutation({
    mutationFn: (p: Phase) => ensureFn({ data: { shiftId: shift!.id, phase: p } }),
    onSuccess: () => syncDomains(qc, "tasks", "operations"),
  });
  const closeM = useMutation({
    mutationFn: () => closeFn({ data: { shiftId: shift!.id } }),
    onSuccess: () => { toast.success("Shift closed"); syncDomains(qc, "operations", "tasks", "labor", "recaps"); },
  });
  const completeM = useMutation({
    mutationFn: (taskId: string) => completeFn({ data: { taskId } }),
    onSuccess: () => syncDomains(qc, "tasks", "operations"),
    onError: (e: Error) => toast.error(e.message),
  });
  const signOffM = useMutation({
    mutationFn: (vars: { taskId: string; approve: boolean }) => signOffFn({ data: vars }),
    onSuccess: () => { toast.success("Signed off"); syncDomains(qc, "tasks", "operations"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteFn = useServerFn(deleteTask);
  const deleteM = useMutation({
    mutationFn: (taskId: string) => deleteFn({ data: { taskId } }),
    onSuccess: () => { toast.success("Task deleted"); syncDomains(qc, "tasks", "operations"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTaskFn = useServerFn(createActionTask);
  const addTaskM = useMutation({
    mutationFn: () => addTaskFn({ data: {
      title: newTitle.trim(),
      description: newDesc.trim() || (phase.toUpperCase() + " · CUSTOM"),
      assigneeRole: (newRole || undefined) as any,
      assigneeUserId: (newAssignee || undefined) as any,
      phase,
      requiresSignoff: newSignoff,
      trailerId: activeTrailer ?? undefined,
    } }),
    onSuccess: () => {
      toast.success("Task added");
      setShowAdd(false); setNewTitle(""); setNewDesc(""); setNewRole(""); setNewAssignee(""); setNewSignoff(false);
      syncDomains(qc, "tasks", "operations");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "done" || t.status === "signed_off").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const sections = Array.from(new Set(tasks.map((t) => t.description ?? "GENERAL")));

  if (!shift) {
    return (
      <AppShell>
        <Card dark className="text-center py-12">
          <div className="label-caps text-white/55">No active shift</div>
          <h1 className="font-display text-3xl text-white mt-2">START THE SHIFT</h1>
          <p className="text-white/60 text-sm mt-2">Open the trailer to seed the checklist.</p>
          <button onClick={() => openM.mutate()} disabled={openM.isPending}
            className="mt-5 inline-flex items-center gap-2 rounded-lg px-5 py-3 bg-[var(--color-gold)] text-[#0A0A0A] font-semibold text-sm disabled:opacity-60">
            <Play className="h-4 w-4" /> Open Shift
          </button>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Card dark>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="label-caps text-white/55">Active Shift · {trailerLabel}</div>
            <h1 className="font-display text-3xl mt-1 text-white">{phase.toUpperCase()} CHECKLIST</h1>
            <div className="mt-1 text-xs text-white/60 flex items-center gap-2"><Timer className="h-3.5 w-3.5" /> Opened {new Date(shift.opened_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold text-[var(--color-gold)]">{pct}%</div>
            <div className="label-caps text-white/55">{completed}/{total} tasks</div>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {PHASES.map((p) => (
          <button key={p}
            onClick={() => { setPhase(p); if (shift?.id) ensureM.mutate(p); }}
            className={cn(
              "rounded-lg px-2 py-2.5 text-xs font-semibold uppercase tracking-[1.2px] border transition",
              p === phase ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]" : "bg-card text-muted-foreground border-border hover:text-foreground",
            )}>
            {p}
          </button>
        ))}
      </div>

      <ChecklistSessionForm shiftId={shift.id} phase={phase} trailerId={activeTrailer ?? null} />

      {isManager && (
        <div className="mt-4">
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 border border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-[var(--color-gold)]">
              <Plus className="h-4 w-4" /> Add task to {phase}
            </button>
          ) : (
            <Card>
              <div className="label-caps text-muted-foreground mb-2">New {phase} task</div>
              <div className="space-y-2">
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Section / description (optional)"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
                <div className="flex gap-2">
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                    className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none">
                    <option value="">Any role</option>
                    <option value="manager">Manager</option>
                    <option value="shift_lead">Shift lead</option>
                    <option value="grill">Grill</option>
                    <option value="prep">Prep</option>
                    <option value="cashier">Cashier</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground px-2 border border-border rounded-md">
                    <input type="checkbox" checked={newSignoff} onChange={(e) => setNewSignoff(e.target.checked)} />
                    Sign-off
                  </label>
                </div>
                <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none">
                  <option value="">Assign to specific employee… (optional)</option>
                  {roster.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.role}</option>
                  ))}
                </select>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowAdd(false)} className="flex-1 rounded-md border border-border py-2 text-sm">Cancel</button>
                  <button onClick={() => addTaskM.mutate()} disabled={!newTitle.trim() || addTaskM.isPending}
                    className="flex-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] py-2 text-sm font-semibold disabled:opacity-60">
                    {addTaskM.isPending ? "Adding…" : "Add task"}
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}


      {sections.length === 0 && (
        <Card className="mt-5 text-center text-sm text-muted-foreground">
          No tasks for this phase yet. <button onClick={() => ensureM.mutate(phase)} className="text-[var(--color-gold)] font-semibold">Seed checklist</button>
        </Card>
      )}

      {sections.map((section) => {
        const list = tasks.filter((t) => (t.description ?? "GENERAL") === section);
        const sDone = list.filter((t) => t.status === "done" || t.status === "signed_off").length;
        return (
          <div key={section}>
            <div className="mt-5 rounded-lg surface-dark px-4 py-3 flex items-center gap-3">
              <span className="font-display text-[var(--color-gold)] tracking-wider">{section}</span>
              <span className="label-caps text-white/55">{sDone}/{list.length} complete</span>
            </div>
            <Card className="p-0 overflow-hidden mt-2">
              {list.map((t, i) => {
                const isDone = t.status === "done" || t.status === "signed_off";
                const isSigned = t.status === "signed_off";
                return (
                  <div key={t.id} className={cn("p-3.5 flex items-center gap-3", i && "border-t border-border")}>
                    <button
                      onClick={() => { if (!isDone) completeM.mutate(t.id); }}
                      disabled={isDone}
                      className={cn(
                        "h-6 w-6 rounded-md border-2 grid place-items-center shrink-0",
                        isDone ? "bg-[var(--color-gold)] border-[var(--color-gold)]" : "border-border hover:border-foreground/40",
                      )}>
                      {isDone && <Check className="h-3.5 w-3.5 text-[#0A0A0A]" strokeWidth={3} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-[15px] font-semibold leading-tight", isDone && "line-through text-muted-foreground")}>{t.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {t.assignee_role && <RoleBadge role={t.assignee_role} />}
                        {t.requires_signoff && <StatusPill tone={isSigned ? "success" : "warning"}>{isSigned ? "Signed off" : "Needs sign-off"}</StatusPill>}
                        {t.completed_at && <span className="text-[10px] text-muted-foreground">· {new Date(t.completed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</span>}
                      </div>
                    </div>
                    {isDone && !isSigned && t.requires_signoff && isManager && (
                      <button onClick={() => signOffM.mutate({ taskId: t.id, approve: true })}
                        className="rounded-md bg-[var(--color-success)] text-white px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete task "${t.title}"? This cannot be undone from the checklist.`)) {
                            deleteM.mutate(t.id);
                          }
                        }}
                        disabled={deleteM.isPending}
                        title="Delete task"
                        className="h-8 w-8 grid place-items-center rounded-md border border-border text-muted-foreground hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] disabled:opacity-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        );
      })}

      <div className="sticky bottom-20 lg:bottom-4 mt-6">
        <Card className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{phase}: {completed}/{total} complete</div>
            <div className="mt-2"><ProgressBar value={pct} /></div>
          </div>
          {isManager && (
            <button onClick={() => closeM.mutate()}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 border border-border text-sm font-semibold hover:border-[var(--color-gold)]">
              Close Shift
            </button>
          )}
        </Card>
      </div>

      <div className="h-6" />
    </AppShell>
  );
}

function toLocalInput(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}
function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 60000;
  return diff > 0 ? Math.round(diff) : null;
}

const TARGETS: Record<Phase, string> = {
  opening: "10–15 min",
  mid: "60–75 min",
  closing: "35–50 min",
  emergency: "15–25 min",
};
const PHASE_TITLES: Record<Phase, string> = {
  opening: "Opening Session",
  mid: "Prep Session",
  closing: "Closing Session",
  emergency: "Inventory Check Session",
};

function ChecklistSessionForm({ shiftId, phase, trailerId }: { shiftId: string; phase: Phase; trailerId: string | null }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getChecklistSession);
  const saveFn = useServerFn(upsertChecklistSession);
  const { data: session } = useQuery<any>({
    queryKey: ["checklist-session", shiftId, phase],
    queryFn: () => getFn({ data: { shiftId, phase } }) as any,
  });

  const [employee, setEmployee] = useState("");
  const [manager, setManager] = useState("");
  const [initials, setInitials] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState<string | null>(null);

  if (hydrated !== `${shiftId}|${phase}`) {
    setEmployee(session?.employee_name ?? "");
    setManager(session?.manager_name ?? "");
    setInitials(session?.manager_initials ?? "");
    setStartAt(toLocalInput(session?.start_at));
    setEndAt(toLocalInput(session?.end_at));
    setNotes(session?.notes ?? "");
    setHydrated(`${shiftId}|${phase}`);
  }

  const saveM = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      saveFn({
        data: {
          shiftId,
          phase,
          trailerId,
          employeeName: employee.trim() || null,
          managerName: manager.trim() || null,
          managerInitials: initials.trim().toUpperCase() || null,
          startAt: fromLocalInput(startAt),
          endAt: fromLocalInput(endAt),
          notes: notes.trim() || null,
          ...patch,
        } as any,
      }),
    onSuccess: () => {
      toast.success("Session saved");
      qc.invalidateQueries({ queryKey: ["checklist-session", shiftId, phase] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = minutesBetween(fromLocalInput(startAt), fromLocalInput(endAt));

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="label-caps text-muted-foreground">{PHASE_TITLES[phase]}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Target {TARGETS[phase]} · {new Date().toLocaleDateString()}</div>
        </div>
        <button
          onClick={() => {
            const now = new Date().toISOString();
            setStartAt(toLocalInput(now));
            saveM.mutate({ startAt: now });
          }}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:border-[var(--color-gold)]"
        >
          Stamp start
        </button>
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={employee} onChange={(e) => setEmployee(e.target.value)} placeholder="Employee name" maxLength={120}
          className="bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
        <input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Manager name" maxLength={120}
          className="bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Start time
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
            className="bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--color-gold)]" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          End time
          <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)}
            className="bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--color-gold)]" />
        </label>
        <input value={initials} onChange={(e) => setInitials(e.target.value)} placeholder="Manager initials" maxLength={8}
          className="bg-secondary border border-border rounded-md px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-[var(--color-gold)]" />
        <div className="bg-secondary border border-border rounded-md px-3 py-2 text-sm flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Total minutes</span>
          <span className="font-semibold">{total ?? "—"}</span>
        </div>
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" maxLength={2000} rows={2}
        className="mt-2 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
      <div className="mt-2 flex gap-2 justify-end">
        <button
          onClick={() => {
            const now = new Date().toISOString();
            setEndAt(toLocalInput(now));
            saveM.mutate({ endAt: now });
          }}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:border-[var(--color-gold)]"
        >
          Stamp end
        </button>
        <button onClick={() => saveM.mutate({})} disabled={saveM.isPending}
          className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-4 py-1.5 text-xs font-semibold disabled:opacity-60">
          {saveM.isPending ? "Saving…" : "Save session"}
        </button>
      </div>
    </Card>
  );
}
