import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { EmbedShell } from "@/components/gotham/EmbedShell";
import { Card, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { canSee, ROLES, useRole, type RoleId } from "@/lib/role";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import {
  listTrailers, generateInvite, listInvitesV2, disableInvite, deleteInvite,
  listUsers, setUserRole, setUserTrailer, setUserActive, listAccessLogs, amISuperAdmin,
  scanUserDependencies, archiveUser, restoreUser, hardDeleteUser, setUserPayRate,
} from "@/lib/users.functions";
import { listAllTabPermissions, setTabPermission } from "@/lib/permissions.functions";
import { setEmployeePin, listEmployeePinStatus } from "@/lib/kiosk.functions";
import { Copy, Plus, Trash2, Ban, Shield, Check, X, ChevronDown, Archive, RotateCcw, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { syncDomains } from "@/lib/sync-bus";

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
  { key: "permissions", label: "Permissions" },
];

const MOD_PRESETS: { id: string; label: string; desc: string; allow: string[] }[] = [
  { id: "view_only",  label: "View only",  desc: "Dashboard & My Tasks only",                  allow: ["dashboard", "my-tasks"] },
  { id: "crew",       label: "Crew",       desc: "Operations, schedule, SOPs, inventory view", allow: ["dashboard", "my-tasks", "operations", "schedule", "sops", "inventory"] },
  { id: "lead",       label: "Shift Lead", desc: "Crew + hospitality logs",                    allow: ["dashboard", "my-tasks", "operations", "schedule", "sops", "inventory", "hospitality"] },
  { id: "manager",    label: "Manager",    desc: "Everything except Permissions",              allow: TABS.filter((t) => t.key !== "permissions").map((t) => t.key) },
  { id: "full",       label: "Full access", desc: "All tabs (owner-equivalent)",               allow: TABS.map((t) => t.key) },
];

export const Route = createFileRoute("/users")({
  ssr: false,
  beforeLoad: () => { throw redirect({ to: "/admin", search: { tab: "people" } as any }); },
  head: () => ({ meta: [{ title: "Users · Gotham OS" }] }),
  component: UsersPage,
});

const ROLE_OPTIONS: { id: RoleId; label: string }[] = [
  { id: "cashier", label: "Cashier" },
  { id: "prep", label: "Prep" },
  { id: "grill", label: "Grill" },
  { id: "shift_lead", label: "Shift Lead" },
  { id: "manager", label: "Manager" },
  { id: "owner", label: "Owner" },
];

const EXPIRY_OPTIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "24 hours" },
  { hours: 24 * 7, label: "7 days" },
];

export function UsersPage() {
  const { roleId } = useRole();
  if (roleId !== "owner") return <Navigate to="/" />;
  const [tab, setTab] = useState<"users" | "invites" | "logs">("users");

  return (
    <EmbedShell>
      <Card dark>
        <div className="label-caps text-white/55">Access Control</div>
        <h1 className="font-display text-3xl mt-1 text-white">USERS & ACCESS</h1>
        <p className="text-white/60 text-sm mt-2">Generate invite codes, manage crew, audit access.</p>
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { id: "users" as const, label: "Users" },
          { id: "invites" as const, label: "Pending Invites" },
          { id: "logs" as const, label: "Access Logs" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-2 py-2.5 text-xs font-semibold uppercase tracking-[1.2px] border transition",
              tab === t.id ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]" : "bg-card text-muted-foreground border-border hover:text-foreground",
            )}>{t.label}</button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "invites" && <InvitesTab />}
      {tab === "logs" && <LogsTab />}

      <div className="h-6" />
    </EmbedShell>
  );
}

function UsersTab() {
  const { roleId } = useRole();
  const isOwner = roleId === "owner";
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const fetchTrailers = useServerFn(listTrailers);
  const setRoleFn = useServerFn(setUserRole);
  const setTrailerFn = useServerFn(setUserTrailer);
  const setActiveFn = useServerFn(setUserActive);
  const fetchPerms = useServerFn(listAllTabPermissions);
  const setPermFn = useServerFn(setTabPermission);
  const fetchSuper = useServerFn(amISuperAdmin);
  const scanFn = useServerFn(scanUserDependencies);
  const archiveFn = useServerFn(archiveUser);
  const restoreFn = useServerFn(restoreUser);
  const hardDeleteFn = useServerFn(hardDeleteUser);
  const setPayRateFn = useServerFn(setUserPayRate);
  const setPinFn = useServerFn(setEmployeePin);
  const listPinsFn = useServerFn(listEmployeePinStatus);
  const { data: pinList = [] } = useQuery({
    queryKey: ["employee-pins"],
    queryFn: () => listPinsFn(),
    enabled: isOwner,
  });
  const pinSet = new Set(pinList.map((p: any) => p.userId));
  const pinMut = useMutation({
    mutationFn: (v: { employeeId: string; pin: string }) => setPinFn({ data: v }),
    onSuccess: () => { toast.success("PIN updated"); qc.invalidateQueries({ queryKey: ["employee-pins"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [showArchived, setShowArchived] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [depReport, setDepReport] = useState<{ counts: Record<string, { label: string; count: number }>; totalRefs: number } | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["users", { showArchived }],
    queryFn: () => fetchUsers({ data: { includeArchived: showArchived } }),
  });
  const { data: trailers = [] } = useQuery({ queryKey: ["trailers"], queryFn: () => fetchTrailers() });
  const { data: superData } = useQuery({ queryKey: ["am-i-super-admin"], queryFn: () => fetchSuper() });
  const isSuperAdmin = !!superData?.isSuperAdmin;
  const { data: permData } = useQuery({
    queryKey: ["all-tab-permissions"],
    queryFn: () => fetchPerms() as Promise<any>,
    enabled: isOwner,
  });
  const allPerms: any[] = permData?.perms ?? [];

  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = () => syncDomains(qc, "users", "roles", "permissions", "profiles", "schedule", "timeclock", "labor", "operations", "dashboard", "history");
  const refreshPerms = () => syncDomains(qc, "permissions", "users");

  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: RoleId }) => setRoleFn({ data: v }),
    onSuccess: () => { toast.success("Role updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const trailerMut = useMutation({
    mutationFn: (v: { userId: string; trailerId: string | null }) => setTrailerFn({ data: v }),
    onSuccess: () => { toast.success("Trailer assigned"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const activeMut = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) => setActiveFn({ data: v }),
    onSuccess: (_d, v) => { toast.success(v.active ? "Access restored" : "Access disabled"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const payRateMut = useMutation({
    mutationFn: (v: { userId: string; payRate: number | null }) => setPayRateFn({ data: v }),
    onSuccess: () => { toast.success("Pay rate updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const archiveMut = useMutation({
    mutationFn: (v: { userId: string; reason?: string }) => archiveFn({ data: v }),
    onSuccess: () => { toast.success("User archived"); setRemoveTarget(null); setDepReport(null); setRemoveReason(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const restoreMut = useMutation({
    mutationFn: (userId: string) => restoreFn({ data: { userId } }),
    onSuccess: () => { toast.success("User restored"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const hardDeleteMut = useMutation({
    mutationFn: (v: { userId: string; force?: boolean }) => hardDeleteFn({ data: v }),
    onSuccess: () => { toast.success("User deleted"); setRemoveTarget(null); setDepReport(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const permMut = useMutation({
    mutationFn: (v: { userId: string; tabKey: string; enabled: boolean }) =>
      setPermFn({ data: { scopeType: "user", scopeId: v.userId, tabKey: v.tabKey, enabled: v.enabled } }),
    onSuccess: () => refreshPerms(),
    onError: (e: Error) => toast.error(e.message),
  });

  const startRemove = async (u: any) => {
    setRemoveTarget({ id: u.id, name: u.display_name });
    setDepReport(null);
    setRemoveReason("");
    try {
      const report = await scanFn({ data: { userId: u.id } });
      setDepReport(report);
      if (report.totalRefs === 0) {
        // No history → safe to hard delete directly via the modal CTA.
      }
    } catch (e: any) {
      toast.error(e.message ?? "Scan failed");
      setRemoveTarget(null);
    }
  };

  const isEnabled = (userId: string, tabKey: string) => {
    const found = allPerms.find((p) => p.scope_type === "user" && p.scope_id === userId && p.tab_key === tabKey);
    return found ? !!found.enabled : true;
  };

  const applyPreset = async (userId: string, preset: typeof MOD_PRESETS[number]) => {
    const allow = new Set(preset.allow);
    for (const t of TABS) {
      await permMut.mutateAsync({ userId, tabKey: t.key, enabled: allow.has(t.key) });
    }
    toast.success(`Applied "${preset.label}"`);
  };

  return (
    <>
      <SectionHeader
        eyebrow="Crew"
        title="All Users"
        action={
          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                onClick={() => setShowArchived((v) => !v)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold",
                  showArchived ? "border-[var(--color-gold)] text-[var(--color-gold)]" : "border-border hover:border-[var(--color-gold)]",
                )}
              >
                {showArchived ? "Hide archived" : "Show archived"}
              </button>
            )}
            <StatusPill tone="neutral">{users.length} total</StatusPill>
          </div>
        }
      />
      <Card className="p-0 overflow-hidden">
        {users.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No users yet.</div>}
        {users.map((u: any, i: number) => {
          const role = (u.roles[0] as RoleId | undefined) ?? "cashier";
          const isUserOwner = u.roles.includes("owner");
          const open = openId === u.id;
          const isArchived = !!u.archived_at;
          return (
            <div key={u.id} className={cn(i && "border-t border-border", isArchived && "opacity-60")}>
              <div className="grid grid-cols-1 md:grid-cols-[1.4fr_140px_180px_120px_auto_auto_auto] gap-3 px-4 py-3 items-center text-sm">
                <div>
                  <div className="font-semibold truncate inline-flex items-center gap-2">
                    {u.display_name}
                    {isArchived && <span className="inline-flex items-center gap-1 rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"><Archive className="h-3 w-3" /> Archived</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isArchived
                      ? `Archived ${new Date(u.archived_at).toLocaleDateString()}${u.archive_reason ? ` · ${u.archive_reason}` : ""}`
                      : `Last login: ${u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "never"}`}
                  </div>
                </div>
                <select disabled={isArchived} value={role} onChange={(e) => roleMut.mutate({ userId: u.id, role: e.target.value as RoleId })}
                  className="h-9 rounded-md border border-border bg-card px-2 text-xs disabled:opacity-50">
                  {ROLE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <select disabled={isArchived} value={u.trailer_id ?? ""} onChange={(e) => trailerMut.mutate({ userId: u.id, trailerId: e.target.value || null })}
                  className="h-9 rounded-md border border-border bg-card px-2 text-xs disabled:opacity-50">
                  <option value="">No trailer</option>
                  {trailers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <div><StatusPill tone={isArchived ? "neutral" : u.active ? "success" : "danger"}>{isArchived ? "Archived" : u.active ? "Active" : "Disabled"}</StatusPill></div>
                {isOwner && !isArchived ? (
                  <button onClick={() => activeMut.mutate({ userId: u.id, active: !u.active })}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:border-[var(--color-gold)]">
                    {u.active ? "Disable" : "Restore access"}
                  </button>
                ) : <div />}
                {isOwner ? (
                  isArchived ? (
                    <button onClick={() => restoreMut.mutate(u.id)} disabled={restoreMut.isPending}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-[var(--color-success)] hover:text-[var(--color-success)] disabled:opacity-60">
                      <RotateCcw className="h-3 w-3" /> Restore
                    </button>
                  ) : (
                    <button onClick={() => startRemove(u)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-40"
                      title="Archive or delete">
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  )
                ) : <div />}
                {isOwner ? (
                  <button onClick={() => setOpenId(open ? null : u.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5",
                      open ? "border-[var(--color-gold)] text-[var(--color-gold)]" : "border-border hover:border-[var(--color-gold)]"
                    )}>
                    <Shield className="h-3 w-3" /> Permissions
                    <ChevronDown className={cn("h-3 w-3 transition", open && "rotate-180")} />
                  </button>
                ) : <div />}
              </div>

              {isOwner && !isArchived && (
                <div className="px-4 pb-3 -mt-1 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Pay rate</span>
                  <span className="text-muted-foreground">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    defaultValue={u.pay_rate ?? ""}
                    placeholder="0.00"
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const next = raw === "" ? null : Number(raw);
                      const prev = u.pay_rate == null ? null : Number(u.pay_rate);
                      if (next === prev) return;
                      if (next != null && (!Number.isFinite(next) || next < 0)) { toast.error("Invalid rate"); return; }
                      payRateMut.mutate({ userId: u.id, payRate: next });
                    }}
                    className="h-7 w-24 rounded-md border border-border bg-card px-2 text-xs"
                  />
                  <span className="text-muted-foreground">/ hr</span>
                </div>
              )}

              {isOwner && !isArchived && (
                <div className="px-4 pb-3 -mt-1 flex items-center gap-2 text-xs">
                  <KeyRound className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Kiosk PIN</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    placeholder={pinSet.has(u.id) ? "••••" : "Not set"}
                    defaultValue=""
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v) return;
                      if (!/^\d{4}$/.test(v)) { toast.error("PIN must be 4 digits"); return; }
                      pinMut.mutate({ employeeId: u.id, pin: v });
                      e.target.value = "";
                    }}
                    className="h-7 w-20 rounded-md border border-border bg-card px-2 text-xs font-mono tracking-widest"
                  />
                  {pinSet.has(u.id) && <span className="text-green-500 text-xs">✓ set</span>}
                </div>
              )}




              {isOwner && open && (
                <div className="px-4 pb-4 border-t border-border bg-[var(--color-muted)]/30">
                  {isUserOwner ? (
                    <div className="py-4 text-xs text-muted-foreground">Owners always have full access. Permissions cannot be restricted.</div>
                  ) : (
                    <>
                      <div className="pt-3 pb-2">
                        <div className="label-caps text-muted-foreground mb-2">Quick mod level</div>
                        <div className="flex flex-wrap gap-2">
                          {MOD_PRESETS.map((p) => (
                            <button key={p.id} onClick={() => applyPreset(u.id, p)}
                              disabled={permMut.isPending}
                              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-[var(--color-gold)] disabled:opacity-60"
                              title={p.desc}>
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="pt-2">
                        <div className="label-caps text-muted-foreground mb-2">Tab-by-tab access</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {TABS.map((t) => {
                            const on = isEnabled(u.id, t.key);
                            return (
                              <button key={t.key}
                                disabled={permMut.isPending}
                                onClick={() => permMut.mutate({ userId: u.id, tabKey: t.key, enabled: !on })}
                                className={cn(
                                  "flex items-center justify-between rounded-md border px-3 py-2 text-xs transition",
                                  on
                                    ? "border-[var(--color-success)]/40 bg-[var(--color-success-bg)] text-[var(--color-success)]"
                                    : "border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                                )}>
                                <span className="font-medium">{t.label}</span>
                                {on ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>
      {!isOwner && (
        <div className="mt-3 text-xs text-muted-foreground">
          Only owners can edit per-user tab permissions. Managers can change roles and trailer assignments.
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !archiveMut.isPending && !hardDeleteMut.isPending && setRemoveTarget(null)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="label-caps text-muted-foreground">Remove user</div>
            <h3 className="font-display text-xl mt-1">{removeTarget.name}</h3>
            {!depReport ? (
              <div className="mt-4 text-sm text-muted-foreground">Scanning historical references…</div>
            ) : depReport.totalRefs === 0 ? (
              <>
                <p className="mt-3 text-sm text-muted-foreground">No historical records reference this user. They can be deleted permanently.</p>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setRemoveTarget(null)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Cancel</button>
                  <button
                    onClick={() => hardDeleteMut.mutate({ userId: removeTarget.id })}
                    disabled={hardDeleteMut.isPending}
                    className="rounded-md bg-[var(--color-danger)] text-white px-3 py-2 text-xs font-semibold disabled:opacity-60"
                  >
                    {hardDeleteMut.isPending ? "Deleting…" : "Delete permanently"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm">
                  This user is referenced in <span className="font-semibold">{depReport.totalRefs}</span> historical record{depReport.totalRefs === 1 ? "" : "s"}. Archiving preserves audit history and removes them from every live list.
                </p>
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground max-h-48 overflow-auto">
                  {Object.entries(depReport.counts).map(([k, v]) => (
                    <li key={k} className="flex justify-between border-b border-border/50 py-1">
                      <span>{v.label}</span><span className="font-mono">{v.count}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <div className="label-caps text-muted-foreground mb-1">Reason (optional)</div>
                  <input value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="Left the team"
                    className="w-full h-9 rounded-md border border-border bg-card px-2 text-sm" />
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setRemoveTarget(null)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Cancel</button>
                  <button
                    onClick={() => archiveMut.mutate({ userId: removeTarget.id, reason: removeReason || undefined })}
                    disabled={archiveMut.isPending}
                    className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                  >
                    <Archive className="h-3.5 w-3.5" /> {archiveMut.isPending ? "Archiving…" : "Archive user"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}


function InvitesTab() {
  const qc = useQueryClient();
  const fetchInvites = useServerFn(listInvitesV2);
  const fetchTrailers = useServerFn(listTrailers);
  const genFn = useServerFn(generateInvite);
  const disableFn = useServerFn(disableInvite);
  const delFn = useServerFn(deleteInvite);

  const [role, setRole] = useState<RoleId>("cashier");
  const [trailerId, setTrailerId] = useState<string>("");
  const [hours, setHours] = useState<number>(24);
  const [note, setNote] = useState("");

  const { data: invites = [] } = useQuery({ queryKey: ["invites-v2"], queryFn: () => fetchInvites() });
  const { data: trailers = [] } = useQuery({ queryKey: ["trailers"], queryFn: () => fetchTrailers() });

  const refresh = () => syncDomains(qc, "invites");

  const genMut = useMutation({
    mutationFn: () => genFn({ data: { role, trailerId: trailerId || undefined, expiresHours: hours, note: note || undefined } }),
    onSuccess: (row: any) => {
      navigator.clipboard?.writeText(row.code).catch(() => {});
      toast.success(`Code ${row.code} copied`);
      setNote("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const disableMut = useMutation({
    mutationFn: (id: string) => disableFn({ data: { id } }),
    onSuccess: () => { toast.success("Disabled"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (code: string) => { navigator.clipboard?.writeText(code); toast.success(`Copied ${code}`); };

  return (
    <>
      <SectionHeader eyebrow="Generate" title="New Invite Code" />
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="label-caps text-muted-foreground mb-1">Role</div>
            <select value={role} onChange={(e) => setRole(e.target.value as RoleId)}
              className="w-full h-10 rounded-md border border-border bg-card px-2 text-sm">
              {ROLE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <div className="label-caps text-muted-foreground mb-1">Trailer</div>
            <select value={trailerId} onChange={(e) => setTrailerId(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-card px-2 text-sm">
              <option value="">Any</option>
              {trailers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <div className="label-caps text-muted-foreground mb-1">Expires</div>
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))}
              className="w-full h-10 rounded-md border border-border bg-card px-2 text-sm">
              {EXPIRY_OPTIONS.map((o) => <option key={o.hours} value={o.hours}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <div className="label-caps text-muted-foreground mb-1">Note</div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="For: Mario"
              className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={() => genMut.mutate()} disabled={genMut.isPending}
            className="h-10 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-4 text-xs font-semibold uppercase tracking-[1.2px] inline-flex items-center gap-1.5 disabled:opacity-60">
            <Plus className="h-3.5 w-3.5" /> {genMut.isPending ? "Generating…" : "Generate"}
          </button>
        </div>
      </Card>

      <SectionHeader eyebrow="History" title="All Codes" action={<StatusPill tone="neutral">{invites.length}</StatusPill>} />
      <Card className="p-0 overflow-hidden">
        {invites.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No codes yet.</div>}
        {invites.map((inv: any, i: number) => (
          <div key={inv.id} className={cn("grid grid-cols-1 md:grid-cols-[180px_120px_1fr_140px_120px_auto] gap-3 px-4 py-3 items-center text-sm", i && "border-t border-border")}>
            <button onClick={() => copy(inv.code)} className="font-mono text-base tracking-widest text-left inline-flex items-center gap-1.5 hover:text-[var(--color-gold)]">
              {inv.code} <Copy className="h-3 w-3 opacity-50" />
            </button>
            <div><RoleBadge role={inv.role} /></div>
            <div className="text-xs text-muted-foreground truncate">{inv.note || "—"}</div>
            <div className="text-xs text-muted-foreground">Expires {new Date(inv.expires_at).toLocaleString()}</div>
            <div>
              <StatusPill tone={inv.status === "active" ? "success" : inv.status === "used" ? "neutral" : "danger"}>
                {inv.status.toUpperCase()}
              </StatusPill>
            </div>
            <div className="flex gap-2 justify-end">
              {inv.status === "active" && (
                <button onClick={() => disableMut.mutate(inv.id)} className="rounded-md border border-border px-2 py-1 text-xs inline-flex items-center gap-1 hover:border-[var(--color-warning)]">
                  <Ban className="h-3 w-3" /> Disable
                </button>
              )}
              <button onClick={() => { if (confirm("Delete this code?")) delMut.mutate(inv.id); }}
                className="rounded-md border border-border px-2 py-1 text-xs inline-flex items-center gap-1 hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

function LogsTab() {
  const fetchLogs = useServerFn(listAccessLogs);
  const { data: logs = [] } = useQuery({ queryKey: ["access-logs"], queryFn: () => fetchLogs(), refetchInterval: 30_000 });
  const fetchUsers = useServerFn(listUsers);
  const { data: users = [] } = useQuery({ queryKey: ["users", { showArchived: true }], queryFn: () => fetchUsers({ data: { includeArchived: true } }) });
  const nameOf = (id: string | null) => users.find((u: any) => u.id === id)?.display_name ?? (id ? id.slice(0, 8) : "system");

  return (
    <>
      <SectionHeader eyebrow="Audit" title="Access Activity" action={<StatusPill tone="neutral">{logs.length}</StatusPill>} />
      <Card className="p-0 overflow-hidden">
        {logs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No activity yet.</div>}
        {logs.map((l: any, i: number) => (
          <div key={l.id} className={cn("grid grid-cols-[1fr_auto] md:grid-cols-[1.2fr_160px_1fr_180px] gap-3 px-4 py-3 items-center text-sm", i && "border-t border-border")}>
            <div className="font-medium truncate">{nameOf(l.user_id)}</div>
            <div><StatusPill tone={l.event.includes("revoked") ? "danger" : l.event === "login" ? "success" : "neutral"}>{l.event.toUpperCase()}</StatusPill></div>
            <div className="text-xs text-muted-foreground truncate">{l.payload ? JSON.stringify(l.payload) : "—"}</div>
            <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</div>
          </div>
        ))}
      </Card>
    </>
  );
}
