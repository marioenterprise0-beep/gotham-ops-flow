import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { getLaborDashboard, getEmployeeWeek, ownerEditPunch, decideCorrection, decideTimeOff, listAllRequests, getPayrollDetail } from "@/lib/labor.functions";
import { ChevronLeft, ChevronRight, Check, X, MessageSquare, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn, fmtTime12 } from "@/lib/utils";
import { downloadCSV, openPrintablePDF, htmlTable, kpiBlock, escapeHTML } from "@/lib/exports";
import { syncDomains } from "@/lib/sync-bus";

export const Route = createFileRoute("/labor")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Labor · Gotham OS" }] }),
  component: LaborPage,
});

function fmtH(min: number) {
  const sign = min < 0 ? "-" : "";
  const m = Math.abs(min);
  return `${sign}${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
}

function weekStartOf(d: Date): string {
  const dt = new Date(d);
  const back = (dt.getDay() + 1) % 7;
  dt.setDate(dt.getDate() - back);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

function shiftWeek(ws: string, deltaDays: number): string {
  const d = new Date(ws + "T00:00:00");
  d.setDate(d.getDate() + deltaDays);
  return weekStartOf(d);
}

function LaborPage() {
  const { roleId, trailerScope } = useRole();
  if (roleId !== "owner" && roleId !== "manager") return <Navigate to="/" />;
  const isOwner = roleId === "owner";

  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);

  const dashFn = useServerFn(getLaborDashboard);
  const reqFn = useServerFn(listAllRequests);
  const { data: dash } = useQuery({
    queryKey: ["labor-dash", weekStart, trailerScope],
    queryFn: () => dashFn({ data: { weekStart, trailerId: trailerScope ?? null } }),
  });
  const { data: reqs } = useQuery({
    queryKey: ["labor-reqs", trailerScope],
    queryFn: () => reqFn({ data: { trailerId: trailerScope ?? null } }),
  });

  const weekEnd = new Date(weekStart + "T00:00:00");
  weekEnd.setDate(weekEnd.getDate() + 6);
  const rangeLabel = `${new Date(weekStart + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="label-caps text-muted-foreground">Payroll week · Sat – Fri</div>
          <h1 className="font-display text-3xl text-foreground">LABOR</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(shiftWeek(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-sm font-medium px-3">{rangeLabel}</div>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(shiftWeek(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" disabled={!dash} onClick={() => exportLaborCSV(weekStart, dash)}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" disabled={!dash} onClick={() => exportLaborPDF(weekStart, rangeLabel, dash)}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          <PayrollExportButton weekStart={weekStart} />
        </div>
      </div>

      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <KPI label="Scheduled" value={fmtH(dash.totals.scheduled)} />
          <KPI label="Worked" value={fmtH(dash.totals.worked)} />
          <KPI label="Difference" value={fmtH(dash.totals.worked - dash.totals.scheduled)} />
          <KPI label="Open shifts" value={String(dash.openShifts)} />
          <KPI label="Missed clock-outs" value={String(dash.missedClockOuts)} tone={dash.missedClockOuts ? "warning" : "default"} />
          <KPI label="Pending corrections" value={String(dash.pendingCorrections)} tone={dash.pendingCorrections ? "warning" : "default"} />
          <KPI label="Pending time off" value={String(dash.pendingTimeOff)} tone={dash.pendingTimeOff ? "warning" : "default"} />
          <KPI label="Payroll-ready" value={fmtH(dash.totals.worked)} />
        </div>
      )}

      <Tabs defaultValue="employees" className="mt-6">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="corrections">Corrections {dash?.pendingCorrections ? `(${dash.pendingCorrections})` : ""}</TabsTrigger>
          <TabsTrigger value="timeoff">Time Off {dash?.pendingTimeOff ? `(${dash.pendingTimeOff})` : ""}</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card className="p-0 overflow-hidden">
            {(dash?.employees ?? []).length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No employees this week.</div>}
            {(dash?.employees ?? []).map((e: any, i: number) => {
              const status = e.flags.includes("missed_clock_out") || e.flags.includes("no_show")
                ? "danger" : e.flags.includes("overtime") ? "warning" : "success";
              return (
                <button key={e.id}
                  onClick={() => isOwner && setSelectedEmp(e.id === selectedEmp ? null : e.id)}
                  disabled={!isOwner}
                  title={isOwner ? "View / edit punches" : "Owner only"}
                  className={cn("w-full text-left p-3.5 flex items-center justify-between gap-3", isOwner ? "hover:bg-secondary/50 cursor-pointer" : "cursor-default", i && "border-t border-border")}>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Scheduled {fmtH(e.scheduledMin)} · Worked {fmtH(e.workedMin)} · Diff {fmtH(e.diffMin)}
                    </div>
                    {e.flags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {e.flags.map((f: string) => <StatusPill key={f} tone="warning">{f.replace(/_/g, " ")}</StatusPill>)}
                      </div>
                    )}
                  </div>
                  <StatusPill tone={status as any}>{status === "success" ? "OK" : status === "warning" ? "Review" : "Needs review"}</StatusPill>
                </button>
              );
            })}
          </Card>
          {isOwner && selectedEmp && <EmployeeDrawer userId={selectedEmp} weekStart={weekStart} isOwner={isOwner} onClose={() => setSelectedEmp(null)} />}
        </TabsContent>

        <TabsContent value="corrections">
          <CorrectionsList items={reqs?.corrections ?? []} isOwner={isOwner} />
        </TabsContent>
        <TabsContent value="timeoff">
          <TimeOffList items={reqs?.timeoff ?? []} isOwner={isOwner} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesList items={reqs?.notes ?? []} />
        </TabsContent>
      </Tabs>

      <div className="h-6" />
    </AppShell>
  );
}

function KPI({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <Card className="p-3">
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-display", tone === "warning" ? "text-[var(--color-danger)]" : "text-foreground")}>{value}</div>
    </Card>
  );
}

function EmployeeDrawer({ userId, weekStart, isOwner, onClose }: { userId: string; weekStart: string; isOwner: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(getEmployeeWeek);
  const editFn = useServerFn(ownerEditPunch);
  const { data } = useQuery({ queryKey: ["emp-week", userId, weekStart], queryFn: () => fn({ data: { userId, weekStart } }) });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ in: string; out: string; brk: number; reason: string }>({ in: "", out: "", brk: 0, reason: "" });

  const saveM = useMutation({
    mutationFn: () => editFn({
      data: {
        punchId: editing!,
        clockInAt: draft.in ? new Date(draft.in).toISOString() : undefined,
        clockOutAt: draft.out ? new Date(draft.out).toISOString() : undefined,
        breakMinutes: draft.brk,
        reason: draft.reason || "Owner edit",
      },
    }),
    onSuccess: () => { toast.success("Punch updated"); setEditing(null); syncDomains(qc, "labor", "timeclock"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mt-4 p-4">
      <div className="flex items-center justify-between">
        <div className="font-display text-lg">Punches</div>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      {(data?.punches ?? []).length === 0 && <div className="text-sm text-muted-foreground py-3">No punches this week.</div>}
      {(data?.punches ?? []).map((p: any) => {
        const isEdit = editing === p.id;
        return (
          <div key={p.id} className="border-t border-border py-3 text-sm">
            {!isEdit ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{new Date(p.clock_in_at).toLocaleString()} → {p.clock_out_at ? new Date(p.clock_out_at).toLocaleString() : "—"}</div>
                  <div className="text-xs text-muted-foreground">Break {p.break_minutes}m · {p.status}</div>
                </div>
                {isOwner && (
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditing(p.id);
                    setDraft({
                      in: new Date(p.clock_in_at).toISOString().slice(0, 16),
                      out: p.clock_out_at ? new Date(p.clock_out_at).toISOString().slice(0, 16) : "",
                      brk: p.break_minutes ?? 0,
                      reason: "",
                    });
                  }}>Edit</Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Clock in</Label><Input type="datetime-local" value={draft.in} onChange={(e) => setDraft({ ...draft, in: e.target.value })} /></div>
                <div><Label>Clock out</Label><Input type="datetime-local" value={draft.out} onChange={(e) => setDraft({ ...draft, out: e.target.value })} /></div>
                <div><Label>Break (min)</Label><Input type="number" value={draft.brk} onChange={(e) => setDraft({ ...draft, brk: Number(e.target.value) })} /></div>
                <div><Label>Reason</Label><Input value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></div>
                <div className="col-span-2 flex gap-2">
                  <Button size="sm" onClick={() => saveM.mutate()} disabled={saveM.isPending}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {(data?.notes ?? []).length > 0 && (
        <>
          <div className="mt-4 font-display text-lg">Notes</div>
          {data!.notes.map((n: any) => (
            <div key={n.id} className="border-t border-border py-2 text-sm">
              <div>{n.note}</div>
              <div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}

function DecisionButtons({ id, isOwner, decideFn, qkey }: { id: string; isOwner: boolean; decideFn: any; qkey: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(decideFn);
  const m = useMutation({
    mutationFn: (decision: "approved" | "declined") => fn({ data: { id, decision } }),
    onSuccess: () => { toast.success("Decision recorded"); qc.invalidateQueries({ queryKey: [qkey] }); syncDomains(qc, "labor", "alerts"); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!isOwner) return <StatusPill tone="warning">Owner approval required</StatusPill>;
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => m.mutate("approved")} disabled={m.isPending}><Check className="h-3.5 w-3.5" /> Approve</Button>
      <Button size="sm" variant="outline" onClick={() => m.mutate("declined")} disabled={m.isPending}><X className="h-3.5 w-3.5" /> Decline</Button>
    </div>
  );
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CorrectionRow({ c, isOwner }: { c: any; isOwner: boolean }) {
  const qc = useQueryClient();
  const decideFn = useServerFn(decideCorrection);
  const [editing, setEditing] = useState(false);
  const [inVal, setInVal] = useState(toLocalInput(c.requested_in));
  const [outVal, setOutVal] = useState(toLocalInput(c.requested_out));
  const [brk, setBrk] = useState<number>(c.current_punch?.break_minutes ?? 0);
  const [note, setNote] = useState("");

  const m = useMutation({
    mutationFn: (decision: "approved" | "declined") => decideFn({
      data: {
        id: c.id,
        decision,
        note: note || undefined,
        requestedIn: inVal ? new Date(inVal).toISOString() : null,
        requestedOut: outVal ? new Date(outVal).toISOString() : null,
        breakMinutes: Number.isFinite(brk) ? brk : 0,
      },
    }),
    onSuccess: () => { toast.success("Decision recorded"); setEditing(false); qc.invalidateQueries({ queryKey: ["labor-reqs"] }); syncDomains(qc, "labor", "timeclock", "alerts"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cp = c.current_punch;

  return (
    <div className="p-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-0.5">
          <div className="text-sm font-semibold">{c.employee_name} · {c.type.replace(/_/g, " ")}</div>
          <div className="text-xs text-muted-foreground">For {c.for_date} · {c.reason}</div>
          {cp && (
            <div className="text-xs text-muted-foreground">
              On record: {new Date(cp.clock_in_at).toLocaleString()} → {cp.clock_out_at ? new Date(cp.clock_out_at).toLocaleString() : <span className="text-[var(--color-warning)]">open</span>}
              {" "}· break {cp.break_minutes ?? 0}m
            </div>
          )}
          {(c.requested_in || c.requested_out) && (
            <div className="text-xs font-medium text-[var(--color-gold)]">
              Requested: {c.requested_in ? new Date(c.requested_in).toLocaleString() : "—"} → {c.requested_out ? new Date(c.requested_out).toLocaleString() : "—"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill tone={c.status === "approved" ? "success" : c.status === "declined" ? "danger" : "warning"}>{c.status}</StatusPill>
          {c.status === "pending" && isOwner && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Review &amp; edit</Button>
          )}
          {c.status === "pending" && !isOwner && <StatusPill tone="warning">Owner approval required</StatusPill>}
        </div>
      </div>

      {editing && isOwner && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-border bg-secondary/30 p-3">
          <div><Label className="text-xs">Clock in</Label><Input type="datetime-local" value={inVal} onChange={(e) => setInVal(e.target.value)} /></div>
          <div><Label className="text-xs">Clock out</Label><Input type="datetime-local" value={outVal} onChange={(e) => setOutVal(e.target.value)} /></div>
          <div><Label className="text-xs">Break (min)</Label><Input type="number" min={0} value={brk} onChange={(e) => setBrk(Number(e.target.value))} /></div>
          <div><Label className="text-xs">Note (optional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for your adjustment" /></div>
          <div className="sm:col-span-2 flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => m.mutate("approved")} disabled={m.isPending}><Check className="h-3.5 w-3.5 mr-1" /> Approve with these times</Button>
            <Button size="sm" variant="outline" onClick={() => m.mutate("declined")} disabled={m.isPending}><X className="h-3.5 w-3.5 mr-1" /> Decline</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={m.isPending}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CorrectionsList({ items, isOwner }: { items: any[]; isOwner: boolean }) {
  if (items.length === 0) return <Card className="mt-3 p-6 text-center text-sm text-muted-foreground">No corrections.</Card>;
  return (
    <Card className="mt-3 p-0 overflow-hidden">
      {items.map((c, i) => (
        <div key={c.id} className={cn(i && "border-t border-border")}>
          <CorrectionRow c={c} isOwner={isOwner} />
        </div>
      ))}
    </Card>
  );
}

function TimeOffList({ items, isOwner }: { items: any[]; isOwner: boolean }) {
  if (items.length === 0) return <Card className="mt-3 p-6 text-center text-sm text-muted-foreground">No time off requests.</Card>;
  return (
    <Card className="mt-3 p-0 overflow-hidden">
      {items.map((t, i) => (
        <div key={t.id} className={cn("p-3.5", i && "border-t border-border")}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t.employee_name} · {t.start_date} → {t.end_date}</div>
              <div className="text-xs text-muted-foreground">{t.full_day ? "Full day(s)" : `${fmtTime12(t.start_time)} – ${fmtTime12(t.end_time)}`} · {t.reason}</div>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill tone={t.status === "approved" ? "success" : t.status === "declined" ? "danger" : "warning"}>{t.status}</StatusPill>
              {t.status === "pending" && <DecisionButtons id={t.id} isOwner={isOwner} decideFn={decideTimeOff} qkey="labor-reqs" />}
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function NotesList({ items }: { items: any[] }) {
  if (items.length === 0) return <Card className="mt-3 p-6 text-center text-sm text-muted-foreground">No notes.</Card>;
  return (
    <Card className="mt-3 p-0 overflow-hidden">
      {items.map((n, i) => (
        <div key={n.id} className={cn("p-3.5", i && "border-t border-border")}>
          <div className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />{n.employee_name}</div>
          <div className="text-sm mt-1">{n.note}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
        </div>
      ))}
    </Card>
  );
}

function PayrollExportButton({ weekStart }: { weekStart: string }) {
  const fn = useServerFn(getPayrollDetail);
  const [busy, setBusy] = useState(false);
  const handleExport = async () => {
    setBusy(true);
    try {
      const detail = await fn({ data: { weekStart } }) as any;
      exportPayrollCSV(weekStart, detail);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally { setBusy(false); }
  };
  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={busy}>
      <Download className="h-4 w-4 mr-1" />{busy ? "…" : "Payroll"}
    </Button>
  );
}

function exportPayrollCSV(weekStart: string, detail: any) {
  const rows: (string | number | null | undefined)[][] = [];
  for (const emp of detail.employees ?? []) {
    let regMin = 0, otMin = 0;
    for (const p of emp.punches ?? []) {
      if (!p.clock_out_at) continue;
      const diffMin = (new Date(p.clock_out_at).getTime() - new Date(p.clock_in_at).getTime()) / 60000;
      const netMin = Math.max(0, diffMin - (p.break_minutes ?? 0));
      const dailyReg = Math.min(netMin, 8 * 60);
      const dailyOT  = Math.max(0, netMin - 8 * 60);
      regMin += dailyReg; otMin += dailyOT;
      rows.push([
        emp.name, emp.id,
        new Date(p.clock_in_at).toLocaleDateString(),
        new Date(p.clock_in_at).toLocaleTimeString(),
        p.clock_out_at ? new Date(p.clock_out_at).toLocaleTimeString() : "Open",
        (netMin / 60).toFixed(2),
        (dailyReg / 60).toFixed(2),
        (dailyOT / 60).toFixed(2),
        p.break_minutes ?? 0,
        p.status,
      ]);
    }
    // Subtotal row per employee
    rows.push([
      `TOTAL — ${emp.name}`, emp.id, "", "", "",
      ((regMin + otMin) / 60).toFixed(2),
      (regMin / 60).toFixed(2),
      (otMin / 60).toFixed(2),
      "", "",
    ]);
    rows.push([]); // spacer
  }
  downloadCSV(
    `payroll-${weekStart}.csv`,
    ["Employee", "Employee ID", "Date", "Clock In", "Clock Out", "Net Hours", "Regular (h)", "OT (h)", "Break (min)", "Status"],
    rows,
  );
}

function exportLaborCSV(weekStart: string, dash: any) {
  const rows = (dash.employees ?? []).map((e: any) => [
    e.name,
    (e.scheduledMin / 60).toFixed(2),
    (e.workedMin / 60).toFixed(2),
    (e.diffMin / 60).toFixed(2),
    e.openPunch ? "yes" : "no",
    (e.flags ?? []).join("; "),
  ]);
  rows.push([
    "TOTAL",
    (dash.totals.scheduled / 60).toFixed(2),
    (dash.totals.worked / 60).toFixed(2),
    ((dash.totals.worked - dash.totals.scheduled) / 60).toFixed(2),
    "",
    "",
  ]);
  downloadCSV(
    `labor-${weekStart}.csv`,
    ["Employee", "Scheduled (h)", "Worked (h)", "Diff (h)", "Open Punch", "Flags"],
    rows,
  );
}

function exportLaborPDF(weekStart: string, rangeLabel: string, dash: any) {
  const rows = (dash.employees ?? []).map((e: any) => [
    e.name,
    (e.scheduledMin / 60).toFixed(2) + "h",
    (e.workedMin / 60).toFixed(2) + "h",
    (e.diffMin / 60).toFixed(2) + "h",
    (e.flags ?? []).join(", ") || "—",
  ]);
  const html = `
    <h1>Labor — Week of ${escapeHTML(rangeLabel)}</h1>
    <div class="meta">Week start ${escapeHTML(weekStart)} · Payroll Sat–Fri</div>
    ${kpiBlock([
      { label: "Scheduled", value: (dash.totals.scheduled / 60).toFixed(1) + "h" },
      { label: "Worked", value: (dash.totals.worked / 60).toFixed(1) + "h" },
      { label: "Difference", value: ((dash.totals.worked - dash.totals.scheduled) / 60).toFixed(1) + "h" },
      { label: "Open Shifts", value: dash.openShifts ?? 0 },
      { label: "Missed Clock-outs", value: dash.missedClockOuts ?? 0, tone: dash.missedClockOuts ? "danger" : "ok" },
      { label: "Pending Corrections", value: dash.pendingCorrections ?? 0, tone: dash.pendingCorrections ? "warn" : "ok" },
      { label: "Pending Time Off", value: dash.pendingTimeOff ?? 0, tone: dash.pendingTimeOff ? "warn" : "ok" },
      { label: "Employees", value: dash.employees?.length ?? 0 },
    ])}
    <h2>Employees</h2>
    ${htmlTable(["Employee", "Scheduled", "Worked", "Diff", "Flags"], rows)}
  `;
  openPrintablePDF(`Labor ${weekStart}`, html);
}
