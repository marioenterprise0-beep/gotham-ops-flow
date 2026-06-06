import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, CircularProgress, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { AlertTriangle, BookOpen, Boxes, ChevronRight, Download, FileText, FileWarning, Flag, MapPin, Play, Timer, Users } from "lucide-react";
import { downloadCSV, openPrintablePDF, htmlTable, kpiBlock, escapeHTML } from "@/lib/exports";
import { useEffect, useState } from "react";
import { useRole, ROLES, initials } from "@/lib/role";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { supabase } from "@/integrations/supabase/client";
import { requireAuthBeforeLoad } from "@/lib/require-auth";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({
    meta: [
      { title: "Dashboard · Gotham OS" },
      { name: "description", content: "Live shift dashboard for Gotham Halal crew." },
    ],
  }),
  component: Dashboard,
});

function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return t;
}

function Dashboard() {
  const { roleId, session, loading } = useRole();
  const role = roleId ? ROLES[roleId] : null;
  const now = useClock();

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

  const totalTasks = stats?.tasks.total ?? 0;
  const doneTasks = stats?.tasks.done ?? 0;
  const remaining = stats?.tasks.remaining ?? 0;
  const completePct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const alertCount = stats?.alerts.count ?? 0;
  const crew = stats?.crew ?? [];
  const shiftActive = !!stats?.shift;
  const phaseLabel = stats?.shift?.phase ? `${String(stats.shift.phase).toUpperCase()} SHIFT` : "NO ACTIVE SHIFT";

  const shiftStart = stats?.shift?.opened_at ? new Date(stats.shift.opened_at) : new Date();
  const targetEnd = new Date(shiftStart.getTime() + 20 * 60 * 1000);
  const remainingMs = Math.max(0, targetEnd.getTime() - now.getTime());
  const mm = Math.floor(remainingMs / 60000); const ss = Math.floor((remainingMs % 60000) / 1000);
  const countdown = shiftActive ? `${mm.toString().padStart(2,"0")}:${ss.toString().padStart(2,"0")}` : "--:--";

  return (
    <AppShell>
      <Card dark className="relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-center">
          <div>
            <div className="flex items-center gap-2 label-caps text-white/60">
              <span className={`h-1.5 w-1.5 rounded-full ${shiftActive ? "bg-[var(--color-success)] animate-pulse" : "bg-white/30"}`} />
              {shiftActive ? "Current Shift" : "Idle"}
            </div>
            <h1 className="font-display text-3xl md:text-4xl mt-1 text-white">{phaseLabel}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
              <span className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-[var(--color-gold)]" />{now.toLocaleString([], { weekday: "short", month: "short", day: "numeric" })} · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
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
        <DarkStat label="Inventory Alerts" value={String(alertCount)} sub={alertCount > 0 ? "needs attention" : "all good"} tone={alertCount > 0 ? "danger" : undefined} />
        <DarkStat label="Crew" value={String(crew.length)} sub="on roster" />
        <DarkStat label="Shift Window" value={countdown} sub="opening countdown" tone="gold" />
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
        <ActionBtn to="/operations" label={shiftActive ? "Open Operations" : "Start Shift"} icon={Play} primary />
        <ActionBtn to="/inventory" label="Inventory Count" icon={Boxes} />
        <ActionBtn to="/hospitality" label="Report an Issue" icon={FileWarning} />
        <ActionBtn to="/sops" label="View SOPs" icon={BookOpen} />
      </div>

      <SectionHeader eyebrow="Watch" title="Critical Stock" action={<Link to="/inventory" className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">View all</Link>} />
      <Card className="p-0 overflow-hidden">
        {stats?.alerts.items.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No critical stock. Nice work.</div>
        )}
        {stats?.alerts.items.map((r, i) => (
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
          {crew.map((c) => (
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

      <div className="h-6" />
    </AppShell>
  );
}

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
  rows.push(["Alerts", "Count", stats?.alerts?.count ?? 0]);
  rows.push(["Alerts", "Low stock", stats?.alerts?.lowStock ?? 0]);
  rows.push(["Alerts", "Pending", stats?.alerts?.pending ?? 0]);
  rows.push(["Crew", "On roster", crew.length]);
  rows.push(["Viewer role", "Role", roleName]);
  for (const it of stats?.alerts?.items ?? []) {
    rows.push(["Critical stock", it.name, `${it.pct}% of par`]);
  }
  downloadCSV(`gotham-health-${new Date().toISOString().slice(0, 10)}.csv`, ["Section", "Metric", "Value"], rows);
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
      { label: "Low Stock", value: stats?.alerts?.lowStock ?? 0, tone: (stats?.alerts?.lowStock ?? 0) ? "warn" : "ok" },
      { label: "Pending Actions", value: stats?.alerts?.pending ?? 0, tone: (stats?.alerts?.pending ?? 0) ? "warn" : "ok" },
      { label: "Crew on Roster", value: crew.length },
    ])}
    <h2>Critical Stock</h2>
    ${items.length ? htmlTable(["Item", "% of Par", "Status"], items) : '<div class="meta">No critical items.</div>'}
    <h2>Crew</h2>
    ${crewRows.length ? htmlTable(["Name", "Role"], crewRows) : '<div class="meta">No active crew.</div>'}
  `;
  openPrintablePDF("Gotham Health Report", html);
}
