import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, ProgressBar, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { canSee, ROLES, useRole, type RoleId } from "@/lib/role";
import { syncDomains } from "@/lib/sync-bus";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPendingApprovals, signOffTask } from "@/lib/tasks.functions";
import { listInventory } from "@/lib/inventory.functions";
import {
  getManagerOverview, createActionTask, acknowledgeAlert, reorderItem,
  listCrewRoster, requestNewEmployee,
} from "@/lib/manager.functions";
import { toast } from "sonner";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { TaskTemplatesPanel } from "@/components/gotham/TaskTemplatesPanel";

export const Route = createFileRoute("/manager")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Command Center · Gotham OS" }] }),
  component: ManagerPage,
});

function ManagerPage() {
  const { roleId, session, loading } = useRole();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const allowed = canSee(roleId, "manager");

  const fetchApprovals = useServerFn(listPendingApprovals);
  const fetchInventory = useServerFn(listInventory);
  const signOff = useServerFn(signOffTask);

  const fetchOverview = useServerFn(getManagerOverview);
  const { data: overview } = useQuery({
    queryKey: ["manager-overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 30_000,
    enabled: !loading && !!session?.access_token && allowed,
  });
  const crew = overview?.crew ?? [];
  const openTasks = overview?.openTasks ?? [];
  const hasShift = !!overview?.shift;
  const scores = overview?.scores ?? { ops: 0, inventory: 0, hospitality: 0, team: 0, overall: 0 };

  const ackFn = useServerFn(acknowledgeAlert);
  const reorderFn = useServerFn(reorderItem);
  const ackMut = useMutation({
    mutationFn: (itemId: string) => ackFn({ data: { itemId } }),
    onSuccess: () => toast.success("Acknowledged"),
    onError: (e: Error) => toast.error(e.message),
  });
  const reorderMut = useMutation({
    mutationFn: (itemId: string) => reorderFn({ data: { itemId } }),
    onSuccess: (res: any) => { toast.success(`Reorder task created (${res.qty})`); qc.invalidateQueries({ queryKey: ["manager-overview"] }); syncDomains(qc, "tasks", "inventory", "alerts"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: () => fetchApprovals(),
    enabled: !loading && !!session?.access_token && allowed,
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => fetchInventory(),
    enabled: !loading && !!session?.access_token && allowed,
  });

  const alerts = inventory
    .filter((i: any) => Number(i.current_qty) <= Number(i.low_threshold))
    .slice(0, 8)
    .map((i: any) => ({
      id: i.id,
      item: i.name,
      count: Number(i.current_qty),
      par: Number(i.par_level),
      status: (Number(i.current_qty) <= Number(i.low_threshold) * 0.5 ? "CRITICAL" : "LOW") as "CRITICAL" | "LOW",
    }));

  const signOffMut = useMutation({
    mutationFn: (vars: { taskId: string; approve: boolean }) => signOff({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.approve ? "Approved" : "Sent back");
      qc.invalidateQueries({ queryKey: ["pending-approvals"] }); syncDomains(qc, "orders", "labor", "alerts");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });


  if (loading) return <AppShell><Card>Loading…</Card></AppShell>;
  if (!allowed) return <Navigate to="/" />;

  return (
    <AppShell>
      <Card dark>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
          <div>
            <div className="label-caps text-[var(--color-gold)]/80">One place. All day.</div>
            <h1 className="font-display text-3xl mt-1 text-white">COMMAND CENTER</h1>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l: "Operations",  v: scores.ops },
                { l: "Inventory",   v: scores.inventory },
                { l: "Hospitality", v: scores.hospitality },
                { l: "Team",        v: scores.team },
              ].map((b) => (
                <div key={b.l} className="rounded-md bg-[#1C1C1C] border border-[#2A2A2A] p-3">
                  <div className="label-caps text-white/55">{b.l}</div>
                  <div className="text-2xl font-semibold mt-1 text-[var(--color-gold)]">{b.v}<span className="text-white/40 text-sm">%</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center md:text-right">
            <div className="font-display text-7xl text-[var(--color-gold)] leading-none">{scores.overall}</div>
            <div className="label-caps text-white/55 mt-1">overall · /100</div>
          </div>
        </div>
      </Card>

      <SectionHeader eyebrow="Crew" title="Completion Today" action={<button onClick={() => setOpen(true)} disabled={!hasShift} title={hasShift ? "" : "Open a shift to create action items"} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Action Item</button>} />
      <Card className="p-0 overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.4fr_140px_90px_140px] gap-3 px-4 py-2.5 label-caps text-muted-foreground bg-[#FAFAF5] border-b border-border">
          <div>Employee</div><div>Role</div><div>Completed</div><div>Status</div>
        </div>
        {crew.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No crew profiles yet.</div>}
        {crew.map((c, i) => {
          const roleLabel = ROLES[c.role as RoleId]?.name ?? c.role;
          const tone = c.done >= 6 ? "success" : c.done >= 3 ? "gold" : "warning";
          const status = !hasShift ? "OFF SHIFT" : c.done >= 6 ? "STRONG" : c.done >= 3 ? "ON TRACK" : "LOW ACTIVITY";
          return (
            <div key={c.id} className={cn("grid grid-cols-[1fr_auto] md:grid-cols-[1.4fr_140px_90px_140px] gap-3 px-4 py-3 text-sm items-center", i && "border-t border-border")}>
              <div className="font-medium truncate">{c.name}</div>
              <div className="md:order-none order-3 md:col-auto col-span-2 md:contents">
                <div className="md:block"><RoleBadge role={roleLabel} /></div>
              </div>
              <div className="hidden md:block">{c.done}</div>
              <div className="md:block"><StatusPill tone={tone as any}>{!hasShift ? status : `${c.done} done`}</StatusPill></div>
            </div>
          );
        })}
      </Card>

      <SectionHeader eyebrow="Review" title="Pending Approvals" action={<StatusPill tone={approvals.length ? "warning" : "success"}>{approvals.length} pending</StatusPill>} />
      <Card className="p-0 overflow-hidden">
        {approvals.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nothing waiting on you.</div>}
        {approvals.map((a: any, i: number) => (
          <div key={a.id} className={cn("p-4 flex items-start justify-between gap-3", i && "border-t border-border")}>
            <div className="min-w-0">
              <div className="font-semibold text-sm">{a.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{a.description ?? "—"} · {a.completed_at ? new Date(a.completed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }) : ""}</div>
              {a.text_value && (
                <div className="mt-2 text-sm rounded-md bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30 px-3 py-1.5 text-[#7C3A00]">
                  {a.text_value}
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button disabled={signOffMut.isPending} onClick={() => signOffMut.mutate({ taskId: a.id, approve: true })} className="rounded-md bg-[var(--color-success)] text-white px-3 py-2 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Approve</button>
              <button disabled={signOffMut.isPending} onClick={() => signOffMut.mutate({ taskId: a.id, approve: false })} className="rounded-md border border-border px-3 py-2 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"><X className="h-3.5 w-3.5" /> Reject</button>
            </div>
          </div>
        ))}
      </Card>

      <SectionHeader eyebrow="Watch" title="Inventory Issues" />
      <Card className="p-0 overflow-hidden">
        {alerts.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No inventory alerts.</div>}
        {alerts.map((a, i) => {

          const pct = Math.round((a.count / a.par) * 100);
          return (
            <div key={a.id} className={cn("grid grid-cols-1 md:grid-cols-[1.4fr_90px_90px_120px_180px] gap-3 px-4 py-3 items-center text-sm", i && "border-t border-border")}>
              <div className="font-medium">{a.item}</div>
              <div className="text-muted-foreground">{a.count}/{a.par}</div>
              <div><StatusPill tone={a.status === "CRITICAL" ? "danger" : "warning"}>{a.status}</StatusPill></div>
              <div className="hidden md:block"><ProgressBar value={pct} tone={a.status === "CRITICAL" ? "danger" : "gold"} /></div>
              <div className="flex gap-2">
                <button disabled={reorderMut.isPending} onClick={() => reorderMut.mutate(a.id)} className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Reorder</button>
                <button disabled={ackMut.isPending} onClick={() => ackMut.mutate(a.id)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Acknowledge</button>
              </div>
            </div>
          );
        })}
      </Card>

      {/* LABOR ISSUES */}
      <SectionHeader eyebrow="Schedule" title="Labor Issues" action={<Link to="/labor" className="label-caps text-foreground/70 hover:text-[var(--color-gold)]">Open labor</Link>} />
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border border-border p-3">
            <div className="label-caps text-muted-foreground">Crew on shift</div>
            <div className="font-display text-2xl mt-1">{crew.length}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="label-caps text-muted-foreground">Open tasks</div>
            <div className="font-display text-2xl mt-1">{openTasks.length}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="label-caps text-muted-foreground">Team score</div>
            <div className="font-display text-2xl mt-1 text-[var(--color-gold)]">{scores.team}%</div>
          </div>
          <Link to="/schedule" className="rounded-md border border-border p-3 hover:border-[var(--color-gold)] transition-colors">
            <div className="label-caps text-muted-foreground">Schedule</div>
            <div className="font-semibold mt-1 text-sm">Open scheduling →</div>
          </Link>
        </div>
      </Card>

      {/* PERFORMANCE — open tasks */}
      <SectionHeader eyebrow="Performance" title="Open Tasks" action={<StatusPill tone={openTasks.length ? "warning" : "success"}>{openTasks.length} open</StatusPill>} />
      <Card className="p-0 overflow-hidden">
        {!hasShift && <div className="p-6 text-center text-sm text-muted-foreground">No active shift.</div>}
        {hasShift && openTasks.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">All tasks complete. Nice.</div>}
        {openTasks.map((t: any, i: number) => (
          <div key={t.id} className={cn("grid grid-cols-[1fr_auto] md:grid-cols-[1.6fr_120px_140px] gap-3 px-4 py-3 text-sm items-center", i && "border-t border-border")}>
            <div className="font-medium truncate">{t.title}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{t.phase}</div>
            <div className="col-span-2 md:col-auto"><StatusPill tone="warning">Pending{t.requires_signoff ? " · sign-off" : ""}</StatusPill></div>
          </div>
        ))}
      </Card>

      {/* ACTIONS */}
      <SectionHeader eyebrow="Actions" title="Task Templates" action={<StatusPill tone="gold">Auto-assigns on clock-in</StatusPill>} />
      <TaskTemplatesPanel />

      <SectionHeader eyebrow="Today" title="Crew on Shift" />
      <CrewRosterPanel />

      <SectionHeader eyebrow="Requests" title="Request New Employee" action={<StatusPill tone="info">Owner approves</StatusPill>} />
      <RequestNewEmployeePanel />

      {open && <ActionModal onClose={() => setOpen(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ["manager-overview"] }); syncDomains(qc, "tasks", "alerts"); }} />}

      <div className="h-6" />
    </AppShell>
  );
}

function ActionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createFn = useServerFn(createActionTask);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [assigneeRole, setAssigneeRole] = useState<RoleId | "">("");
  const [phase, setPhase] = useState<"opening" | "mid" | "closing" | "emergency">("mid");
  const [requiresSignoff, setRequiresSignoff] = useState(false);

  const createMut = useMutation({
    mutationFn: () => createFn({ data: {
      title: title.trim(),
      description: notes.trim() || undefined,
      assigneeRole: assigneeRole || undefined,
      phase,
      requiresSignoff,
    } }),
    onSuccess: () => { toast.success("Action item created"); onCreated(); onClose(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 card-shadow" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-xl mb-4">CREATE ACTION ITEM</h3>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Wipe down fryer area)" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={assigneeRole} onChange={(e) => setAssigneeRole(e.target.value as RoleId | "")} className="h-10 rounded-md border border-border bg-card px-3 text-sm">
              <option value="">Any role</option>
              {(Object.keys(ROLES) as RoleId[]).map((r) => <option key={r} value={r}>{ROLES[r].name}</option>)}
            </select>
            <select value={phase} onChange={(e) => setPhase(e.target.value as any)} className="h-10 rounded-md border border-border bg-card px-3 text-sm">
              <option value="opening">Opening</option>
              <option value="mid">Mid-shift</option>
              <option value="closing">Closing</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={requiresSignoff} onChange={(e) => setRequiresSignoff(e.target.checked)} />
            Require manager sign-off
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm border border-border">Cancel</button>
          <button
            disabled={!title.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
            className="rounded-md px-4 py-2 text-sm font-semibold bg-[var(--color-gold)] text-[#0A0A0A] disabled:opacity-50">
            {createMut.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

const REQUEST_ROLE_OPTIONS: { id: "cashier"|"prep"|"grill"|"shift_lead"|"manager"; label: string }[] = [
  { id: "cashier", label: "Cashier" },
  { id: "prep", label: "Prep" },
  { id: "grill", label: "Grill Master" },
  { id: "shift_lead", label: "Shift Lead" },
  { id: "manager", label: "Manager" },
];

// View-only roster. Managers see who's on shift but cannot change roles,
// disable accounts, or reset access. Those are owner-only governance actions.
function CrewRosterPanel() {
  const fetchRoster = useServerFn(listCrewRoster);
  const { data: roster = [] } = useQuery({ queryKey: ["crew-roster"], queryFn: () => fetchRoster() });

  return (
    <Card className="p-0 overflow-hidden">
      {roster.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No crew assigned to this location yet. Use “Request New Employee” below to ask the owner to add someone.
        </div>
      )}
      {roster.map((m: any, i: number) => (
        <div key={m.id} className={cn("grid grid-cols-[1fr_auto] md:grid-cols-[1.6fr_160px_1fr] gap-3 px-4 py-3 items-center text-sm", i && "border-t border-border")}>
          <div className="font-medium truncate">{m.name}</div>
          <div><RoleBadge role={ROLES[m.role as RoleId]?.name ?? m.role} /></div>
          <div className="text-xs text-muted-foreground hidden md:block">Joined {new Date(m.joined).toLocaleDateString()}</div>
        </div>
      ))}
    </Card>
  );
}

function RequestNewEmployeePanel() {
  const qc = useQueryClient();
  const { trailers } = useRole();
  const requestFn = useServerFn(requestNewEmployee);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [requestedRole, setRequestedRole] = useState<typeof REQUEST_ROLE_OPTIONS[number]["id"]>("cashier");
  const [trailerId, setTrailerId] = useState<string>("");
  const [reason, setReason] = useState("");

  const mut = useMutation({
    mutationFn: () => requestFn({ data: {
      name: name.trim(),
      contact: contact.trim(),
      requestedRole,
      requestedTrailerId: trailerId || null,
      reason: reason.trim(),
    } }),
    onSuccess: () => {
      toast.success("Request sent to owner");
      setName(""); setContact(""); setReason(""); setTrailerId("");
      setRequestedRole("cashier");
      qc.invalidateQueries({ queryKey: ["alerts"] });
      syncDomains(qc, "alerts");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const canSubmit = name.trim() && contact.trim() && reason.trim() && !mut.isPending;

  return (
    <Card>
      <div className="text-xs text-muted-foreground mb-3">
        Need a new crew member at your location? Submit a request — the owner will receive an alert and email, and decides whether to approve, decline, or ask for more info.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="label-caps text-muted-foreground mb-1">Employee name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Carlos Rivera" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
        </div>
        <div>
          <div className="label-caps text-muted-foreground mb-1">Phone or email</div>
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="555-0144 or carlos@…" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
        </div>
        <div>
          <div className="label-caps text-muted-foreground mb-1">Requested role</div>
          <select value={requestedRole} onChange={(e) => setRequestedRole(e.target.value as any)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
            {REQUEST_ROLE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <div className="label-caps text-muted-foreground mb-1">Requested location</div>
          <select value={trailerId} onChange={(e) => setTrailerId(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
            <option value="">My current location</option>
            {trailers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <div className="label-caps text-muted-foreground mb-1">Reason</div>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Short-staffed weekends; replacing departed cashier; etc." className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => mut.mutate()}
          disabled={!canSubmit}
          className="h-10 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-4 text-xs font-semibold uppercase tracking-[1.2px] disabled:opacity-60"
        >
          {mut.isPending ? "Sending…" : "Request new employee"}
        </button>
      </div>
    </Card>
  );
}
