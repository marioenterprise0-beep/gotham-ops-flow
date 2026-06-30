import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, CircularProgress, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import {
  Activity, AlertTriangle, BellRing, BookOpen, Boxes, CalendarDays, Check, ChevronRight, ClipboardList,
  Clock, Coffee, Download, FileText, FileWarning, Flame, LogIn, LogOut, MapPin,
  Megaphone, Play, ShieldCheck, Timer, TrendingUp, Users, Wallet,
} from "lucide-react";
import { downloadCSV, openPrintablePDF, htmlTable, kpiBlock, escapeHTML } from "@/lib/exports";
import { useEffect, useMemo, useState } from "react";
import { useRole, ROLES, initials, type RoleId } from "@/lib/role";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { getHealthScore } from "@/lib/health.functions";
import { listMyTasks, completeTask } from "@/lib/tasks.functions";
import { getMyActivePunch } from "@/lib/timeclock.functions";
import { listAlerts } from "@/lib/alerts.functions";
import { supabase } from "@/integrations/supabase/client";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { syncDomains } from "@/lib/sync-bus";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ShiftFlowTracker } from "@/components/gotham/ShiftFlowTracker";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({
    meta: [
      { title: "Dashboard · Gotham OS" },
      { name: "description", content: "Role-based shift dashboard for Gotham Halal crew." },
    ],
  }),
  component: Dashboard,
});

function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return t;
}

type Task = {
  id: string; title: string; description: string | null; phase: string;
  assignee_role: string | null; assignee_user_id: string | null;
  status: string; requires_signoff: boolean;
  completed_at: string | null; signed_off_at: string | null;
};

function Dashboard() {
  const { roleId, session, loading, user } = useRole();
  const role = roleId ? ROLES[roleId] : null;
  const isManagerView = roleId === "owner" || roleId === "manager";

  const fetchStats = useServerFn(getDashboardStats);
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return null;
      return fetchStats();
    },
    enabled: !loading && !!session,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (loading) {
    return <AppShell><Card className="py-10 text-center text-sm text-muted-foreground">Loading dashboard…</Card></AppShell>;
  }

  return (
    <AppShell>
      {isManagerView
        ? <ManagerView stats={stats} role={role} />
        : <CrewView stats={stats} role={role} roleId={roleId} userName={user} />}
      <div className="h-4" />
    </AppShell>
  );
}

/* =================== CREW VIEW =================== */

function CrewView({ stats, role, roleId, userName }: { stats: any; role: any; roleId: RoleId | null; userName: string }) {
  const qc = useQueryClient();
  const now = useClock();

  const listTasksFn = useServerFn(listMyTasks);
  const { data: myTasks = [] } = useQuery<Task[]>({
    queryKey: ["my-tasks"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return [];
      return listTasksFn() as Promise<Task[]>;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const punchFn = useServerFn(getMyActivePunch);
  const { data: punch } = useQuery({
    queryKey: ["my-active-punch"],
    queryFn: () => punchFn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const alertsFn = useServerFn(listAlerts);
  const { data: announcements = [] } = useQuery<any[]>({
    queryKey: ["my-announcements"],
    queryFn: () => alertsFn({ data: { category: "announcements" } }) as Promise<any[]>,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const completeFn = useServerFn(completeTask);
  const completeM = useMutation({
    mutationFn: (taskId: string) => completeFn({ data: { taskId } }),
    onSuccess: () => {
      toast.success("Task complete");
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      syncDomains(qc, "tasks", "operations");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = myTasks.length;
  const done = myTasks.filter((t) => t.status === "done" || t.status === "signed_off").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const clockedIn = !!(punch as any)?.clock_in_at;
  const clockInAt = clockedIn ? new Date((punch as any).clock_in_at) : null;
  const elapsedMs = clockInAt ? now.getTime() - clockInAt.getTime() : 0;
  const hours = Math.floor(elapsedMs / 3_600_000);
  const minutes = Math.floor((elapsedMs % 3_600_000) / 60_000);
  const elapsedLabel = clockedIn ? `${hours}h ${minutes.toString().padStart(2, "0")}m` : "—";

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, [now]);

  return (
    <>
      {/* Hero: greeting + shift status (compressed) */}
      <Card dark className="relative overflow-hidden !p-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
          <div>
            <div className="flex items-center gap-2 label-caps text-white/60">
              <span className={`h-1.5 w-1.5 rounded-full ${clockedIn ? "bg-[var(--color-success)] animate-pulse" : "bg-white/30"}`} />
              {clockedIn ? "On shift" : "Off the clock"}
            </div>
            <h1 className="font-display text-2xl md:text-3xl mt-0.5 text-white leading-tight">
              {greeting.toUpperCase()}, {userName.toUpperCase()}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/70">
              <span className="flex items-center gap-1.5"><Timer className="h-3 w-3 text-[var(--color-gold)]" />{now.toLocaleString([], { weekday: "short", month: "short", day: "numeric" })} · {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-[var(--color-gold)]" />{stats?.store?.name ?? "—"}</span>
              {role && <RoleBadge role={role.name} />}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {clockedIn
                ? <Link to="/time-clock" className="inline-flex items-center gap-1.5 rounded-md bg-white/10 text-white border border-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[1.2px] hover:bg-white/15"><LogOut className="h-3 w-3" /> Clock out · {elapsedLabel}</Link>
                : <Link to="/time-clock" className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[1.2px]"><LogIn className="h-3 w-3" /> Clock in</Link>}
              <Link to="/my-tasks" className="inline-flex items-center gap-1.5 rounded-md bg-white/5 text-white border border-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[1.2px] hover:bg-white/10">
                <ClipboardList className="h-3 w-3" /> All my tasks
              </Link>
            </div>
          </div>
          <div className="hidden md:flex justify-end">
            <CircularProgress value={pct} size={84} stroke={8} label="My Tasks" />
          </div>
        </div>
      </Card>

      {/* Shift flow tracker — primary employee workflow */}
      <div className="mt-3">
        <ShiftFlowTracker
          clockedIn={clockedIn}
          hasClockedInToday={clockedIn}
          tasksTotal={total}
          tasksDone={done}
          opsRunPct={total > 0 ? pct : 0}
          inventoryCountedToday={false}
          criticalAlertsOpen={(stats?.alerts?.pending ?? []).filter((a: any) => a.priority === "critical").length}
          recapSubmittedToday={false}
          isManagerView={false}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
        <DarkStat label="My Tasks Done" value={`${done}/${total || 0}`} sub={total === 0 ? "no tasks yet" : `${total - done} remaining`} tone={done === total && total > 0 ? "gold" : undefined} />
        <DarkStat label="Time on Shift" value={elapsedLabel} sub={clockedIn ? "since clock-in" : "not clocked in"} />
        <DarkStat label="Announcements" value={String(announcements.length)} sub={announcements.length ? "new for you" : "all caught up"} tone={announcements.length ? "gold" : undefined} />
        <DarkStat label="Shift Phase" value={(stats?.shift?.phase ?? "—").toString().toUpperCase()} sub={stats?.shift ? "active shift" : "no active shift"} />
      </div>

      {/* My Tasks for This Shift */}
      <SectionHeader
        eyebrow="Your shift"
        title="My Tasks"
        action={<Link to="/my-tasks" className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">Open list</Link>}
      />
      <Card className="p-0 overflow-hidden">
        {myTasks.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            You're all caught up. No tasks assigned to you right now.
          </div>
        )}
        {myTasks.slice(0, 8).map((t, i) => {
          const isDone = t.status === "done" || t.status === "signed_off";
          const isSigned = t.status === "signed_off";
          return (
            <div key={t.id} className={cn("p-3.5 flex items-center gap-3", i && "border-t border-border")}>
              <button
                onClick={() => { if (!isDone) completeM.mutate(t.id); }}
                disabled={isDone || completeM.isPending}
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
                  {t.description && <span className="text-[11px] text-muted-foreground truncate">· {t.description}</span>}
                  {t.requires_signoff && <StatusPill tone={isSigned ? "success" : "warning"}>{isSigned ? "Signed off" : "Needs sign-off"}</StatusPill>}
                </div>
              </div>
              {isSigned && <ShieldCheck className="h-4 w-4 text-[var(--color-success)]" />}
            </div>
          );
        })}
        {myTasks.length > 8 && (
          <Link to="/my-tasks" className="block border-t border-border p-3 text-center text-xs label-caps text-foreground/70 hover:text-[var(--color-gold)]">
            View {myTasks.length - 8} more <ChevronRight className="inline h-3 w-3" />
          </Link>
        )}
      </Card>

      {/* Announcements / personal alerts */}
      <SectionHeader eyebrow="For you" title="Announcements" action={<Link to="/alerts" className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">All alerts</Link>} />
      <Card className="p-0 overflow-hidden">
        {announcements.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No new announcements.</div>
        )}
        {announcements.slice(0, 4).map((a, i) => (
          <Link
            key={a.id}
            to="/alerts"
            className={cn("flex items-start gap-3 p-4", i && "border-t border-border")}
          >
            <div className="h-9 w-9 rounded-lg bg-[var(--color-gold-bg)] grid place-items-center shrink-0">
              <Megaphone className="h-4 w-4 text-[var(--color-gold)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{a.title}</div>
              {a.description && <div className="text-xs text-muted-foreground line-clamp-2">{a.description}</div>}
            </div>
            <StatusPill tone={a.priority === "critical" ? "danger" : a.priority === "high" ? "warning" : "neutral"}>
              {a.priority ?? "normal"}
            </StatusPill>
          </Link>
        ))}
      </Card>

      {/* Quick actions per role */}
      <SectionHeader eyebrow="Execute" title="Quick Actions" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActionsForRole(roleId, clockedIn).map((a) => (
          <ActionBtn key={a.label} to={a.to} label={a.label} icon={a.icon} primary={(a as any).primary} />
        ))}
      </div>
    </>
  );
}

function quickActionsForRole(role: RoleId | null, clockedIn: boolean) {
  const clock = { to: "/time-clock", label: clockedIn ? "Time Clock" : "Clock In", icon: clockedIn ? Clock : LogIn, primary: !clockedIn };
  const tasks = { to: "/my-tasks", label: "My Tasks", icon: ClipboardList, primary: clockedIn };
  const ops = { to: "/operations", label: "Operations", icon: Play };
  const sops = { to: "/sops", label: "View SOPs", icon: BookOpen };
  const report = { to: "/hospitality", label: "Report Issue", icon: FileWarning };
  const inv = { to: "/inventory", label: "Inventory", icon: Boxes };
  const inventoryChanges = { to: "/inventory", label: "Flag Low Stock", icon: AlertTriangle };
  const cash = { to: "/cash", label: "Cash Drawer", icon: Wallet };

  if (role === "cashier") return [clock, tasks, cash, report];
  if (role === "grill") return [clock, tasks, inventoryChanges, sops];
  if (role === "prep") return [clock, tasks, inv, inventoryChanges];
  if (role === "shift_lead") return [clock, ops, tasks, report];
  return [clock, tasks, ops, sops];
}

/* =================== MANAGER / OWNER VIEW =================== */

function ManagerView({ stats, role }: { stats: any; role: any }) {
  const now = useClock();
  const totalTasks = stats?.tasks.total ?? 0;
  const doneTasks = stats?.tasks.done ?? 0;
  const remaining = stats?.tasks.remaining ?? 0;
  const completePct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const alertCount = stats?.alerts.count ?? 0;
  const pending = stats?.alerts.pending ?? [];
  const lowStock = stats?.alerts.lowStock ?? stats?.alerts.items ?? [];
  const crew = stats?.crew ?? [];
  const shiftActive = !!stats?.shift;
  const phaseLabel = stats?.shift?.phase ? String(stats.shift.phase).toUpperCase() : "NO ACTIVE SHIFT";
  const openedAt = stats?.shift?.opened_at ? new Date(stats.shift.opened_at) : null;

  // Personal clock status for the manager/owner viewing the dashboard.
  const punchFn = useServerFn(getMyActivePunch);
  const { data: punch } = useQuery({
    queryKey: ["my-active-punch"],
    queryFn: () => punchFn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const clockedIn = !!(punch as any)?.clock_in_at;
  const clockInAt = clockedIn ? new Date((punch as any).clock_in_at) : null;
  const elapsedMs = clockInAt ? now.getTime() - clockInAt.getTime() : 0;
  const hours = Math.floor(elapsedMs / 3_600_000);
  const minutes = Math.floor((elapsedMs % 3_600_000) / 60_000);
  const elapsedLabel = clockedIn ? `${hours}h ${minutes.toString().padStart(2, "0")}m` : "Off the clock";

  // My tasks (managers also have personal tasks)
  const listTasksFn = useServerFn(listMyTasks);
  const { data: myTasks = [] } = useQuery<Task[]>({
    queryKey: ["my-tasks"],
    queryFn: () => listTasksFn() as Promise<Task[]>,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const myDone = myTasks.filter((t) => t.status === "done" || t.status === "signed_off").length;

  return (
    <>
      {/* HERO — TODAY AT GOTHAM (compressed) */}
      <Card dark className="relative overflow-hidden !p-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
          <div>
            <div className="flex items-center gap-2 label-caps text-[var(--color-gold)]/80">
              <span className={`h-1.5 w-1.5 rounded-full ${shiftActive ? "bg-[var(--color-success)] animate-pulse" : "bg-white/30"}`} />
              Today at Gotham
            </div>
            <h1 className="font-display text-2xl md:text-3xl mt-0.5 text-white leading-tight">{phaseLabel}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/70">
              <span className="flex items-center gap-1.5"><Timer className="h-3 w-3 text-[var(--color-gold)]" />{now.toLocaleString([], { weekday: "short", month: "short", day: "numeric" })} · {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-[var(--color-gold)]" />{stats?.store?.name ?? "—"}</span>
              <span className="flex items-center gap-1.5"><Users className="h-3 w-3 text-[var(--color-gold)]" />Crew: {crew.length}</span>
            </div>
          </div>
          <div className="hidden md:flex justify-end">
            <CircularProgress value={completePct} size={84} stroke={8} label="Complete" />
          </div>
        </div>
      </Card>

      {/* Shift flow tracker — primary workflow */}
      <div className="mt-3">
        <ShiftFlowTracker
          clockedIn={clockedIn}
          hasClockedInToday={clockedIn}
          tasksTotal={myTasks.length}
          tasksDone={myDone}
          opsRunPct={completePct}
          inventoryCountedToday={false}
          criticalAlertsOpen={(pending ?? []).filter((a: any) => a.priority === "critical").length}
          recapSubmittedToday={false}
          isManagerView={true}
        />
      </div>

      {/* 1 · CURRENT SHIFT  +  2 · CLOCK STATUS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="label-caps text-muted-foreground">Current Shift</div>
              <div className="font-display text-2xl mt-1">{shiftActive ? phaseLabel : "Idle"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {openedAt ? `Opened ${openedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}` : "No shift opened today"}
              </div>
            </div>
            {shiftActive
              ? <StatusPill tone="gold">Active</StatusPill>
              : <Link to="/operations" className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px]"><Play className="h-3 w-3" /> Start</Link>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Tasks done" value={`${doneTasks}/${totalTasks}`} />
            <MiniStat label="Remaining" value={String(remaining)} />
            <MiniStat label="Crew on" value={String(crew.length)} />
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="label-caps text-muted-foreground">Clock Status</div>
              <div className="font-display text-2xl mt-1">{elapsedLabel}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {clockedIn ? `Since ${clockInAt!.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}` : "You are not clocked in"}
              </div>
            </div>
            {clockedIn
              ? <Link to="/time-clock" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px]"><LogOut className="h-3 w-3" /> Clock out</Link>
              : <Link to="/time-clock" className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px]"><LogIn className="h-3 w-3" /> Clock in</Link>}
          </div>
          <div className="mt-3">
            <Link to="/time-clock" className="text-xs label-caps text-foreground/70 hover:text-[var(--color-gold)] inline-flex items-center gap-1">
              Open time clock <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      </div>

      {/* 2b · SCHEDULE THIS WEEK */}
      {stats?.schedule && (
        <>
          <SectionHeader
            eyebrow="This week"
            title="Schedule"
            action={<Link to="/schedule" className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">Open schedule</Link>}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Card className="p-3">
              <div className="label-caps text-muted-foreground">Scheduled</div>
              <div className="font-display text-2xl mt-1">{stats.schedule.scheduledHrs}h</div>
            </Card>
            <Card className="p-3">
              <div className="label-caps text-muted-foreground">Open Shifts</div>
              <div className={cn("font-display text-2xl mt-1", stats.schedule.openShifts > 0 && "text-[var(--color-warning)]")}>
                {stats.schedule.openShifts}
              </div>
            </Card>
            <Card className="p-3">
              <div className="label-caps text-muted-foreground">Proj. Labor</div>
              <div className="font-display text-2xl mt-1">${stats.schedule.laborCost.toLocaleString()}</div>
            </Card>
            <Card className="p-3">
              <div className="label-caps text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Labor %
              </div>
              {stats.schedule.laborPct != null ? (
                <div className={cn(
                  "font-display text-2xl mt-1",
                  stats.schedule.laborPct > 35 && "text-[var(--color-danger)]",
                  stats.schedule.laborPct > 28 && stats.schedule.laborPct <= 35 && "text-[var(--color-warning)]",
                )}>
                  {stats.schedule.laborPct}%
                </div>
              ) : (
                <div className="font-display text-2xl mt-1 text-muted-foreground">—</div>
              )}
              {!stats.schedule.salesTarget && (
                <Link to="/schedule" className="text-[10px] text-muted-foreground hover:text-[var(--color-gold)]">
                  set sales target
                </Link>
              )}
            </Card>
          </div>
        </>
      )}

      {/* 3 · MY TASKS */}
      <SectionHeader
        eyebrow="Your shift"
        title="My Tasks"
        action={<Link to="/my-tasks" className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">Open list ({myDone}/{myTasks.length})</Link>}
      />
      <Card className="p-0 overflow-hidden">
        {myTasks.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No personal tasks right now.</div>
        )}
        {myTasks.slice(0, 5).map((t, i) => {
          const isDone = t.status === "done" || t.status === "signed_off";
          return (
            <div key={t.id} className={cn("p-3.5 flex items-center gap-3", i && "border-t border-border")}>
              <div className={cn("h-5 w-5 rounded-md border-2 grid place-items-center shrink-0",
                isDone ? "bg-[var(--color-gold)] border-[var(--color-gold)]" : "border-border")}>
                {isDone && <Check className="h-3 w-3 text-[#0A0A0A]" strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm font-medium leading-tight", isDone && "line-through text-muted-foreground")}>{t.title}</div>
                <div className="label-caps text-muted-foreground mt-0.5">{t.phase}</div>
              </div>
            </div>
          );
        })}
      </Card>

      {/* 4 · CRITICAL ALERTS */}
      <SectionHeader eyebrow="Action needed" title="Critical Alerts" action={<Link to="/alerts" className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">All alerts</Link>} />
      <Card className="p-0 overflow-hidden">
        {pending.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No critical alerts. All clear.</div>
        )}
        {pending.slice(0, 5).map((a: any, i: number) => (
          <Link key={a.id} to="/alerts" className={cn("flex items-center justify-between p-4", i && "border-t border-border")}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-[var(--color-danger-bg)] grid place-items-center shrink-0">
                <Flame className="h-4 w-4 text-[var(--color-danger)]" />
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{a.title}</div>
                <div className="text-xs text-muted-foreground capitalize">{(a.type ?? "").replace(/_/g, " ")}</div>
              </div>
            </div>
            <StatusPill tone={a.priority === "critical" ? "danger" : "warning"}>{a.priority ?? "normal"}</StatusPill>
          </Link>
        ))}
      </Card>

      {/* 5 · INVENTORY RISKS */}
      <SectionHeader eyebrow="Watch" title="Inventory Risks" action={<Link to="/inventory" search={{ tab: undefined, focus: undefined }} className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">View inventory</Link>} />
      <Card className="p-0 overflow-hidden">
        {lowStock.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No items at risk.</div>
        )}
        {lowStock.map((r: any, i: number) => (
          <div key={r.id} className={`flex items-center justify-between p-4 ${i ? "border-t border-border" : ""}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-[var(--color-danger-bg)] grid place-items-center">
                <AlertTriangle className="h-4 w-4 text-[var(--color-danger)]" />
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.pct}% of par · reorder soon</div>
              </div>
            </div>
            <StatusPill tone={r.critical ? "danger" : "warning"}>{r.critical ? "Critical" : "Low"} · {r.pct}%</StatusPill>
          </div>
        ))}
      </Card>

      {/* 6 · PENDING APPROVALS */}
      <SectionHeader eyebrow="Review" title="Pending Approvals" action={<Link to="/manager" className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">Open Command Center</Link>} />
      <Card className="p-0 overflow-hidden">
        {pending.filter((a: any) => a.type === "approval_required" || a.type === "signoff" || a.type === "task_signoff").length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nothing waiting on your sign-off.
          </div>
        )}
        {pending.slice(0, 4).map((a: any, i: number) => (
          <Link key={`appr-${a.id}`} to="/manager" className={cn("flex items-center justify-between p-4", i && "border-t border-border")}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-[var(--color-gold-bg)] grid place-items-center">
                <ShieldCheck className="h-4 w-4 text-[var(--color-gold)]" />
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{a.title}</div>
                <div className="text-xs text-muted-foreground capitalize">{(a.type ?? "").replace(/_/g, " ")}</div>
              </div>
            </div>
            <StatusPill tone="gold">Review</StatusPill>
          </Link>
        ))}
      </Card>

      {/* 7 · STORE SNAPSHOT + STORE HEALTH */}
      <SectionHeader eyebrow="Snapshot" title="Store Snapshot" action={
        <div className="flex gap-2">
          <button onClick={() => exportHealthCSV(stats, crew, role?.name ?? "Crew")} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={() => exportHealthPDF(stats, crew, role?.name ?? "Crew", phaseLabel)} className="inline-flex items-center gap-1 rounded-md bg-[#0A0A0A] text-[var(--color-gold)] px-2.5 py-1 text-xs font-semibold">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      } />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DarkStat label="Tasks Remaining" value={String(remaining)} sub={`of ${totalTasks} total`} />
        <DarkStat label="Open Alerts" value={String(alertCount)} sub={alertCount > 0 ? "needs attention" : "all clear"} tone={alertCount > 0 ? "danger" : undefined} />
        <DarkStat label="Crew" value={String(crew.length)} sub="on roster" />
        <DarkStat label="Pending Approvals" value={String(pending.length)} sub="awaiting sign-off" tone={pending.length ? "gold" : undefined} />
      </div>

      <StoreHealthCard />

      <SectionHeader eyebrow="Execute" title="Quick Actions" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ActionBtn to="/manager" label="Command Center" icon={ShieldCheck} primary />
        <ActionBtn to="/alerts" label="Review Alerts" icon={BellRing} />
        <ActionBtn to="/schedule" label="Schedule" icon={Coffee} />
        <ActionBtn to="/inventory" label="Inventory" icon={Boxes} />
      </div>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/40 border border-border p-2">
      <div className="label-caps text-muted-foreground text-[9px]">{label}</div>
      <div className="font-semibold text-sm mt-0.5">{value}</div>
    </div>
  );
}

function StoreHealthCard() {
  const fetch = useServerFn(getHealthScore);
  const { trailerScope } = useRole();
  const { data } = useQuery({
    queryKey: ["health", trailerScope ?? "all", 1],
    queryFn: () => fetch({ data: { trailerId: trailerScope ?? null, days: 1 } }),
    refetchInterval: 60_000,
  });
  const score = data?.overall ?? null;
  const band = data?.band ?? "yellow";
  const color = band === "green" ? "var(--color-success)" : band === "yellow" ? "var(--color-warning)" : "var(--color-danger)";
  const top = (data?.components ?? []).slice().sort((a, b) => a.score - b.score).slice(0, 3);

  return (
    <>
      <SectionHeader eyebrow="Analytics" title="Store Health" action={<Link to="/health" className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">Open full analytics <ChevronRight className="inline h-3 w-3" /></Link>} />
      <Link to="/health" className="block">
        <Card className="hover:border-[var(--color-gold)] transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-center">
            <div className="flex items-center gap-4">
              <div className="grid place-items-center h-20 w-20 rounded-full border-4" style={{ borderColor: color, color }}>
                <span className="font-display text-3xl font-bold">{score ?? "—"}</span>
              </div>
              <div>
                <div className="label-caps text-muted-foreground">Today</div>
                <div className="font-display text-xl">{band === "green" ? "Healthy" : band === "yellow" ? "Needs Attention" : "Action Needed"}</div>
                <StatusPill tone={band === "green" ? "success" : band === "yellow" ? "warning" : "danger"}>{band.toUpperCase()}</StatusPill>
              </div>
            </div>
            <div>
              <div className="label-caps text-muted-foreground mb-2">Top drivers · biggest drag</div>
              {top.length === 0 && <div className="text-sm text-muted-foreground">Loading…</div>}
              <div className="space-y-1.5">
                {top.map((c) => (
                  <div key={c.key} className="flex items-center gap-3 text-sm">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium w-24 truncate">{c.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full" style={{ width: `${c.score}%`, backgroundColor: c.score >= 80 ? "var(--color-success)" : c.score >= 60 ? "var(--color-warning)" : "var(--color-danger)" }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{c.score}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Tap to see drivers, trend, and recommended actions.
              </div>
            </div>
          </div>
        </Card>
      </Link>
    </>
  );
}

/* =================== SHARED =================== */

function DarkStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "gold" | "danger" }) {
  return (
    <div className="rounded-xl border border-[#1C1C1C] bg-[#0A0A0A] p-4 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--color-gold)] opacity-60" />
      <div className="label-caps text-white/55">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${tone === "gold" ? "text-[var(--color-gold)]" : tone === "danger" ? "text-[#FF6B5B]" : "text-white"}`}>{value}</div>
      {sub && <div className="text-[11px] text-white/55 mt-0.5">{sub}</div>}
    </div>
  );
}

function ActionBtn({ to, label, icon: Icon, primary }: { to: string; label: string; icon: typeof Play; primary?: boolean }) {
  return (
    <Link to={to} className={`flex items-center gap-3 rounded-lg px-4 py-4 border transition-all ${
      primary
        ? "bg-[var(--color-gold)] text-[#0A0A0A] border-[var(--color-gold)] hover:brightness-95"
        : "bg-card text-foreground border-border hover:border-[var(--color-gold)]"
    }`}>
      <Icon className="h-5 w-5" strokeWidth={2} />
      <span className="font-semibold text-sm">{label}</span>
    </Link>
  );
}

function exportHealthCSV(stats: any, crew: any[], roleName: string) {
  const rows: (string | number)[][] = [];
  rows.push(["Shift", "Phase", stats?.shift?.phase ?? "—"]);
  rows.push(["Shift", "Store", stats?.store?.name ?? "—"]);
  rows.push(["Shift", "Opened at", stats?.shift?.opened_at ?? "—"]);
  rows.push(["Tasks", "Total", stats?.tasks?.total ?? 0]);
  rows.push(["Tasks", "Done", stats?.tasks?.done ?? 0]);
  rows.push(["Tasks", "Remaining", stats?.tasks?.remaining ?? 0]);
  rows.push(["Alerts", "Open", stats?.alerts?.count ?? 0]);
  (stats?.alerts?.items ?? []).forEach((r: any) => rows.push(["Stock", r.name, `${r.pct}% of par${r.critical ? " · CRITICAL" : ""}`]));
  crew.forEach((c: any) => rows.push(["Crew", c.display_name, roleName]));
  downloadCSV("gotham-health.csv", ["Section", "Label", "Value"], rows);
}

function exportHealthPDF(stats: any, crew: any[], roleName: string, phaseLabel: string) {
  const items = (stats?.alerts?.items ?? []).map((r: any) => [r.name, `${r.pct}%`, r.critical ? "CRITICAL" : "LOW"]);
  const crewRows = crew.map((c: any) => [c.display_name, roleName]);
  const html = `
    <h1>Gotham OS — Health Report</h1>
    <div class="meta">${escapeHTML(phaseLabel)} · ${escapeHTML(stats?.store?.name ?? "—")}</div>
    ${kpiBlock([
      { label: "Tasks Remaining", value: stats?.tasks?.remaining ?? 0, tone: (stats?.tasks?.remaining ?? 0) ? "warn" : "ok" },
      { label: "Tasks Done", value: `${stats?.tasks?.done ?? 0} / ${stats?.tasks?.total ?? 0}` },
      { label: "Alerts", value: stats?.alerts?.count ?? 0, tone: (stats?.alerts?.count ?? 0) ? "danger" : "ok" },
      { label: "Crew on Roster", value: crew.length },
    ])}
    <h2>Critical Stock</h2>
    ${items.length ? htmlTable(["Item", "% of Par", "Status"], items) : '<div class="meta">No critical items.</div>'}
    <h2>Crew</h2>
    ${crewRows.length ? htmlTable(["Name", "Role"], crewRows) : '<div class="meta">No active crew.</div>'}
  `;
  openPrintablePDF("Gotham Health Report", html);
}
