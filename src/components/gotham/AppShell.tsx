import { Link, Outlet, useRouterState, useNavigate, Navigate } from "@tanstack/react-router";
import { Home, ClipboardCheck, Boxes, BookOpen, BarChart3, Shield, Star, LogOut, Settings as SettingsIcon, ScrollText, Users as UsersIcon, CalendarDays, ListChecks, KeyRound, Clock, Timer, Bell, GripVertical, ArrowUp, ArrowDown, Check, RotateCcw, Activity, Banknote, Keyboard } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { canSee, initials, ROLES, useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { useUnreadAlerts } from "@/hooks/use-unread-alerts";
import { CommandPalette } from "@/components/gotham/CommandPalette";
import { KeyboardShortcuts } from "@/components/gotham/KeyboardShortcuts";
import { OnlineIndicator, OnlineDot } from "@/components/gotham/OnlineIndicator";
import logoAsset from "@/assets/gotham-halal-logo.jpeg.asset.json";


type Tab = { to: string; key: string; label: string; icon: typeof Home; gate?: "manager" | "analytics" | "owner" };

const ALL_TABS: Tab[] = [
  { to: "/",            key: "dashboard",   label: "Dashboard",   icon: Home },
  { to: "/my-tasks",    key: "my-tasks",    label: "My Tasks",    icon: ListChecks },
  { to: "/time-clock",  key: "time-clock",  label: "Time Clock",  icon: Clock },
  { to: "/cash",        key: "cash",        label: "Cash",        icon: Banknote },
  { to: "/operations",  key: "operations",  label: "Operations",  icon: ClipboardCheck },
  { to: "/recaps",      key: "recaps",      label: "Daily Recap", icon: ScrollText,  gate: "manager" },
  { to: "/schedule",    key: "schedule",    label: "Scheduling",  icon: CalendarDays },
  { to: "/labor",       key: "labor",       label: "Labor",       icon: Timer,       gate: "manager" },
  { to: "/inventory",   key: "inventory",   label: "Inventory",   icon: Boxes },
  { to: "/order-guide", key: "order-guide", label: "Order Guide", icon: BookOpen,    gate: "manager" },
  { to: "/sops",        key: "sops",        label: "SOPs",        icon: BookOpen },
  { to: "/hospitality", key: "hospitality", label: "Hospitality", icon: Star },
  { to: "/health",      key: "health",      label: "Health Score",icon: Activity,    gate: "manager" },
  { to: "/alerts",      key: "alerts",      label: "Alerts",      icon: Bell,        gate: "manager" },
  { to: "/manager",     key: "manager",     label: "Manager",     icon: Shield,      gate: "manager" },
  { to: "/users",       key: "users",       label: "Users",       icon: UsersIcon,   gate: "manager" },
  { to: "/permissions", key: "permissions", label: "Permissions", icon: KeyRound,    gate: "owner" },
  { to: "/audit",       key: "audit",       label: "Audit Log",   icon: ScrollText,  gate: "manager" },
  { to: "/change-log",  key: "change-log",  label: "Change Log",  icon: ScrollText,  gate: "manager" },
  { to: "/integrity",   key: "integrity",   label: "Data Integrity", icon: Shield,   gate: "owner" },
  { to: "/analytics",   key: "analytics",   label: "Analytics",   icon: BarChart3,   gate: "analytics" },
  { to: "/settings",    key: "settings",    label: "Settings",    icon: SettingsIcon },
];

const TAB_ORDER_KEY = "gotham:tab-order:v1";

function loadOrder(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(TAB_ORDER_KEY) ?? "[]"); } catch { return []; }
}
function saveOrder(keys: string[]) {
  try { localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(keys)); } catch {}
}

export function AppShell({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roleId, session, loading, disabledTabs } = useRole();
  const [orderKeys, setOrderKeys] = useState<string[]>(() => loadOrder());
  const [reorderMode, setReorderMode] = useState(false);
  const isOwner = roleId === "owner";
  const unreadAlerts = useUnreadAlerts();
  const queryClient = useQueryClient();

  useEffect(() => {
    const onRefresh = () => {
      queryClient.invalidateQueries();
      toast.success("Refreshed");
    };
    window.addEventListener("gotham:refresh", onRefresh);
    return () => window.removeEventListener("gotham:refresh", onRefresh);
  }, [queryClient]);

  const visibleTabs = ALL_TABS.filter((t) => {
    if (t.gate === "owner") { if (roleId !== "owner") return false; }
    else if (t.gate && !canSee(roleId, t.gate)) return false;
    if (roleId !== "owner" && disabledTabs.has(t.key)) return false;
    return true;
  });

  const tabs = useMemo(() => {
    const byKey = new Map(visibleTabs.map((t) => [t.key, t]));
    const ordered: Tab[] = [];
    for (const k of orderKeys) { const t = byKey.get(k); if (t) { ordered.push(t); byKey.delete(k); } }
    for (const t of visibleTabs) if (byKey.has(t.key)) ordered.push(t);
    return ordered;
  }, [visibleTabs, orderKeys]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading Gotham OS…</div>;
  if (!session && pathname !== "/auth") return <Navigate to="/auth" />;

  function move(key: string, dir: -1 | 1) {
    const keys = tabs.map((t) => t.key);
    const i = keys.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    setOrderKeys(keys);
    saveOrder(keys);
  }
  function resetOrder() { setOrderKeys([]); saveOrder([]); }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <CommandPalette />
      <KeyboardShortcuts />
      <OnlineIndicator />
      <TopBar />

      <div className="flex-1 flex">
        <aside className="hidden lg:flex w-60 shrink-0 border-r border-border bg-card flex-col">
          {isOwner && (
            <div className="flex items-center justify-between gap-2 px-3 pt-3">
              <span className="label-caps text-muted-foreground">Navigation</span>
              <div className="flex gap-1">
                {reorderMode && (
                  <button onClick={resetOrder} title="Reset to default"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground">
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
                <button onClick={() => setReorderMode((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                    reorderMode ? "border-[var(--color-gold)] bg-[var(--color-gold)] text-[#0A0A0A]" : "border-border text-muted-foreground hover:text-foreground",
                  )}>
                  {reorderMode ? <><Check className="h-3 w-3" /> Done</> : <><GripVertical className="h-3 w-3" /> Reorder</>}
                </button>
              </div>
            </div>
          )}
          <nav className="p-3 flex flex-col gap-1">
            {tabs.map((t, idx) => {
              const active = isActive(pathname, t.to);
              const Icon = t.icon;
              if (reorderMode && isOwner) {
                return (
                  <div key={t.to} className="flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1.5 bg-background">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    <Icon className="h-4 w-4 text-foreground/60" strokeWidth={2} />
                    <span className="flex-1 text-sm font-medium truncate">{t.label}</span>
                    <button onClick={() => move(t.key, -1)} disabled={idx === 0}
                      className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => move(t.key, 1)} disabled={idx === tabs.length - 1}
                      className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }
              return (
                <Link key={t.to} to={t.to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium border-l-2 transition-colors",
                    active
                      ? "border-l-[var(--color-gold)] text-[var(--color-gold)] bg-[#FAF7EE]"
                      : "border-l-transparent text-foreground/70 hover:bg-secondary hover:text-foreground",
                  )}>
                  <span className="relative inline-flex">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                    {t.key === "alerts" && unreadAlerts > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-[16px] text-center">
                        {unreadAlerts > 99 ? "99+" : unreadAlerts}
                      </span>
                    )}
                  </span>
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
