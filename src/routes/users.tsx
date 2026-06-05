import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { canSee, ROLES, useRole, type RoleId } from "@/lib/role";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import {
  listTrailers, generateInvite, listInvitesV2, disableInvite, deleteInvite,
  listUsers, setUserRole, setUserTrailer, setUserActive, listAccessLogs,
} from "@/lib/users.functions";
import { Copy, Plus, Trash2, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/users")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
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

function UsersPage() {
  const { roleId } = useRole();
  if (!canSee(roleId, "manager")) return <Navigate to="/" />;
  const [tab, setTab] = useState<"users" | "invites" | "logs">("users");

  return (
    <AppShell>
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
    </AppShell>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const fetchTrailers = useServerFn(listTrailers);
  const setRoleFn = useServerFn(setUserRole);
  const setTrailerFn = useServerFn(setUserTrailer);
  const setActiveFn = useServerFn(setUserActive);

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => fetchUsers() });
  const { data: trailers = [] } = useQuery({ queryKey: ["trailers"], queryFn: () => fetchTrailers() });

  const refresh = () => qc.invalidateQueries({ queryKey: ["users"] });

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

  return (
    <>
      <SectionHeader eyebrow="Crew" title="All Users" action={<StatusPill tone="default">{users.length} total</StatusPill>} />
      <Card className="p-0 overflow-hidden">
        {users.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No users yet.</div>}
        {users.map((u: any, i: number) => {
          const role = (u.roles[0] as RoleId | undefined) ?? "cashier";
          return (
            <div key={u.id} className={cn("grid grid-cols-1 md:grid-cols-[1.4fr_140px_180px_140px_auto] gap-3 px-4 py-3 items-center text-sm", i && "border-t border-border")}>
              <div>
                <div className="font-semibold truncate">{u.display_name}</div>
                <div className="text-xs text-muted-foreground">Last login: {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "never"}</div>
              </div>
              <select value={role} onChange={(e) => roleMut.mutate({ userId: u.id, role: e.target.value as RoleId })}
                className="h-9 rounded-md border border-border bg-card px-2 text-xs">
                {ROLE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <select value={u.trailer_id ?? ""} onChange={(e) => trailerMut.mutate({ userId: u.id, trailerId: e.target.value || null })}
                className="h-9 rounded-md border border-border bg-card px-2 text-xs">
                <option value="">No trailer</option>
                {trailers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div><StatusPill tone={u.active ? "success" : "danger"}>{u.active ? "Active" : "Disabled"}</StatusPill></div>
              <button onClick={() => activeMut.mutate({ userId: u.id, active: !u.active })}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:border-[var(--color-gold)]">
                {u.active ? "Disable" : "Restore"}
              </button>
            </div>
          );
        })}
      </Card>
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

  const refresh = () => qc.invalidateQueries({ queryKey: ["invites-v2"] });

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

      <SectionHeader eyebrow="History" title="All Codes" action={<StatusPill tone="default">{invites.length}</StatusPill>} />
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
              <StatusPill tone={inv.status === "active" ? "success" : inv.status === "used" ? "default" : "danger"}>
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
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => fetchUsers() });
  const nameOf = (id: string | null) => users.find((u: any) => u.id === id)?.display_name ?? (id ? id.slice(0, 8) : "system");

  return (
    <>
      <SectionHeader eyebrow="Audit" title="Access Activity" action={<StatusPill tone="default">{logs.length}</StatusPill>} />
      <Card className="p-0 overflow-hidden">
        {logs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No activity yet.</div>}
        {logs.map((l: any, i: number) => (
          <div key={l.id} className={cn("grid grid-cols-[1fr_auto] md:grid-cols-[1.2fr_160px_1fr_180px] gap-3 px-4 py-3 items-center text-sm", i && "border-t border-border")}>
            <div className="font-medium truncate">{nameOf(l.user_id)}</div>
            <div><StatusPill tone={l.event.includes("revoked") ? "danger" : l.event === "login" ? "success" : "default"}>{l.event.toUpperCase()}</StatusPill></div>
            <div className="text-xs text-muted-foreground truncate">{l.payload ? JSON.stringify(l.payload) : "—"}</div>
            <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</div>
          </div>
        ))}
      </Card>
    </>
  );
}
