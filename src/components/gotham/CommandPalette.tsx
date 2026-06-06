import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { canSee, useRole } from "@/lib/role";
import { markAlertsSeen } from "@/hooks/use-unread-alerts";
import { actOnAlert, markCategoryRead } from "@/lib/alerts.functions";
import { completeTask } from "@/lib/tasks.functions";
import { toast } from "sonner";
import {
  Home, ListChecks, Clock, Banknote, ClipboardCheck, ScrollText, CalendarDays,
  Timer, Boxes, BookOpen, Star, Activity, Bell, Shield, Users as UsersIcon,
  KeyRound, BarChart3, Settings as SettingsIcon, LogOut, CheckCircle2,
  AlertTriangle, Megaphone, CheckCheck,
} from "lucide-react";

type Gate = "manager" | "analytics" | "owner" | undefined;
const ROUTES: { to: string; label: string; icon: any; gate?: Gate; key: string }[] = [
  { to: "/",            key: "dashboard",   label: "Dashboard",    icon: Home },
  { to: "/my-tasks",    key: "my-tasks",    label: "My Tasks",     icon: ListChecks },
  { to: "/time-clock",  key: "time-clock",  label: "Time Clock",   icon: Clock },
  { to: "/cash",        key: "cash",        label: "Cash",         icon: Banknote },
  { to: "/operations",  key: "operations",  label: "Operations",   icon: ClipboardCheck },
  { to: "/recaps",      key: "recaps",      label: "Daily Recap",  icon: ScrollText,   gate: "manager" },
  { to: "/schedule",    key: "schedule",    label: "Scheduling",   icon: CalendarDays },
  { to: "/labor",       key: "labor",       label: "Labor",        icon: Timer,        gate: "manager" },
  { to: "/inventory",   key: "inventory",   label: "Inventory",    icon: Boxes },
  { to: "/order-guide", key: "order-guide", label: "Order Guide",  icon: BookOpen,     gate: "manager" },
  { to: "/sops",        key: "sops",        label: "SOPs",         icon: BookOpen },
  { to: "/hospitality", key: "hospitality", label: "Hospitality",  icon: Star },
  { to: "/health",      key: "health",      label: "Health Score", icon: Activity,     gate: "manager" },
  { to: "/alerts",      key: "alerts",      label: "Alerts",       icon: Bell,         gate: "manager" },
  { to: "/manager",     key: "manager",     label: "Manager",      icon: Shield,       gate: "manager" },
  { to: "/users",       key: "users",       label: "Users",        icon: UsersIcon,    gate: "manager" },
  { to: "/permissions", key: "permissions", label: "Permissions",  icon: KeyRound,     gate: "owner" },
  { to: "/audit",       key: "audit",       label: "Audit Log",    icon: ScrollText,   gate: "manager" },
  { to: "/change-log",  key: "change-log",  label: "Change Log",   icon: ScrollText,   gate: "manager" },
  { to: "/analytics",   key: "analytics",   label: "Analytics",    icon: BarChart3,    gate: "analytics" },
  { to: "/settings",    key: "settings",    label: "Settings",     icon: SettingsIcon },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { roleId, session, disabledTabs, signOut } = useRole();
  const isOwner = roleId === "owner";
  const isManager = roleId === "owner" || roleId === "manager";

  // ⌘K / Ctrl+K to toggle. Ignore when typing in inputs unless modifier held.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (k === "escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const visibleRoutes = useMemo(() => ROUTES.filter((r) => {
    if (r.gate === "owner") { if (roleId !== "owner") return false; }
    else if (r.gate && !canSee(roleId, r.gate)) return false;
    if (roleId !== "owner" && disabledTabs?.has?.(r.key)) return false;
    return true;
  }), [roleId, disabledTabs]);

  // Recent open alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ["cmdk", "alerts"],
    enabled: open && !!session?.access_token && isManager,
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("id, title, priority, status, type, source_module, created_at")
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
  });

  // My open tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["cmdk", "my-tasks"],
    enabled: open && !!session?.access_token,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, status, phase, shift_id")
        .neq("status", "signed_off")
        .order("created_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
  });

  const act = useServerFn(actOnAlert);
  const complete = useServerFn(completeTask);
  const markCat = useServerFn(markCategoryRead);

  function go(to: string) { setOpen(false); nav({ to: to as any }); }

  async function quickResolve(alertId: string, title: string) {
    setOpen(false);
    try {
      await act({ data: { alertId, action: "resolve" } } as any);
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["cmdk", "alerts"] });
      toast.success(`Resolved “${title}”`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to resolve");
    }
  }

  async function quickComplete(taskId: string, title: string) {
    setOpen(false);
    try {
      await complete({ data: { taskId } } as any);
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      qc.invalidateQueries({ queryKey: ["cmdk", "my-tasks"] });
      toast.success(`Completed “${title}”`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to complete");
    }
  }

  async function markAllAlertsRead() {
    setOpen(false);
    try {
      await markCat({ data: { category: "all" as any } } as any);
      markAlertsSeen();
      qc.invalidateQueries({ queryKey: ["alert-category-reads"] });
      toast.success("All alerts marked as read");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to mark read");
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search routes, alerts, tasks, or run a command…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          {isManager && (
            <CommandItem onSelect={markAllAlertsRead}>
              <CheckCheck className="h-4 w-4 mr-2" /> Mark all alerts as read
            </CommandItem>
          )}
          {isOwner && (
            <CommandItem onSelect={() => go("/alerts")}>
              <Megaphone className="h-4 w-4 mr-2" /> New announcement
            </CommandItem>
          )}
          <CommandItem onSelect={() => go("/time-clock")}>
            <Clock className="h-4 w-4 mr-2" /> Open time clock
          </CommandItem>
          <CommandItem onSelect={async () => { setOpen(false); await signOut(); nav({ to: "/auth" }); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          {visibleRoutes.map((r) => {
            const Icon = r.icon;
            return (
              <CommandItem key={r.to} value={`route ${r.label} ${r.key}`} onSelect={() => go(r.to)}>
                <Icon className="h-4 w-4 mr-2" /> {r.label}
                <CommandShortcut>{r.to}</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {isManager && alerts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Open alerts">
              {alerts.map((a: any) => (
                <CommandItem
                  key={a.id}
                  value={`alert ${a.title} ${a.type} ${a.source_module ?? ""}`}
                  onSelect={() => quickResolve(a.id, a.title)}
                >
                  <AlertTriangle className={
                    a.priority === "critical" ? "h-4 w-4 mr-2 text-red-500"
                    : a.priority === "high" ? "h-4 w-4 mr-2 text-orange-500"
                    : "h-4 w-4 mr-2 text-muted-foreground"
                  } />
                  <span className="truncate">{a.title}</span>
                  <CommandShortcut>resolve</CommandShortcut>
                </CommandItem>
              ))}
              <CommandItem value="alerts-view-all" onSelect={() => go("/alerts")}>
                <Bell className="h-4 w-4 mr-2" /> View all alerts…
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks">
              {tasks.map((t: any) => (
                <CommandItem
                  key={t.id}
                  value={`task ${t.title} ${t.phase}`}
                  onSelect={() => quickComplete(t.id, t.title)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
                  <span className="truncate">{t.title}</span>
                  <CommandShortcut>{t.status === "done" ? "done" : "complete"}</CommandShortcut>
                </CommandItem>
              ))}
              <CommandItem value="tasks-view-all" onSelect={() => go("/my-tasks")}>
                <ListChecks className="h-4 w-4 mr-2" /> View my tasks…
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
