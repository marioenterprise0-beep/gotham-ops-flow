import { Link, Outlet, useRouterState, useNavigate, Navigate } from "@tanstack/react-router";
import { Home, ClipboardCheck, Boxes, BookOpen, BarChart3, Shield, Star, LogOut, Settings as SettingsIcon, ScrollText, Users as UsersIcon, CalendarDays, ListChecks, KeyRound, Clock, Timer, Bell } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { canSee, initials, ROLES, useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/gotham-halal-logo.jpeg.asset.json";

type Tab = { to: string; key: string; label: string; icon: typeof Home; gate?: "manager" | "analytics" | "owner" };

const ALL_TABS: Tab[] = [
  { to: "/",            key: "dashboard",   label: "Dashboard",   icon: Home },
  { to: "/my-tasks",    key: "my-tasks",    label: "My Tasks",    icon: ListChecks },
  { to: "/time-clock",  key: "time-clock",  label: "Time Clock",  icon: Clock },
  { to: "/operations",  key: "operations",  label: "Operations",  icon: ClipboardCheck },
  { to: "/schedule",    key: "schedule",    label: "Scheduling",  icon: CalendarDays },
  { to: "/labor",       key: "labor",       label: "Labor",       icon: Timer,       gate: "manager" },
  { to: "/inventory",   key: "inventory",   label: "Inventory",   icon: Boxes },
  { to: "/sops",        key: "sops",        label: "SOPs",        icon: BookOpen },
  { to: "/hospitality", key: "hospitality", label: "Hospitality", icon: Star },
  { to: "/manager",     key: "manager",     label: "Manager",     icon: Shield,      gate: "manager" },
  { to: "/users",       key: "users",       label: "Users",       icon: UsersIcon,   gate: "manager" },
  { to: "/permissions", key: "permissions", label: "Permissions", icon: KeyRound,    gate: "owner" },
  { to: "/audit",       key: "audit",       label: "Audit Log",   icon: ScrollText,  gate: "manager" },
  { to: "/analytics",   key: "analytics",   label: "Analytics",   icon: BarChart3,   gate: "analytics" },
  { to: "/settings",    key: "settings",    label: "Settings",    icon: SettingsIcon },
];

export function AppShell({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roleId, session, loading, disabledTabs } = useRole();

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading Gotham OS…</div>;
  if (!session && pathname !== "/auth") return <Navigate to="/auth" />;

  const tabs = ALL_TABS.filter((t) => {
    if (t.gate === "owner") { if (roleId !== "owner") return false; }
    else if (t.gate && !canSee(roleId, t.gate)) return false;
    // owners always see everything regardless of overrides
    if (roleId !== "owner" && disabledTabs.has(t.key)) return false;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />
      <div className="flex-1 flex">
        <aside className="hidden lg:flex w-60 shrink-0 border-r border-border bg-card flex-col">
          <nav className="p-3 flex flex-col gap-1">
            {tabs.map((t) => {
              const active = isActive(pathname, t.to);
              const Icon = t.icon;
              return (
                <Link key={t.to} to={t.to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium border-l-2 transition-colors",
                    active
                      ? "border-l-[var(--color-gold)] text-[var(--color-gold)] bg-[#FAF7EE]"
                      : "border-l-transparent text-foreground/70 hover:bg-secondary hover:text-foreground",
                  )}>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 pb-24 lg:pb-6 pt-4">
          <div className="mx-auto w-full max-w-5xl px-4">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 surface-dark border-t border-[#1C1C1C]">
        <div className="mx-auto max-w-3xl overflow-x-auto scrollbar-none">
          <div className="flex min-w-max px-1">
            {tabs.map((t) => {
            const active = isActive(pathname, t.to);
            const Icon = t.icon;
            return (
                <Link key={t.to} to={t.to}
                  className="relative flex min-w-[76px] shrink-0 flex-col items-center justify-center gap-1 px-2 py-2.5 label-caps text-white/60 data-[active=true]:text-[var(--color-gold)]"
                  data-active={active}>
                  {active && <span className="absolute top-0 inset-x-3 h-[2px] bg-[var(--color-gold)] rounded-full" />}
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                  <span className="text-[9px] text-center leading-tight">{t.label}</span>
                </Link>
            );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

function isActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

function TrailerSwitcher() {
  const { roleId, trailers, trailerScope, setTrailerScope, homeTrailerId } = useRole();
  const isManager = roleId === "owner" || roleId === "manager";
  if (trailers.length === 0) return null;
  const homeName = trailers.find((t) => t.id === homeTrailerId)?.name ?? "—";
  if (!isManager) {
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1C1C1C] border border-[#2A2A2A]">
        <span className="label-caps text-white/50">Trailer</span>
        <span className="text-xs font-medium text-[var(--color-gold)]">{homeName}</span>
      </div>
    );
  }
  return (
    <select
      value={trailerScope ?? ""}
      onChange={(e) => setTrailerScope(e.target.value || null)}
      className="hidden md:block bg-[#1C1C1C] border border-[#2A2A2A] rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--color-gold)] outline-none focus:border-[var(--color-gold)]"
      title="Trailer scope"
    >
      <option value="">All trailers (Company)</option>
      {trailers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}

function TopBar() {
  const { roleId, user, signOut } = useRole();
  const nav = useNavigate();
  const role = roleId ? ROLES[roleId] : null;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <header className="sticky top-0 z-30 surface-dark border-b border-[#1C1C1C]">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <img src={logoAsset.url} alt="Gotham Halal" className="h-8 w-auto object-contain" />
          <span className="hidden sm:inline font-display text-lg tracking-wider text-[var(--color-gold)]">GOTHAM OS</span>
        </Link>

        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-md bg-[#1C1C1C] border border-[#2A2A2A]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-success)] animate-pulse" />
          <span className="text-xs font-medium text-white/90">Live</span>
          <span className="text-xs text-white/50">· {timeStr}</span>
        </div>

        <TrailerSwitcher />

        <div className="flex items-center gap-2.5">
          {role && (
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="label-caps text-white/50">{role.name}</span>
              <span className="text-sm font-medium text-white">{user}</span>
            </div>
          )}
          <Link to="/settings" title="Settings" className="h-9 w-9 rounded-full bg-[var(--color-gold)] text-[#0A0A0A] grid place-items-center font-semibold text-sm hover:ring-2 hover:ring-[var(--color-gold)]/40 transition">{initials(user)}</Link>
          <button
            onClick={async () => { await signOut(); nav({ to: "/auth" }); }}
            title="Sign out"
            className="hidden sm:grid h-9 w-9 place-items-center rounded-md border border-[#2A2A2A] text-white/70 hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] transition">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
