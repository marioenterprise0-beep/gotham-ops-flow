import { Link, Outlet, useRouterState, useNavigate, Navigate } from "@tanstack/react-router";
import { Home, ClipboardCheck, Boxes, BookOpen, BarChart3, Shield, Star, LogOut, Settings as SettingsIcon, ScrollText, Users as UsersIcon, CalendarDays, ListChecks, KeyRound, Clock, Timer, Bell, Activity, Banknote, Keyboard, MapPin, Archive, HeartPulse, ChevronLeft, ChevronRight, HardHat, Briefcase, Crown, Utensils } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { initials, ROLES, useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { useUnreadAlerts } from "@/hooks/use-unread-alerts";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { CommandPalette } from "@/components/gotham/CommandPalette";
import { KeyboardShortcuts } from "@/components/gotham/KeyboardShortcuts";
import { OnlineIndicator, OnlineDot } from "@/components/gotham/OnlineIndicator";
import logoAsset from "@/assets/gotham-halal-logo.jpeg.asset.json";
import { LocationRequestDialog } from "@/components/gotham/LocationRequestDialog";


type Tab = { to: string; key: string; label: string; icon: typeof Home };

const ALL_TABS: Tab[] = [
  { to: "/",                  key: "dashboard",          label: "Dashboard",          icon: Home },
  { to: "/my-tasks",          key: "my-tasks",           label: "My Tasks",           icon: ListChecks },
  { to: "/time-clock",        key: "time-clock",         label: "Time Clock",         icon: Clock },
  { to: "/cash",              key: "cash",               label: "Cash",               icon: Banknote },
  { to: "/operations",        key: "operations",         label: "Operations",         icon: ClipboardCheck },
  { to: "/recaps",            key: "recaps",             label: "Daily Recap",        icon: ScrollText },
  { to: "/prep-log",          key: "prep-log",           label: "Prep Log",           icon: Utensils },
  { to: "/schedule",          key: "schedule",           label: "Scheduling",         icon: CalendarDays },
  { to: "/labor",             key: "labor",              label: "Labor",              icon: Timer },
  { to: "/inventory",         key: "inventory",          label: "Inventory",          icon: Boxes },
  { to: "/sops",              key: "sops",               label: "SOPs",               icon: BookOpen },
  { to: "/hospitality",       key: "hospitality",        label: "Hospitality",        icon: Star },
  { to: "/health",            key: "health",             label: "Health Score",       icon: Activity },
  { to: "/alerts",            key: "alerts",             label: "Alerts",             icon: Bell },
  { to: "/manager",           key: "manager",            label: "Command Center",     icon: Shield },
  { to: "/admin",             key: "admin",              label: "Admin",              icon: Shield },
  { to: "/archive-center",    key: "archive-center",     label: "Archive Center",     icon: Archive },
  { to: "/integrity",         key: "integrity",          label: "Data Integrity",     icon: Shield },
  { to: "/analytics",         key: "analytics",          label: "Analytics",          icon: BarChart3 },
  { to: "/settings",          key: "settings",           label: "Settings",           icon: SettingsIcon },
];

// Workspace modes — role-tailored navigation. Owners can switch modes.
export type WorkspaceMode = "crew" | "manager" | "owner";

const MODE_TABS: Record<WorkspaceMode, string[]> = {
  crew: [
    "dashboard", "my-tasks", "time-clock", "cash", "operations",
    "recaps", "prep-log", "schedule", "inventory", "sops", "alerts", "settings",
  ],
  manager: [
    "dashboard", "my-tasks", "time-clock", "cash", "operations",
    "recaps", "prep-log", "schedule", "labor", "inventory", "sops",
    "hospitality", "alerts", "manager", "settings",
  ],
  // Owner sees everything EXCEPT Health Score — it's reached via the
  // Store Health card on the dashboard, not the sidebar.
  owner: ALL_TABS.filter((t) => t.key !== "health").map((t) => t.key),
};

const MODE_META: Record<WorkspaceMode, { label: string; tagline: string; icon: typeof HardHat }> = {
  crew:    { label: "Crew",    tagline: "I came to work.",   icon: HardHat },
  manager: { label: "Manager", tagline: "I run this shift.", icon: Briefcase },
  owner:   { label: "Owner",   tagline: "Full access.",      icon: Crown },
};

const COLLAPSE_KEY = "gotham:sidebar-collapsed:v1";

function defaultMode(roleId: string | null): WorkspaceMode {
  if (roleId === "owner") return "owner";
  if (roleId === "manager") return "manager";
  return "crew";
}

export function AppShell({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roleId, actualRoleId, actAsRole, setActAsRole, session, loading, disabledTabs } = useRole();
  const isRealOwner = actualRoleId === "owner";
  const isOwner = roleId === "owner"; // effective
  const unreadAlerts = useUnreadAlerts();
  usePushNotifications();
  const queryClient = useQueryClient();

  // Mode is derived from the effective role — owners impersonating crew see crew workspace.
  const mode: WorkspaceMode = defaultMode(roleId);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  });

  function setMode(next: WorkspaceMode) {
    if (!isRealOwner) return;
    // Map workspace mode to impersonation role. "owner" mode clears impersonation.
    if (next === "owner") setActAsRole(null);
    else if (next === "manager") setActAsRole("manager");
    else setActAsRole("cashier"); // representative crew role
  }
  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }

  useEffect(() => {
    const onRefresh = () => {
      queryClient.invalidateQueries();
      toast.success("Refreshed");
    };
    window.addEventListener("gotham:refresh", onRefresh);
    return () => window.removeEventListener("gotham:refresh", onRefresh);
  }, [queryClient]);

  const tabs = useMemo(() => {
    const allowed = new Set(MODE_TABS[mode]);
    return ALL_TABS.filter((t) => {
      if (!allowed.has(t.key)) return false;
      if (!isOwner && disabledTabs.has(t.key)) return false;
      return true;
    });
  }, [mode, isOwner, disabledTabs]);

  // Dynamic route protection: if user navigates to a path not in their mode allowlist, redirect home.
  const allowedPaths = useMemo(() => new Set(tabs.map((t) => t.to)), [tabs]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading Gotham OS…</div>;
  if (!session && pathname !== "/auth") return <Navigate to="/auth" />;

  // Allow /auth and any sub-paths whose top-level is allowed.
  const pathAllowed =
    pathname === "/auth" ||
    pathname === "/" ||
    Array.from(allowedPaths).some((p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/")));
  if (session && !pathAllowed) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <CommandPalette />
      <KeyboardShortcuts />
      <OnlineIndicator />
      <TopBar mode={mode} setMode={setMode} canSwitch={isRealOwner} impersonating={!!actAsRole && isRealOwner} />


      <div className="flex-1 flex">
        <aside className={cn(
          "hidden lg:flex shrink-0 border-r border-border bg-card flex-col transition-[width] duration-200",
          collapsed ? "w-14" : "w-56",
        )}>
          <div className={cn("flex items-center gap-2 px-2 pt-3", collapsed ? "justify-center" : "justify-between px-3")}>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="label-caps text-muted-foreground text-[10px]">Workspace</span>
                <span className="text-xs font-semibold text-foreground">{MODE_META[mode].label}</span>
              </div>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          </div>

          <nav className={cn("flex flex-col gap-0.5 mt-2", collapsed ? "px-1.5" : "p-3 pt-1")}>
            {tabs.map((t) => {
              const active = isActive(pathname, t.to);
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  title={collapsed ? t.label : undefined}
                  className={cn(
                    "group flex items-center rounded-md text-sm font-medium transition-colors",
                    collapsed
                      ? "justify-center h-9 w-9 mx-auto"
                      : "gap-3 px-3 py-2 border-l-2",
                    active
                      ? (collapsed
                          ? "bg-[#FAF7EE] text-[var(--color-gold)]"
                          : "border-l-[var(--color-gold)] text-[var(--color-gold)] bg-[#FAF7EE]")
                      : (collapsed
                          ? "text-foreground/70 hover:bg-secondary hover:text-foreground"
                          : "border-l-transparent text-foreground/70 hover:bg-secondary hover:text-foreground"),
                  )}
                >
                  <span className="relative inline-flex">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                    {t.key === "alerts" && unreadAlerts > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-[16px] text-center">
                        {unreadAlerts > 99 ? "99+" : unreadAlerts}
                      </span>
                    )}
                  </span>
                  {!collapsed && <span className="truncate">{t.label}</span>}
                </Link>
              );
            })}
          </nav>

          {!collapsed && (
            <div className="mt-auto px-3 pb-3 pt-4">
              <p className="text-[10px] italic text-muted-foreground">{MODE_META[mode].tagline}</p>
            </div>
          )}
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
                <Link
                  key={t.to}
                  to={t.to}
                  className="relative flex min-w-[76px] shrink-0 flex-col items-center justify-center gap-1 px-2 py-2.5 label-caps text-white/60 data-[active=true]:text-[var(--color-gold)]"
                  data-active={active}
                >
                  {active && <span className="absolute top-0 inset-x-3 h-[2px] bg-[var(--color-gold)] rounded-full" />}
                  <span className="relative inline-flex">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                    {t.key === "alerts" && unreadAlerts > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-[16px] text-center">
                        {unreadAlerts > 99 ? "99+" : unreadAlerts}
                      </span>
                    )}
                  </span>
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

function WorkspaceSwitcher({ mode, setMode, canSwitch }: { mode: WorkspaceMode; setMode: (m: WorkspaceMode) => void; canSwitch: boolean }) {
  const Meta = MODE_META[mode];
  const Icon = Meta.icon;
  if (!canSwitch) {
    return (
      <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#1C1C1C] border border-[#2A2A2A]" title={Meta.tagline}>
        <Icon className="h-3.5 w-3.5 text-[var(--color-gold)]" />
        <span className="text-xs font-medium text-white/90">{Meta.label}</span>
      </div>
    );
  }
  return (
    <div className="hidden md:flex items-center gap-1 p-0.5 rounded-md bg-[#1C1C1C] border border-[#2A2A2A]">
      {(["crew", "manager", "owner"] as WorkspaceMode[]).map((m) => {
        const MIcon = MODE_META[m].icon;
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            title={MODE_META[m].tagline}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold transition",
              active ? "bg-[var(--color-gold)] text-[#0A0A0A]" : "text-white/60 hover:text-white",
            )}
          >
            <MIcon className="h-3 w-3" />
            {MODE_META[m].label}
          </button>
        );
      })}
    </div>
  );
}

function TrailerSwitcher() {
  const { roleId, trailers, trailerScope, setTrailerScope, homeTrailerId } = useRole();
  const [dialogOpen, setDialogOpen] = useState(false);
  const isOwner = roleId === "owner";
  const isManager = roleId === "manager";
  if (trailers.length === 0) return null;
  const homeName = trailers.find((t) => t.id === homeTrailerId)?.name ?? "—";
  const scopeName = trailerScope ? (trailers.find((t) => t.id === trailerScope)?.name ?? homeName) : homeName;
  if (!isOwner) {
    if (isManager) {
      return (
        <>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            title="Request temporary access to another trailer"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1C1C1C] border border-[#2A2A2A] hover:border-[var(--color-gold)] transition"
          >
            <span className="label-caps text-white/50">Trailer</span>
            <span className="text-xs font-medium text-[var(--color-gold)]">🔒 {scopeName}</span>
            <span className="text-[10px] text-white/40">Request</span>
          </button>
          {dialogOpen && <LocationRequestDialog onClose={() => setDialogOpen(false)} />}
        </>
      );
    }
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1C1C1C] border border-[#2A2A2A]" title="Locked to your assigned trailer">
        <span className="label-caps text-white/50">Trailer</span>
        <span className="text-xs font-medium text-[var(--color-gold)]">🔒 {homeName}</span>
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

function TopBar({ mode, setMode, canSwitch, impersonating }: { mode: WorkspaceMode; setMode: (m: WorkspaceMode) => void; canSwitch: boolean; impersonating?: boolean }) {
  const { roleId, user, signOut } = useRole();
  const nav = useNavigate();
  const role = roleId ? ROLES[roleId] : null;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <header className="sticky top-0 z-30 surface-dark border-b border-[#1C1C1C]">
      {impersonating && (
        <div className="bg-[var(--color-gold)] text-[#0A0A0A] text-[11px] font-semibold tracking-wide text-center py-1">
          VIEWING AS {role?.name?.toUpperCase() ?? "ROLE"} · Click "Owner" to return
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <img src={logoAsset.url} alt="Gotham Halal" className="h-8 w-auto object-contain" />
          <span className="hidden sm:inline font-display text-lg tracking-wider text-[var(--color-gold)]">GOTHAM OS</span>
        </Link>

        <WorkspaceSwitcher mode={mode} setMode={setMode} canSwitch={canSwitch} />


        <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-md bg-[#1C1C1C] border border-[#2A2A2A]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-success)] animate-pulse" />
          <span className="text-xs font-medium text-white/90">Live</span>
          <span className="text-xs text-white/50">· {timeStr}</span>
          <OnlineDot />
        </div>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#1C1C1C] border border-[#2A2A2A] text-xs text-white/60 hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] transition"
          title="Open command palette (⌘K)"
        >
          <span>Search</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#0A0A0A] border border-[#2A2A2A] text-[10px] font-mono">⌘K</kbd>
        </button>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", shiftKey: true }))}
          className="hidden md:grid h-9 w-9 place-items-center rounded-md bg-[#1C1C1C] border border-[#2A2A2A] text-white/60 hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] transition"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="h-4 w-4" />
        </button>

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
