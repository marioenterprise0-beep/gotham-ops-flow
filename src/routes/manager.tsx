import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, ProgressBar, RoleBadge, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { canSee, useRole } from "@/lib/role";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPendingApprovals, signOffTask } from "@/lib/tasks.functions";
import { listInventory } from "@/lib/inventory.functions";
import { createInvite, listInvites, revokeInvite } from "@/lib/invites.functions";
import { toast } from "sonner";
import { Copy } from "lucide-react";

export const Route = createFileRoute("/manager")({
  head: () => ({ meta: [{ title: "Manager Panel · Gotham OS" }] }),
  component: ManagerPage,
});

const CREW = [
  { name: "Marcus T.",  role: "Shift Lead",    assigned: 12, done: 9,  status: "ON TRACK" as const },
  { name: "DeShawn",    role: "Grill Master",  assigned: 8,  done: 5,  status: "BEHIND"   as const },
  { name: "Priya",      role: "Prep",          assigned: 6,  done: 6,  status: "COMPLETE" as const },
  { name: "Carlos",     role: "Cashier",       assigned: 7,  done: 4,  status: "BEHIND"   as const },
];

const MISSED = [
  { task: "Pre-shift huddle",   who: "Marcus",  due: "10:10", missed: "20m" },
  { task: "Mid-shift trash",    who: "Carlos",  due: "13:00", missed: "12m" },
];

function ManagerPage() {
  const { roleId } = useRole();
  if (!canSee(roleId, "manager")) return <Navigate to="/" />;
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const fetchApprovals = useServerFn(listPendingApprovals);
  const fetchInventory = useServerFn(listInventory);
  const signOff = useServerFn(signOffTask);

  const { data: approvals = [] } = useQuery({ queryKey: ["pending-approvals"], queryFn: () => fetchApprovals() });
  const { data: inventory = [] } = useQuery({ queryKey: ["inventory"], queryFn: () => fetchInventory() });

  const alerts = inventory
    .filter((i: any) => Number(i.current_qty) <= Number(i.low_threshold))
    .slice(0, 8)
    .map((i: any) => ({
      item: i.name,
      count: Number(i.current_qty),
      par: Number(i.par_level),
      status: (Number(i.current_qty) <= Number(i.low_threshold) * 0.5 ? "CRITICAL" : "LOW") as "CRITICAL" | "LOW",
    }));

  const signOffMut = useMutation({
    mutationFn: (vars: { taskId: string; approve: boolean }) => signOff({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.approve ? "Approved" : "Sent back");
      qc.invalidateQueries({ queryKey: ["pending-approvals"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });


  return (
    <AppShell>
      <Card dark>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
          <div>
            <div className="label-caps text-white/55">Store Score · Today</div>
            <h1 className="font-display text-3xl mt-1 text-white">STORE PERFORMANCE</h1>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l: "Operations", v: 88 },
                { l: "Inventory",  v: 72 },
                { l: "Hospitality", v: 87 },
                { l: "Team",        v: 94 },
              ].map((b) => (
                <div key={b.l} className="rounded-md bg-[#1C1C1C] border border-[#2A2A2A] p-3">
                  <div className="label-caps text-white/55">{b.l}</div>
                  <div className="text-2xl font-semibold mt-1 text-[var(--color-gold)]">{b.v}<span className="text-white/40 text-sm">%</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center md:text-right">
            <div className="font-display text-7xl text-[var(--color-gold)] leading-none">85</div>
            <div className="label-caps text-white/55 mt-1">overall · /100</div>
          </div>
        </div>
      </Card>

      <SectionHeader eyebrow="Crew" title="Completion" action={<button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px]"><Plus className="h-3.5 w-3.5" /> Action Item</button>} />
      <Card className="p-0 overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.4fr_140px_90px_90px_80px_140px] gap-3 px-4 py-2.5 label-caps text-muted-foreground bg-[#FAFAF5] border-b border-border">
          <div>Employee</div><div>Role</div><div>Assigned</div><div>Done</div><div>%</div><div>Status</div>
        </div>
        {CREW.map((c, i) => {
          const pct = Math.round((c.done / c.assigned) * 100);
          return (
            <div key={c.name} className={cn("grid grid-cols-1 md:grid-cols-[1.4fr_140px_90px_90px_80px_140px] gap-3 px-4 py-3 text-sm items-center", i && "border-t border-border")}>
              <div className="font-medium">{c.name}</div>
              <div><RoleBadge role={c.role} /></div>
              <div>{c.assigned}</div>
              <div>{c.done}</div>
              <div>{pct}%</div>
              <div>
                <StatusPill tone={c.status === "COMPLETE" ? "success" : c.status === "ON TRACK" ? "gold" : "warning"}>{c.status}</StatusPill>
              </div>
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
              <div className="text-xs text-muted-foreground mt-0.5">{a.description ?? "—"} · {a.completed_at ? new Date(a.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</div>
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

      <SectionHeader eyebrow="Watch" title="Inventory Alerts" />
      <Card className="p-0 overflow-hidden">
        {alerts.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No inventory alerts.</div>}
        {alerts.map((a, i) => {

          const pct = Math.round((a.count / a.par) * 100);
          return (
            <div key={a.item} className={cn("grid grid-cols-1 md:grid-cols-[1.4fr_90px_90px_120px_180px] gap-3 px-4 py-3 items-center text-sm", i && "border-t border-border")}>
              <div className="font-medium">{a.item}</div>
              <div className="text-muted-foreground">{a.count}/{a.par}</div>
              <div><StatusPill tone={a.status === "CRITICAL" ? "danger" : "warning"}>{a.status}</StatusPill></div>
              <div className="hidden md:block"><ProgressBar value={pct} tone={a.status === "CRITICAL" ? "danger" : "gold"} /></div>
              <div className="flex gap-2">
                <button className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold">Reorder</button>
                <button className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Acknowledge</button>
              </div>
            </div>
          );
        })}
      </Card>

      <SectionHeader eyebrow="Accountability" title="Missed Tasks" />
      <Card className="p-0 overflow-hidden">
        {MISSED.map((m, i) => (
          <div key={i} className={cn("grid grid-cols-1 md:grid-cols-4 gap-3 px-4 py-3 text-sm", i && "border-t border-border")}>
            <div className="font-medium">{m.task}</div>
            <div className="text-muted-foreground">{m.who}</div>
            <div className="text-muted-foreground">Due {m.due}</div>
            <div><StatusPill tone="warning">Missed by {m.missed}</StatusPill></div>
          </div>
        ))}
      </Card>

      <SectionHeader eyebrow="Documentation" title="Photo Evidence" />
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-md border border-border bg-[#EAEAE5] grid place-items-center text-xs text-muted-foreground">Photo {i + 1}</div>
        ))}
      </div>

      <SectionHeader eyebrow="Access" title="Invite Codes" />
      <InviteCodesPanel />

      {open && <ActionModal onClose={() => setOpen(false)} />}

      <div className="h-6" />
    </AppShell>
  );
}

function ActionModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 card-shadow" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-xl mb-4">CREATE ACTION ITEM</h3>
        <div className="space-y-3">
          <input placeholder="Title" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
          <select className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
            <option>Assign to Marcus</option><option>DeShawn</option><option>Priya</option><option>Carlos</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="time" className="h-10 rounded-md border border-border bg-card px-3 text-sm" />
            <select className="h-10 rounded-md border border-border bg-card px-3 text-sm">
              <option>High priority</option><option>Medium</option><option>Low</option>
            </select>
          </div>
          <textarea rows={2} placeholder="Notes" className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm border border-border">Cancel</button>
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold bg-[var(--color-gold)] text-[#0A0A0A]">Create</button>
        </div>
      </div>
    </div>
  );
}

const ROLE_OPTIONS: { id: "cashier"|"prep"|"grill"|"shift_lead"|"manager"|"owner"; label: string }[] = [
  { id: "cashier", label: "Cashier" },
  { id: "prep", label: "Prep" },
  { id: "grill", label: "Grill Master" },
  { id: "shift_lead", label: "Shift Lead" },
  { id: "manager", label: "Manager" },
  { id: "owner", label: "Owner" },
];

function InviteCodesPanel() {
  const qc = useQueryClient();
  const fetchInvites = useServerFn(listInvites);
  const createFn = useServerFn(createInvite);
  const revokeFn = useServerFn(revokeInvite);

  const [role, setRole] = useState<typeof ROLE_OPTIONS[number]["id"]>("cashier");
  const [note, setNote] = useState("");

  const { data: invites = [] } = useQuery({ queryKey: ["invites"], queryFn: () => fetchInvites() });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { role, note: note || undefined } }),
    onSuccess: (row: any) => {
      toast.success(`Code ${row.code} created`);
      setNote("");
      navigator.clipboard?.writeText(row.code).catch(() => {});
      qc.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => { toast.success("Revoked"); qc.invalidateQueries({ queryKey: ["invites"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code);
    toast.success(`Copied ${code}`);
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-border bg-[#FAFAF5] grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-2 items-end">
        <div>
          <div className="label-caps text-muted-foreground mb-1">Role</div>
          <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full h-10 rounded-md border border-border bg-card px-2 text-sm">
            {ROLE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <div className="label-caps text-muted-foreground mb-1">Note (optional)</div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="For: Carlos" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
        </div>
        <button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="h-10 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-4 text-xs font-semibold uppercase tracking-[1.2px] disabled:opacity-60">
          {createMut.isPending ? "Generating…" : "Generate code"}
        </button>
      </div>
      {invites.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No invite codes yet. Generate one above to onboard crew.</div>}
      {invites.map((inv: any, i: number) => {
        const used = !!inv.used_by;
        const expired = !used && new Date(inv.expires_at) < new Date();
        return (
          <div key={inv.id} className={cn("grid grid-cols-1 md:grid-cols-[180px_120px_1fr_140px_120px] gap-3 px-4 py-3 items-center text-sm", i && "border-t border-border")}>
            <div className="font-mono text-base tracking-widest">{inv.code}</div>
            <div><RoleBadge role={inv.role} /></div>
            <div className="text-xs text-muted-foreground truncate">{inv.note || "—"}</div>
            <div className="text-xs text-muted-foreground">
              {used ? `Used ${new Date(inv.used_at).toLocaleDateString()}` : expired ? "Expired" : `Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
            </div>
            <div className="flex gap-2 justify-end">
              {!used && !expired && (
                <>
                  <button onClick={() => copy(inv.code)} className="rounded-md border border-border px-2 py-1.5 text-xs inline-flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</button>
                  <button onClick={() => revokeMut.mutate(inv.id)} className="rounded-md border border-border px-2 py-1.5 text-xs">Revoke</button>
                </>
              )}
              {used && <StatusPill tone="success">Used</StatusPill>}
              {!used && expired && <StatusPill tone="warning">Expired</StatusPill>}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
