import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { EmbedShell } from "@/components/gotham/EmbedShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Check, X, MapPin, Clock, Ban } from "lucide-react";
import { toast } from "sonner";
import {
  listLocationRequests,
  approveLocationRequest,
  declineLocationRequest,
  listActiveLocationGrants,
  revokeLocationGrant,
} from "@/lib/location-access.functions";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { syncDomains } from "@/lib/sync-bus";
import { GeofencePanel } from "@/components/gotham/geofence-panel";

export const Route = createFileRoute("/location-requests")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Location Access · Gotham OS" }] }),
  component: LocationRequests,
});

type Req = {
  id: string;
  status: "pending" | "approved" | "declined" | "used" | "expired" | "cancelled";
  requested_trailer_id: string;
  current_trailer_id: string | null;
  requested_by: string;
  reason: string | null;
  duration_minutes: number;
  decision_note: string | null;
  approved_at: string | null;
  code_expires_at: string | null;
  used_at: string | null;
  created_at: string;
};

const STATUS_TONE: Record<string, "warning" | "success" | "danger" | "info"> = {
  pending: "warning", approved: "success", used: "info", declined: "danger",
  expired: "danger", cancelled: "info",
};

function LocationRequests() {
  const qc = useQueryClient();
  const { roleId, trailers, session, loading } = useRole();
  const isOwner = roleId === "owner";
  const listFn = useServerFn(listLocationRequests);
  const approveFn = useServerFn(approveLocationRequest);
  const declineFn = useServerFn(declineLocationRequest);

  const { data: rows = [], isLoading } = useQuery<Req[]>({
    queryKey: ["location-requests"],
    queryFn: () => listFn() as Promise<Req[]>,
    enabled: !loading && !!session?.access_token,
    refetchInterval: 8000,
  });

  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [issuedCode, setIssuedCode] = useState<{ id: string; code: string; expiresAt: string } | null>(null);

  const visible = useMemo(
    () => rows.filter((r) => (filter === "all" ? true : r.status === "pending")),
    [rows, filter],
  );

  const approve = useMutation({
    mutationFn: (vars: { id: string; note?: string }) => approveFn({ data: vars }) as Promise<{ ok: true; code: string; expiresAt: string }>,
    onSuccess: (d, vars) => {
      setIssuedCode({ id: vars.id, code: d.code, expiresAt: d.expiresAt });
      setNoteFor(null); setNote("");
      syncDomains(qc, "alerts");
      qc.invalidateQueries({ queryKey: ["location-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decline = useMutation({
    mutationFn: (vars: { id: string; note?: string }) => declineFn({ data: vars }),
    onSuccess: () => {
      toast.success("Request declined");
      setNoteFor(null); setNote("");
      syncDomains(qc, "alerts");
      qc.invalidateQueries({ queryKey: ["location-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const trailerName = (id?: string | null) => (id ? trailers.find((t) => t.id === id)?.name ?? "Trailer" : "—");

  return (
    <EmbedShell>
      <div className="mb-3">
        <div className="label-caps text-muted-foreground">Governance</div>
        <h1 className="font-display text-2xl text-foreground">LOCATION ACCESS REQUESTS</h1>
      </div>

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
        <Card className="p-6 text-center text-sm text-muted-foreground">
          <MapPin className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          No {filter === "pending" ? "pending" : ""} requests.
        </Card>
      )}

      <div className="space-y-2">
        {visible.map((r) => (
          <Card key={r.id} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {trailerName(r.current_trailer_id)} → {trailerName(r.requested_trailer_id)}
                </div>
                <div className="label-caps text-muted-foreground mt-1">
                  {new Date(r.created_at).toLocaleString()} · {r.duration_minutes} min
                </div>
                {r.reason && <div className="text-xs text-muted-foreground mt-1">Reason: {r.reason}</div>}
                {r.decision_note && <div className="text-xs text-muted-foreground mt-1">Note: {r.decision_note}</div>}
              </div>
              <StatusPill tone={STATUS_TONE[r.status] ?? "info"}>{r.status}</StatusPill>
            </div>

            {isOwner && issuedCode?.id === r.id && (
              <div className="mt-3 rounded-md border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 p-3">
                <div className="label-caps text-muted-foreground">One-time code</div>
                <div className="text-2xl font-mono tracking-widest">{issuedCode.code}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Share with manager · expires {new Date(issuedCode.expiresAt).toLocaleTimeString()}
                </div>
              </div>
            )}

            {isOwner && r.status === "pending" && issuedCode?.id !== r.id && (
              <div className="mt-3 border-t border-border pt-3">
                {noteFor === r.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2}
                      placeholder="Optional note"
                      className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setNoteFor(null); setNote(""); }} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancel</button>
                      <button disabled={decline.isPending} onClick={() => decline.mutate({ id: r.id, note: note || undefined })} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-[var(--color-danger)] inline-flex items-center gap-1">
                        <X className="h-3.5 w-3.5" /> Decline
                      </button>
                      <button disabled={approve.isPending} onClick={() => approve.mutate({ id: r.id, note: note || undefined })} className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Approve & issue code
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button onClick={() => { setNoteFor(r.id); setNote(""); }} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Review</button>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {isOwner && <ActiveGrantsSection trailerName={trailerName} />}

      {isOwner && <GeofencePanel />}

      <div className="h-6" />
    </EmbedShell>
  );
}

function ActiveGrantsSection({ trailerName }: { trailerName: (id?: string | null) => string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listActiveLocationGrants);
  const revokeFn = useServerFn(revokeLocationGrant);
  const { data: grants = [], isLoading } = useQuery<Array<{ id: string; user_id: string; user_name: string; trailer_id: string; expires_at: string }>>({
    queryKey: ["active-location-grants"],
    queryFn: () => listFn() as any,
    refetchInterval: 15000,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Grant revoked");
      qc.invalidateQueries({ queryKey: ["active-location-grants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mt-6">
      <SectionHeader eyebrow="Live" title="Active temporary grants" />
      {isLoading && <Card>Loading…</Card>}
      {!isLoading && grants.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          <Clock className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          No active grants.
        </Card>
      )}
      <div className="space-y-2">
        {grants.map((g) => {
          const minsLeft = Math.max(0, Math.round((new Date(g.expires_at).getTime() - Date.now()) / 60000));
          return (
            <Card key={g.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{g.user_name} · {trailerName(g.trailer_id)}</div>
                <div className="label-caps text-muted-foreground mt-1">
                  Expires {new Date(g.expires_at).toLocaleTimeString()} · {minsLeft} min left
                </div>
              </div>
              <button
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(g.id)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-[var(--color-danger)] inline-flex items-center gap-1"
              >
                <Ban className="h-3.5 w-3.5" /> Revoke
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
