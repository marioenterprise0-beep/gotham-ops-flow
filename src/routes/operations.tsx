import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, ProgressBar, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Check, Play, ShieldCheck, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveShift, openShift, closeShift, ensureShiftPhase } from "@/lib/shifts.functions";
import { listTasks, completeTask, signOffTask } from "@/lib/tasks.functions";
import { createActionTask } from "@/lib/manager.functions";
import { useRole } from "@/lib/role";
import { toast } from "sonner";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { Plus } from "lucide-react";


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

function Operations() {
  const qc = useQueryClient();
  const { roleId } = useRole();
  const isManager = roleId === "owner" || roleId === "manager";
  const [phase, setPhase] = useState<Phase>("opening");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRole, setNewRole] = useState<string>("");
  const [newSignoff, setNewSignoff] = useState(false);


  const shiftFn = useServerFn(getActiveShift);
  const { data: shiftData } = useQuery({ queryKey: ["shift"], queryFn: () => shiftFn() });
  const shift = shiftData?.shift;

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
    mutationFn: () => openFn({ data: { phase: "opening" } }),
    onSuccess: () => { toast.success("Shift opened"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const ensureM = useMutation({
    mutationFn: (p: Phase) => ensureFn({ data: { shiftId: shift!.id, phase: p } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const closeM = useMutation({
    mutationFn: () => closeFn({ data: { shiftId: shift!.id } }),
    onSuccess: () => { toast.success("Shift closed"); qc.invalidateQueries(); },
  });
  const completeM = useMutation({
    mutationFn: (taskId: string) => completeFn({ data: { taskId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const signOffM = useMutation({
    mutationFn: (vars: { taskId: string; approve: boolean }) => signOffFn({ data: vars }),
    onSuccess: () => { toast.success("Signed off"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
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
            <div className="label-caps text-white/55">Active Shift</div>
            <h1 className="font-display text-3xl mt-1 text-white">{phase.toUpperCase()} CHECKLIST</h1>
            <div className="mt-1 text-xs text-white/60 flex items-center gap-2"><Timer className="h-3.5 w-3.5" /> Opened {new Date(shift.opened_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
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
                        {t.completed_at && <span className="text-[10px] text-muted-foreground">· {new Date(t.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                      </div>
                    </div>
                    {isDone && !isSigned && t.requires_signoff && isManager && (
                      <button onClick={() => signOffM.mutate({ taskId: t.id, approve: true })}
                        className="rounded-md bg-[var(--color-success)] text-white px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Approve
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
