import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, CircularProgress, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import {
  Activity, AlertTriangle, BellRing, BookOpen, Boxes, Check, ChevronRight, ClipboardList,
  Clock, Coffee, Download, FileText, FileWarning, Flame, LogIn, LogOut, MapPin,
  Megaphone, Play, ShieldCheck, Timer, Users, Wallet,
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
    refetchInterval: 30_000,
  });

  if (loading) {
    return <AppShell><Card className="py-10 text-center text-sm text-muted-foreground">Loading dashboard…</Card></AppShell>;
  }

  return (
    <AppShell>
      {isManagerView
        ? <ManagerView stats={stats} role={role} />
        : <CrewView stats={stats} role={role} roleId={roleId} userName={user} />}
      <div className="h-6" />
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
    queryFn: () => listTasksFn() as Promise<Task[]>,
    refetchInterval: 30_000,
  });

  const punchFn = useServerFn(getMyActivePunch);
  const { data: punch } = useQuery({
    queryKey: ["my-active-punch"],
    queryFn: () => punchFn(),
    refetchInterval: 30_000,
  });

  const alertsFn = useServerFn(listAlerts);
  const { data: announcements = [] } = useQuery<any[]>({
    queryKey: ["my-announcements"],
    queryFn: () => alertsFn({ data: { category: "announcements" } }) as Promise<any[]>,
    refetchInterval: 60_000,
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
      {/* Hero: greeting + shift status */}
      <Card dark className="relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-center">
          <div>
            <div className="flex items-center gap-2 label-caps text-white/60">
              <span className={`h-1.5 w-1.5 rounded-full ${clockedIn ? "bg-[var(--color-success)] animate-pulse" : "bg-white/30"}`} />
              {clockedIn ? "On shift" : "Off the clock"}
            </div>
            <h1 className="font-display text-3xl md:text-4xl mt-1 text-white">
              {greeting.toUpperCase()}, {userName.toUpperCase()}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
              <span className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-[var(--color-gold)]" />{now.toLocaleString([], { weekday: "short", month: "short", day: "numeric" })} · {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[var(--color-gold)]" />{stats?.store?.name ?? "—"}</span>
              {role && <RoleBadge role={role.name} />}
            </div>
            <div className="mt-3 flex items-center gap-2">
              {clockedIn
                ? <Link to="/time-clock" className="inline-flex items-center gap-1.5 rounded-md bg-white/10 text-white border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] hover:bg-white/15"><LogOut className="h-3 w-3" /> Clock out · {elapsedLabel}</Link>
                : <Link to="/time-clock" className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px]"><LogIn className="h-3 w-3" /> Clock in</Link>}
              <Link to="/my-tasks" className="inline-flex items-center gap-1.5 rounded-md bg-white/5 text-white border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] hover:bg-white/10">
                <ClipboardList className="h-3 w-3" /> All my tasks
              </Link>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <CircularProgress value={pct} size={120} stroke={10} label="My Tasks" />
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
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
  const inventoryChanges = { to: "/inventory-changes", label: "Flag Low Stock", icon: AlertTriangle };
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
  const crew = stats?.crew ?? [];
  const shiftActive = !!stats?.shift;
  const phaseLabel = stats?.shift?.phase ? `${String(stats.shift.phase).toUpperCase()} SHIFT` : "NO ACTIVE SHIFT";

  return (
    <>
      <Card dark className="relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-center">
          <div>
            <div className="flex items-center gap-2 label-caps text-white/60">
              <span className={`h-1.5 w-1.5 rounded-full ${shiftActive ? "bg-[var(--color-success)] animate-pulse" : "bg-white/30"}`} />
              {shiftActive ? "Current Shift" : "Idle"}
            </div>
            <h1 className="font-display text-3xl md:text-4xl mt-1 text-white">{phaseLabel}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
              <span className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-[var(--color-gold)]" />{now.toLocaleString([], { weekday: "short", month: "short", day: "numeric" })} · {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[var(--color-gold)]" />{stats?.store?.name ?? "—"}</span>
              <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-[var(--color-gold)]" />Crew: {crew.length}</span>
            </div>
            <div className="mt-3">
              {shiftActive
                ? <StatusPill tone="gold">Active</StatusPill>
                : <Link to="/operations" className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px]"><Play className="h-3 w-3" /> Start Shift</Link>}
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <CircularProgress value={completePct} size={120} stroke={10} label="Complete" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <DarkStat label="Tasks Remaining" value={String(remaining)} sub={`of ${totalTasks} total`} />
        <DarkStat label="Open Alerts" value={String(alertCount)} sub={alertCount > 0 ? "needs attention" : "all clear"} tone={alertCount > 0 ? "danger" : undefined} />
        <DarkStat label="Crew" value={String(crew.length)} sub="on roster" />
        <DarkStat label="Pending Approvals" value={String(pending.length)} sub="awaiting your sign-off" tone={pending.length ? "gold" : undefined} />
      </div>

      <SectionHeader eyebrow="Execute" title="Quick Actions" action={stats ? (
        <div className="flex gap-2">
          <button onClick={() => exportHealthCSV(stats, crew, role?.name ?? "Crew")} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold">
            <Download className="h-3.5 w-3.5" /> Health CSV
          </button>
          <button onClick={() => exportHealthPDF(stats, crew, role?.name ?? "Crew", phaseLabel)} className="inline-flex items-center gap-1 rounded-md bg-[#0A0A0A] text-[var(--color-gold)] px-2.5 py-1 text-xs font-semibold">
            <FileText className="h-3.5 w-3.5" /> Health PDF
          </button>
        </div>
      ) : null} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ActionBtn to="/manager" label="Manager Console" icon={ShieldCheck} primary />
        <ActionBtn to="/alerts" label="Review Alerts" icon={BellRing} />
        <ActionBtn to="/schedule" label="Schedule" icon={Coffee} />
        <ActionBtn to="/inventory" label="Inventory" icon={Boxes} />
      </div>

      {pending.length > 0 && (
        <>
          <SectionHeader eyebrow="Action needed" title="Pending Approvals" action={<Link to="/alerts" className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">Open queue</Link>} />
          <Card className="p-0 overflow-hidden">
            {pending.slice(0, 5).map((a: any, i: number) => (
              <Link key={a.id} to="/alerts" className={cn("flex items-center justify-between p-4", i && "border-t border-border")}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-[var(--color-gold-bg)] grid place-items-center">
                    <Flame className="h-4 w-4 text-[var(--color-gold)]" />
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
        </>
      )}

      <SectionHeader eyebrow="Watch" title="Critical Stock" action={<Link to="/inventory" className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">View all</Link>} />
      <Card className="p-0 overflow-hidden">
        {stats?.alerts.items.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No critical stock. Nice work.</div>
        )}
        {stats?.alerts.items.map((r: any, i: number) => (
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

      <SectionHeader eyebrow="On Station" title="Current Crew" action={<StatusPill tone="success">{crew.length} active</StatusPill>} />
      <Card>
        {crew.length === 0 && <div className="p-2 text-sm text-muted-foreground">No crew profiles yet.</div>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {crew.map((c: any) => (
            <div key={c.id} className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#0A0A0A] text-white grid place-items-center font-semibold text-sm">
                {initials(c.display_name)}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate text-sm">{c.display_name}</div>
                <RoleBadge role={role?.name ?? "Crew"} />
              </div>
            </div>
          ))}
        </div>
      </Card>
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
