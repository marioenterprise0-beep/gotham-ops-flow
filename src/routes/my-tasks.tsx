import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Check, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncDomains } from "@/lib/sync-bus";
import { listMyTasks, completeTask } from "@/lib/tasks.functions";
import { supabase } from "@/integrations/supabase/client";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/my-tasks")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "My Tasks · Dip N Shake OS" }] }),
  component: MyTasks,
});

type Task = {
  id: string; title: string; description: string | null; phase: string;
  assignee_role: string | null; assignee_user_id: string | null;
  status: string; requires_signoff: boolean;
  completed_at: string | null; signed_off_at: string | null;
};

function MyTasks() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyTasks);
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["my-tasks"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return [];
      return listFn() as Promise<Task[]>;
    },
  });

  const completeFn = useServerFn(completeTask);
  const completeM = useMutation({
    mutationFn: (taskId: string) => completeFn({ data: { taskId } }),
    onSuccess: () => { toast.success("Task complete"); qc.invalidateQueries({ queryKey: ["my-tasks"] }); syncDomains(qc, "tasks", "operations"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const personal = tasks.filter((t) => t.assignee_user_id);
  const role = tasks.filter((t) => !t.assignee_user_id);

  return (
    <AppShell>
      <div>
        <div className="label-caps text-muted-foreground">Your worklist</div>
        <h1 className="font-display text-3xl text-foreground">MY TASKS</h1>
      </div>

      {tasks.length === 0 && (
        <Card className="mt-6 text-center text-sm text-muted-foreground py-10">
          You're all caught up. No tasks assigned to you right now.
        </Card>
      )}

      {personal.length > 0 && (
        <>
          <SectionHeader eyebrow="Assigned to you" title={`${personal.length} personal`} />
          <TaskGroup tasks={personal} onComplete={(id) => completeM.mutate(id)} pending={completeM.isPending} />
        </>
      )}

      {role.length > 0 && (
        <>
          <SectionHeader eyebrow="From your role" title={`${role.length} role tasks`} />
          <TaskGroup tasks={role} onComplete={(id) => completeM.mutate(id)} pending={completeM.isPending} />
        </>
      )}

      <div className="h-6" />
    </AppShell>
  );
}

function TaskGroup({ tasks, onComplete, pending }: { tasks: Task[]; onComplete: (id: string) => void; pending: boolean }) {
  return (
    <Card className="p-0 overflow-hidden">
      {tasks.map((t, i) => {
        const isDone = t.status === "done" || t.status === "signed_off";
        const isSigned = t.status === "signed_off";
        return (
          <div key={t.id} className={cn("p-3.5 flex items-center gap-3", i && "border-t border-border")}>
            <button
              onClick={() => { if (!isDone) onComplete(t.id); }}
              disabled={isDone || pending}
              className={cn(
                "h-6 w-6 rounded-md border-2 grid place-items-center shrink-0",
                isDone ? "bg-[var(--color-gold)] border-[var(--color-gold)]" : "border-border hover:border-foreground/40",
              )}>
              {isDone && <Check className="h-3.5 w-3.5 text-[#0A0A0A]" strokeWidth={3} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className={cn("text-[15px] font-semibold leading-tight", isDone && "line-through text-muted-foreground")}>{t.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="label-caps text-muted-foreground">{t.phase}</span>
                {t.description && <span className="text-[11px] text-muted-foreground">· {t.description}</span>}
                {t.assignee_role && <RoleBadge role={t.assignee_role} />}
                {t.requires_signoff && <StatusPill tone={isSigned ? "success" : "warning"}>{isSigned ? "Signed off" : "Needs sign-off"}</StatusPill>}
              </div>
            </div>
            {isSigned && <ShieldCheck className="h-4 w-4 text-[var(--color-success)]" />}
          </div>
        );
      })}
    </Card>
  );
}
