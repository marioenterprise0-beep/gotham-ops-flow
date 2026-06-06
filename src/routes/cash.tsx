import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill, MetricStat } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Banknote, Plus, Download, FileText, ShieldCheck, AlertTriangle, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import {
  listCashDrawers, addCashDrawer, openDrawerSession, closeDrawerSession,
  getDrawerSession, listDrawerSessions, submitCashDrop, verifyCashDrop, reviewDrawerSession,
} from "@/lib/cash.functions";
import { openPrintablePDF, kpiBlock, htmlTable, escapeHTML } from "@/lib/exports";

export const Route = createFileRoute("/cash")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Cash Management · Gotham OS" }] }),
  component: CashPage,
});

const money = (n: number | string | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function CashPage() {
  const qc = useQueryClient();
  const { roleId, trailerScope, homeTrailerId, trailers, session, loading } = useRole();
  const isManager = roleId === "owner" || roleId === "manager";
  const trailerId = trailerScope ?? homeTrailerId ?? null;
  const trailerName = trailers.find((t) => t.id === trailerId)?.name ?? "—";

  const listDrawersFn = useServerFn(listCashDrawers);
  const listSessionsFn = useServerFn(listDrawerSessions);

  const { data: drawers = [] } = useQuery<any[]>({
    queryKey: ["cash-drawers", trailerId ?? "none"],
    queryFn: () => listDrawersFn({ data: trailerId ? { trailerId } : {} }) as Promise<any[]>,
    enabled: !loading && !!session?.access_token,
    refetchInterval: 30000,
  });

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["cash-sessions", trailerId ?? "all"],
    queryFn: () => listSessionsFn({ data: { trailerId: trailerId ?? undefined, limit: 50 } }) as Promise<any[]>,
    enabled: !loading && !!session?.access_token,
    refetchInterval: 30000,
  });

  const openCount = drawers.filter((d) => d.open_session).length;
  const cashInDrawers = drawers.reduce((s, d) => s + (d.open_session ? Number(d.open_session.starting_float) : 0), 0);

  const [addOpen, setAddOpen] = useState(false);
  const [openFor, setOpenFor] = useState<any | null>(null);
  const [closeFor, setCloseFor] = useState<any | null>(null);
  const [dropFor, setDropFor] = useState<any | null>(null);
  const [detailFor, setDetailFor] = useState<string | null>(null);

  return (
    <AppShell>
      <SectionHeader eyebrow="Module" title="Cash Management" action={
        <div className="flex items-center gap-2">
          <StatusPill tone="gold">{trailerName}</StatusPill>
        </div>
      } />

      <Card className="mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricStat label="Open Drawers" value={String(openCount)} />
          <MetricStat label="Float In Drawers" value={money(cashInDrawers)} tone="gold" />
          <MetricStat label="Drawers Configured" value={String(drawers.length)} />
          <MetricStat label="Recent Sessions" value={String(sessions.length)} />
        </div>
      </Card>

      <SectionHeader title="Drawers" action={
        trailerId ? (
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Add Drawer
          </Button>
        ) : null
      } />

      {!trailerId && <Card>Select a trailer scope to manage drawers.</Card>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {drawers.map((d) => (
          <DrawerCard
            key={d.id}
            drawer={d}
            onOpen={() => qc.invalidateQueries({ queryKey: ["cash-drawers"] })}
            onClose={() => setCloseFor(d)}
            onDrop={() => setDropFor(d)}
            onView={(sid) => setDetailFor(sid)}
          />
        ))}
      </div>

      <SectionHeader title="Store Activities" />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 pr-3">Drawer</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Opened</th>
              <th className="py-2 pr-3">Closed</th>
              <th className="py-2 pr-3">Sales</th>
              <th className="py-2 pr-3">Counted</th>
              <th className="py-2 pr-3">Variance</th>
              <th className="py-2 pr-3">Review</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const drawer = drawers.find((d) => d.id === s.drawer_id);
              const v = Number(s.variance ?? 0);
              const tone = s.status === "open" ? "info" : v === 0 ? "success" : Math.abs(v) > 5 ? "danger" : "warning";
              return (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium">{drawer?.name ?? "—"}</td>
                  <td className="py-2 pr-3"><StatusPill tone={s.status === "open" ? "info" : s.status === "pending" ? "warning" : "neutral"}>{s.status}</StatusPill></td>
                  <td className="py-2 pr-3 text-muted-foreground">{new Date(s.opened_at).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{s.closed_at ? new Date(s.closed_at).toLocaleString() : "—"}</td>
                  <td className="py-2 pr-3">{s.total_cash_sales != null ? money(s.total_cash_sales) : "—"}</td>
                  <td className="py-2 pr-3">{s.counted_amount != null ? money(s.counted_amount) : "—"}</td>
                  <td className="py-2 pr-3">
                    {s.variance != null ? <StatusPill tone={tone as any}>{v >= 0 ? "+" : ""}{money(v)}</StatusPill> : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {s.status !== "open" ? <StatusPill tone={
                      s.owner_review === "approved" ? "success" :
                      s.owner_review === "correction" ? "warning" :
                      s.owner_review === "flagged" ? "danger" : "neutral"
                    }>{s.owner_review}</StatusPill> : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <button onClick={() => setDetailFor(s.id)} className="text-xs underline text-foreground/70 hover:text-foreground">Open</button>
                  </td>
                </tr>
              );
            })}
            {sessions.length === 0 && (
              <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">No drawer sessions yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {addOpen && trailerId && (
        <AddDrawerDialog trailerId={trailerId} onClose={() => setAddOpen(false)} onSaved={() => {
          setAddOpen(false);
          qc.invalidateQueries({ queryKey: ["cash-drawers"] });
        }} />
      )}
      {closeFor && (
        <CloseDrawerDialog
          drawer={closeFor}
          session={closeFor.open_session}
          onClose={() => setCloseFor(null)}
          onSaved={(sid) => {
            setCloseFor(null);
            qc.invalidateQueries({ queryKey: ["cash-drawers"] });
            qc.invalidateQueries({ queryKey: ["cash-sessions"] });
            setDetailFor(sid);
          }}
        />
      )}
      {dropFor && (
        <CashDropDialog
          drawer={dropFor}
          session={dropFor.open_session}
          onClose={() => setDropFor(null)}
          onSaved={() => {
            setDropFor(null);
            qc.invalidateQueries({ queryKey: ["cash-drawers"] });
          }}
        />
      )}
      {detailFor && (
        <SessionDetailDialog
          sessionId={detailFor}
          isManager={isManager}
          onClose={() => setDetailFor(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["cash-sessions"] });
            qc.invalidateQueries({ queryKey: ["cash-drawers"] });
          }}
        />
      )}
    </AppShell>
  );
}

function DrawerCard({ drawer, onOpen, onClose, onDrop, onView }: {
  drawer: any;
  onOpen: () => void;
  onClose: () => void;
  onDrop: () => void;
  onView: (sid: string) => void;
}) {
  const openFn = useServerFn(openDrawerSession);
  const openMu = useMutation({
    mutationFn: () => openFn({ data: { drawerId: drawer.id } }),
    onSuccess: () => { toast.success("Drawer opened"); onOpen(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to open"),
  });

  const isOpen = !!drawer.open_session;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-[var(--color-gold)]" />
            <h3 className="font-semibold text-lg">{drawer.name}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Float {money(drawer.starting_float)}</p>
        </div>
        <StatusPill tone={isOpen ? "success" : drawer.enabled ? "neutral" : "danger"}>
          {isOpen ? "Open" : drawer.enabled ? "Closed" : "Disabled"}
        </StatusPill>
      </div>

      {isOpen ? (
        <div className="text-xs text-muted-foreground border-t border-border pt-2">
          Opened {new Date(drawer.open_session.opened_at).toLocaleString()}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!isOpen && (
          <Button size="sm" variant="default" disabled={!drawer.enabled || openMu.isPending} onClick={() => openMu.mutate()}>
            Open Drawer
          </Button>
        )}
        {isOpen && (
          <>
            <Button size="sm" variant="default" onClick={onClose}>Close Drawer</Button>
            <Button size="sm" variant="outline" onClick={onDrop}>Cash Drop</Button>
            <Button size="sm" variant="ghost" onClick={() => onView(drawer.open_session.id)}>Activity</Button>
          </>
        )}
      </div>
    </Card>
  );
}

function AddDrawerDialog({ trailerId, onClose, onSaved }: { trailerId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [float, setFloat] = useState("150");
  const addFn = useServerFn(addCashDrawer);
  const mu = useMutation({
    mutationFn: () => addFn({ data: { trailerId, name: name.trim(), startingFloat: Number(float) || 0 } }),
    onSuccess: () => { toast.success("Drawer added"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Cash Drawer</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Drawer Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="pos1" maxLength={40} />
          </div>
          <div>
            <Label>Starting Float ($)</Label>
            <Input type="number" inputMode="decimal" value={float} onChange={(e) => setFloat(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mu.mutate()} disabled={!name.trim() || mu.isPending}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CashDropDialog({ drawer, session, onClose, onSaved }: { drawer: any; session: any; onClose: () => void; onSaved: () => void }) {
  const { user } = useRole();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const submit = useServerFn(submitCashDrop);
  const [savedDrop, setSavedDrop] = useState<any | null>(null);
  const mu = useMutation({
    mutationFn: () => submit({ data: { sessionId: session.id, amount: Number(amount), reason: reason || undefined, notes: notes || undefined } }),
    onSuccess: (drop: any) => {
      setSavedDrop(drop);
      toast.success(`Cash drop ${drop.drop_code} recorded`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const downloadSlip = () => {
    if (!savedDrop) return;
    printCashDropSlip({
      drop: savedDrop,
      drawerName: drawer.name,
      trailerName: drawer.trailer_id, // placeholder; full name resolved in detail view
      submittedBy: user,
      verifiedBy: null,
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && (savedDrop ? onSaved() : onClose())}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cash Drop — {drawer.name}</DialogTitle></DialogHeader>
        {!savedDrop ? (
          <div className="space-y-3">
            <div>
              <Label>Cash Drop Amount ($)</Label>
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Mid-shift drop" maxLength={200} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} />
            </div>
            <div className="text-xs text-muted-foreground">
              Submitted by <b>{user}</b> · Drawer <b>{drawer.name}</b> · {new Date().toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="rounded-md border border-border p-3 bg-secondary">
              <div className="text-xs text-muted-foreground">Drop ID</div>
              <div className="font-mono font-semibold text-lg">{savedDrop.drop_code}</div>
              <div className="mt-2 text-xs">Amount: <b>{money(savedDrop.amount)}</b></div>
            </div>
            <p className="text-xs text-muted-foreground">Drop saved and expected drawer amount updated.</p>
          </div>
        )}
        <DialogFooter>
          {!savedDrop ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => mu.mutate()} disabled={!Number(amount) || mu.isPending}>Submit Cash Drop</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={downloadSlip} className="gap-1">
                <Download className="h-4 w-4" /> Download Slip PDF
              </Button>
              <Button onClick={onSaved}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseDrawerDialog({ drawer, session, onClose, onSaved }: {
  drawer: any; session: any; onClose: () => void; onSaved: (sid: string) => void;
}) {
  const { user } = useRole();
  const [sales, setSales] = useState("");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [verification, setVerification] = useState<"self" | "requested">("self");

  const detailFn = useServerFn(getDrawerSession);
  const { data: detail } = useQuery<any>({
    queryKey: ["cash-session-pre", session.id],
    queryFn: () => detailFn({ data: { sessionId: session.id } }),
  });
  const drops = detail?.drops ?? [];
  const totalDrops = drops.reduce((s: number, d: any) => s + Number(d.amount), 0);

  const starting = Number(session.starting_float);
  const salesNum = Number(sales) || 0;
  const countedNum = Number(counted) || 0;
  // Correct model: float stays in drawer and is counted with the cash.
  const expectedDrawerTotal = starting + salesNum;
  const variance = countedNum - expectedDrawerTotal;
  const dropAmount = countedNum - starting;
  const remainingFloat = starting;
  const belowFloat = counted !== "" && countedNum < starting;
  const needsReason = variance !== 0;
  const canSubmit =
    sales !== "" && counted !== "" &&
    (!needsReason || reason.trim().length > 0) &&
    (!belowFloat || verification === "requested");

  const closeFn = useServerFn(closeDrawerSession);
  const mu = useMutation({
    mutationFn: () => closeFn({ data: {
      sessionId: session.id,
      totalCashSales: salesNum,
      countedAmount: countedNum,
      varianceReason: reason || undefined,
      varianceNotes: notes || undefined,
      verification,
    } }),
    onSuccess: () => { toast.success("Drawer closed"); onSaved(session.id); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Close Drawer — {drawer.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Card className="bg-secondary">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Starting Float</div><div className="font-semibold">{money(starting)}</div></div>
              <div><div className="text-xs text-muted-foreground">Mid-shift Drops</div><div className="font-semibold">{drops.length} · {money(totalDrops)}</div></div>
              <div><div className="text-xs text-muted-foreground">Remaining Float (target)</div><div className="font-semibold">{money(remainingFloat)}</div></div>
            </div>
          </Card>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Total Cash Sales From POS</Label>
              <Input type="number" inputMode="decimal" value={sales} onChange={(e) => setSales(e.target.value)} placeholder="550.00" autoFocus />
            </div>
            <div>
              <Label>Actual Cash Counted (includes float)</Label>
              <Input type="number" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="750.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3 bg-[#E8F0FE]">
              <div className="text-[10px] uppercase tracking-wider text-[#2D6CDF]">Actual Count</div>
              <div className="text-xl font-bold text-[#2D6CDF]">{money(countedNum)}</div>
            </div>
            <div className="rounded-lg border border-border p-3 bg-[var(--color-success-bg)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-success)]">Expected Drawer Total</div>
              <div className="text-xl font-bold text-[var(--color-success)]">{money(expectedDrawerTotal)}</div>
            </div>
            <div className={`rounded-lg border p-3 ${variance === 0 ? "border-border bg-secondary" : "border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)]"}`}>
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-danger)]">Variance</div>
              <div className={`text-xl font-bold ${variance === 0 ? "text-foreground" : "text-[var(--color-danger)]"}`}>
                {variance >= 0 ? "+" : ""}{money(variance)}
              </div>
            </div>
            <div className="rounded-lg border border-border p-3 bg-[var(--color-warning-bg,#FFF8E1)]">
              <div className="text-[10px] uppercase tracking-wider">Drop Amount</div>
              <div className="text-xl font-bold">{money(Math.max(0, dropAmount))}</div>
              <div className="text-[10px] text-muted-foreground">Remaining float {money(remainingFloat)}</div>
            </div>
          </div>

          {belowFloat && (
            <div className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)] p-3 text-sm text-[var(--color-danger)]">
              <b>Drawer below starting float.</b> Owner review is required — Request Verification is enforced.
            </div>
          )}

          {needsReason && (
            <>
              <div>
                <Label>Variance Reason {variance !== 0 && <span className="text-[var(--color-danger)]">*</span>}</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Short cause (e.g. wrong change given)" />
              </div>
              <div>
                <Label>Variance Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} />
              </div>
            </>
          )}

          <div>
            <Label>Verification</Label>
            <div className="flex gap-2 mt-1">
              <Button size="sm" variant={verification === "self" ? "default" : "outline"} disabled={belowFloat} onClick={() => setVerification("self")}>Self-Verify</Button>
              <Button size="sm" variant={verification === "requested" ? "default" : "outline"} onClick={() => setVerification("requested")}>Request Verification</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Closed by <b>{user}</b> · {new Date().toLocaleString()}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Go Back</Button>
          <Button onClick={() => mu.mutate()} disabled={!canSubmit || mu.isPending}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionDetailDialog({ sessionId, isManager, onClose, onChanged }: {
  sessionId: string; isManager: boolean; onClose: () => void; onChanged: () => void;
}) {
  const detailFn = useServerFn(getDrawerSession);
  const { data, refetch } = useQuery<any>({
    queryKey: ["cash-session", sessionId],
    queryFn: () => detailFn({ data: { sessionId } }),
  });

  const verifyFn = useServerFn(verifyCashDrop);
  const reviewFn = useServerFn(reviewDrawerSession);
  const [reviewNote, setReviewNote] = useState("");

  const verifyMu = useMutation({
    mutationFn: (dropId: string) => verifyFn({ data: { dropId } }),
    onSuccess: () => { toast.success("Drop verified"); refetch(); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const reviewMu = useMutation({
    mutationFn: (decision: "approved"|"correction"|"flagged") => reviewFn({ data: { sessionId, decision, note: reviewNote || undefined } }),
    onSuccess: () => { toast.success("Review saved"); refetch(); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (!data) return null;
  const { session: s, drawer, trailer, drops, names } = data;
  const totalDrops = drops.reduce((acc: number, d: any) => acc + Number(d.amount), 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Drawer Session — {drawer?.name ?? "—"}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <Card className="bg-secondary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Field label="Status" value={s.status} />
              <Field label="Trailer" value={trailer?.name ?? "—"} />
              <Field label="Opened" value={new Date(s.opened_at).toLocaleString()} />
              <Field label="Closed" value={s.closed_at ? new Date(s.closed_at).toLocaleString() : "—"} />
              <Field label="Opened By" value={names[s.opened_by] ?? "—"} />
              <Field label="Closed By" value={s.closed_by ? (names[s.closed_by] ?? "—") : "—"} />
              <Field label="Verification" value={s.verification} />
              <Field label="Owner Review" value={s.owner_review} />
            </div>
          </Card>

          {s.status !== "open" && (
            <Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Field label="Starting Float" value={money(s.starting_float)} />
                <Field label="Total Cash Sales From POS" value={money(s.total_cash_sales)} />
                <Field label="Expected Drawer Total" value={money(s.expected_amount)} />
                <Field label="Actual Cash Counted" value={money(s.counted_amount)} />
                <Field label="Variance" value={`${Number(s.variance) >= 0 ? "+" : ""}${money(s.variance)}`} />
                <Field label="Drop Amount" value={money(Math.max(0, Number(s.counted_amount ?? 0) - Number(s.starting_float)))} />
                <Field label="Remaining Float" value={money(s.starting_float)} />
                <Field label="Mid-shift Drops" value={`${drops.length} · ${money(totalDrops)}`} />
              </div>
              {s.variance_reason && (
                <div className="mt-2 text-sm text-muted-foreground">Reason / Notes: {s.variance_reason}</div>
              )}
            </Card>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Cash Drops ({drops.length})</h4>
              {s.status !== "open" && (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => printDrawerClose({
                  session: s, drawer, trailer, drops, names, totalDrops,
                })}>
                  <FileText className="h-4 w-4" /> Drawer Close PDF
                </Button>
              )}
            </div>
            {drops.length === 0 ? (
              <Card className="text-sm text-muted-foreground">No cash drops in this session.</Card>
            ) : (
              <div className="space-y-2">
                {drops.map((d: any) => (
                  <Card key={d.id} className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-mono text-xs text-muted-foreground">{d.drop_code}</div>
                      <div className="font-semibold">{money(d.amount)} <span className="text-xs text-muted-foreground font-normal">· {d.reason || "—"}</span></div>
                      <div className="text-xs text-muted-foreground">
                        By {names[d.submitted_by] ?? "—"} · {new Date(d.submitted_at).toLocaleString()}
                        {d.verified_by && <> · ✅ Verified by {names[d.verified_by] ?? "—"}</>}
                      </div>
                      {d.notes && <div className="text-xs mt-1">{d.notes}</div>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => printCashDropSlip({
                        drop: d, drawerName: drawer?.name ?? "—",
                        trailerName: trailer?.name ?? "—",
                        submittedBy: names[d.submitted_by] ?? "—",
                        verifiedBy: d.verified_by ? (names[d.verified_by] ?? null) : null,
                      })}>
                        <Download className="h-3 w-3" /> Slip
                      </Button>
                      {isManager && !d.verified_by && (
                        <Button size="sm" className="gap-1" onClick={() => verifyMu.mutate(d.id)}>
                          <ShieldCheck className="h-3 w-3" /> Verify
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {isManager && s.status !== "open" && (
            <Card goldAccent>
              <h4 className="font-semibold mb-2">Owner Review</h4>
              <Textarea placeholder="Note (optional)" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} maxLength={1000} />
              <div className="flex flex-wrap gap-2 mt-2">
                <Button size="sm" className="gap-1" onClick={() => reviewMu.mutate("approved")}><Check className="h-3 w-3" /> Approve</Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => reviewMu.mutate("correction")}><Clock className="h-3 w-3" /> Request Correction</Button>
                <Button size="sm" variant="destructive" className="gap-1" onClick={() => reviewMu.mutate("flagged")}><AlertTriangle className="h-3 w-3" /> Flag</Button>
              </div>
              {s.owner_note && <p className="text-xs text-muted-foreground mt-2">Last note: {s.owner_note}</p>}
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="h-4 w-4 mr-1" /> Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}

// ---------------- PDFs ----------------

function printCashDropSlip(p: {
  drop: any; drawerName: string; trailerName: string; submittedBy: string; verifiedBy: string | null;
}) {
  const d = p.drop;
  const when = new Date(d.submitted_at);
  const body = `
    <h1>Cash Drop Slip</h1>
    <div class="meta">Gotham Halal · Cash Management</div>
    ${kpiBlock([
      { label: "Drop ID", value: d.drop_code },
      { label: "Amount", value: `$${Number(d.amount).toFixed(2)}`, tone: "warn" },
      { label: "Date", value: when.toLocaleDateString() },
      { label: "Time", value: when.toLocaleTimeString() },
    ])}
    <h2>Details</h2>
    ${htmlTable(
      ["Field", "Value"],
      [
        ["Business", "Gotham Halal"],
        ["Module", "Cash Management"],
        ["Type", "Cash Drop Slip"],
        ["Location / Trailer", p.trailerName],
        ["Drawer", p.drawerName],
        ["Cash Drop Amount", `$${Number(d.amount).toFixed(2)}`],
        ["Reason", d.reason || "—"],
        ["Notes", d.notes || "—"],
        ["Submitted By", p.submittedBy],
        ["Manager Verified By", p.verifiedBy || "— Not yet verified —"],
        ["Unique Drop ID", d.drop_code],
      ],
    )}
    <h2>Signature / Confirmation</h2>
    <div style="margin-top:24px; display:flex; gap:40px;">
      <div style="flex:1;"><div style="border-top:1px solid #000; padding-top:4px; font-size:10px;">Submitter Signature</div></div>
      <div style="flex:1;"><div style="border-top:1px solid #000; padding-top:4px; font-size:10px;">Manager Signature</div></div>
    </div>
  `;
  openPrintablePDF(`Cash Drop Slip — ${d.drop_code}`, body);
}

function printDrawerClose(p: { session: any; drawer: any; trailer: any; drops: any[]; names: Record<string, string>; totalDrops: number }) {
  const s = p.session;
  const v = Number(s.variance ?? 0);
  const starting = Number(s.starting_float);
  const counted = Number(s.counted_amount ?? 0);
  const expected = Number(s.expected_amount ?? 0);
  const dropAmount = Math.max(0, counted - starting);
  const dropRows = p.drops.map((d) => [
    d.drop_code,
    `$${Number(d.amount).toFixed(2)}`,
    new Date(d.submitted_at).toLocaleString(),
    p.names[d.submitted_by] ?? "—",
    d.verified_by ? (p.names[d.verified_by] ?? "—") : "—",
    d.reason || "—",
    d.notes || "—",
  ]);
  const body = `
    <h1>Drawer Close Report</h1>
    <div class="meta">Gotham Halal · ${escapeHTML(p.trailer?.name ?? "—")} · Drawer ${escapeHTML(p.drawer?.name ?? "—")}</div>
    ${kpiBlock([
      { label: "Starting Float", value: `$${starting.toFixed(2)}` },
      { label: "Total Cash Sales From POS", value: `$${Number(s.total_cash_sales ?? 0).toFixed(2)}` },
      { label: "Expected Drawer Total", value: `$${expected.toFixed(2)}` },
      { label: "Actual Cash Counted", value: `$${counted.toFixed(2)}` },
    ])}
    ${kpiBlock([
      { label: "Variance", value: `${v >= 0 ? "+" : ""}$${v.toFixed(2)}`, tone: v === 0 ? "ok" : "danger" },
      { label: "Drop Amount", value: `$${dropAmount.toFixed(2)}` },
      { label: "Remaining Float", value: `$${starting.toFixed(2)}` },
      { label: "Owner Review", value: String(s.owner_review) },
    ])}
    <h2>Session</h2>
    ${htmlTable(["Field","Value"], [
      ["Opened At", new Date(s.opened_at).toLocaleString()],
      ["Opened By", p.names[s.opened_by] ?? "—"],
      ["Closed At", s.closed_at ? new Date(s.closed_at).toLocaleString() : "—"],
      ["Submitted By (Closed By)", s.closed_by ? (p.names[s.closed_by] ?? "—") : "—"],
      ["Verified By (Owner Reviewer)", s.owner_reviewed_by ? (p.names[s.owner_reviewed_by] ?? "—") : "—"],
      ["Verification", String(s.verification)],
      ["Variance Reason / Notes", s.variance_reason ?? "—"],
      ["Owner Note", s.owner_note ?? "—"],
      ["Owner Review Status", String(s.owner_review)],
    ])}
    <h2>Mid-shift Cash Drops (${p.drops.length})</h2>
    ${p.drops.length ? htmlTable(["Drop ID","Amount","Time","Submitted By","Verified By","Reason","Notes"], dropRows) : '<p style="color:#666;font-size:11px;">No mid-shift drops in this session.</p>'}
  `;
  openPrintablePDF(`Drawer Close — ${p.drawer?.name ?? "drawer"}`, body);
}
