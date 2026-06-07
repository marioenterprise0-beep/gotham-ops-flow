import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader } from "@/components/gotham/primitives";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { ROLES, useRole, type RoleId, type TabAccess } from "@/lib/role";
import { listAllTabPermissions, setTabPermission, applyDefaultPresets } from "@/lib/permissions.functions";
import { toast } from "sonner";
import { EyeOff, Eye, Pencil, KeyRound, User as UserIcon, Shield, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncDomains } from "@/lib/sync-bus";

export const Route = createFileRoute("/permissions")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Permissions · Gotham OS" }] }),
  component: PermissionsPage,
});

const TABS: { key: string; label: string }[] = [
  { key: "dashboard",   label: "Dashboard" },
  { key: "my-tasks",    label: "My Tasks" },
  { key: "time-clock",  label: "Time Clock" },
  { key: "operations",  label: "Operations" },
  { key: "recaps",      label: "Daily Recap" },
  { key: "schedule",    label: "Scheduling" },
  { key: "labor",       label: "Labor" },
  { key: "inventory",   label: "Inventory" },
  { key: "order-guide", label: "Order Guide" },
  { key: "sops",        label: "SOPs" },
  { key: "hospitality", label: "Hospitality" },
  { key: "health",      label: "Health Score" },
  { key: "alerts",      label: "Alerts" },
  { key: "cash",        label: "Cash" },
  { key: "manager",     label: "Manager" },
  { key: "users",       label: "Users" },
  { key: "audit",       label: "Audit Log" },
  { key: "change-log",  label: "Change Log" },
  { key: "analytics",   label: "Analytics" },
  { key: "settings",    label: "Settings" },
];

const ROLE_IDS: RoleId[] = ["owner", "manager", "shift_lead", "grill", "prep", "cashier"];

const LEVELS: { id: TabAccess; label: string; icon: typeof Eye; tone: string }[] = [
  { id: "none", label: "Hidden",    icon: EyeOff, tone: "danger" },
  { id: "view", label: "View only", icon: Eye,    tone: "warn" },
  { id: "edit", label: "Full edit", icon: Pencil, tone: "success" },
];

function PermissionsPage() {
  const { loading, session, roleId, refreshPermissions } = useRole();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"role" | "user">("role");
  const authReady = !loading;
  const canLoadPermissions = authReady && !!session?.access_token && roleId === "owner";

  const listFn = useServerFn(listAllTabPermissions);
  const setFn = useServerFn(setTabPermission);
  const applyPresetsFn = useServerFn(applyDefaultPresets);

  const { data, isLoading, error } = useQuery({
    queryKey: ["all-tab-permissions", session?.user?.id ?? null],
    queryFn: () => listFn() as Promise<any>,
    enabled: canLoadPermissions,
    retry: false,
  });

  const setM = useMutation({
    mutationFn: (v: { scopeType: "role" | "user"; scopeId: string; tabKey: string; accessLevel: TabAccess }) =>
      setFn({ data: v }),
    onSuccess: async () => {
      syncDomains(qc, "permissions", "users");
      await refreshPermissions();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const presetM = useMutation({
    mutationFn: (overwrite: boolean) => applyPresetsFn({ data: { overwrite } }),
    onSuccess: async (res: any) => {
      toast.success(`Applied defaults · ${res?.applied ?? 0} rules updated`);
      syncDomains(qc, "permissions", "users");
      await refreshPermissions();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!authReady) {
    return (
      <AppShell>
        <div className="text-sm text-muted-foreground">Loading permissions…</div>
      </AppShell>
    );
  }

  if (!session?.access_token) return <Navigate to="/auth" />;
  if (session && !roleId) {
    return (
      <AppShell>
        <div className="text-sm text-muted-foreground">Loading permissions…</div>
      </AppShell>
    );
  }
  if (roleId !== "owner") return <Navigate to="/" />;

  const queryError = error instanceof Error ? error : null;
  if (queryError?.message?.includes("Unauthorized")) {
    return <Navigate to="/auth" />;
  }

  const perms: any[] = data?.perms ?? [];
  const profiles: any[] = data?.profiles ?? [];
  const userRoles: any[] = data?.roles ?? [];

  const accessFor = (scopeType: "role" | "user", scopeId: string, tabKey: string): TabAccess => {
    const found = perms.find((p) => p.scope_type === scopeType && p.scope_id === scopeId && p.tab_key === tabKey);
    if (!found) return "edit";
    return (found.access_level as TabAccess) ?? (found.enabled === false ? "none" : "edit");
  };

  const setAccess = (scopeType: "role" | "user", scopeId: string, tabKey: string, accessLevel: TabAccess) => {
    setM.mutate({ scopeType, scopeId, tabKey, accessLevel });
  };

  const roleByUser = useMemo(() => {
    const m = new Map<string, RoleId[]>();
    for (const r of userRoles) {
      const arr = m.get(r.user_id) ?? [];
      arr.push(r.role);
      m.set(r.user_id, arr);
    }
    return m;
  }, [userRoles]);

  return (
    <AppShell>
      <Card dark>
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[var(--color-gold)]" />
          <div className="label-caps text-white/55">Owner controls</div>
        </div>
        <h1 className="font-display text-3xl mt-1 text-white">PERMISSIONS</h1>
        <p className="mt-2 text-sm text-white/70">
          Set per-tab access for each role or override per user. Three levels: <b>Hidden</b> (tab removed),
          <b> View only</b> (read-only, edits blocked), <b>Full edit</b>. Owners always have full edit on everything.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-[#2A2A2A] p-1 bg-[#1C1C1C]">
            {(["role", "user"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] rounded",
                  mode === m ? "bg-[var(--color-gold)] text-[#0A0A0A]" : "text-white/70 hover:text-white"
                )}>
                {m === "role" ? (<><Shield className="inline h-3 w-3 mr-1" />By role</>) : (<><UserIcon className="inline h-3 w-3 mr-1" />By user</>)}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => presetM.mutate(false)}
              disabled={presetM.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] rounded border border-[#2A2A2A] bg-[#1C1C1C] text-white/80 hover:text-white hover:border-[var(--color-gold)] disabled:opacity-50"
              title="Seed defaults for any role/tab not yet configured"
            >
              <Wand2 className="h-3 w-3" /> Apply defaults
            </button>
            <button
              onClick={() => {
                if (confirm("Reset ALL role permissions to defaults? Per-user overrides are kept.")) {
                  presetM.mutate(true);
                }
              }}
              disabled={presetM.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] rounded border border-[#2A2A2A] bg-[#1C1C1C] text-white/60 hover:text-white hover:border-[var(--color-danger)] disabled:opacity-50"
            >
              Reset to defaults
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-white/50">
          Presets: <b>Owner</b> full access · <b>Manager</b> full ops + view audit/settings · <b>Shift Lead</b> ops/recaps/inventory edit, schedule/labor view, no admin · <b>Crew</b> (Grill, Prep, Cashier) tasks + clock edit, view-only ops.
        </p>
      </Card>

      {isLoading && <div className="mt-6 text-sm text-muted-foreground">Loading permissions…</div>}
      {queryError && !queryError.message.includes("Unauthorized") && (
        <div className="mt-6 text-sm text-[var(--color-danger)]">{queryError.message}</div>
      )}



      {!isLoading && mode === "role" && (
        <>
          <SectionHeader eyebrow="Role-based access" title="Access level per role" />
          <PermMatrix
            rows={ROLE_IDS.map((r) => ({ id: r, label: ROLES[r].name, locked: r === "owner" }))}
            tabs={TABS}
            accessFor={(rowId, tabKey) => accessFor("role", rowId, tabKey)}
            onSet={(rowId, tabKey, lvl) => setAccess("role", rowId, tabKey, lvl)}
            disabled={setM.isPending}
          />
        </>
      )}

      {!isLoading && mode === "user" && (
        <>
          <SectionHeader eyebrow="Per-user overrides" title="Override access for a specific user" />
          {profiles.length === 0 && <div className="text-sm text-muted-foreground">No users yet.</div>}
          <PermMatrix
            rows={profiles.map((p) => {
              const rs = roleByUser.get(p.id) ?? [];
              return {
                id: p.id,
                label: `${p.display_name ?? "Crew"} ${rs.length ? `· ${rs.map((r) => ROLES[r as RoleId]?.short ?? r).join("/")}` : ""}`,
                locked: rs.includes("owner"),
              };
            })}
            tabs={TABS}
            accessFor={(rowId, tabKey) => accessFor("user", rowId, tabKey)}
            onSet={(rowId, tabKey, lvl) => setAccess("user", rowId, tabKey, lvl)}
            disabled={setM.isPending}
          />
        </>
      )}

      <div className="h-6" />
    </AppShell>
  );
}

function PermMatrix({
  rows, tabs, accessFor, onSet, disabled,
}: {
  rows: { id: string; label: string; locked?: boolean }[];
  tabs: { key: string; label: string }[];
  accessFor: (rowId: string, tabKey: string) => TabAccess;
  onSet: (rowId: string, tabKey: string, lvl: TabAccess) => void;
  disabled?: boolean;
}) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="label-caps text-muted-foreground pb-2 pr-3 sticky left-0 bg-card">Row</th>
            {tabs.map((t) => (
              <th key={t.key} className="label-caps text-muted-foreground pb-2 px-2 text-center whitespace-nowrap">{t.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-2 pr-3 font-medium sticky left-0 bg-card whitespace-nowrap">
                {r.label}
                {r.locked && <span className="ml-1 text-[10px] text-[var(--color-gold)]">owner</span>}
              </td>
              {tabs.map((t) => {
                const current = r.locked ? "edit" : accessFor(r.id, t.key);
                return (
                  <td key={t.key} className="text-center px-2 py-2">
                    <div className="inline-flex rounded-md border border-border overflow-hidden">
                      {LEVELS.map((lvl) => {
                        const on = current === lvl.id;
                        const Icon = lvl.icon;
                        return (
                          <button
                            key={lvl.id}
                            disabled={disabled || r.locked}
                            onClick={() => onSet(r.id, t.key, lvl.id)}
                            title={lvl.label}
                            className={cn(
                              "h-7 w-7 grid place-items-center transition",
                              r.locked && "opacity-50 cursor-not-allowed",
                              !on && "text-muted-foreground hover:bg-secondary",
                              on && lvl.tone === "danger"  && "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
                              on && lvl.tone === "warn"    && "bg-[var(--color-warn-bg,#FFF7E6)] text-[var(--color-warn,#B7791F)]",
                              on && lvl.tone === "success" && "bg-[var(--color-success-bg)] text-[var(--color-success)]",
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
