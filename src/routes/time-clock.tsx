import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  clockIn, clockOut, getMyActivePunch, getMyWeek,
  submitCorrection, submitTimeOff, submitShiftNote, listMyRequests,
} from "@/lib/timeclock.functions";
import { listMyTasks } from "@/lib/tasks.functions";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { supabase } from "@/integrations/supabase/client";
import { Clock, LogIn, LogOut, FileText, Calendar, MessageSquare, MapPin, AlertTriangle, Coffee, CameraIcon } from "lucide-react";

const BREAK_KEY  = "gotham:break-start:v1";
const BREAK_ACC  = "gotham:break-acc:v1";   // accumulated break minutes from prior breaks this punch

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { syncDomains } from "@/lib/sync-bus";

export const Route = createFileRoute("/time-clock")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Time Clock · Gotham OS" }] }),
  component: TimeClockPage,
});

function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

function TimeClockPage() {
  const qc = useQueryClient();
  const { user, trailers, homeTrailerId } = useRole();
  const trailerName = trailers.find((t) => t.id === homeTrailerId)?.name ?? "—";

  const activeFn = useServerFn(getMyActivePunch);
  const weekFn = useServerFn(getMyWeek);
  const inFn = useServerFn(clockIn);
  const outFn = useServerFn(clockOut);

  const { data: active } = useQuery({ queryKey: ["my-active-punch"], queryFn: () => activeFn(), refetchInterval: 30_000 });
  const { data: week } = useQuery({ queryKey: ["my-week"], queryFn: () => weekFn({ data: {} }) });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  // Break tracking — persisted in localStorage so it survives page refresh
  const [onBreak, setOnBreak] = useState<boolean>(() => !!localStorage.getItem(BREAK_KEY));
  const [breakStart, setBreakStart] = useState<number | null>(() => {
    const v = localStorage.getItem(BREAK_KEY); return v ? Number(v) : null;
  });
  const [breakAccMin, setBreakAccMin] = useState<number>(() => Number(localStorage.getItem(BREAK_ACC) ?? "0"));

  const breakElapsedMin = onBreak && breakStart ? (now.getTime() - breakStart) / 60000 : 0;
  const totalBreakMin = breakAccMin + breakElapsedMin;

  function startBreak() {
    const t = Date.now();
    localStorage.setItem(BREAK_KEY, String(t));
    setBreakStart(t); setOnBreak(true);
  }
  function endBreak() {
    const extra = breakStart ? (Date.now() - breakStart) / 60000 : 0;
    const newAcc = breakAccMin + extra;
    localStorage.setItem(BREAK_ACC, String(newAcc));
    localStorage.removeItem(BREAK_KEY);
    setBreakAccMin(newAcc); setBreakStart(null); setOnBreak(false);
  }
  function clearBreakState() {
    localStorage.removeItem(BREAK_KEY); localStorage.removeItem(BREAK_ACC);
    setOnBreak(false); setBreakStart(null); setBreakAccMin(0);
  }
  // Reset break state when no active punch
  useEffect(() => { if (!active) clearBreakState(); }, [active]);

  // Selfie capture
  const selfieRef = useRef<HTMLInputElement>(null);
  const [selfieUploading, setSelfieUploading] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  async function captureSelfie(): Promise<string | null> {
    return new Promise((resolve) => {
      if (!selfieRef.current) return resolve(null);
      const input = selfieRef.current;

      let settled = false;
      const settle = (url: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        window.removeEventListener("focus", onWindowFocus);
        input.removeEventListener("change", onChange);
        setSelfieUploading(false);
        resolve(url);
      };

      // Detect file picker dismissed without selecting (focus returns to window)
      const onWindowFocus = () => setTimeout(() => { if (!input.files?.length) settle(null); }, 300);
      // Hard fallback — never block clock-in longer than 30s
      const timer = setTimeout(() => settle(null), 30_000);

      const onChange = async () => {
        window.removeEventListener("focus", onWindowFocus);
        clearTimeout(timer);
        const file = input.files?.[0];
        if (!file) return settle(null);
        setSelfieUploading(true);
        try {
          const ext = file.name.split(".").pop() ?? "jpg";
          const path = `selfies/${Date.now()}_clockin.${ext}`;
          const { error } = await supabase.storage.from("gotham-photos").upload(path, file, { upsert: true });
          if (error) { settle(null); return; }
          const { data: signed } = await supabase.storage.from("gotham-photos").createSignedUrl(path, 60 * 60 * 8);
          setSelfieUrl(signed?.signedUrl ?? null);
          settle(signed?.signedUrl ?? null);
        } catch { settle(null); }
      };

      window.addEventListener("focus", onWindowFocus, { once: true });
      input.addEventListener("change", onChange);
      input.click();
    });
  }

  const elapsed = active?.clock_in_at
    ? Math.max(0, (now.getTime() - new Date(active.clock_in_at).getTime()) / 60000)
    : 0;

  async function getGeo(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
    });
  }

  const [geoBlock, setGeoBlock] = useState<string | null>(null);

  const inM = useMutation({
    mutationFn: async () => {
      const geo = await getGeo();
      if (!geo) throw new Error("LOCATION_OFF");
      // Only prompt for a selfie on touch devices (front camera). On desktop
      // the file picker can hang the clock-in for up to 30s if dismissed
      // without the window losing focus. Fire-and-forget so the punch is
      // never blocked by photo capture.
      const isTouch = typeof window !== "undefined" &&
        (("ontouchstart" in window) || (navigator as any).maxTouchPoints > 0);
      if (isTouch) {
        void captureSelfie().catch(() => null);
      }
      return inFn({ data: {
        deviceInfo: {
          ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "",
          ...(geo.accuracy > 30 ? { low_gps_accuracy: true, gps_accuracy_m: Math.round(geo.accuracy) } : {}),
        },
        lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy,
      } });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setGeoBlock(result.message);
        return;
      }
      const assigned = (result as any).assignedTaskCount ?? 0;
      toast.success(assigned > 0 ? `Clocked in · ${assigned} task${assigned === 1 ? "" : "s"} assigned` : "Clocked in");
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      syncDomains(qc, "timeclock", "labor", "operations", "tasks");
    },
    onError: (e: Error) => {
      if (e.message === "LOCATION_OFF") {
        setGeoBlock("Location access is required to clock in. Please enable location in your browser settings and try again at the trailer.");
        return;
      }
      toast.error(e.message);
    },
  });
  const tasksFn = useServerFn(listMyTasks);
  const { data: myTasks = [] } = useQuery<any[]>({
    queryKey: ["my-tasks"],
    queryFn: () => tasksFn() as Promise<any[]>,
    refetchInterval: 30_000,
  });
  const incompleteTasks = myTasks.filter((t: any) => t.status !== "done" && t.status !== "signed_off" && t.status !== "missed");
  const [confirmOut, setConfirmOut] = useState(false);

  const outM = useMutation({
    mutationFn: () => {
      // End break if active before clocking out
      if (onBreak && breakStart) endBreak();
      const finalBreakMin = Math.round(onBreak && breakStart
        ? breakAccMin + (Date.now() - breakStart) / 60000
        : breakAccMin);
      return outFn({ data: { breakMinutes: finalBreakMin } });
    },
    onSuccess: (result: any) => {
      const missed = result?.missedTaskCount ?? 0;
      toast.success(missed > 0 ? `Clocked out · ${missed} task${missed === 1 ? "" : "s"} marked missed` : "Clocked out");
      setConfirmOut(false);
      clearBreakState();
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      syncDomains(qc, "timeclock", "labor", "operations", "tasks");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleClockOut = () => {
    if (incompleteTasks.length > 0) setConfirmOut(true);
    else outM.mutate();
  };


  return (
    <AppShell>
      <div>
        <div className="label-caps text-muted-foreground">{trailerName} · Welcome</div>
        <h1 className="font-display text-3xl text-foreground">{user.toUpperCase()}</h1>
      </div>

      {/* Hidden file input for selfie capture (opens front camera on mobile) */}
      <input ref={selfieRef} type="file" accept="image/*" capture="user" className="hidden" aria-hidden />

      <Card className="mt-6 p-6 text-center">
        <Clock className="h-8 w-8 mx-auto text-[var(--color-gold)]" />
        <div className="mt-2 text-sm text-muted-foreground">
          {active ? (onBreak ? "On break" : "Currently clocked in") : "Ready to start your shift"}
        </div>
        {active && (
          <div className="mt-2 text-3xl font-display text-foreground">
            {onBreak
              ? <span className="text-[var(--color-gold)]">{fmtDuration(elapsed)}</span>
              : fmtDuration(elapsed - totalBreakMin)}
          </div>
        )}
        {active && totalBreakMin > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">
            Break: {fmtDuration(totalBreakMin)}
          </div>
        )}
        {selfieUploading && (
          <div className="mt-1 text-xs text-[var(--color-gold)]">Uploading clock-in photo…</div>
        )}
        <div className="mt-4 flex flex-col items-center gap-3">
          {!active ? (
            <Button size="lg" className="px-10 h-14 text-base" onClick={() => inM.mutate()} disabled={inM.isPending || selfieUploading}>
              <LogIn className="h-5 w-5" /> {inM.isPending ? "Clocking in…" : "Clock In"}
            </Button>
          ) : (
            <>
              <Button size="lg" variant="destructive" className="px-10 h-14 text-base" onClick={handleClockOut} disabled={outM.isPending}>
                <LogOut className="h-5 w-5" /> Clock Out
              </Button>
              {!onBreak ? (
                <Button size="sm" variant="outline" onClick={startBreak} className="gap-2">
                  <Coffee className="h-4 w-4" /> Start Break
                </Button>
              ) : (
                <Button size="sm" onClick={endBreak} className="gap-2 bg-[var(--color-gold)] text-[#0A0A0A] hover:bg-[var(--color-gold)]/90">
                  <Coffee className="h-4 w-4" /> End Break
                </Button>
              )}
            </>
          )}
        </div>
      </Card>

      {week && (
        <>
          <SectionHeader eyebrow={`Payroll week starting ${week.weekStart}`} title="THIS WEEK" />
          <div className="grid grid-cols-3 gap-3">
            <KPI label="Scheduled" value={fmtDuration(week.scheduledMin)} />
            <KPI label="Worked" value={fmtDuration(week.workedMin)} />
            <KPI label="Difference" value={(week.diffMin >= 0 ? "+" : "") + fmtDuration(Math.abs(week.diffMin))} tone={week.diffMin < -30 ? "warning" : "default"} />
          </div>
          {week.flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {week.flags.map((f: string) => (
                <StatusPill key={f} tone={f === "no_break_on_long_shift" ? "danger" : "warning"}>
                  {f === "no_break_on_long_shift" ? "Long shift — no break recorded" : f.replace(/_/g, " ")}
                </StatusPill>
              ))}
            </div>
          )}
        </>
      )}

      <SectionHeader eyebrow="Requests & notes" title="SUBMIT" />
      <Tabs defaultValue="note">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="note"><MessageSquare className="h-3.5 w-3.5 mr-1" />Note</TabsTrigger>
          <TabsTrigger value="correction"><FileText className="h-3.5 w-3.5 mr-1" />Correction</TabsTrigger>
          <TabsTrigger value="timeoff"><Calendar className="h-3.5 w-3.5 mr-1" />Time off</TabsTrigger>
        </TabsList>
        <TabsContent value="note"><NoteForm /></TabsContent>
        <TabsContent value="correction"><CorrectionForm /></TabsContent>
        <TabsContent value="timeoff"><TimeOffForm /></TabsContent>
      </Tabs>

      <MyHistory />
      <div className="h-6" />

      <AlertDialog open={!!geoBlock} onOpenChange={(o) => !o && setGeoBlock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[var(--color-gold)]" />
              You're not at the trailer
            </AlertDialogTitle>
            <AlertDialogDescription>
              {geoBlock ?? ""}
              <br />
              <br />
              You must be on-site within the trailer's geofence to clock in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setGeoBlock(null)}>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOut} onOpenChange={setConfirmOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--color-warning,#C0392B)]" />
              {incompleteTasks.length} task{incompleteTasks.length === 1 ? "" : "s"} still open
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <div className="mb-2">If you clock out now, these will be marked missed:</div>
                <ul className="list-disc pl-5 space-y-1 max-h-48 overflow-auto text-sm">
                  {incompleteTasks.slice(0, 10).map((t: any) => <li key={t.id}>{t.title}</li>)}
                  {incompleteTasks.length > 10 && <li className="text-muted-foreground">+ {incompleteTasks.length - 10} more</li>}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmOut(false)}>Keep working</Button>
            <AlertDialogAction onClick={() => outM.mutate()} disabled={outM.isPending}>Clock out anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppShell>
  );
}

function KPI({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <Card className="p-3 text-center">
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-display", tone === "warning" ? "text-[var(--color-warning,#C0392B)]" : "text-foreground")}>{value}</div>
    </Card>
  );
}

function NoteForm() {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const fn = useServerFn(submitShiftNote);
  const m = useMutation({
    mutationFn: () => fn({ data: { note } }),
    onSuccess: () => { toast.success("Note submitted"); setNote(""); syncDomains(qc, "labor", "timeclock"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="mt-3 p-4 space-y-3">
      <Label>Note</Label>
      <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Forgot to clock out, stayed 15 minutes late." />
      <Button onClick={() => m.mutate()} disabled={!note.trim() || m.isPending}>Submit note</Button>
    </Card>
  );
}

function CorrectionForm() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<"missed_in" | "missed_out" | "wrong_time" | "extra_time" | "left_early" | "stayed_late" | "other">("missed_out");
  const [forDate, setForDate] = useState(today);
  const [inTime, setInTime] = useState("");
  const [outTime, setOutTime] = useState("");
  const [reason, setReason] = useState("");
  const fn = useServerFn(submitCorrection);
  const m = useMutation({
    mutationFn: () => fn({
      data: {
        type, forDate, reason,
        requestedIn: inTime ? new Date(`${forDate}T${inTime}:00`).toISOString() : null,
        requestedOut: outTime ? new Date(`${forDate}T${outTime}:00`).toISOString() : null,
      },
    }),
    onSuccess: () => { toast.success("Correction sent for approval"); setReason(""); setInTime(""); setOutTime(""); syncDomains(qc, "labor", "timeclock", "alerts"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="mt-3 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm">
            <option value="missed_in">Missed clock in</option>
            <option value="missed_out">Missed clock out</option>
            <option value="wrong_time">Wrong time</option>
            <option value="extra_time">Extra time worked</option>
            <option value="left_early">Left early</option>
            <option value="stayed_late">Stayed late</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={forDate} onChange={(e) => setForDate(e.target.value)} />
        </div>
        <div>
          <Label>Clock-in time</Label>
          <Input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} />
        </div>
        <div>
          <Label>Clock-out time</Label>
          <Input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Reason</Label>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <Button onClick={() => m.mutate()} disabled={!reason.trim() || m.isPending}>Send to owner</Button>
    </Card>
  );
}

function TimeOffForm() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [fullDay, setFullDay] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const fn = useServerFn(submitTimeOff);
  const m = useMutation({
    mutationFn: () => fn({ data: { startDate, endDate, fullDay, startTime: startTime || null, endTime: endTime || null, reason, notes } }),
    onSuccess: () => { toast.success("Time off requested"); setReason(""); setNotes(""); syncDomains(qc, "labor", "timeclock", "alerts"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="mt-3 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><Label>End date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={fullDay} onChange={(e) => setFullDay(e.target.checked)} /> Full day(s)
      </label>
      {!fullDay && (
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start time</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          <div><Label>End time</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
        </div>
      )}
      <div><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Family event" /></div>
      <div><Label>Notes (optional)</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <Button onClick={() => m.mutate()} disabled={!reason.trim() || m.isPending}>Submit request</Button>
    </Card>
  );
}

function MyHistory() {
  const fn = useServerFn(listMyRequests);
  const { data } = useQuery({ queryKey: ["my-requests"], queryFn: () => fn() });
  if (!data) return null;
  const items = [
    ...data.corrections.map((c: any) => ({ kind: "Correction", title: c.type.replace(/_/g, " "), status: c.status, date: c.for_date, created: c.created_at, note: c.reason })),
    ...data.timeOff.map((t: any) => ({ kind: "Time off", title: `${t.start_date} → ${t.end_date}`, status: t.status, date: t.start_date, created: t.created_at, note: t.reason })),
    ...data.notes.map((n: any) => ({ kind: "Note", title: n.note.slice(0, 80), status: "submitted", date: n.for_date, created: n.created_at, note: null })),
  ].sort((a, b) => (a.created < b.created ? 1 : -1)).slice(0, 20);
  if (items.length === 0) return null;
  return (
    <>
      <SectionHeader eyebrow="Audit trail" title="MY SUBMISSIONS" />
      <Card className="p-0 overflow-hidden">
        {items.map((it, i) => (
          <div key={i} className={cn("p-3 flex items-center justify-between gap-3", i && "border-t border-border")}>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{it.kind} · {it.title}</div>
              {it.note && <div className="text-xs text-muted-foreground truncate">{it.note}</div>}
              <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(it.created).toLocaleString()}</div>
            </div>
            <StatusPill tone={it.status === "approved" ? "success" : it.status === "declined" ? "danger" : "warning"}>{it.status}</StatusPill>
          </div>
        ))}
      </Card>
    </>
  );
}
