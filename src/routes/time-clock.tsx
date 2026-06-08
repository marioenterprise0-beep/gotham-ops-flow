import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { Clock, LogIn, LogOut, FileText, Calendar, MessageSquare, MapPin } from "lucide-react";
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

  const inM = useMutation({
    mutationFn: async () => {
      const geo = await getGeo();
      if (!geo) throw new Error("Location is required to clock in. Please enable location access in your browser settings.");
      return inFn({ data: {
        deviceInfo: { ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "" },
        lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy,
      } });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Clocked in");
      syncDomains(qc, "timeclock", "labor", "operations");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const outM = useMutation({
    mutationFn: () => outFn({ data: { breakMinutes: 0 } }),
    onSuccess: () => { toast.success("Clocked out"); syncDomains(qc, "timeclock", "labor", "operations"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div>
        <div className="label-caps text-muted-foreground">{trailerName} · Welcome</div>
        <h1 className="font-display text-3xl text-foreground">{user.toUpperCase()}</h1>
      </div>

      <Card className="mt-6 p-6 text-center">
        <Clock className="h-8 w-8 mx-auto text-[var(--color-gold)]" />
        <div className="mt-2 text-sm text-muted-foreground">
          {active ? "Currently clocked in" : "Ready to start your shift"}
        </div>
        {active && (
          <div className="mt-2 text-3xl font-display text-foreground">{fmtDuration(elapsed)}</div>
        )}
        <div className="mt-4">
          {!active ? (
            <Button size="lg" className="px-10 h-14 text-base" onClick={() => inM.mutate()} disabled={inM.isPending}>
              <LogIn className="h-5 w-5" /> Clock In
            </Button>
          ) : (
            <Button size="lg" variant="destructive" className="px-10 h-14 text-base" onClick={() => outM.mutate()} disabled={outM.isPending}>
              <LogOut className="h-5 w-5" /> Clock Out
            </Button>
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
              {week.flags.map((f) => <StatusPill key={f} tone="warning">{f.replace(/_/g, " ")}</StatusPill>)}
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
