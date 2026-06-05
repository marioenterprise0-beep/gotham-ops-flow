import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, CircularProgress, MetricStat, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { AlertTriangle, BookOpen, Boxes, ChevronRight, FileWarning, Flag, MapPin, Play, Timer, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useRole, ROLES } from "@/lib/role";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Gotham OS" },
      { name: "description", content: "Live shift dashboard for Gotham Halal crew." },
    ],
  }),
  component: Dashboard,
});

const CREW = [
  { name: "Marcus T.", role: "Shift Lead" },
  { name: "DeShawn",   role: "Grill Master" },
  { name: "Priya",     role: "Prep" },
  { name: "Carlos",    role: "Cashier" },
];

const TASKS_BY_ROLE: Record<string, { label: string; cat: string; done?: boolean; at?: string }[]> = {
  "Grill Master": [
    { label: "Preheat flat top to 400°F",  cat: "Kitchen", done: true,  at: "10:14" },
    { label: "Cold storage temp check",     cat: "Kitchen", done: true,  at: "10:18" },
    { label: "Smash patties prep (80x)",    cat: "Kitchen" },
    { label: "Sauce station mise en place", cat: "Kitchen" },
  ],
  "Prep": [
    { label: "Thaw 12 lbs gyro meat", cat: "Prep", done: true, at: "10:02" },
    { label: "Cut & label fries",      cat: "Prep" },
    { label: "Sauce station fill",     cat: "Prep" },
  ],
  "Cashier / Front": [
    { label: "POS test transaction", cat: "Front", done: true, at: "10:22" },
    { label: "Drink station setup",  cat: "Front" },
    { label: "Packaging stocked",    cat: "Front" },
  ],
  "Shift Lead": [
    { label: "Crew check-in",            cat: "Team", done: true, at: "10:00" },
    { label: "Pre-shift huddle",         cat: "Team", done: true, at: "10:08" },
    { label: "Uniform inspection",       cat: "Team" },
    { label: "Sign opening checklist",   cat: "Team" },
  ],
  "Manager":    [{ label: "Review opening signoff", cat: "Mgmt" }, { label: "Approve waste log", cat: "Mgmt" }],
  "Owner":      [{ label: "Review daily store score", cat: "Owner" }],
};

function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return t;
}

function Dashboard() {
  const { roleId, user } = useRole();
  const role = roleId ? ROLES[roleId] : null;
  const now = useClock();
  const myTasks = role ? (TASKS_BY_ROLE[role.name] ?? []) : [];

  // Countdown: 20:00 from a fixed shift start at 10:00 today
  const shiftStart = new Date(); shiftStart.setHours(10, 0, 0, 0);
  const targetEnd = new Date(shiftStart.getTime() + 20 * 60 * 1000);
  const remainingMs = Math.max(0, targetEnd.getTime() - now.getTime());
  const mm = Math.floor(remainingMs / 60000); const ss = Math.floor((remainingMs % 60000) / 1000);
  const countdown = `${mm.toString().padStart(2,"0")}:${ss.toString().padStart(2,"0")}`;

  return (
    <AppShell>
      {/* Shift Status Bar */}
      <Card dark className="relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-center">
          <div>
            <div className="flex items-center gap-2 label-caps text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
              Current Shift
            </div>
            <h1 className="font-display text-3xl md:text-4xl mt-1 text-white">OPENING SHIFT</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
              <span className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-[var(--color-gold)]" />{now.toLocaleString([], { weekday: "short", month: "short", day: "numeric" })} · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[var(--color-gold)]" />Main Trailer</span>
              <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-[var(--color-gold)]" />Lead: Marcus T.</span>
            </div>
            <div className="mt-3"><StatusPill tone="gold">Active</StatusPill></div>
          </div>
          <div className="flex justify-center md:justify-end">
            <CircularProgress value={68} size={120} stroke={10} label="Complete" />
          </div>
        </div>
      </Card>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <DarkStat label="Tasks Remaining" value="14" sub="of 28 total" />
        <DarkStat label="Inventory Alerts" value="2" sub="critical" tone="danger" />
        <DarkStat label="Crew On Shift" value="4" sub="all clocked in" />
        <DarkStat label="Opening Target" value={countdown} sub="countdown" tone="gold" />
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
        {/* My Tasks */}
        <div>
          <SectionHeader eyebrow={role?.name ?? "Crew"} title="My Tasks" action={
            <Link to="/operations" className="label-caps text-foreground/70 hover:text-[var(--color-gold)] flex items-center gap-1">View all <ChevronRight className="h-3 w-3" /></Link>
          } />
          <Card className="p-0 overflow-hidden">
            {myTasks.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No tasks assigned. Enjoy the calm.</div>
            )}
            {myTasks.map((t, i) => (
              <div key={t.label} className={`flex items-center gap-3 p-3.5 ${i ? "border-t border-border" : ""}`}>
                <div className={`h-5 w-5 rounded border-2 grid place-items-center shrink-0 ${t.done ? "bg-[var(--color-gold)] border-[var(--color-gold)]" : "border-border"}`}>
                  {t.done && <svg viewBox="0 0 12 12" className="h-3 w-3 text-[#0A0A0A]"><path d="M2 6.5l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm leading-tight ${t.done ? "line-through text-muted-foreground" : "font-medium text-foreground"}`}>{t.label}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="label-caps text-muted-foreground">{t.cat}</span>
                    {t.done && t.at && <span className="text-[10px] text-muted-foreground">· logged {t.at}</span>}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Manager Notes */}
        <div>
          <SectionHeader eyebrow="From Manager" title="Notes" />
          <Card dark className="space-y-3">
            <Note who="Hamza · Manager" when="08:42" text="Health inspection this week. Every station must be photo-documented at open and close. No exceptions." />
            <Note who="Hamza · Manager" when="07:55" text="Focus on greeting energy today. Two mystery shoppers expected before 2pm." />
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <SectionHeader eyebrow="Execute" title="Quick Actions" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ActionBtn to="/operations" label="Start Shift" icon={Play} primary />
        <ActionBtn to="/inventory" label="Inventory Count" icon={Boxes} />
        <ActionBtn to="/operations" label="Report an Issue" icon={FileWarning} />
        <ActionBtn to="/sops" label="View SOPs" icon={BookOpen} />
      </div>

      {/* Inventory alerts strip */}
      <SectionHeader eyebrow="Watch" title="Critical Stock" action={<Link to="/inventory" className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">View all</Link>} />
      <Card className="p-0 overflow-hidden">
        {[
          { item: "Halal Smash Patties", pct: 18, note: "Below 25% par · reorder now" },
          { item: "Brioche Buns",         pct: 22, note: "Critical · ETA tomorrow" },
        ].map((r, i) => (
          <div key={r.item} className={`flex items-center justify-between p-4 ${i ? "border-t border-border" : ""}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-[var(--color-danger-bg)] grid place-items-center">
                <AlertTriangle className="h-4 w-4 text-[var(--color-danger)]" />
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{r.item}</div>
                <div className="text-xs text-muted-foreground">{r.note}</div>
              </div>
            </div>
            <StatusPill tone="danger">Critical · {r.pct}%</StatusPill>
          </div>
        ))}
      </Card>

      <SectionHeader eyebrow="On Station" title="Current Crew" action={<StatusPill tone="success">4 clocked in</StatusPill>} />
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CREW.map((c) => (
            <div key={c.name} className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#0A0A0A] text-white grid place-items-center font-semibold text-sm">
                {c.name.split(" ").map(p => p[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate text-sm">{c.name}</div>
                <RoleBadge role={c.role} />
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

function Note({ who, when, text }: { who: string; when: string; text: string }) {
  return (
    <div className="pl-3 border-l-2 border-[var(--color-gold)]">
      <div className="flex items-center gap-2 label-caps text-white/60">
        <Flag className="h-3 w-3 text-[var(--color-gold)]" /> {who} · {when}
      </div>
      <div className="mt-1 text-sm text-white/90 leading-relaxed">{text}</div>
    </div>
  );
}
