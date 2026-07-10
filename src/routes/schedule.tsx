import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Send,
  Check,
  Upload,
  Trash2,
  Copy,
  Sparkles,
  Plus,
  Calendar as CalIcon,
  RotateCcw,
  Filter,
  ArrowLeftRight,
  X,
  UserX,
  AlertCircle,
  Pencil,
  DollarSign,
  CalendarCheck,
  CalendarPlus,
} from "lucide-react";
import { Card, StatusPill } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/lib/role";
import { AppShell } from "@/components/gotham/AppShell";
import { toast } from "sonner";
import { cn, fmtTime12 } from "@/lib/utils";
import {
  getSchedule,
  upsertShift,
  deleteShift,
  duplicateShift,
  transitionSchedule,
  listEmployees,
  deleteSchedule,
  getOrCreateScheduleForRange,
  generateCoverage,
  requestShiftSwap,
  listSwapRequests,
  decideSwapRequest,
  mySwapRequests,
  listAvailabilityForRange,
  upsertAvailability,
  deleteAvailability,
  setScheduleSalesTarget,
  setEmployeeWeeklyHours,
  claimShift,
  listClaimRequests,
  decideClaimRequest,
  myClaimRequests,
  listMyScheduleShifts,
} from "@/lib/schedule.functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { syncDomains } from "@/lib/sync-bus";
import { DEFAULT_TRAILER_TZ, zonedDateToUtcMs } from "@/lib/timezone";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/schedule")({ component: SchedulePage });

type Status = "draft" | "submitted" | "approved" | "locked" | "published";
type ViewMode = "day" | "week" | "twoweek" | "month";
type ScheduleTab = "schedule" | "myshifts" | "swaps";

const STATUS_TONE: Record<Status, "neutral" | "warning" | "success" | "danger" | "info"> = {
  draft: "neutral",
  submitted: "warning",
  approved: "success",
  locked: "danger",
  published: "info",
};
const SEGMENTS = ["open", "mid", "close", "custom"] as const;
const ROLES = ["owner", "manager", "shift_lead", "grill", "prep", "cashier"] as const;

// Segment palette (Gotham identity)
const SEG_BG: Record<string, string> = {
  open: "var(--color-success)",
  mid: "var(--color-gold)",
  close: "#0A0A0A",
  custom: "#6B6B6B",
};
const SEG_FG: Record<string, string> = {
  open: "#0E3B22",
  mid: "var(--color-gold-foreground)",
  close: "#FFFFFF",
  custom: "#FFFFFF",
};

// ---------- date helpers ----------
function startOfWeek(d: Date) {
  // Week: Monday → Sunday
  const x = new Date(d);
  const day = x.getDay(); // Sun=0..Sat=6
  const back = (day + 6) % 7;
  x.setDate(x.getDate() - back);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}
function rangeDays(start: string, end: string) {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  for (let d = new Date(s); d <= e; d = addDays(d, 1)) out.push(fmt(d));
  return out;
}
function hoursBetween(a: string, b: string, breakMin: number) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  const startMins = ah * 60 + am;
  let endMins = bh * 60 + bm;
  if (endMins <= startMins) endMins += 24 * 60;
  const mins = endMins - startMins - breakMin;
  return Math.max(0, mins / 60);
}
function viewRange(anchor: Date, mode: ViewMode): { start: Date; end: Date } {
  if (mode === "day") return { start: anchor, end: anchor };
  if (mode === "week") {
    const s = startOfWeek(anchor);
    return { start: s, end: addDays(s, 6) };
  }
  if (mode === "twoweek") {
    const s = startOfWeek(anchor);
    return { start: s, end: addDays(s, 13) };
  }
  const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const e = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: s, end: e };
}
function rangeLabel(start: Date, end: Date, mode: ViewMode) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (mode === "month") return start.toLocaleDateString([], { month: "long", year: "numeric" });
  if (mode === "day")
    return start.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${start.toLocaleDateString([], opts)} – ${end.toLocaleDateString([], { ...opts, year: "numeric" })}`;
}

// ============================================================
function SchedulePage() {
  const { roleId, trailerScope, session } = useRole();
  const isOwner = roleId === "owner";
  const isMgr = isOwner || roleId === "manager";
  const qc = useQueryClient();

  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [mode, setMode] = useState<ViewMode>("week");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<ScheduleTab>("schedule");

  useEffect(() => {
    if (isMgr && activeTab === "myshifts") setActiveTab("schedule");
    // Crew can freely browse the Schedule tab (read-only) — don't redirect
    // them away. They need it to see assigned days and mark unavailability.
  }, [activeTab, isMgr, roleId]);

  const { start, end } = useMemo(() => viewRange(anchor, mode), [anchor, mode]);
  const startStr = fmt(start),
    endStr = fmt(end);

  const findOrCreate = useServerFn(getOrCreateScheduleForRange);
  const { data: schedule, refetch: refetchSched } = useQuery({
    queryKey: ["schedule-range", startStr, endStr, trailerScope, isMgr],
    queryFn: async () => {
      // Managers/owners auto-create a blank draft on landing so the grid is
      // always present for crew to view and mark unavailability against.
      const exact = await findOrCreate({ data: { startDate: startStr, endDate: endStr, autoCreate: false } });
      if (exact) return exact;
      const legacy = await findOrCreate({ data: { startDate: fmt(addDays(start, -1)), endDate: fmt(addDays(end, -1)), autoCreate: false } });
      if (legacy) return legacy;
      return findOrCreate({ data: { startDate: startStr, endDate: endStr, autoCreate: isMgr } });
    },
    enabled: !!session,
  });

  const createMut = useMutation({
    mutationFn: () =>
      findOrCreate({ data: { startDate: startStr, endDate: endStr, autoCreate: true } }),
    onSuccess: () => {
      toast.success("Draft schedule created");
      refetchSched();
      syncDomains(qc, "schedule");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const shift = (n: number) => {
    const step = mode === "day" ? 1 : mode === "week" ? 7 : mode === "twoweek" ? 14 : 30;
    const next =
      mode === "month"
        ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1)
        : addDays(anchor, n * step);
    setAnchor(next);
  };

  return (
    <AppShell>
      <div className="-mx-4 px-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ScheduleTab)}>
          <div className="flex items-center gap-3 mb-3">
            <TabsList>
              {!isMgr && (
                <TabsTrigger value="myshifts" className="flex items-center gap-1.5">
                  <CalendarCheck className="h-3.5 w-3.5" /> My Shifts
                </TabsTrigger>
              )}
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="swaps" className="flex items-center gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Requests
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="schedule">
            <HeaderBar
              anchor={anchor}
              setAnchor={setAnchor}
              mode={mode}
              setMode={setMode}
              start={start}
              end={end}
              schedule={schedule}
              filterRole={filterRole}
              setFilterRole={setFilterRole}
              isOwner={isOwner}
              isMgr={isMgr}
              onPrev={() => shift(-1)}
              onNext={() => shift(1)}
              onToday={() => setAnchor(new Date())}
            />

            {!schedule ? (
              <>
                <Card className="mt-3">
                  <div className="py-8 text-center">
                    <CalIcon className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <div className="font-display text-lg">No schedule for this range</div>
                    <div className="text-sm text-muted-foreground mt-1 mb-4">
                      {rangeLabel(start, end, mode)}
                    </div>
                    {isMgr ? (
                      <Button
                        onClick={() => createMut.mutate()}
                        disabled={createMut.isPending}
                        className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)] hover:opacity-90"
                      >
                        <Plus className="h-4 w-4 mr-1.5" /> Create Draft for This Range
                      </Button>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        A manager will publish one soon. You can still mark days you're unavailable below.
                      </div>
                    )}
                  </div>
                </Card>
                {!isMgr && (
                  <MyAvailabilityCalendar startStr={startStr} endStr={endStr} />
                )}
              </>
            ) : (
              <ScheduleBoard
                scheduleId={schedule.id}
                startStr={startStr}
                endStr={endStr}
                filterRole={filterRole}
                isOwner={isOwner}
                isMgr={isMgr}
                trailerScope={trailerScope}
              />
            )}

          </TabsContent>

          {!isMgr && (
            <TabsContent value="myshifts">
              <MyShiftsPanel />
            </TabsContent>
          )}

          <TabsContent value="swaps">
            <RequestsPanel isMgr={isMgr} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// ============================================================
function HeaderBar({
  anchor,
  setAnchor,
  mode,
  setMode,
  start,
  end,
  schedule,
  filterRole,
  setFilterRole,
  isOwner,
  isMgr,
  onPrev,
  onNext,
  onToday,
}: any) {
  const status = (schedule?.status ?? null) as Status | null;
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        {/* Left: week nav */}
        <div className="flex items-center gap-2 min-w-0">
          <Button size="icon" variant="outline" onClick={onPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center">
            <div className="font-display text-base leading-tight truncate">
              {rangeLabel(start, end, mode)}
            </div>
            <button
              onClick={onToday}
              className="text-[10px] label-caps text-muted-foreground hover:text-[var(--color-gold)] transition"
            >
              Jump to Today
            </button>
          </div>
          <Button size="icon" variant="outline" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={fmt(anchor)}
            onChange={(e) => setAnchor(new Date(e.target.value + "T00:00:00"))}
            className="w-[150px] hidden md:block"
          />
        </div>

        {/* Center: schedule status */}
        <div className="flex items-center gap-2">
          {schedule && (
            <>
              <span className="text-sm font-medium hidden sm:inline truncate max-w-[160px]">
                {schedule.name}
              </span>
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
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {schedule && <WorkflowActions schedule={schedule} isOwner={isOwner} isMgr={isMgr} />}
    </Card>
  );
}

function ViewModeToggle({ mode, setMode }: { mode: ViewMode; setMode: (m: ViewMode) => void }) {
  const opts: { id: ViewMode; label: string }[] = [
    { id: "day", label: "Day" },
    { id: "week", label: "Week" },
    { id: "twoweek", label: "2 Wk" },
    { id: "month", label: "Month" },
  ];
  return (
    <div className="inline-flex rounded-md border border-border bg-background overflow-hidden">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => setMode(o.id)}
          className={cn(
            "px-2.5 py-1.5 text-xs font-medium transition",
            mode === o.id
              ? "bg-[var(--color-gold)] text-[var(--color-gold-foreground)]"
              : "text-muted-foreground hover:bg-secondary",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function WorkflowActions({
  schedule,
  isOwner,
  isMgr,
}: {
  schedule: any;
  isOwner: boolean;
  isMgr: boolean;
}) {
  const qc = useQueryClient();
  const transition = useServerFn(transitionSchedule);
  const removeSchedule = useServerFn(deleteSchedule);
  const status = schedule.status as Status;

  const [lockOpen, setLockOpen] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  const mut = useMutation({
    mutationFn: (v: any) => transition({ data: v }),
    onSuccess: () => {
      syncDomains(qc, "schedule", "labor", "alerts");
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: () => removeSchedule({ data: { id: schedule.id } }),
    onSuccess: () => {
      syncDomains(qc, "schedule", "labor", "alerts");
      toast.success("Schedule deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
        {isMgr && status === "draft" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => mut.mutate({ id: schedule.id, action: "submit" })}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" /> Submit
          </Button>
        )}
        {isOwner && status === "submitted" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => mut.mutate({ id: schedule.id, action: "approve" })}
          >
            <Check className="h-3.5 w-3.5 mr-1.5" /> Approve
          </Button>
        )}
        {isOwner && status === "approved" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLockReason("");
              setLockOpen(true);
            }}
          >
            <Lock className="h-3.5 w-3.5 mr-1.5" /> Lock
          </Button>
        )}
        {isOwner && status === "locked" && (
          <>
            <Button size="sm" variant="outline" onClick={() => setUnlockOpen(true)}>
              <Unlock className="h-3.5 w-3.5 mr-1.5" /> Unlock
            </Button>
            <Button
              size="sm"
              className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)]"
              onClick={() => mut.mutate({ id: schedule.id, action: "publish" })}
              disabled={mut.isPending}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Publish
            </Button>
          </>
        )}
        {isOwner && status === "published" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => mut.mutate({ id: schedule.id, action: "revert_draft" })}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Revert to Draft
          </Button>
        )}
        {schedule.lock_reason && (
          <div className="text-[11px] text-muted-foreground">
            Locked · {new Date(schedule.locked_at).toLocaleDateString()} · {schedule.lock_reason}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isOwner && (
            <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Lock reason dialog */}
      <Dialog open={lockOpen} onOpenChange={setLockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Lock Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Locking will notify all assigned employees via email with their shifts.
            </p>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="e.g. Approved for the week"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)]"
              disabled={mut.isPending}
              onClick={() => {
                setLockOpen(false);
                mut.mutate({ id: schedule.id, action: "lock", reason: lockReason || undefined });
              }}
            >
              <Lock className="h-4 w-4 mr-1.5" /> Lock & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock confirm dialog */}
      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unlock Schedule?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will reopen the schedule for editing.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={mut.isPending}
              onClick={() => {
                setUnlockOpen(false);
                mut.mutate({ id: schedule.id, action: "unlock" });
              }}
            >
              <Unlock className="h-4 w-4 mr-1.5" /> Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Schedule?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the entire schedule and all its shifts. This cannot be
            undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => {
                setDeleteOpen(false);
                delMut.mutate();
              }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
function ScheduleBoard({
  scheduleId,
  startStr,
  endStr,
  filterRole,
  isOwner,
  isMgr,
  trailerScope,
}: {
  scheduleId: string;
  startStr: string;
  endStr: string;
  filterRole: string;
  isOwner: boolean;
  isMgr: boolean;
  trailerScope: string | null;
}) {
  const qc = useQueryClient();
  const { session } = useRole();
  const currentUserId = session?.user?.id ?? null;

  const fetchSchedule = useServerFn(getSchedule);
  const fetchEmployees = useServerFn(listEmployees);
  const save = useServerFn(upsertShift);
  const remove = useServerFn(deleteShift);
  const dup = useServerFn(duplicateShift);
  const gen = useServerFn(generateCoverage);
  const fetchAvail = useServerFn(listAvailabilityForRange);
  const markUnavail = useServerFn(upsertAvailability);
  const clearUnavail = useServerFn(deleteAvailability);
  const requestSwapFn = useServerFn(requestShiftSwap);
  const claimShiftFn = useServerFn(claimShift);
  const setSalesTargetFn = useServerFn(setScheduleSalesTarget);
  const setWeeklyHoursFn = useServerFn(setEmployeeWeeklyHours);
  const scheduleCacheKey = ["schedule", scheduleId, trailerScope, startStr, endStr] as const;

  const { data, isLoading } = useQuery({
    queryKey: scheduleCacheKey,
    queryFn: () => fetchSchedule({ data: { id: scheduleId, trailerId: trailerScope ?? null, startDate: startStr, endDate: endStr } }),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees", trailerScope],
    queryFn: () => fetchEmployees({ data: { trailerId: trailerScope ?? null } }),
  });
  const { data: availRows = [] } = useQuery({
    queryKey: ["availability", startStr, endStr],
    queryFn: () => fetchAvail({ data: { startDate: startStr, endDate: endStr } }),
    enabled: !!session,
  });

  const [addedEmployeeIds, setAddedEmployeeIds] = useState<Set<string>>(new Set());
  // Reset manually-pinned employees when the viewed week changes.
  useEffect(() => { setAddedEmployeeIds(new Set()); }, [startStr]);

  // Realtime: refetch the schedule cache whenever a punch or shift changes
  // anywhere in the visible week — keeps clocked-hours and shift edits in sync
  // across all devices without a manual refresh.
  useEffect(() => {
    if (!scheduleId || !startStr || !endStr) return;
    let pending = false;
    const refresh = () => {
      if (pending) return;
      pending = true;
      // Coalesce bursts (e.g. clock-in writes audit + punch rows).
      setTimeout(() => {
        pending = false;
        qc.invalidateQueries({ queryKey: ["schedule", scheduleId, trailerScope] });
      }, 350);
    };
    const channel = supabase
      .channel(`schedule-live-${scheduleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_punches" },
        (payload: any) => {
          const row = (payload.new ?? payload.old) as { clock_in_at?: string } | null;
          const inAt = row?.clock_in_at;
          if (!inAt) return refresh();
          const d = inAt.slice(0, 10);
          if (d >= startStr && d <= endStr) refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_shifts", filter: `schedule_id=eq.${scheduleId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [scheduleId, trailerScope, startStr, endStr, qc]);

  const [editing, setEditing] = useState<any | null>(null);
  const [swapDialogShift, setSwapDialogShift] = useState<any | null>(null);
  const [claimDialogShift, setClaimDialogShift] = useState<any | null>(null);
  const [availDialog, setAvailDialog] = useState<{
    userId: string;
    date: string;
    existing: any | null;
  } | null>(null);
  const [hoursDialog, setHoursDialog] = useState<{
    empId: string;
    name: string;
    current: number;
  } | null>(null);

  const scheduleQueryMatches = (queryKey: readonly unknown[]) =>
    Array.isArray(queryKey) && queryKey[0] === "schedule" && queryKey[1] === scheduleId;
  const upsertShiftInScheduleCache = (saved: any) => {
    if (!saved?.id) return;
    qc.setQueriesData(
      { predicate: (q) => scheduleQueryMatches(q.queryKey) },
      (current: any) => {
        if (!current?.schedule) return current;
        const existing = Array.isArray(current.shifts) ? current.shifts : [];
        const idx = existing.findIndex((s: any) => s.id === saved.id);
        const shifts = idx >= 0
          ? existing.map((s: any) => (s.id === saved.id ? saved : s))
          : [...existing, saved];
        shifts.sort((a: any, b: any) =>
          String(a.shift_date).localeCompare(String(b.shift_date)) ||
          String(a.start_time).localeCompare(String(b.start_time)),
        );
        return { ...current, shifts };
      },
    );
  };
  const removeShiftFromScheduleCache = (id: string) => {
    qc.setQueriesData(
      { predicate: (q) => scheduleQueryMatches(q.queryKey) },
      (current: any) => {
        if (!current?.schedule || !Array.isArray(current.shifts)) return current;
        return { ...current, shifts: current.shifts.filter((s: any) => s.id !== id) };
      },
    );
  };
  const invalidateLabor = () => syncDomains(qc, "labor");
  const forceScheduleRefresh = async () => {
    await qc.invalidateQueries({
      predicate: (q) =>
        (Array.isArray(q.queryKey) && q.queryKey[0] === "schedule") ||
        (Array.isArray(q.queryKey) && q.queryKey[0] === "schedule-range"),
    });
    await qc.refetchQueries({
      predicate: (q) =>
        (Array.isArray(q.queryKey) && q.queryKey[0] === "schedule") ||
        (Array.isArray(q.queryKey) && q.queryKey[0] === "schedule-range"),
      type: "active",
    });
  };

  const saveMut = useMutation({
    mutationFn: (v: any) => {
      if (locked) return Promise.reject(new Error("Schedule is locked — unlock it before making changes"));
      return save({ data: v });
    },

    onMutate: async (v: any) => {
      await qc.cancelQueries({ queryKey: scheduleCacheKey });
      const prev = qc.getQueryData(scheduleCacheKey);
      qc.setQueryData(scheduleCacheKey, (old: any) => {
        if (!old) return old;
        const patch = {
          schedule_id: v.scheduleId, employee_id: v.employeeId ?? null,
          trailer_id: v.trailerId ?? null, role: v.role, segment: v.segment,
          shift_date: v.shiftDate, start_time: v.startTime, end_time: v.endTime,
          break_minutes: v.breakMinutes ?? 30, notes: v.notes ?? null,
          repeat_weekly: v.repeatWeekly ?? false, archived_at: null,
        };
        if (v.id) return { ...old, shifts: old.shifts.map((s: any) => s.id === v.id ? { ...s, ...patch } : s) };
        return { ...old, shifts: [...old.shifts, { ...patch, id: `temp-${Date.now()}`, created_at: new Date().toISOString() }] };
      });
      return { prev };
    },
    onSuccess: async (saved: any) => {
      toast.success("Shift saved");
      await forceScheduleRefresh();
      upsertShiftInScheduleCache(saved);
      invalidateLabor();
      setEditing(null);
    },
    onError: (e: any, _v: any, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(scheduleCacheKey, ctx.prev);
      toast.error(e.message);
    },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => {
      if (locked) return Promise.reject(new Error("Schedule is locked — unlock it before making changes"));
      return remove({ data: { id } });
    },

    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: scheduleCacheKey });
      const prev = qc.getQueryData(scheduleCacheKey);
      qc.setQueryData(scheduleCacheKey, (old: any) => {
        if (!old) return old;
        return { ...old, shifts: old.shifts.filter((s: any) => s.id !== id) };
      });
      return { prev };
    },
    onSuccess: async (_result, id) => {
      toast.success("Shift removed");
      await forceScheduleRefresh();
      removeShiftFromScheduleCache(id);
      invalidateLabor();
      setEditing(null);
    },
    onError: (e: any, _v: any, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(scheduleCacheKey, ctx.prev);
      toast.error(e.message);
    },
  });
  const [copyShift, setCopyShift] = useState<any | null>(null);
  const [copyDate, setCopyDate] = useState<string>("");
  const dupMut = useMutation({
    mutationFn: (v: { id: string; targetDate?: string }) => {
      if (locked) return Promise.reject(new Error("Schedule is locked — unlock it before making changes"));
      return dup({ data: v });
    },

    onMutate: async (v: { id: string; targetDate?: string }) => {
      await qc.cancelQueries({ queryKey: scheduleCacheKey });
      const prev = qc.getQueryData(scheduleCacheKey);
      qc.setQueryData(scheduleCacheKey, (old: any) => {
        if (!old) return old;
        const src = old.shifts.find((s: any) => s.id === v.id);
        if (!src) return old;
        return { ...old, shifts: [...old.shifts, { ...src, id: `temp-${Date.now()}`, shift_date: v.targetDate ?? src.shift_date, created_at: new Date().toISOString() }] };
      });
      return { prev };
    },
    onSuccess: async (saved: any) => {
      toast.success("Shift duplicated");
      await forceScheduleRefresh();
      upsertShiftInScheduleCache(saved);
      invalidateLabor();
    },
    onError: (e: any, _v: any, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(scheduleCacheKey, ctx.prev);
      toast.error(e.message);
    },
  });
  const availMut = useMutation({
    mutationFn: (v: { blockDate: string; reason?: string }) => markUnavail({ data: v }),
    onSuccess: (r: any) => {
      toast.success(
        r?.requiresApproval
          ? "Request sent — manager approval required (schedule already published)"
          : "Marked unavailable",
      );
      qc.invalidateQueries({ queryKey: ["availability"] });
      setAvailDialog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const availDelMut = useMutation({
    mutationFn: (blockDate: string) => clearUnavail({ data: { blockDate } }),
    onSuccess: () => {
      toast.success("Availability cleared");
      qc.invalidateQueries({ queryKey: ["availability"] });
      setAvailDialog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const swapMut = useMutation({
    mutationFn: (v: { scheduleShiftId: string; reason?: string }) => requestSwapFn({ data: v }),
    onSuccess: () => {
      toast.success("Swap request sent to manager");
      syncDomains(qc, "swaps");
      setSwapDialogShift(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const claimMut = useMutation({
    mutationFn: (v: { scheduleShiftId: string; reason?: string }) => claimShiftFn({ data: v }),
    onSuccess: () => {
      toast.success("Claim request sent to manager");
      syncDomains(qc, "schedule", "swaps");
      setClaimDialogShift(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const salesTargetMut = useMutation({
    mutationFn: (v: { id: string; salesTarget: number }) => setSalesTargetFn({ data: v }),
    onSuccess: () => {
      toast.success("Sales target saved");
      syncDomains(qc, "schedule");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const weeklyHoursMut = useMutation({
    mutationFn: (v: { employeeId: string; weeklyHours: number }) =>
      setWeeklyHoursFn({ data: v }),
    onSuccess: () => {
      toast.success("Weekly hours updated");
      qc.invalidateQueries({ queryKey: ["employees"] });
      setHoursDialog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const genMut = useMutation({
    mutationFn: () => gen({ data: { scheduleId } }),
    onSuccess: (r: any) => {
      if (r.inserted > 0)
        toast.success(`Generated ${r.inserted} open shift${r.inserted === 1 ? "" : "s"}`);
      else toast.info("Coverage already in place — no new shifts to add");
      syncDomains(qc, "schedule", "labor");
      qc.refetchQueries({ queryKey: ["schedule", scheduleId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Generate coverage failed"),
  });

  const schedule = data?.schedule;
  const shifts = useMemo(() => data?.shifts ?? [], [data]);
  const days = useMemo(() => rangeDays(startStr, endStr), [startStr, endStr]);
  const status = (schedule?.status ?? "draft") as Status;
  const locked = status === "locked" || status === "published";
  const canEdit = isMgr && !locked;

  // Hours per employee within the visible range
  const hoursMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of shifts) {
      if (!s.employee_id) continue;
      if (s.shift_date < startStr || s.shift_date > endStr) continue;
      m.set(
        s.employee_id,
        (m.get(s.employee_id) ?? 0) + hoursBetween(s.start_time, s.end_time, s.break_minutes),
      );
    }
    return m;
  }, [shifts, startStr, endStr]);

  // Actual clocked hours per employee in the visible range.
  // Open punches (no clock_out_at) count up to "now" so an in-progress shift is reflected live.
  const clockedMap = useMemo(() => {
    const m = new Map<string, number>();
    const punches = (data?.punches ?? []) as Array<{
      employee_id: string;
      clock_in_at: string;
      clock_out_at: string | null;
      break_minutes: number | null;
    }>;
    const tz = (data as any)?.timezone || DEFAULT_TRAILER_TZ;
    // Anchor the visible window to the trailer's local timezone so every
    // device computes the same start/end boundaries.
    const startMs = zonedDateToUtcMs(startStr, tz, false);
    const endMs = zonedDateToUtcMs(endStr, tz, true);
    const nowMs = Date.now();
    for (const p of punches) {
      if (!p.employee_id || !p.clock_in_at) continue;
      const inMs = new Date(p.clock_in_at).getTime();
      if (inMs < startMs || inMs > endMs) continue;
      const outMs = p.clock_out_at ? new Date(p.clock_out_at).getTime() : nowMs;
      // Duration math uses absolute UTC instants — an hour is an hour
      // regardless of the viewer's timezone or daylight-savings shifts.
      // Subtract break minutes to match the Labor page's calculation.
      const hrs = Math.max(0, (outMs - inMs) / 3_600_000 - (p.break_minutes ?? 0) / 60);
      m.set(p.employee_id, (m.get(p.employee_id) ?? 0) + hrs);
    }
    return m;
  }, [data, startStr, endStr]);


  // Group shifts by employee+date (string key)
  const grid = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of shifts) {
      if (s.shift_date < startStr || s.shift_date > endStr) continue;
      const k = `${s.employee_id ?? "unassigned"}|${s.shift_date}`;
      const arr = m.get(k) ?? [];
      arr.push(s);
      m.set(k, arr);
    }
    return m;
  }, [shifts, startStr, endStr]);

  // Map of userId|date → availability block (null = available)
  const availMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const b of availRows as any[]) m.set(`${b.user_id}|${b.block_date}`, b);
    return m;
  }, [availRows]);

  // Show every employee associated with the trailer in the grid so crew can
  // see themselves and mark unavailability even when they have no shifts
  // yet. Managers can still narrow with the role filter.
  const visibleEmployees = useMemo(() => {
    return (employees as any[]).filter(
      (e) => filterRole === "all" || e.roles.includes(filterRole),
    );
  }, [employees, filterRole]);

  // Manager-only "Add to Schedule" picker is now redundant since everyone
  // shows by default. Keep an empty list so the existing UI hides itself.
  const availableToAdd = useMemo(() => [] as any[], []);


  // Analytics
  const totals = useMemo(() => {
    let scheduledHrs = 0,
      openShifts = 0,
      otHrs = 0;
    const perEmp = new Map<string, number>();
    for (const s of shifts) {
      if (s.shift_date < startStr || s.shift_date > endStr) continue;
      const h = hoursBetween(s.start_time, s.end_time, s.break_minutes);
      scheduledHrs += h;
      if (!s.employee_id) openShifts++;
      else perEmp.set(s.employee_id, (perEmp.get(s.employee_id) ?? 0) + h);
    }
    for (const h of perEmp.values()) if (h > 40) otHrs += h - 40;
    const coveragePct =
      days.length > 0
        ? Math.min(
            100,
            Math.round(
              (shifts.filter((s: any) => s.shift_date >= startStr && s.shift_date <= endStr)
                .length /
                (days.length * 3)) *
                100,
            ),
          )
        : 0;
    const laborCost = scheduledHrs * 17; // assumed avg $17/hr
    const salesTarget = (schedule as any)?.sales_target ?? null;
    const laborPct = salesTarget && salesTarget > 0 ? (laborCost / salesTarget) * 100 : null;
    return { scheduledHrs, openShifts, otHrs, coveragePct, laborCost, salesTarget, laborPct };
  }, [shifts, days, startStr, endStr, schedule]);

  if (isLoading || !schedule) {
    return (
      <Card className="mt-3">
        <div className="py-10 text-center text-sm text-muted-foreground">Loading schedule…</div>
      </Card>
    );
  }

  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground">
          {visibleEmployees.length} employees · {days.length} days · {shifts.length} shifts
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {availableToAdd.length > 0 && (
              <Select
                value=""
                onValueChange={(id) =>
                  setAddedEmployeeIds((prev) => new Set([...prev, id]))
                }
              >
                <SelectTrigger className="h-9 w-auto gap-1.5 pl-2.5 pr-3 text-sm">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add to Schedule</span>
                </SelectTrigger>
                <SelectContent>
                  {availableToAdd.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                      {e.roles.length > 0 && (
                        <span className="ml-1.5 text-muted-foreground text-[11px]">
                          · {e.roles[0]}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => genMut.mutate()}
              disabled={genMut.isPending}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate Coverage
            </Button>
          </div>
        )}
      </div>

      <Card className="overflow-hidden p-0 mt-2">
        <div className="overflow-x-auto">
          <div className="min-w-fit">
            {/* Header row */}
            <div
              className="grid sticky top-0 z-20 bg-secondary/60 backdrop-blur border-b border-border"
              style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(140px,1fr))` }}
            >
              <div className="px-3 py-2 sticky left-0 z-30 bg-secondary/80 backdrop-blur border-r border-border label-caps text-muted-foreground">
                Employee
              </div>
              {days.map((d) => {
                const dt = new Date(d + "T00:00:00");
                const isToday = fmt(new Date()) === d;
                return (
                  <div
                    key={d}
                    className={cn(
                      "px-2 py-2 border-r border-border last:border-r-0",
                      isToday && "bg-[#FAF7EE]",
                    )}
                  >
                    <div className="text-[10px] label-caps text-muted-foreground">
                      {dt.toLocaleDateString([], { weekday: "short" })}
                    </div>
                    <div
                      className={cn("text-sm font-semibold", isToday && "text-[var(--color-gold)]")}
                    >
                      {dt.toLocaleDateString([], { month: "short", day: "numeric" })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Body rows */}
            {visibleEmployees.map((emp: any) => {
              const hrs = hoursMap.get(emp.id) ?? 0;
              const clocked = clockedMap.get(emp.id) ?? 0;
              const target = emp.targetHours ?? 40;
              const ratio = target > 0 ? hrs / target : 0;
              const tone = hrs > target ? "over" : ratio > 0.9 ? "warn" : "ok";
              return (
                <div
                  key={emp.id}
                  className="grid border-b border-border last:border-b-0"
                  style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(140px,1fr))` }}
                >
                  <div className="px-3 py-2 sticky left-0 z-10 bg-card border-r border-border">
                    <div className="flex items-start gap-2.5">
                      <Avatar name={emp.name} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{emp.name}</div>
                        <div className="text-[10px] label-caps text-muted-foreground truncate">
                          {emp.roles.slice(0, 2).join(" · ") || "—"}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 group/hrs">
                          <span
                            className={cn(
                              "inline-block h-1.5 w-1.5 rounded-full shrink-0",
                              tone === "ok" && "bg-[var(--color-success)]",
                              tone === "warn" && "bg-[var(--color-warning)]",
                              tone === "over" && "bg-[var(--color-danger)]",
                            )}
                          />
                          <span
                            className={cn(
                              "text-[11px] font-mono",
                              tone === "ok" && "text-foreground",
                              tone === "warn" && "text-[var(--color-warning)]",
                              tone === "over" && "text-[var(--color-danger)]",
                            )}
                            title="Scheduled / weekly target"
                          >
                            {hrs.toFixed(1)} / {target}h
                          </span>
                          {isMgr && (
                            <button
                              onClick={() =>
                                setHoursDialog({ empId: emp.id, name: emp.name, current: target })
                              }
                              className="opacity-0 group-hover/hrs:opacity-100 transition-opacity"
                              title="Set weekly hours target"
                            >
                              <Pencil className="h-2.5 w-2.5 text-muted-foreground hover:text-[var(--color-gold)]" />
                            </button>
                          )}
                        </div>
                        <div
                          className="mt-0.5 flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground"
                          title="Actual clocked hours this week (open punches count to now)"
                        >
                          <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0 bg-[var(--color-gold)]" />
                          <span>{clocked.toFixed(1)}h clocked</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {days.map((d) => {
                    const cellShifts = grid.get(`${emp.id}|${d}`) ?? [];
                    const availBlock = availMap.get(`${emp.id}|${d}`) ?? null;
                    const isOwnRow = emp.id === currentUserId;
                    return (
                      <Cell
                        key={d}
                        canEdit={canEdit}
                        shifts={cellShifts}
                        status={status}
                        availBlock={availBlock}
                        isOwnRow={isOwnRow}
                        isMgr={isMgr}
                        currentUserId={currentUserId}
                        onAdd={() => {
                          if (!isMgr && isOwnRow) {
                            setAvailDialog({ userId: emp.id, date: d, existing: availBlock });
                            return;
                          }
                          if (availBlock && isMgr) {
                            toast.warning(`${emp.name} marked unavailable on this day`);
                          }
                          setEditing({
                            schedule_id: scheduleId,
                            employee_id: emp.id,
                            shift_date: d,
                            role: emp.roles[0] ?? "cashier",
                            segment: "mid",
                            start_time: "11:00",
                            end_time: "19:00",
                            break_minutes: 30,
                          });
                        }}
                        onAvailToggle={() =>
                          setAvailDialog({ userId: emp.id, date: d, existing: availBlock })
                        }
                        onEdit={(s) => setEditing(s)}
                        onDup={(s) => dupMut.mutate({ id: s.id })}
                        onCopy={(s) => { setCopyShift(s); setCopyDate(s.shift_date); }}
                        onSwap={(s) => setSwapDialogShift(s)}
                        onClaim={(s) => setClaimDialogShift(s)}
                      />
                    );
                  })}
                </div>
              );
            })}

            {/* Unassigned row */}
            <UnassignedRow
              days={days}
              grid={grid}
              status={status}
              canEdit={canEdit}
              currentUserId={currentUserId}
              isMgr={isMgr}
              onAdd={(d) =>
                setEditing({
                  schedule_id: scheduleId,
                  employee_id: null,
                  shift_date: d,
                  role: "cashier",
                  segment: "mid",
                  start_time: "11:00",
                  end_time: "19:00",
                  break_minutes: 30,
                })
              }
              onEdit={(s) => setEditing(s)}
              onDup={(s) => dupMut.mutate({ id: s.id })}
              onCopy={(s) => { setCopyShift(s); setCopyDate(s.shift_date); }}
              onClaim={(s) => setClaimDialogShift(s)}
            />

            {visibleEmployees.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No crew scheduled yet.{" "}
                {canEdit
                  ? 'Use "Add to Schedule" above to add employees, or click cells in the Open Shifts row.'
                  : "A manager will publish shifts soon."}
              </div>
            )}
          </div>
        </div>
      </Card>

      <AnalyticsBar
        totals={totals}
        isMgr={isMgr}
        onSalesTarget={(t) => salesTargetMut.mutate({ id: scheduleId, salesTarget: t })}
      />

      <ShiftEditDialog
        shift={editing}
        onClose={() => setEditing(null)}
        onSave={(v) => saveMut.mutate(v)}
        onDelete={(id) => delMut.mutate(id)}
        onDuplicate={(id) => {
          dupMut.mutate({ id });
          setEditing(null);
        }}
        canEdit={canEdit}
        employees={employees as any[]}
      />

      {copyShift && (
        <Dialog open onOpenChange={() => setCopyShift(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copy shift to another day</DialogTitle>
              <DialogDescription>
                Pick the date you want to copy this shift to. The employee and times stay the same.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <input
                type="date"
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={copyDate}
                onChange={(e) => setCopyDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCopyShift(null)}>Cancel</Button>
              <Button
                disabled={!copyDate || dupMut.isPending}
                onClick={() => {
                  dupMut.mutate(
                    { id: copyShift.id, targetDate: copyDate },
                    { onSuccess: () => setCopyShift(null) }
                  );
                }}
              >
                Copy shift
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <SwapRequestDialog
        shift={swapDialogShift}
        onClose={() => setSwapDialogShift(null)}
        onSubmit={(shiftId, reason) => swapMut.mutate({ scheduleShiftId: shiftId, reason })}
        isPending={swapMut.isPending}
      />

      <ClaimShiftDialog
        shift={claimDialogShift}
        onClose={() => setClaimDialogShift(null)}
        onSubmit={(shiftId, reason) => claimMut.mutate({ scheduleShiftId: shiftId, reason })}
        isPending={claimMut.isPending}
      />

      <WeeklyHoursDialog
        entry={hoursDialog}
        onClose={() => setHoursDialog(null)}
        onSave={(empId, hrs) => weeklyHoursMut.mutate({ employeeId: empId, weeklyHours: hrs })}
        isPending={weeklyHoursMut.isPending}
      />

      <AvailabilityDialog
        entry={availDialog}
        onClose={() => setAvailDialog(null)}
        onMark={(date, reason) => availMut.mutate({ blockDate: date, reason })}
        onRemove={(date) => availDelMut.mutate(date)}
        isPending={availMut.isPending || availDelMut.isPending}
      />
    </>
  );
}

function Cell({
  canEdit,
  shifts,
  status,
  availBlock,
  isOwnRow,
  isMgr,
  currentUserId,
  onAdd,
  onAvailToggle,
  onEdit,
  onDup,
  onCopy,
  onSwap,
  onClaim,
}: {
  canEdit: boolean;
  shifts: any[];
  status: Status;
  availBlock: any | null;
  isOwnRow: boolean;
  isMgr: boolean;
  currentUserId: string | null;
  onAdd: () => void;
  onAvailToggle: () => void;
  onEdit: (s: any) => void;
  onDup: (s: any) => void;
  onCopy: (s: any) => void;
  onSwap: (s: any) => void;
  onClaim?: (s: any) => void;
}) {
  const locked = status === "locked" || status === "published";
  const canToggleAvail = isOwnRow && !isMgr && !locked;

  return (
    <div className="p-1.5 border-r border-border last:border-r-0 min-h-[64px] group hover:bg-secondary/30 transition relative">
      {/* Unavailability block */}
      {availBlock && (
        <div
          className={cn(
            "mb-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold",
            "bg-blue-100 text-blue-700 border border-blue-200",
            canToggleAvail && "cursor-pointer hover:bg-blue-200",
          )}
          onClick={canToggleAvail ? onAvailToggle : undefined}
          title={availBlock.reason || "Unavailable"}
        >
          <UserX className="h-3 w-3 shrink-0" />
          <span>UNAVAILABLE</span>
          {availBlock.reason && <span className="opacity-70 truncate">· {availBlock.reason}</span>}
        </div>
      )}

      {/* Warn managers when scheduling over unavailability */}
      {availBlock && shifts.length > 0 && isMgr && (
        <div className="mb-1 flex items-center gap-1 text-[10px] text-amber-600">
          <AlertCircle className="h-3 w-3" /> scheduled over unavailability
        </div>
      )}

      <div className="space-y-1">
        {shifts.map((s) => (
          <ShiftCard
            key={s.id}
            shift={s}
            status={status}
            canEdit={canEdit}
            isOwnShift={s.employee_id === currentUserId}
            onEdit={onEdit}
            onDup={onDup}
            onCopy={onCopy}
            onSwap={onSwap}
            onClaim={onClaim}
          />
        ))}
        {canEdit && (
          <button
            onClick={onAdd}
            className="w-full text-[11px] text-muted-foreground hover:text-[var(--color-gold)] py-1 rounded-md border border-dashed border-border hover:border-[var(--color-gold)] transition opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            + Add
          </button>
        )}
        {canToggleAvail && !availBlock && (
          <button
            onClick={onAvailToggle}
            className="w-full text-[11px] text-blue-600 hover:text-blue-700 py-1 rounded-md border border-dashed border-blue-300 hover:border-blue-500 transition"
          >
            Mark unavailable
          </button>
        )}

      </div>
    </div>
  );
}

function ShiftCard({
  shift,
  status,
  canEdit,
  isOwnShift,
  onEdit,
  onDup,
  onCopy,
  onSwap,
  onClaim,
}: {
  shift: any;
  status: Status;
  canEdit: boolean;
  isOwnShift: boolean;
  onEdit: (s: any) => void;
  onDup: (s: any) => void;
  onCopy: (s: any) => void;
  onSwap: (s: any) => void;
  onClaim?: (s: any) => void;
}) {
  const bg = SEG_BG[shift.segment] ?? SEG_BG.custom;
  const fg = SEG_FG[shift.segment] ?? SEG_FG.custom;
  const isDraft = status === "draft" || status === "submitted";
  const isLocked = status === "locked" || status === "published";

  // Subtle stripe overlay for locked — kept faint so shift text stays legible
  const lockedBg = isLocked
    ? `repeating-linear-gradient(45deg, ${bg}, ${bg} 14px, rgba(0,0,0,0.06) 14px, rgba(0,0,0,0.06) 16px)`
    : bg;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => canEdit && onEdit(shift)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && canEdit) onEdit(shift);
      }}
      className={cn(
        "w-full text-left rounded-md px-2 py-1.5 transition relative",
        canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default",
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
          {fmtTime12(shift.start_time)}–{fmtTime12(shift.end_time)}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDup(shift);
              }}
              title="Duplicate"
            >
              <Copy className="h-3 w-3" style={{ color: isDraft ? bg : fg }} />
            </button>
          )}
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(shift);
              }}
              title="Copy to another day"
            >
              <CalendarPlus className="h-3 w-3" style={{ color: isDraft ? bg : fg }} />
            </button>
          )}
          {isOwnShift && !canEdit && status === "published" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSwap(shift);
              }}
              title="Request swap"
            >
              <ArrowLeftRight className="h-3 w-3" style={{ color: isDraft ? bg : fg }} />
            </button>
          )}
          {!shift.employee_id && !canEdit && onClaim && status === "published" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClaim(shift);
              }}
              title="Claim this shift"
            >
              <CalendarCheck className="h-3 w-3" style={{ color: isDraft ? bg : fg }} />
            </button>
          )}
        </div>
      </div>
      <div className="text-[10px] label-caps opacity-90 leading-tight mt-0.5 truncate">
        {shift.role} · {shift.segment}
      </div>
    </div>
  );
}

function UnassignedRow({
  days,
  grid,
  status,
  canEdit,
  currentUserId,
  isMgr,
  onAdd,
  onEdit,
  onDup,
  onCopy,
  onClaim,
}: {
  days: string[];
  grid: Map<string, any[]>;
  status: Status;
  canEdit: boolean;
  currentUserId: string | null;
  isMgr: boolean;
  onAdd: (d: string) => void;
  onEdit: (s: any) => void;
  onDup: (s: any) => void;
  onCopy: (s: any) => void;
  onClaim: (s: any) => void;
}) {
  const hasAny = days.some((d) => (grid.get(`unassigned|${d}`) ?? []).length > 0);
  if (!hasAny && !canEdit) return null;
  return (
    <div
      className="grid border-b border-border bg-[#F8F4E8]/40"
      style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(140px,1fr))` }}
    >
      <div className="px-3 py-2 sticky left-0 z-10 bg-[#F8F4E8] border-r border-border">
        <div className="text-sm font-semibold text-[var(--color-gold)]">Open Shifts</div>
        <div className="text-[10px] label-caps text-muted-foreground">Unassigned</div>
      </div>
      {days.map((d) => {
        const cellShifts = grid.get(`unassigned|${d}`) ?? [];
        return (
          <Cell
            key={d}
            canEdit={canEdit}
            shifts={cellShifts}
            status={status}
            availBlock={null}
            isOwnRow={false}
            isMgr={isMgr}
            currentUserId={currentUserId}
            onAdd={() => onAdd(d)}
            onAvailToggle={() => {}}
            onEdit={onEdit}
            onDup={onDup}
            onCopy={onCopy}
            onSwap={() => {}}
            onClaim={onClaim}
          />
        );
      })}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const init = name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full bg-[var(--color-gold)] text-[var(--color-gold-foreground)] grid place-items-center text-[11px] font-semibold shrink-0">
      {init}
    </div>
  );
}

// ============================================================
function AnalyticsBar({
  totals,
  isMgr,
  onSalesTarget,
}: {
  totals: {
    scheduledHrs: number;
    openShifts: number;
    otHrs: number;
    coveragePct: number;
    laborCost: number;
    salesTarget: number | null;
    laborPct: number | null;
  };
  isMgr: boolean;
  onSalesTarget: (t: number) => void;
}) {
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");

  const laborPctTone =
    totals.laborPct == null
      ? undefined
      : totals.laborPct > 35
        ? "danger"
        : totals.laborPct > 28
          ? "warning"
          : undefined;

  const items = [
    { label: "Scheduled", value: `${totals.scheduledHrs.toFixed(0)}h` },
    { label: "Coverage", value: `${totals.coveragePct}%` },
    {
      label: "Overtime",
      value: `${totals.otHrs.toFixed(1)}h`,
      tone: totals.otHrs > 0 ? "danger" : undefined,
    },
    {
      label: "Open Shifts",
      value: `${totals.openShifts}`,
      tone: totals.openShifts > 0 ? "warning" : undefined,
    },
    { label: "Projected Labor", value: `$${Math.round(totals.laborCost).toLocaleString()}` },
  ];

  return (
    <div className="sticky bottom-0 lg:bottom-3 mt-3 z-10">
      <Card className="surface-dark border-[#1C1C1C] text-white p-3">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {items.map((i: any) => (
            <div key={i.label} className="min-w-0">
              <div className="text-[10px] label-caps text-white/50">{i.label}</div>
              <div
                className={cn(
                  "text-lg font-semibold tracking-tight",
                  i.tone === "danger" && "text-[var(--color-danger)]",
                  i.tone === "warning" && "text-[var(--color-warning)]",
                )}
              >
                {i.value}
              </div>
            </div>
          ))}

          {/* Labor % with inline sales target editing */}
          <div className="min-w-0">
            <div className="text-[10px] label-caps text-white/50">Labor %</div>
            {totals.laborPct != null ? (
              <div
                className={cn(
                  "text-lg font-semibold tracking-tight",
                  laborPctTone === "danger" && "text-[var(--color-danger)]",
                  laborPctTone === "warning" && "text-[var(--color-warning)]",
                )}
              >
                {totals.laborPct.toFixed(1)}%
              </div>
            ) : (
              <div className="text-lg font-semibold text-white/40">—</div>
            )}
            {isMgr && !editingTarget && (
              <button
                onClick={() => {
                  setTargetInput(totals.salesTarget ? String(totals.salesTarget) : "");
                  setEditingTarget(true);
                }}
                className="flex items-center gap-1 text-[10px] text-white/40 hover:text-[var(--color-gold)] transition mt-0.5"
              >
                <DollarSign className="h-2.5 w-2.5" />
                {totals.salesTarget
                  ? `$${Math.round(totals.salesTarget).toLocaleString()} target`
                  : "set sales target"}
              </button>
            )}
            {isMgr && editingTarget && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = parseFloat(targetInput.replace(/[^0-9.]/g, ""));
                  if (!isNaN(n) && n > 0) {
                    onSalesTarget(n);
                    setEditingTarget(false);
                  }
                }}
                className="flex items-center gap-1 mt-1"
              >
                <input
                  autoFocus
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="e.g. 8000"
                  className="w-20 text-[11px] bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-gold)]"
                />
                <button type="submit" className="text-[var(--color-gold)]">
                  <Check className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => setEditingTarget(false)}>
                  <X className="h-3 w-3 text-white/40" />
                </button>
              </form>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
function ShiftEditDialog({
  shift,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  canEdit,
  employees,
}: {
  shift: any | null;
  onClose: () => void;
  onSave: (v: any) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  canEdit: boolean;
  employees: any[];
}) {
  if (!shift) return null;
  return (
    <Dialog open={!!shift} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{shift.id ? "Edit Shift" : "New Shift"}</DialogTitle>
        </DialogHeader>
        <ShiftForm
          key={shift.id ?? "new"}
          initial={shift}
          employees={employees}
          onSave={onSave}
          onDelete={shift.id ? () => onDelete(shift.id) : undefined}
          onDuplicate={shift.id ? () => onDuplicate(shift.id) : undefined}
          canEdit={canEdit}
        />
      </DialogContent>
    </Dialog>
  );
}

function ShiftForm({
  initial,
  employees,
  onSave,
  onDelete,
  onDuplicate,
  canEdit,
}: {
  initial: any;
  employees: any[];
  onSave: (v: any) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  canEdit: boolean;
}) {
  const [employeeId, setEmployeeId] = useState<string>(initial.employee_id ?? "__unassigned");
  const [role, setRole] = useState<string>(initial.role ?? "cashier");
  const [segment, setSegment] = useState<string>(initial.segment ?? "mid");
  const [shiftDate, setShiftDate] = useState<string>(initial.shift_date);
  const [startTime, setStartTime] = useState<string>((initial.start_time ?? "11:00").slice(0, 5));
  const [endTime, setEndTime] = useState<string>((initial.end_time ?? "19:00").slice(0, 5));
  const [breakMinutes, setBreak] = useState<number>(initial.break_minutes ?? 30);
  const [notes, setNotes] = useState<string>(initial.notes ?? "");
  const [repeat, setRepeat] = useState<boolean>(!!initial.repeat_weekly);

  // Quick templates
  useEffect(() => {
    if (segment === "open") {
      setStartTime("10:00");
      setEndTime("16:00");
    } else if (segment === "close") {
      setStartTime("16:00");
      setEndTime("00:00");
    } else if (segment === "mid") {
      setStartTime("11:00");
      setEndTime("19:00");
    }
  }, [segment]);


  const hrs = hoursBetween(startTime, endTime, breakMinutes);

  const submit = () =>
    onSave({
      id: initial.id,
      scheduleId: initial.schedule_id,
      employeeId: employeeId === "__unassigned" ? null : employeeId,
      role,
      segment,
      shiftDate,
      startTime,
      endTime,
      breakMinutes,
      notes: notes || undefined,
      repeatWeekly: repeat,
    });

  return (
    <div className="grid gap-3">
      <div>
        <Label>Employee</Label>
        <Select value={employeeId} onValueChange={setEmployeeId} disabled={!canEdit}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unassigned">— Open / Unassigned —</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Segment</Label>
          <Select value={segment} onValueChange={setSegment} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={shiftDate}
            onChange={(e) => setShiftDate(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>Start</Label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>End</Label>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <Label>Break (min)</Label>
          <Input
            type="number"
            value={breakMinutes}
            onChange={(e) => setBreak(Number(e.target.value))}
            disabled={!canEdit}
          />
        </div>
        <div className="text-right text-sm">
          <div className="label-caps text-muted-foreground">Duration</div>
          <div className="font-mono text-lg">{hrs.toFixed(1)}h</div>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={repeat}
          onChange={(e) => setRepeat(e.target.checked)}
          disabled={!canEdit}
        />
        Repeat weekly
      </label>

      <DialogFooter className="flex-wrap gap-2">
        {onDelete && canEdit && (
          <Button
            variant="ghost"
            onClick={onDelete}
            className="text-[var(--color-danger)] hover:text-[var(--color-danger)]"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
        )}
        {onDuplicate && canEdit && (
          <Button variant="outline" onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-1.5" />
            Duplicate
          </Button>
        )}
        <Button
          onClick={submit}
          disabled={!canEdit}
          className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)] hover:opacity-90"
        >
          <Check className="h-4 w-4 mr-1.5" />
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

// ============================================================
// Swap Request Dialog (triggered from shift card)
// ============================================================
function SwapRequestDialog({
  shift,
  onClose,
  onSubmit,
  isPending,
}: {
  shift: any | null;
  onClose: () => void;
  onSubmit: (shiftId: string, reason?: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!shift) setReason("");
  }, [shift]);
  if (!shift) return null;
  return (
    <Dialog open={!!shift} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Request Shift Swap</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-secondary p-3 text-sm">
            <div className="font-semibold">{shift.shift_date}</div>
            <div className="text-muted-foreground">
              {fmtTime12(shift.start_time)} – {fmtTime12(shift.end_time)} · {shift.role}
            </div>
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you need to swap this shift?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={isPending}
            className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)]"
            onClick={() => onSubmit(shift.id, reason || undefined)}
          >
            <Send className="h-4 w-4 mr-1.5" /> Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MyAvailabilityCalendar — standalone day picker shown to crew when
// no schedule exists for the range, so they can still flag days off.
// ============================================================
function MyAvailabilityCalendar({ startStr, endStr }: { startStr: string; endStr: string }) {
  const qc = useQueryClient();
  const { session } = useRole();
  const userId = session?.user?.id ?? null;
  const fetchAvail = useServerFn(listAvailabilityForRange);
  const markUnavail = useServerFn(upsertAvailability);
  const clearUnavail = useServerFn(deleteAvailability);
  const [dlg, setDlg] = useState<{ date: string; existing: any | null } | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["availability", startStr, endStr],
    queryFn: () => fetchAvail({ data: { startDate: startStr, endDate: endStr } }),
    enabled: !!session,
  });
  const mine = useMemo(() => {
    const m = new Map<string, any>();
    for (const b of rows as any[]) if (b.user_id === userId) m.set(b.block_date, b);
    return m;
  }, [rows, userId]);
  const days = useMemo(() => rangeDays(startStr, endStr), [startStr, endStr]);

  const markMut = useMutation({
    mutationFn: (v: { blockDate: string; reason?: string }) => markUnavail({ data: v }),
    onSuccess: (r: any) => {
      toast.success(
        r?.requiresApproval
          ? "Request sent — manager approval required"
          : "Marked unavailable",
      );
      qc.invalidateQueries({ queryKey: ["availability"] });
      setDlg(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const clearMut = useMutation({
    mutationFn: (blockDate: string) => clearUnavail({ data: { blockDate } }),
    onSuccess: () => {
      toast.success("Availability cleared");
      qc.invalidateQueries({ queryKey: ["availability"] });
      setDlg(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Card className="mt-3 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-display text-base">My Availability</div>
            <div className="text-xs text-muted-foreground">Tap a day to flag yourself unavailable.</div>
          </div>
          <UserX className="h-4 w-4 text-blue-600" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {days.map((d) => {
            const dt = new Date(d + "T00:00:00");
            const block = mine.get(d) ?? null;
            const isOff = !!block;
            return (
              <button
                key={d}
                onClick={() => setDlg({ date: d, existing: block })}
                className={cn(
                  "rounded-md border p-2 text-left transition",
                  isOff
                    ? "bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200"
                    : "bg-background border-border hover:border-[var(--color-gold)]",
                )}
              >
                <div className="text-[10px] label-caps text-muted-foreground">
                  {dt.toLocaleDateString([], { weekday: "short" })}
                </div>
                <div className="text-sm font-semibold">
                  {dt.toLocaleDateString([], { month: "short", day: "numeric" })}
                </div>
                <div className="text-[10px] mt-1">
                  {isOff ? (block.reason ? `Off · ${block.reason}` : "Off") : "Available"}
                </div>
              </button>
            );
          })}
        </div>
      </Card>
      <AvailabilityDialog
        entry={dlg ? { userId: userId ?? "", date: dlg.date, existing: dlg.existing } : null}
        onClose={() => setDlg(null)}
        onMark={(date, reason) => markMut.mutate({ blockDate: date, reason })}
        onRemove={(date) => clearMut.mutate(date)}
        isPending={markMut.isPending || clearMut.isPending}
      />
    </>
  );
}


// ============================================================
// Availability Toggle Dialog
// ============================================================
function AvailabilityDialog({
  entry,
  onClose,
  onMark,
  onRemove,
  isPending,
}: {
  entry: { userId: string; date: string; existing: any | null } | null;
  onClose: () => void;
  onMark: (date: string, reason?: string) => void;
  onRemove: (date: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!entry) setReason("");
  }, [entry]);
  if (!entry) return null;
  const { date, existing } = entry;
  const dt = new Date(date + "T00:00:00");
  const label = dt.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Remove Unavailability" : "Mark as Unavailable"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm font-medium">{label}</div>
          {existing ? (
            <p className="text-sm text-muted-foreground">
              You marked yourself unavailable on this day
              {existing.reason ? ` — "${existing.reason}"` : ""}. Remove it?
            </p>
          ) : (
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Doctor's appointment, family event…"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {existing ? (
            <Button disabled={isPending} onClick={() => onRemove(date)}>
              <X className="h-4 w-4 mr-1.5" /> Remove
            </Button>
          ) : (
            <Button
              disabled={isPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => onMark(date, reason || undefined)}
            >
              <UserX className="h-4 w-4 mr-1.5" /> Mark Unavailable
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Shift Swap Panel
// ============================================================
const SWAP_STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  pending: "warning",
  accepted: "success",
  declined: "danger",
  approved: "success",
  cancelled: "neutral",
};

function RequestsPanel({ isMgr }: { isMgr: boolean }) {
  const qc = useQueryClient();
  const { session } = useRole();
  const listMgrFn = useServerFn(listSwapRequests);
  const listMyFn = useServerFn(mySwapRequests);
  const decideFn = useServerFn(decideSwapRequest);
  const listClaimsFn = useServerFn(listClaimRequests);
  const myClaimsFn = useServerFn(myClaimRequests);
  const decideClaimFn = useServerFn(decideClaimRequest);

  const { data: swaps = [], isLoading: swapsLoading } = useQuery({
    queryKey: isMgr ? ["swap-requests"] : ["my-swaps"],
    queryFn: () => (isMgr ? (listMgrFn({ data: {} }) as any) : (listMyFn() as any)),
    enabled: !!session,
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery({
    queryKey: isMgr ? ["claim-requests"] : ["my-claims"],
    queryFn: () =>
      isMgr ? (listClaimsFn({ data: {} }) as any) : (myClaimsFn() as any),
    enabled: !!session,
  });

  const swapDecideMut = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "declined"; note?: string }) =>
      decideFn({ data: v }),
    onSuccess: () => {
      toast.success("Decision saved");
      syncDomains(qc, "swaps", "schedule");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const claimDecideMut = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "declined"; note?: string }) =>
      decideClaimFn({ data: v }),
    onSuccess: () => {
      toast.success("Decision saved");
      syncDomains(qc, "swaps", "schedule");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renderRequestCard = (req: any, type: "swap" | "claim") => {
    const isSwap = type === "swap";
    const mutate = isSwap ? swapDecideMut : claimDecideMut;
    return (
      <Card key={req.id} className="p-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {isSwap ? (
                <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-[10px] label-caps text-muted-foreground">
                {isSwap ? "swap" : "open shift claim"}
              </span>
            </div>
            <div className="font-semibold text-sm">
              {isSwap ? (req.requester_name ?? "Me") : (req.claimant_name ?? "Crew")} → shift on{" "}
              {req.schedule_shifts?.shift_date ?? "—"}
              {req.schedule_shifts?.start_time
                ? ` (${fmtTime12(req.schedule_shifts.start_time)}–${fmtTime12(req.schedule_shifts.end_time)})`
                : ""}
            </div>
            {req.reason && (
              <div className="text-xs text-muted-foreground mt-0.5">"{req.reason}"</div>
            )}
            {req.decision_note && (
              <div className="text-xs text-[var(--color-warning)] mt-0.5">
                Note: {req.decision_note}
              </div>
            )}
            <div className="text-[10px] label-caps text-muted-foreground mt-1">
              {new Date(req.created_at).toLocaleDateString()}
              {req.decided_at && ` · decided ${new Date(req.decided_at).toLocaleDateString()}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill tone={SWAP_STATUS_TONE[req.status] ?? "neutral"}>{req.status}</StatusPill>
            {isMgr && req.status === "pending" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => mutate.mutate({ id: req.id, decision: "approved" })}
                  disabled={mutate.isPending}
                  className="text-[var(--color-success)] border-[var(--color-success)]"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => mutate.mutate({ id: req.id, decision: "declined" })}
                  disabled={mutate.isPending}
                  className="text-[var(--color-danger)] border-[var(--color-danger)]"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const allRequests = [
    ...(swaps as any[]).map((r: any) => ({ ...r, _type: "swap" })),
    ...(claims as any[]).map((r: any) => ({ ...r, _type: "claim" })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const isLoading = swapsLoading || claimsLoading;

  return (
    <div className="space-y-4">
      <div className="font-display text-lg">
        {isMgr ? "Swap & Claim Requests" : "My Requests"}
      </div>

      {isLoading && <Card className="p-4 text-sm text-muted-foreground">Loading…</Card>}

      {!isLoading && allRequests.length === 0 && (
        <Card className="py-10 text-center text-sm text-muted-foreground">
          No requests yet.
        </Card>
      )}

      <div className="space-y-2">
        {allRequests.map((r) => renderRequestCard(r, r._type as "swap" | "claim"))}
      </div>
    </div>
  );
}

// ============================================================
function MyShiftsPanel() {
  const { session } = useRole();
  const listMyFn = useServerFn(listMyScheduleShifts);

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["my-shifts"],
    queryFn: () => listMyFn({ data: {} }) as any,
    enabled: !!session,
  });

  const upcoming = (shifts as any[])
    .filter((s: any) => s.shift_date >= new Date().toISOString().slice(0, 10))
    .sort((a: any, b: any) => a.shift_date.localeCompare(b.shift_date) || a.start_time.localeCompare(b.start_time));

  return (
    <div className="space-y-3">
      <div className="font-display text-lg">My Upcoming Shifts</div>
      {isLoading && <Card className="p-4 text-sm text-muted-foreground">Loading…</Card>}
      {!isLoading && upcoming.length === 0 && (
        <Card className="py-10 text-center text-sm text-muted-foreground">
          No upcoming shifts scheduled.
        </Card>
      )}
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {upcoming.map((s: any) => {
          const bg = SEG_BG[s.segment] ?? SEG_BG.custom;
          const fg = SEG_FG[s.segment] ?? SEG_FG.custom;
          const date = new Date(s.shift_date + "T00:00:00");
          return (
            <div
              key={s.id}
              className="rounded-xl p-4 space-y-1"
              style={{ background: bg, color: fg }}
            >
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
                {date.toLocaleDateString("en-US", { weekday: "long" })}
              </div>
              <div className="font-display text-xl font-bold">
                {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              <div className="text-sm font-semibold">
                {fmtTime12(s.start_time)} – {fmtTime12(s.end_time)}
              </div>
              <div className="text-[11px] label-caps opacity-80">
                {s.role} · {s.segment}
              </div>
              {s.break_minutes > 0 && (
                <div className="text-[11px] opacity-70">{s.break_minutes}m break</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
function ClaimShiftDialog({
  shift,
  onClose,
  onSubmit,
  isPending,
}: {
  shift: any | null;
  onClose: () => void;
  onSubmit: (shiftId: string, reason?: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  if (!shift) return null;
  return (
    <Dialog open={!!shift} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Claim Open Shift</DialogTitle>
          <DialogDescription>
            {shift.shift_date} · {fmtTime12(shift.start_time)}–{fmtTime12(shift.end_time)} · {shift.role}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you want this shift?"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(shift.id, reason || undefined)}
            disabled={isPending}
            className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)] hover:opacity-90"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" /> Submit Claim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
function WeeklyHoursDialog({
  entry,
  onClose,
  onSave,
  isPending,
}: {
  entry: { empId: string; name: string; current: number } | null;
  onClose: () => void;
  onSave: (empId: string, hrs: number) => void;
  isPending: boolean;
}) {
  const [val, setVal] = useState("");
  useEffect(() => {
    if (entry) setVal(String(entry.current));
  }, [entry]);
  if (!entry) return null;
  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle>Weekly Hours Target</DialogTitle>
          <DialogDescription>{entry.name}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label>Target hours per week (0–80)</Label>
          <Input
            type="number"
            min={0}
            max={80}
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const n = parseInt(val, 10);
              if (!isNaN(n) && n >= 0 && n <= 80) onSave(entry.empId, n);
            }}
            disabled={isPending}
            className="bg-[var(--color-gold)] text-[var(--color-gold-foreground)] hover:opacity-90"
          >
            <Check className="h-3.5 w-3.5 mr-1.5" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
