import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { listInventoryChangeRequests, decideInventoryChangeRequest } from "@/lib/inventory-changes.functions";
import { useRole } from "@/lib/role";
import { syncDomains } from "@/lib/sync-bus";
import { toast } from "sonner";
import { Check, X, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/inventory-changes")({
  beforeLoad: () => {
    throw redirect({ to: "/inventory", search: { tab: "approvals" } as any });
  },
  component: () => null,
});

type Req = {
  id: string;
  action: "create" | "update" | "delete" | "archive";
  status: "pending" | "approved" | "declined" | "cancelled";
  payload: Record<string, any>;
  reason: string | null;
  requested_by: string;
  trailer_id: string | null;
  target_item_id: string | null;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
};

const ACTION_TONE: Record<string, "info" | "warning" | "danger" | "success"> = {
  create: "info", update: "warning", archive: "warning", delete: "danger",
};

export function InventoryChangesView() {
  const qc = useQueryClient();
  const { roleId, session, loading } = useRole();
  const isOwner = roleId === "owner";
  const listFn = useServerFn(listInventoryChangeRequests);
  const decideFn = useServerFn(decideInventoryChangeRequest);

  const { data: rows = [], isLoading } = useQuery<Req[]>({
    queryKey: ["inventory-change-requests"],
    queryFn: () => listFn() as Promise<Req[]>,
    enabled: !loading && !!session?.access_token,
  });

  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const visible = useMemo(
    () => rows.filter((r) => (filter === "all" ? true : r.status === "pending")),
    [rows, filter],
  );

  const decide = useMutation({
    mutationFn: (vars: { id: string; decision: "approved" | "declined"; note?: string }) =>
      decideFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(`Request ${vars.decision}`);
      setNoteFor(null); setNote("");
      syncDomains(qc, "inventory", "alerts");
      qc.invalidateQueries({ queryKey: ["inventory-change-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <SectionHeader
        eyebrow="Queue"
        title={isOwner ? "Owner review" : "My requests"}
        action={
          <div className="flex gap-2">
            <button onClick={() => setFilter("pending")} className={`rounded-md border border-border px-2.5 py-1 text-xs font-semibold ${filter === "pending" ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "text-muted-foreground"}`}>Pending</button>
            <button onClick={() => setFilter("all")} className={`rounded-md border border-border px-2.5 py-1 text-xs font-semibold ${filter === "all" ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "text-muted-foreground"}`}>All</button>
          </div>
        }
      />

      {(loading || isLoading) && <Card>Loading…</Card>}
      {!isLoading && visible.length === 0 && (
        <Card className="p-6 text-center">
          <ClipboardList className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm text-muted-foreground">No {filter === "pending" ? "pending" : ""} change requests.</div>
        </Card>
      )}

      <div className="space-y-2">
        {visible.map((r) => {
          const p = r.payload ?? {};
          const itemName = p.name ?? "(item)";
          return (
            <Card key={r.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusPill tone={ACTION_TONE[r.action] ?? "info"}>{r.action.toUpperCase()}</StatusPill>
                    <span className="font-semibold text-sm">{itemName}</span>
                  </div>
                  <div className="label-caps text-muted-foreground mt-1">
                    {new Date(r.created_at).toLocaleString()} · {r.status}
                  </div>
                  {r.reason && <div className="text-xs text-muted-foreground mt-1">Reason: {r.reason}</div>}
                  {r.decision_note && (
                    <div className="text-xs text-muted-foreground mt-1">Decision note: {r.decision_note}</div>
                  )}
                </div>
                <StatusPill tone={r.status === "approved" ? "success" : r.status === "declined" ? "danger" : r.status === "pending" ? "warning" : "info"}>
                  {r.status}
                </StatusPill>
              </div>

              {Object.keys(p).length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {Object.entries(p).filter(([k]) => k !== "name").map(([k, v]) => (
                    <div key={k}><span className="label-caps">{k}: </span>{String(v ?? "")}</div>
                  ))}
                </div>
              )}

              {isOwner && r.status === "pending" && (
                <div className="mt-3 border-t border-border pt-3">
                  {noteFor === r.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                        placeholder="Optional note for the requester"
                        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setNoteFor(null); setNote(""); }} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancel</button>
                        <button disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: "declined", note: note || undefined })} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-[var(--color-danger)] inline-flex items-center gap-1">
                          <X className="h-3.5 w-3.5" /> Decline
                        </button>
                        <button disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: "approved", note: note || undefined })} className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Approve & apply
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setNoteFor(r.id); setNote(""); }} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Review</button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="h-6" />
    </div>
  );
}
