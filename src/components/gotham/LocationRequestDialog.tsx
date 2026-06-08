import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, MapPin, X } from "lucide-react";
import {
  submitLocationRequest,
  listLocationRequests,
  redeemLocationCode,
  getActiveLocationGrant,
} from "@/lib/location-access.functions";
import { useRole } from "@/lib/role";

type Req = {
  id: string;
  status: "pending" | "approved" | "declined" | "used" | "expired" | "cancelled";
  requested_trailer_id: string;
  reason: string | null;
  duration_minutes: number;
  code_expires_at: string | null;
  created_at: string;
};

export function LocationRequestDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { trailers, homeTrailerId, session } = useRole();
  const eligibleTrailers = trailers.filter((t) => t.id !== homeTrailerId);

  const submitFn = useServerFn(submitLocationRequest);
  const listFn = useServerFn(listLocationRequests);
  const redeemFn = useServerFn(redeemLocationCode);
  const grantFn = useServerFn(getActiveLocationGrant);

  const [trailerId, setTrailerId] = useState<string>(eligibleTrailers[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState(60);
  const [codeReqId, setCodeReqId] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const reqs = useQuery<Req[]>({
    queryKey: ["my-location-requests"],
    queryFn: () => listFn() as Promise<Req[]>,
    enabled: !!session?.access_token,
    refetchInterval: 5000,
  });

  const grant = useQuery<{ trailer_id: string; expires_at: string } | null>({
    queryKey: ["active-location-grant"],
    queryFn: () => grantFn() as any,
    enabled: !!session?.access_token,
    refetchInterval: 10000,
  });

  const submit = useMutation({
    mutationFn: () => submitFn({ data: {
      requestedTrailerId: trailerId,
      reason: reason.trim(),
      durationMinutes: duration,
    } }),
    onSuccess: () => {
      toast.success("Request sent to owner");
      setReason("");
      reqs.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const redeem = useMutation({
    mutationFn: (vars: { id: string; code: string }) =>
      redeemFn({ data: { requestId: vars.id, code: vars.code } }),
    onSuccess: () => {
      toast.success("Access activated");
      setCodeReqId(null); setCode("");
      qc.invalidateQueries({ queryKey: ["active-location-grant"] });
      qc.invalidateQueries({ queryKey: ["my-location-requests"] });
      qc.invalidateQueries(); // Refresh trailer-scoped data
      setTimeout(onClose, 600);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const trailerName = (id: string) => trailers.find((t) => t.id === id)?.name ?? "Trailer";
  const pending = (reqs.data ?? []).filter((r) => r.status === "pending");
  const approved = (reqs.data ?? []).filter((r) => r.status === "approved");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 card-shadow max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[var(--color-gold)]" /> REQUEST LOCATION ACCESS
          </h3>
          <button onClick={onClose} className="text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        {grant.data && (
          <div className="mb-3 rounded-md border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 p-3 text-xs">
            <div className="label-caps text-muted-foreground">Active grant</div>
            <div className="text-sm font-semibold">{trailerName(grant.data.trailer_id)}</div>
            <div className="text-muted-foreground">expires {new Date(grant.data.expires_at).toLocaleString()}</div>
          </div>
        )}

        {approved.length > 0 && (
          <div className="mb-3 space-y-2">
            <div className="label-caps text-muted-foreground">Approved — enter code</div>
            {approved.map((r) => (
              <div key={r.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{trailerName(r.requested_trailer_id)}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.code_expires_at ? `expires ${new Date(r.code_expires_at).toLocaleTimeString()}` : ""}
                  </div>
                </div>
                {codeReqId === r.id ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      autoFocus inputMode="numeric" pattern="\d*" maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit code"
                      className="h-10 flex-1 rounded-md border border-border bg-card px-3 text-sm tracking-widest font-mono"
                    />
                    <button
                      disabled={code.length !== 6 || redeem.isPending}
                      onClick={() => redeem.mutate({ id: r.id, code })}
                      className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Activate
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setCodeReqId(r.id); setCode(""); }} className="mt-2 text-xs underline text-muted-foreground hover:text-foreground">
                    Enter code
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {pending.length > 0 && (
          <div className="mb-3 space-y-1">
            <div className="label-caps text-muted-foreground">Pending owner approval</div>
            {pending.map((r) => (
              <div key={r.id} className="text-xs text-muted-foreground">
                {trailerName(r.requested_trailer_id)} · {r.duration_minutes} min · {new Date(r.created_at).toLocaleTimeString()}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-3">
          <div className="label-caps text-muted-foreground">New request</div>
          {eligibleTrailers.length === 0 ? (
            <div className="text-sm text-muted-foreground">No other trailers available.</div>
          ) : (
            <>
              <label className="block">
                <div className="label-caps text-muted-foreground mb-1">Trailer</div>
                <select value={trailerId} onChange={(e) => setTrailerId(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
                  {eligibleTrailers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="label-caps text-muted-foreground mb-1">Reason</div>
                <textarea
                  value={reason} onChange={(e) => setReason(e.target.value.slice(0, 1000))}
                  rows={3} placeholder="Why do you need access to this location?"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <div className="label-caps text-muted-foreground mb-1">Duration (minutes)</div>
                <input
                  type="number" min={15} max={480} value={duration}
                  onChange={(e) => setDuration(Math.min(480, Math.max(15, Number(e.target.value) || 60)))}
                  className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm">Cancel</button>
                <button
                  disabled={!trailerId || !reason.trim() || submit.isPending}
                  onClick={() => submit.mutate()}
                  className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Send request
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
