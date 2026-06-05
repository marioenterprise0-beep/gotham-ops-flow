import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, MetricStat, ProgressBar, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { AlertTriangle, BookOpen, Boxes, ChevronRight, ClipboardCheck, Flame, MessageSquareWarning, Play, Sparkles, Timer, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Gotham OS" },
      { name: "description", content: "Live shift dashboard for Gotham Halal crew." },
    ],
  }),
  component: Dashboard,
});

const crew = [
  { name: "Yusuf A.", role: "Shift Lead", initials: "YA" },
  { name: "Omar K.", role: "Grill Master", initials: "OK" },
  { name: "Bilal R.", role: "Prep", initials: "BR" },
  { name: "Maya S.", role: "Cashier", initials: "MS" },
];

const quickActions = [
  { label: "Start Shift", icon: Play, to: "/operations", tone: "gold" as const },
  { label: "Inventory", icon: Boxes, to: "/inventory" },
  { label: "SOP Library", icon: BookOpen, to: "/sops" },
  { label: "Submit Issue", icon: MessageSquareWarning, to: "/operations" },
];

function Dashboard() {
  return (
    <AppShell>
      {/* Shift hero */}
      <Card dark className="relative overflow-hidden">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/60">Current Shift</div>
            <h1 className="font-display text-2xl font-semibold mt-1">Lunch Rush · Wed</h1>
            <div className="mt-1 text-sm text-sidebar-foreground/70 flex items-center gap-2">
              <Timer className="h-3.5 w-3.5" /> 11:00 — 16:00 · 2h 14m elapsed
            </div>
          </div>
          <StatusPill tone="gold">Live</StatusPill>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatBlockDark label="Completion" value="74%" />
          <StatBlockDark label="Tickets" value="118" />
          <StatBlockDark label="Avg Speed" value="3:42" />
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60 mb-1.5">
            <span>Shift progress</span><span>74 / 100</span>
          </div>
          <ProgressBar value={74} />
        </div>
      </Card>

      {/* Quick actions */}
      <SectionHeader eyebrow="Execute" title="Quick Actions" />
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((a) => (
          <Link key={a.label} to={a.to} className="group">
            <Card className="h-full flex items-center justify-between hover:border-foreground/40 transition">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg grid place-items-center ${a.tone === "gold" ? "shimmer-gold" : "bg-secondary text-secondary-foreground"}`}>
                  <a.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="font-display font-semibold">{a.label}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition" />
            </Card>
          </Link>
        ))}
      </div>

      {/* Opening / Closing status */}
      <SectionHeader eyebrow="Operations" title="Today's Checklists" action={<Link to="/operations" className="text-xs uppercase tracking-[0.18em] text-foreground/70 hover:text-gold flex items-center gap-1">Open <ChevronRight className="h-3 w-3"/></Link>} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ChecklistCard title="Opening" subtitle="Target 20:00" value={100} done={18} total={18} tone="success" />
        <ChecklistCard title="Mid Shift" subtitle="In progress" value={62} done={8} total={13} tone="gold" />
        <ChecklistCard title="Closing" subtitle="Starts 15:30" value={0} done={0} total={22} tone="neutral" />
        <ChecklistCard title="Emergency" subtitle="No incidents" value={100} done={0} total={0} tone="success" />
      </div>

      {/* Inventory alerts */}
      <SectionHeader eyebrow="Watch" title="Inventory Alerts" action={<Link to="/inventory" className="text-xs uppercase tracking-[0.18em] text-foreground/70 hover:text-gold">View all</Link>} />
      <Card className="p-0 overflow-hidden">
        {[
          { item: "Smash Patties (5oz)", level: 22, tone: "danger" as const, note: "Below par · reorder" },
          { item: "Brioche Buns", level: 41, tone: "warning" as const, note: "Tracking low" },
          { item: "American Cheese", level: 68, tone: "neutral" as const, note: "On par" },
        ].map((r, i) => (
          <div key={r.item} className={`flex items-center justify-between p-4 ${i ? "border-t border-border" : ""}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-secondary grid place-items-center">
                {r.tone === "danger" ? <AlertTriangle className="h-4 w-4 text-destructive"/> : r.tone === "warning" ? <Flame className="h-4 w-4 text-warning-foreground"/> : <Sparkles className="h-4 w-4 text-muted-foreground"/>}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{r.item}</div>
                <div className="text-xs text-muted-foreground">{r.note}</div>
              </div>
            </div>
            <div className="w-24 text-right">
              <div className="text-sm font-display font-semibold">{r.level}%</div>
              <ProgressBar value={r.level} tone={r.tone === "danger" ? "gold" : "gold"} />
            </div>
          </div>
        ))}
      </Card>

      {/* Crew */}
      <SectionHeader eyebrow="On Station" title="Current Crew" action={<StatusPill tone="success">4 Clocked In</StatusPill>} />
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {crew.map((c) => (
            <div key={c.name} className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center font-display text-sm">{c.initials}</div>
              <div className="leading-tight min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{c.role}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Manager note */}
      <SectionHeader eyebrow="From Manager" title="Notes" />
      <Card className="border-l-4 border-l-gold">
        <div className="flex items-start gap-3">
          <Users className="h-5 w-5 text-gold mt-0.5" />
          <div>
            <div className="text-sm leading-relaxed">Focus on greeting energy today. Two mystery shoppers expected before 2pm. Keep front counter spotless — towels every 15 min.</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Posted 09:42 · Hamza · Manager</div>
          </div>
        </div>
      </Card>

      <div className="h-6" />
    </AppShell>
  );
}

function StatBlockDark({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sidebar-accent/40 border border-sidebar-border p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">{label}</div>
      <div className="font-display text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function ChecklistCard({ title, subtitle, value, done, total, tone }: { title: string; subtitle: string; value: number; done: number; total: number; tone: "gold" | "success" | "neutral" }) {
  const pillTone = tone === "success" ? "success" : tone === "gold" ? "gold" : "neutral";
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <div className="font-display font-semibold">{title}</div>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
        </div>
        <StatusPill tone={pillTone}>{value === 100 ? "Done" : value === 0 ? "Pending" : "Active"}</StatusPill>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <MetricStat label="Progress" value={`${value}%`} />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tasks</div>
            <div className="font-display text-2xl font-semibold mt-1">{done}<span className="text-muted-foreground text-base">/{total}</span></div>
          </div>
        </div>
        <ProgressBar value={value} tone={tone === "success" ? "success" : "gold"} />
      </div>
    </Card>
  );
}
