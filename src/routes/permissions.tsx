import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader } from "@/components/gotham/primitives";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { ROLES, useRole, type RoleId } from "@/lib/role";
import { listAllTabPermissions, setTabPermission } from "@/lib/permissions.functions";
import { toast } from "sonner";
import { Check, X, KeyRound, User as UserIcon, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/permissions")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Permissions · Gotham OS" }] }),
  component: PermissionsPage,
});

const TABS: { key: string; label: string }[] = [
  { key: "dashboard",   label: "Dashboard" },
  { key: "my-tasks",    label: "My Tasks" },
  { key: "operations",  label: "Operations" },
  { key: "schedule",    label: "Scheduling" },
  { key: "inventory",   label: "Inventory" },
  { key: "sops",        label: "SOPs" },
  { key: "hospitality", label: "Hospitality" },
  { key: "manager",     label: "Manager" },
  { key: "users",       label: "Users" },
  { key: "audit",       label: "Audit Log" },
  { key: "analytics",   label: "Analytics" },
  { key: "settings",    label: "Settings" },
];

const ROLE_IDS: RoleId[] = ["owner", "manager", "shift_lead", "grill", "prep", "cashier"];

function PermissionsPage() {
  const { roleId, refreshPermissions } = useRole();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"role" | "user">("role");

  const listFn = useServerFn(listAllTabPermissions);
  const setFn = useServerFn(setTabPermission);

  const { data, isLoading } = useQuery({
    queryKey: ["all-tab-permissions"],
    queryFn: () => listFn() as Promise<any>,
    enabled: roleId === "owner",
  });

  const setM = useMutation({
    mutationFn: (v: { scopeType: "role" | "user"; scopeId: string; tabKey: string; enabled: boolean }) =>
      setFn({ data: v }),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["all-tab-permissions"] });
      await refreshPermissions();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (roleId !== "owner") return <Navigate to="/" />;

  const perms: any[] = data?.perms ?? [];
  const profiles: any[] = data?.profiles ?? [];
  const userRoles: any[] = data?.roles ?? [];

  const enabledFor = (scopeType: "role" | "user", scopeId: string, tabKey: string) => {
    const found = perms.find((p) => p.scope_type === scopeType && p.scope_id === scopeId && p.tab_key === tabKey);
    return found ? !!found.enabled : true;
  };

  const toggle = (scopeType: "role" | "user", scopeId: string, tabKey: string) => {
    const next = !enabledFor(scopeType, scopeId, tabKey);
    setM.mutate({ scopeType, scopeId, tabKey, enabled: next });
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
          Disable tabs per role or override for individual users. Owners always see everything.
        </p>
        <div className="mt-4 inline-flex rounded-md border border-[#2A2A2A] p-1 bg-[#1C1C1C]">
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
      </Card>

      {isLoading && <div className="mt-6 text-sm text-muted-foreground">Loading permissions…</div>}

      {!isLoading && mode === "role" && (
        <>
          <SectionHeader eyebrow="Role-based access" title="Toggle tabs visible to each role" />
          <PermMatrix
            rows={ROLE_IDS.map((r) => ({ id: r, label: ROLES[r].name, locked: r === "owner" }))}
            tabs={TABS}
            enabledFor={(rowId, tabKey) => enabledFor("role", rowId, tabKey)}
            onToggle={(rowId, tabKey) => toggle("role", rowId, tabKey)}
            disabled={setM.isPending}
          />
        </>
      )}

      {!isLoading && mode === "user" && (
        <>
          <SectionHeader eyebrow="Per-user overrides" title="Re-enable or hide tabs for a specific user" />
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
            enabledFor={(rowId, tabKey) => enabledFor("user", rowId, tabKey)}
            onToggle={(rowId, tabKey) => toggle("user", rowId, tabKey)}
            disabled={setM.isPending}
          />
        </>
      )}

      <div className="h-6" />
    </AppShell>
  );
}

function PermMatrix({
  rows, tabs, enabledFor, onToggle, disabled,
}: {
  rows: { id: string; label: string; locked?: boolean }[];
  tabs: { key: string; label: string }[];
  enabledFor: (rowId: string, tabKey: string) => boolean;
  onToggle: (rowId: string, tabKey: string) => void;
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
                const on = enabledFor(r.id, t.key);
                return (
                  <td key={t.key} className="text-center px-2 py-2">
                    <button
                      disabled={disabled || r.locked}
                      onClick={() => onToggle(r.id, t.key)}
                      className={cn(
                        "h-7 w-7 rounded-md grid place-items-center transition",
                        r.locked
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success)] opacity-60 cursor-not-allowed"
                          : on
                            ? "bg-[var(--color-success-bg)] text-[var(--color-success)] hover:ring-2 hover:ring-[var(--color-success)]/40"
                            : "bg-[var(--color-danger-bg)] text-[var(--color-danger)] hover:ring-2 hover:ring-[var(--color-danger)]/40"
                      )}
                      title={on ? "Enabled — click to disable" : "Disabled — click to enable"}
                    >
                      {on ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </button>
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
