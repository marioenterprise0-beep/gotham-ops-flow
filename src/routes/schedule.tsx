import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Lock, Unlock, Send, Check, Upload, Trash2, Calendar as CalIcon, RotateCcw } from "lucide-react";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/lib/role";
import { toast } from "sonner";
import {
  listSchedules, createSchedule, getSchedule, upsertShift, deleteShift,
  transitionSchedule, listEmployees, deleteSchedule,
} from "@/lib/schedule.functions";

export const Route = createFileRoute("/schedule")({
  component: SchedulePage,
});

type Status = "draft" | "submitted" | "approved" | "locked" | "published";

const STATUS_TONE: Record<Status, "neutral" | "warning" | "success" | "danger" | "info"> = {
  draft: "neutral", submitted: "warning", approved: "success", locked: "danger", published: "info",
};

const SEGMENTS = ["open", "mid", "close", "custom"] as const;
const ROLES = ["owner", "manager", "shift_lead", "grill", "prep", "cashier"] as const;

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function rangeDays(start: string, end: string) {
  const out: string[] = []; const s = new Date(start + "T00:00:00"); const e = new Date(end + "T00:00:00");
  for (let d = new Date(s); d <= e; d = addDays(d, 1)) out.push(fmtDate(d));
  return out;
}
function hoursBetween(a: string, b: string, breakMin: number) {
  const [ah, am] = a.split(":").map(Number); const [bh, bm] = b.split(":").map(Number);
  const mins = (bh * 60 + bm) - (ah * 60 + am) - breakMin;
  return Math.max(0, mins / 60);
}

function SchedulePage() {
  const { roleId } = useRole();
  const isOwner = roleId === "owner";
  const isMgr = isOwner || roleId === "manager";
  const qc = useQueryClient();
  const list = useServerFn(listSchedules);
  const create = useServerFn(createSchedule);

  const { data: schedules = [] } = useQuery({ queryKey: ["schedules"], queryFn: () => list() });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const createMut = useMutation({
    mutationFn: (v: any) => create({ data: v }),
    onSuccess: (row: any) => {
      toast.success("Schedule created");
      qc.invalidateQueries({ queryKey: ["schedules"] });
      setSelectedId(row.id); setCreateOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <SectionHeader
        eyebrow="Labor Control"
        title="Scheduling"
        action={isMgr && (
          <Button onClick={() => setCreateOpen(true)} className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)] hover:opacity-90">
            <Plus className="h-4 w-4 mr-1.5" /> New Schedule
          </Button>
        )}
      />

      {schedules.length === 0 ? (
        <Card><div className="text-sm text-muted-foreground py-6 text-center">No schedules yet. {isMgr ? "Create one to begin." : "A manager will publish one soon."}</div></Card>
      ) : (
        <div className="grid gap-2 mb-4">
          {schedules.map((s: any) => (
            <button key={s.id} onClick={() => setSelectedId(s.id)}
              className={`text-left rounded-lg border px-3 py-2.5 hover:bg-secondary transition ${selectedId === s.id ? "border-[var(--color-gold)] bg-[#FAF7EE]" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.start_date} → {s.end_date}</div>
                </div>
                <StatusPill tone={STATUS_TONE[s.status as Status]}>{s.status}</StatusPill>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedId && <ScheduleEditor scheduleId={selectedId} isOwner={isOwner} isMgr={isMgr} onDeleted={() => setSelectedId(null)} />}

      <CreateScheduleDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={(v) => createMut.mutate(v)} />
    </>
  );
}

function CreateScheduleDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (v: any) => void }) {
  const today = new Date();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(fmtDate(today));
  const [endDate, setEndDate] = useState(fmtDate(addDays(today, 6)));
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Schedule</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Week of Jun 9" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><Label>End</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit({ name, startDate, endDate, notes: notes || undefined })} disabled={!name || !startDate || !endDate}>Create Draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleEditor({ scheduleId, isOwner, isMgr, onDeleted }: { scheduleId: string; isOwner: boolean; isMgr: boolean; onDeleted: () => void }) {
  const qc = useQueryClient();
  const fetchSchedule = useServerFn(getSchedule);
  const fetchEmployees = useServerFn(listEmployees);
  const save = useServerFn(upsertShift);
  const remove = useServerFn(deleteShift);
  const transition = useServerFn(transitionSchedule);
  const removeSchedule = useServerFn(deleteSchedule);

  const { data, isLoading } = useQuery({ queryKey: ["schedule", scheduleId], queryFn: () => fetchSchedule({ data: { id: scheduleId } }) });
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => fetchEmployees() });

  const [editing, setEditing] = useState<any | null>(null);

  const saveMut = useMutation({
    mutationFn: (v: any) => save({ data: v }),
    onSuccess: () => { toast.success("Shift saved"); qc.invalidateQueries({ queryKey: ["schedule", scheduleId] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Shift removed"); qc.invalidateQueries({ queryKey: ["schedule", scheduleId] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const transMut = useMutation({
    mutationFn: (v: any) => transition({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule", scheduleId] }); qc.invalidateQueries({ queryKey: ["schedules"] }); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e.message),
  });
  const delSchedMut = useMutation({
    mutationFn: () => removeSchedule({ data: { id: scheduleId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedules"] }); onDeleted(); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const schedule = data?.schedule;
  const shifts = data?.shifts ?? [];
  const days = useMemo(() => schedule ? rangeDays(schedule.start_date, schedule.end_date) : [], [schedule]);

  // Hours per employee
  const hoursMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of shifts) {
      if (!s.employee_id) continue;
      m.set(s.employee_id, (m.get(s.employee_id) ?? 0) + hoursBetween(s.start_time, s.end_time, s.break_minutes));
    }
    return m;
  }, [shifts]);

  if (isLoading || !schedule) return <Card><div className="text-sm text-muted-foreground py-6 text-center">Loading…</div></Card>;

  const status = schedule.status as Status;
  const locked = status === "locked" || status === "published";
  const canEdit = isMgr && (!locked || isOwner);

  // Group shifts by employee+date
  const grid = new Map<string, any[]>();
  for (const s of shifts) {
    const k = `${s.employee_id ?? "unassigned"}|${s.shift_date}`;
    const arr = grid.get(k) ?? []; arr.push(s); grid.set(k, arr);
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="p-4 border-b border-border flex flex-wrap items-center gap-3 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-xl truncate">{schedule.name}</h3>
            <StatusPill tone={STATUS_TONE[status]}>{status}</StatusPill>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{schedule.start_date} → {schedule.end_date}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isMgr && status === "draft" && (
            <Button size="sm" variant="outline" onClick={() => transMut.mutate({ id: scheduleId, action: "submit" })}>
              <Send className="h-3.5 w-3.5 mr-1.5" /> Submit
            </Button>
          )}
          {isOwner && status === "submitted" && (
            <Button size="sm" variant="outline" onClick={() => transMut.mutate({ id: scheduleId, action: "approve" })}>
              <Check className="h-3.5 w-3.5 mr-1.5" /> Approve
            </Button>
          )}
          {isOwner && status === "approved" && (
            <Button size="sm" variant="outline" onClick={() => transMut.mutate({ id: scheduleId, action: "lock", reason: "Week confirmed" })}>
              <Lock className="h-3.5 w-3.5 mr-1.5" /> Lock
            </Button>
          )}
          {isOwner && status === "locked" && (
            <>
              <Button size="sm" variant="outline" onClick={() => transMut.mutate({ id: scheduleId, action: "unlock" })}>
                <Unlock className="h-3.5 w-3.5 mr-1.5" /> Unlock
              </Button>
              <Button size="sm" className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)]" onClick={() => transMut.mutate({ id: scheduleId, action: "publish" })}>
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Publish
              </Button>
            </>
          )}
          {isOwner && status === "published" && (
            <Button size="sm" variant="outline" onClick={() => transMut.mutate({ id: scheduleId, action: "revert_draft" })}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Revert to Draft
            </Button>
          )}
          {isOwner && (
            <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete schedule?")) delSchedMut.mutate(); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left p-2 sticky left-0 bg-secondary/50 z-10 min-w-[180px] border-r border-border">Employee</th>
              {days.map((d) => {
                const dt = new Date(d + "T00:00:00");
                return (
                  <th key={d} className="text-left p-2 min-w-[140px] border-r border-border last:border-r-0">
                    <div className="text-xs label-caps text-muted-foreground">{dt.toLocaleDateString([], { weekday: "short" })}</div>
                    <div className="text-sm font-semibold">{dt.toLocaleDateString([], { month: "short", day: "numeric" })}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp: any) => {
              const hrs = hoursMap.get(emp.id) ?? 0;
              return (
                <tr key={emp.id} className="border-t border-border align-top">
                  <td className="p-2 sticky left-0 bg-card z-10 border-r border-border">
                    <div className="font-medium text-sm truncate">{emp.name}</div>
                    <div className="text-[10px] label-caps text-muted-foreground">{emp.roles.join(" · ") || "—"}</div>
                    <div className={`text-xs mt-1 font-mono ${hrs > 40 ? "text-[var(--color-danger)]" : "text-muted-foreground"}`}>{hrs.toFixed(1)}h</div>
                  </td>
                  {days.map((d) => {
                    const cellShifts = grid.get(`${emp.id}|${d}`) ?? [];
                    return (
                      <td key={d} className="p-1.5 border-r border-border last:border-r-0">
                        <div className="space-y-1">
                          {cellShifts.map((s: any) => (
                            <button key={s.id} disabled={!canEdit}
                              onClick={() => setEditing(s)}
                              className="w-full text-left rounded-md px-2 py-1.5 border bg-[#FAF7EE] border-[var(--color-gold)]/40 hover:bg-[var(--color-gold)]/20 transition disabled:opacity-70 disabled:cursor-not-allowed">
                              <div className="text-[11px] font-semibold">{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</div>
                              <div className="text-[10px] label-caps text-muted-foreground">{s.role} · {s.segment}</div>
                            </button>
                          ))}
                          {canEdit && (
                            <button onClick={() => setEditing({ schedule_id: scheduleId, employee_id: emp.id, shift_date: d, role: emp.roles[0] ?? "cashier", segment: "mid", start_time: "11:00", end_time: "19:00", break_minutes: 30 })}
                              className="w-full text-[11px] text-muted-foreground hover:text-[var(--color-gold)] py-1 rounded-md border border-dashed border-border hover:border-[var(--color-gold)] transition">
                              + Add
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {employees.length === 0 && (
              <tr><td colSpan={days.length + 1} className="p-6 text-center text-muted-foreground text-sm">No active employees. Add some in Users.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ShiftEditDialog
        shift={editing}
        onClose={() => setEditing(null)}
        onSave={(v) => saveMut.mutate(v)}
        onDelete={(id) => delMut.mutate(id)}
        canEdit={canEdit}
      />
    </Card>
  );
}

function ShiftEditDialog({ shift, onClose, onSave, onDelete, canEdit }: { shift: any | null; onClose: () => void; onSave: (v: any) => void; onDelete: (id: string) => void; canEdit: boolean }) {
  if (!shift) return null;
  return (
    <Dialog open={!!shift} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{shift.id ? "Edit Shift" : "Add Shift"}</DialogTitle></DialogHeader>
        <ShiftForm initial={shift} onSave={onSave} onDelete={shift.id ? () => onDelete(shift.id) : undefined} canEdit={canEdit} />
      </DialogContent>
    </Dialog>
  );
}

function ShiftForm({ initial, onSave, onDelete, canEdit }: { initial: any; onSave: (v: any) => void; onDelete?: () => void; canEdit: boolean }) {
  const [role, setRole] = useState<string>(initial.role ?? "cashier");
  const [segment, setSegment] = useState<string>(initial.segment ?? "mid");
  const [shiftDate, setShiftDate] = useState<string>(initial.shift_date);
  const [startTime, setStartTime] = useState<string>((initial.start_time ?? "11:00").slice(0, 5));
  const [endTime, setEndTime] = useState<string>((initial.end_time ?? "19:00").slice(0, 5));
  const [breakMinutes, setBreak] = useState<number>(initial.break_minutes ?? 30);
  const [notes, setNotes] = useState<string>(initial.notes ?? "");
  const [repeat, setRepeat] = useState<boolean>(!!initial.repeat_weekly);

  const submit = () => onSave({
    id: initial.id, scheduleId: initial.schedule_id, employeeId: initial.employee_id ?? null,
    role, segment, shiftDate, startTime, endTime, breakMinutes, notes: notes || undefined, repeatWeekly: repeat,
  });

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Date</Label><Input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} disabled={!canEdit} /></div>
        <div>
          <Label>Segment</Label>
          <Select value={segment} onValueChange={setSegment} disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Start</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={!canEdit} /></div>
        <div><Label>End</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!canEdit} /></div>
        <div><Label>Break (min)</Label><Input type="number" value={breakMinutes} onChange={(e) => setBreak(Number(e.target.value))} disabled={!canEdit} /></div>
      </div>
      <div>
        <Label>Role</Label>
        <Select value={role} onValueChange={setRole} disabled={!canEdit}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} /></div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} disabled={!canEdit} /> Repeat weekly
      </label>
      <DialogFooter>
        {onDelete && canEdit && <Button variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1.5" />Delete</Button>}
        <Button onClick={submit} disabled={!canEdit}><CalIcon className="h-4 w-4 mr-1.5" />Save</Button>
      </DialogFooter>
    </div>
  );
}
