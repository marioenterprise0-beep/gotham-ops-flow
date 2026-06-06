import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Lock, Unlock, Send, Check, Upload, Trash2,
  Copy, Sparkles, Plus, Calendar as CalIcon, RotateCcw, Filter,
} from "lucide-react";
import { Card, StatusPill } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/lib/role";
import { AppShell } from "@/components/gotham/AppShell";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getSchedule, upsertShift, deleteShift, duplicateShift,
  transitionSchedule, listEmployees, deleteSchedule,
  getOrCreateScheduleForRange, generateCoverage,
} from "@/lib/schedule.functions";

export const Route = createFileRoute("/schedule")({ component: SchedulePage });

type Status = "draft" | "submitted" | "approved" | "locked" | "published";
type ViewMode = "day" | "week" | "twoweek" | "month";

const STATUS_TONE: Record<Status, "neutral" | "warning" | "success" | "danger" | "info"> = {
  draft: "neutral", submitted: "warning", approved: "success", locked: "danger", published: "info",
};
const SEGMENTS = ["open", "mid", "close", "custom"] as const;
const ROLES = ["owner", "manager", "shift_lead", "grill", "prep", "cashier"] as const;

// Segment palette (Gotham identity)
const SEG_BG: Record<string, string> = {
  open:   "var(--color-success)",
  mid:    "var(--color-gold)",
  close:  "#0A0A0A",
  custom: "#6B6B6B",
};
const SEG_FG: Record<string, string> = {
  open: "#0E3B22", mid: "var(--color-gold-foreground)", close: "#FFFFFF", custom: "#FFFFFF",
};

// ---------- date helpers ----------
function startOfWeek(d: Date) {
  const x = new Date(d); const day = x.getDay(); // Sun=0
  x.setDate(x.getDate() - day); x.setHours(0,0,0,0); return x;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmt(d: Date) { return d.toISOString().slice(0,10); }
function rangeDays(start: string, end: string) {
  const out: string[] = []; const s = new Date(start + "T00:00:00"); const e = new Date(end + "T00:00:00");
  for (let d = new Date(s); d <= e; d = addDays(d, 1)) out.push(fmt(d));
  return out;
}
function hoursBetween(a: string, b: string, breakMin: number) {
  const [ah, am] = a.split(":").map(Number); const [bh, bm] = b.split(":").map(Number);
  const mins = (bh * 60 + bm) - (ah * 60 + am) - breakMin;
  return Math.max(0, mins / 60);
}
function viewRange(anchor: Date, mode: ViewMode): { start: Date; end: Date } {
  if (mode === "day") return { start: anchor, end: anchor };
  if (mode === "week") { const s = startOfWeek(anchor); return { start: s, end: addDays(s, 6) }; }
  if (mode === "twoweek") { const s = startOfWeek(anchor); return { start: s, end: addDays(s, 13) }; }
  const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const e = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: s, end: e };
}
function rangeLabel(start: Date, end: Date, mode: ViewMode) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (mode === "month") return start.toLocaleDateString([], { month: "long", year: "numeric" });
  if (mode === "day") return start.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  return `${start.toLocaleDateString([], opts)} – ${end.toLocaleDateString([], { ...opts, year: "numeric" })}`;
}

// ============================================================
function SchedulePage() {
  const { roleId } = useRole();
  const isOwner = roleId === "owner";
  const isMgr = isOwner || roleId === "manager";
  const qc = useQueryClient();

  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [mode, setMode] = useState<ViewMode>("week");
  const [filterRole, setFilterRole] = useState<string>("all");

  const { start, end } = useMemo(() => viewRange(anchor, mode), [anchor, mode]);
  const startStr = fmt(start), endStr = fmt(end);

  const findOrCreate = useServerFn(getOrCreateScheduleForRange);
  const { data: schedule, refetch: refetchSched } = useQuery({
    queryKey: ["schedule-range", startStr, endStr],
    queryFn: () => findOrCreate({ data: { startDate: startStr, endDate: endStr, autoCreate: false } }),
  });

  const createMut = useMutation({
    mutationFn: () => findOrCreate({ data: { startDate: startStr, endDate: endStr, autoCreate: true } }),
    onSuccess: () => { toast.success("Draft schedule created"); refetchSched(); qc.invalidateQueries({ queryKey: ["schedule-range"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const shift = (n: number) => {
    const step = mode === "day" ? 1 : mode === "week" ? 7 : mode === "twoweek" ? 14 : 30;
    const next = mode === "month"
      ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1)
      : addDays(anchor, n * step);
    setAnchor(next);
  };

  return (
    <AppShell>
      <div className="-mx-4 px-4">
        <HeaderBar
          anchor={anchor} setAnchor={setAnchor} mode={mode} setMode={setMode}
          start={start} end={end} schedule={schedule}
          filterRole={filterRole} setFilterRole={setFilterRole}
          isOwner={isOwner} isMgr={isMgr}
          onPrev={() => shift(-1)} onNext={() => shift(1)} onToday={() => setAnchor(new Date())}
        />

        {!schedule ? (
          <Card className="mt-3">
            <div className="py-10 text-center">
              <CalIcon className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <div className="font-display text-lg">No schedule for this range</div>
              <div className="text-sm text-muted-foreground mt-1 mb-4">
                {rangeLabel(start, end, mode)}
              </div>
              {isMgr ? (
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}
                  className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)] hover:opacity-90">
                  <Plus className="h-4 w-4 mr-1.5" /> Create Draft for This Range
                </Button>
              ) : (
                <div className="text-xs text-muted-foreground">A manager will publish one soon.</div>
              )}
            </div>
          </Card>
        ) : (
          <ScheduleBoard
            scheduleId={schedule.id} startStr={startStr} endStr={endStr}
            filterRole={filterRole} isOwner={isOwner} isMgr={isMgr}
          />
        )}
      </div>
    </AppShell>
  );
}

// ============================================================
function HeaderBar({
  anchor, setAnchor, mode, setMode, start, end, schedule,
  filterRole, setFilterRole, isOwner, isMgr, onPrev, onNext, onToday,
}: any) {
  const status = (schedule?.status ?? null) as Status | null;
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        {/* Left: week nav */}
        <div className="flex items-center gap-2 min-w-0">
          <Button size="icon" variant="outline" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-[180px] text-center">
            <div className="font-display text-base leading-tight truncate">{rangeLabel(start, end, mode)}</div>
            <button onClick={onToday} className="text-[10px] label-caps text-muted-foreground hover:text-[var(--color-gold)] transition">Jump to Today</button>
          </div>
          <Button size="icon" variant="outline" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
          <Input
            type="date" value={fmt(anchor)} onChange={(e) => setAnchor(new Date(e.target.value + "T00:00:00"))}
            className="w-[150px] hidden md:block"
          />
        </div>

        {/* Center: schedule status */}
        <div className="flex items-center gap-2">
          {schedule && (
            <>
              <span className="text-sm font-medium hidden sm:inline truncate max-w-[160px]">{schedule.name}</span>
              <StatusPill tone={STATUS_TONE[status!]}>{status}</StatusPill>
            </>
          )}
        </div>

        {/* Right: view mode + filters */}
        <div className="flex items-center gap-2">
          <ViewModeToggle mode={mode} setMode={setMode} />
          <div className="hidden md:flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {schedule && (
        <WorkflowActions schedule={schedule} isOwner={isOwner} isMgr={isMgr} />
      )}
    </Card>
  );
}

function ViewModeToggle({ mode, setMode }: { mode: ViewMode; setMode: (m: ViewMode) => void }) {
  const opts: { id: ViewMode; label: string }[] = [
    { id: "day", label: "Day" }, { id: "week", label: "Week" },
    { id: "twoweek", label: "2 Wk" }, { id: "month", label: "Month" },
  ];
  return (
    <div className="inline-flex rounded-md border border-border bg-background overflow-hidden">
      {opts.map((o) => (
        <button key={o.id} onClick={() => setMode(o.id)}
          className={cn(
            "px-2.5 py-1.5 text-xs font-medium transition",
            mode === o.id
              ? "bg-[var(--color-gold)] text-[var(--color-gold-foreground)]"
              : "text-muted-foreground hover:bg-secondary",
          )}>{o.label}</button>
      ))}
    </div>
  );
}

function WorkflowActions({ schedule, isOwner, isMgr }: { schedule: any; isOwner: boolean; isMgr: boolean }) {
  const qc = useQueryClient();
  const transition = useServerFn(transitionSchedule);
  const removeSchedule = useServerFn(deleteSchedule);
  const status = schedule.status as Status;

  const mut = useMutation({
    mutationFn: (v: any) => transition({ data: v }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: () => removeSchedule({ data: { id: schedule.id } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Schedule deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
      {isMgr && status === "draft" && (
        <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: schedule.id, action: "submit" })}>
          <Send className="h-3.5 w-3.5 mr-1.5" /> Submit
        </Button>
      )}
      {isOwner && status === "submitted" && (
        <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: schedule.id, action: "approve" })}>
          <Check className="h-3.5 w-3.5 mr-1.5" /> Approve
        </Button>
      )}
      {isOwner && status === "approved" && (
        <Button size="sm" variant="outline" onClick={() => {
          const reason = prompt("Lock reason (optional)") ?? undefined;
          mut.mutate({ id: schedule.id, action: "lock", reason });
        }}>
          <Lock className="h-3.5 w-3.5 mr-1.5" /> Lock
        </Button>
      )}
      {isOwner && status === "locked" && (
        <>
          <Button size="sm" variant="outline" onClick={() => {
            if (confirm("Unlock this schedule? Editing will reopen.")) mut.mutate({ id: schedule.id, action: "unlock" });
          }}>
            <Unlock className="h-3.5 w-3.5 mr-1.5" /> Unlock
          </Button>
          <Button size="sm" className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)]"
            onClick={() => mut.mutate({ id: schedule.id, action: "publish" })}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Publish
          </Button>
        </>
      )}
      {isOwner && status === "published" && (
        <Button size="sm" variant="outline" onClick={() => mut.mutate({ id: schedule.id, action: "revert_draft" })}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Revert to Draft
        </Button>
      )}
      {schedule.lock_reason && (
        <div className="text-[11px] text-muted-foreground">
          Locked by · {new Date(schedule.locked_at).toLocaleDateString()} · {schedule.lock_reason}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        {isOwner && (
          <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete entire schedule?")) delMut.mutate(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
function ScheduleBoard({ scheduleId, startStr, endStr, filterRole, isOwner, isMgr }: {
  scheduleId: string; startStr: string; endStr: string; filterRole: string; isOwner: boolean; isMgr: boolean;
}) {
  const qc = useQueryClient();
  const fetchSchedule = useServerFn(getSchedule);
  const fetchEmployees = useServerFn(listEmployees);
  const save = useServerFn(upsertShift);
  const remove = useServerFn(deleteShift);
  const dup = useServerFn(duplicateShift);
  const gen = useServerFn(generateCoverage);

  const { data, isLoading } = useQuery({ queryKey: ["schedule", scheduleId], queryFn: () => fetchSchedule({ data: { id: scheduleId } }) });
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => fetchEmployees() });

  const [editing, setEditing] = useState<any | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["schedule", scheduleId] });

  const saveMut = useMutation({
    mutationFn: (v: any) => save({ data: v }),
    onSuccess: () => { toast.success("Shift saved"); invalidate(); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Shift removed"); invalidate(); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const dupMut = useMutation({
    mutationFn: (id: string) => dup({ data: { id } }),
    onSuccess: () => { toast.success("Shift duplicated"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const genMut = useMutation({
    mutationFn: () => gen({ data: { scheduleId } }),
    onSuccess: (r: any) => { toast.success(`Generated ${r.inserted} shifts`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const schedule = data?.schedule;
  const shifts = data?.shifts ?? [];
  const days = useMemo(() => rangeDays(startStr, endStr), [startStr, endStr]);
  const status = (schedule?.status ?? "draft") as Status;
  const locked = status === "locked" || status === "published";
  const canEdit = isMgr && (!locked || isOwner);

  // Hours per employee within the visible range
  const hoursMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of shifts) {
      if (!s.employee_id) continue;
      if (s.shift_date < startStr || s.shift_date > endStr) continue;
      m.set(s.employee_id, (m.get(s.employee_id) ?? 0) + hoursBetween(s.start_time, s.end_time, s.break_minutes));
    }
    return m;
  }, [shifts, startStr, endStr]);

  // Group shifts by employee+date (string key)
  const grid = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of shifts) {
      if (s.shift_date < startStr || s.shift_date > endStr) continue;
      const k = `${s.employee_id ?? "unassigned"}|${s.shift_date}`;
      const arr = m.get(k) ?? []; arr.push(s); m.set(k, arr);
    }
    return m;
  }, [shifts, startStr, endStr]);

  const visibleEmployees = useMemo(() => {
    const list = (employees as any[]).filter((e) => filterRole === "all" || e.roles.includes(filterRole));
    return list;
  }, [employees, filterRole]);

  // Analytics
  const totals = useMemo(() => {
    let scheduledHrs = 0, openShifts = 0, otHrs = 0;
    const perEmp = new Map<string, number>();
    for (const s of shifts) {
      if (s.shift_date < startStr || s.shift_date > endStr) continue;
      const h = hoursBetween(s.start_time, s.end_time, s.break_minutes);
      scheduledHrs += h;
      if (!s.employee_id) openShifts++;
      else perEmp.set(s.employee_id, (perEmp.get(s.employee_id) ?? 0) + h);
    }
    for (const h of perEmp.values()) if (h > 40) otHrs += h - 40;
    const coveragePct = days.length > 0 ? Math.min(100, Math.round((shifts.filter((s: any) => s.shift_date >= startStr && s.shift_date <= endStr).length / (days.length * 3)) * 100)) : 0;
    const laborCost = scheduledHrs * 17; // assumed avg
    return { scheduledHrs, openShifts, otHrs, coveragePct, laborCost };
  }, [shifts, days, startStr, endStr]);

  if (isLoading || !schedule) {
    return <Card className="mt-3"><div className="py-10 text-center text-sm text-muted-foreground">Loading schedule…</div></Card>;
  }

  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground">{visibleEmployees.length} employees · {days.length} days · {shifts.length} shifts</div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => genMut.mutate()} disabled={genMut.isPending}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate Coverage
          </Button>
        )}
      </div>

      <Card className="overflow-hidden p-0 mt-2">
        <div className="overflow-x-auto">
          <div className="min-w-fit">
            {/* Header row */}
            <div className="grid sticky top-0 z-20 bg-secondary/60 backdrop-blur border-b border-border"
              style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(140px,1fr))` }}>
              <div className="px-3 py-2 sticky left-0 z-30 bg-secondary/80 backdrop-blur border-r border-border label-caps text-muted-foreground">
                Employee
              </div>
              {days.map((d) => {
                const dt = new Date(d + "T00:00:00");
                const isToday = fmt(new Date()) === d;
                return (
                  <div key={d} className={cn("px-2 py-2 border-r border-border last:border-r-0", isToday && "bg-[#FAF7EE]")}>
                    <div className="text-[10px] label-caps text-muted-foreground">{dt.toLocaleDateString([], { weekday: "short" })}</div>
                    <div className={cn("text-sm font-semibold", isToday && "text-[var(--color-gold)]")}>
                      {dt.toLocaleDateString([], { month: "short", day: "numeric" })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Body rows */}
            {visibleEmployees.map((emp: any) => {
              const hrs = hoursMap.get(emp.id) ?? 0;
              const target = emp.targetHours ?? 40;
              const ratio = target > 0 ? hrs / target : 0;
              const tone = hrs > target ? "over" : ratio > 0.9 ? "warn" : "ok";
              return (
                <div key={emp.id}
                  className="grid border-b border-border last:border-b-0"
                  style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(140px,1fr))` }}>
                  <div className="px-3 py-2 sticky left-0 z-10 bg-card border-r border-border">
                    <div className="flex items-start gap-2.5">
                      <Avatar name={emp.name} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{emp.name}</div>
                        <div className="text-[10px] label-caps text-muted-foreground truncate">
                          {emp.roles.slice(0, 2).join(" · ") || "—"}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            tone === "ok" && "bg-[var(--color-success)]",
                            tone === "warn" && "bg-[var(--color-warning)]",
                            tone === "over" && "bg-[var(--color-danger)]",
                          )} />
                          <span className={cn(
                            "text-[11px] font-mono",
                            tone === "ok" && "text-foreground",
                            tone === "warn" && "text-[var(--color-warning)]",
                            tone === "over" && "text-[var(--color-danger)]",
                          )}>{hrs.toFixed(1)} / {target}h</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {days.map((d) => {
                    const cellShifts = grid.get(`${emp.id}|${d}`) ?? [];
                    return (
                      <Cell key={d}
                        canEdit={canEdit}
                        shifts={cellShifts}
                        status={status}
                        onAdd={() => setEditing({
                          schedule_id: scheduleId, employee_id: emp.id, shift_date: d,
                          role: emp.roles[0] ?? "cashier", segment: "mid",
                          start_time: "11:00", end_time: "19:00", break_minutes: 30,
                        })}
                        onEdit={(s) => setEditing(s)}
                        onDup={(s) => dupMut.mutate(s.id)}
                      />
                    );
                  })}
                </div>
              );
            })}

            {/* Unassigned row */}
            <UnassignedRow
              days={days} grid={grid} status={status} canEdit={canEdit}
              onAdd={(d) => setEditing({
                schedule_id: scheduleId, employee_id: null, shift_date: d,
                role: "cashier", segment: "mid", start_time: "11:00", end_time: "19:00", break_minutes: 30,
              })}
              onEdit={(s) => setEditing(s)}
              onDup={(s) => dupMut.mutate(s.id)}
            />

            {visibleEmployees.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No employees match. Add crew in Users or change the role filter.
              </div>
            )}
          </div>
        </div>
      </Card>

      <AnalyticsBar totals={totals} />

      <ShiftEditDialog
        shift={editing}
        onClose={() => setEditing(null)}
        onSave={(v) => saveMut.mutate(v)}
        onDelete={(id) => delMut.mutate(id)}
        onDuplicate={(id) => { dupMut.mutate(id); setEditing(null); }}
        canEdit={canEdit}
        employees={employees as any[]}
      />
    </>
  );
}

function Cell({ canEdit, shifts, status, onAdd, onEdit, onDup }: {
  canEdit: boolean; shifts: any[]; status: Status;
  onAdd: () => void; onEdit: (s: any) => void; onDup: (s: any) => void;
}) {
  return (
    <div className="p-1.5 border-r border-border last:border-r-0 min-h-[64px] group hover:bg-secondary/30 transition">
      <div className="space-y-1">
        {shifts.map((s) => <ShiftCard key={s.id} shift={s} status={status} canEdit={canEdit} onEdit={onEdit} onDup={onDup} />)}
        {canEdit && (
          <button onClick={onAdd}
            className="w-full text-[11px] text-muted-foreground hover:text-[var(--color-gold)] py-1 rounded-md border border-dashed border-border hover:border-[var(--color-gold)] transition opacity-0 group-hover:opacity-100 focus:opacity-100">
            + Add
          </button>
        )}
      </div>
    </div>
  );
}

function ShiftCard({ shift, status, canEdit, onEdit, onDup }: {
  shift: any; status: Status; canEdit: boolean; onEdit: (s: any) => void; onDup: (s: any) => void;
}) {
  const bg = SEG_BG[shift.segment] ?? SEG_BG.custom;
  const fg = SEG_FG[shift.segment] ?? SEG_FG.custom;
  const isDraft = status === "draft" || status === "submitted";
  const isLocked = status === "locked" || status === "published";

  // Pattern overlay for locked
  const lockedBg = isLocked
    ? `repeating-linear-gradient(45deg, ${bg}, ${bg} 6px, rgba(255,255,255,0.18) 6px, rgba(255,255,255,0.18) 9px)`
    : bg;

  return (
    <div
      role="button" tabIndex={0}
      onClick={() => canEdit && onEdit(shift)}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && canEdit) onEdit(shift); }}
      className={cn(
        "w-full text-left rounded-md px-2 py-1.5 transition relative",
        canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default opacity-90",
        isDraft && "border-2 border-dashed",
      )}
      style={{
        background: isDraft ? "transparent" : lockedBg,
        color: isDraft ? bg : fg,
        borderColor: bg,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="text-[11px] font-semibold leading-tight">
          {shift.start_time.slice(0,5)}–{shift.end_time.slice(0,5)}
        </div>
        {canEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onDup(shift); }}
            className="opacity-0 group-hover:opacity-100 hover:scale-110 transition"
            title="Duplicate"
          >
            <Copy className="h-3 w-3" style={{ color: isDraft ? bg : fg }} />
          </button>
        )}
      </div>
      <div className="text-[10px] label-caps opacity-90 leading-tight mt-0.5 truncate">
        {shift.role} · {shift.segment}
      </div>
    </div>
  );
}

function UnassignedRow({ days, grid, status, canEdit, onAdd, onEdit, onDup }: {
  days: string[]; grid: Map<string, any[]>; status: Status; canEdit: boolean;
  onAdd: (d: string) => void; onEdit: (s: any) => void; onDup: (s: any) => void;
}) {
  const hasAny = days.some((d) => (grid.get(`unassigned|${d}`) ?? []).length > 0);
  if (!hasAny && !canEdit) return null;
  return (
    <div className="grid border-b border-border bg-[#F8F4E8]/40"
      style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(140px,1fr))` }}>
      <div className="px-3 py-2 sticky left-0 z-10 bg-[#F8F4E8] border-r border-border">
        <div className="text-sm font-semibold text-[var(--color-gold)]">Open Shifts</div>
        <div className="text-[10px] label-caps text-muted-foreground">Unassigned</div>
      </div>
      {days.map((d) => {
        const cellShifts = grid.get(`unassigned|${d}`) ?? [];
        return (
          <Cell key={d} canEdit={canEdit} shifts={cellShifts} status={status}
            onAdd={() => onAdd(d)} onEdit={onEdit} onDup={onDup} />
        );
      })}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const init = name.split(/\s+/).map((s) => s[0]).slice(0,2).join("").toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full bg-[var(--color-gold)] text-[var(--color-gold-foreground)] grid place-items-center text-[11px] font-semibold shrink-0">
      {init}
    </div>
  );
}

// ============================================================
function AnalyticsBar({ totals }: { totals: { scheduledHrs: number; openShifts: number; otHrs: number; coveragePct: number; laborCost: number } }) {
  const items = [
    { label: "Scheduled", value: `${totals.scheduledHrs.toFixed(0)}h` },
    { label: "Coverage", value: `${totals.coveragePct}%` },
    { label: "Overtime", value: `${totals.otHrs.toFixed(1)}h`, tone: totals.otHrs > 0 ? "danger" : undefined },
    { label: "Open Shifts", value: `${totals.openShifts}`, tone: totals.openShifts > 0 ? "warning" : undefined },
    { label: "Projected Labor", value: `$${Math.round(totals.laborCost).toLocaleString()}` },
    { label: "Labor %", value: "—", sub: "set sales target" },
  ];
  return (
    <div className="sticky bottom-0 lg:bottom-3 mt-3 z-10">
      <Card className="surface-dark border-[#1C1C1C] text-white p-3">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {items.map((i: any) => (
            <div key={i.label} className="min-w-0">
              <div className="text-[10px] label-caps text-white/50">{i.label}</div>
              <div className={cn(
                "text-lg font-semibold tracking-tight",
                i.tone === "danger" && "text-[var(--color-danger)]",
                i.tone === "warning" && "text-[var(--color-warning)]",
              )}>{i.value}</div>
              {i.sub && <div className="text-[10px] text-white/40">{i.sub}</div>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
function ShiftEditDialog({ shift, onClose, onSave, onDelete, onDuplicate, canEdit, employees }: {
  shift: any | null; onClose: () => void; onSave: (v: any) => void;
  onDelete: (id: string) => void; onDuplicate: (id: string) => void; canEdit: boolean; employees: any[];
}) {
  if (!shift) return null;
  return (
    <Dialog open={!!shift} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{shift.id ? "Edit Shift" : "New Shift"}</DialogTitle></DialogHeader>
        <ShiftForm key={shift.id ?? "new"} initial={shift} employees={employees} onSave={onSave}
          onDelete={shift.id ? () => onDelete(shift.id) : undefined}
          onDuplicate={shift.id ? () => onDuplicate(shift.id) : undefined}
          canEdit={canEdit} />
      </DialogContent>
    </Dialog>
  );
}

function ShiftForm({ initial, employees, onSave, onDelete, onDuplicate, canEdit }: {
  initial: any; employees: any[]; onSave: (v: any) => void;
  onDelete?: () => void; onDuplicate?: () => void; canEdit: boolean;
}) {
  const [employeeId, setEmployeeId] = useState<string>(initial.employee_id ?? "__unassigned");
  const [role, setRole] = useState<string>(initial.role ?? "cashier");
  const [segment, setSegment] = useState<string>(initial.segment ?? "mid");
  const [shiftDate, setShiftDate] = useState<string>(initial.shift_date);
  const [startTime, setStartTime] = useState<string>((initial.start_time ?? "11:00").slice(0,5));
  const [endTime, setEndTime] = useState<string>((initial.end_time ?? "19:00").slice(0,5));
  const [breakMinutes, setBreak] = useState<number>(initial.break_minutes ?? 30);
  const [notes, setNotes] = useState<string>(initial.notes ?? "");
  const [repeat, setRepeat] = useState<boolean>(!!initial.repeat_weekly);

  // Quick templates
  useEffect(() => {
    if (segment === "open") { setStartTime("09:00"); setEndTime("14:00"); }
    else if (segment === "close") { setStartTime("16:00"); setEndTime("23:00"); }
    else if (segment === "mid") { setStartTime("11:00"); setEndTime("19:00"); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment]);

  const hrs = hoursBetween(startTime, endTime, breakMinutes);

  const submit = () => onSave({
    id: initial.id, scheduleId: initial.schedule_id,
    employeeId: employeeId === "__unassigned" ? null : employeeId,
    role, segment, shiftDate, startTime, endTime, breakMinutes,
    notes: notes || undefined, repeatWeekly: repeat,
  });

  return (
    <div className="grid gap-3">
      <div>
        <Label>Employee</Label>
        <Select value={employeeId} onValueChange={setEmployeeId} disabled={!canEdit}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__unassigned">— Open / Unassigned —</SelectItem>
            {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Segment</Label>
          <Select value={segment} onValueChange={setSegment} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div><Label>Date</Label><Input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} disabled={!canEdit} /></div>
        <div><Label>Start</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={!canEdit} /></div>
        <div><Label>End</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!canEdit} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3 items-end">
        <div><Label>Break (min)</Label><Input type="number" value={breakMinutes} onChange={(e) => setBreak(Number(e.target.value))} disabled={!canEdit} /></div>
        <div className="text-right text-sm">
          <div className="label-caps text-muted-foreground">Duration</div>
          <div className="font-mono text-lg">{hrs.toFixed(1)}h</div>
        </div>
      </div>

      <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} /></div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} disabled={!canEdit} />
        Repeat weekly
      </label>

      <DialogFooter className="flex-wrap gap-2">
        {onDelete && canEdit && (
          <Button variant="ghost" onClick={onDelete} className="text-[var(--color-danger)] hover:text-[var(--color-danger)]">
            <Trash2 className="h-4 w-4 mr-1.5" />Delete
          </Button>
        )}
        {onDuplicate && canEdit && (
          <Button variant="outline" onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-1.5" />Duplicate
          </Button>
        )}
        <Button onClick={submit} disabled={!canEdit} className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)] hover:opacity-90">
          <Check className="h-4 w-4 mr-1.5" />Save
        </Button>
      </DialogFooter>
    </div>
  );
}
