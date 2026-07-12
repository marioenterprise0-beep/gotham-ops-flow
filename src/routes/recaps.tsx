import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { FileText, Send, ClipboardCheck, Archive, Star } from "lucide-react";
import { EmptyState } from "@/components/gotham/EmptyState";
import { saveRecap, listRecaps, getRecap, reviewRecap } from "@/lib/recaps.functions";
import { toast } from "sonner";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { syncDomains } from "@/lib/sync-bus";

export const Route = createFileRoute("/recaps")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Daily Recap · Dip N Shake OS" }] }),
  component: RecapsPage,
});

type RecapSummary = {
  id: string; recap_date: string; manager_id: string; manager_name: string;
  trailer_id: string | null; location: string | null; shift_score: number | null;
  status: "draft" | "submitted" | "reviewed" | "archived";
  submitted_at: string | null; reviewed_at: string | null;
  reviewed_by: string | null; owner_comment: string | null;
};

const TONE: Record<string, "neutral" | "warning" | "success" | "info" | "danger" | "gold"> = {
  draft: "neutral", submitted: "warning", reviewed: "success", archived: "info",
};

function RecapsPage() {
  const qc = useQueryClient();
  const { roleId, trailerScope, trailers, session, loading, userId } = useRole();
  const isManager = roleId === "manager" || roleId === "owner";
  const isOwner = roleId === "owner";
  const isCrew = !isManager;

  const [tab, setTab] = useState<"today" | "pending" | "history">("today");
  const [editorOpen, setEditorOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useServerFn(listRecaps);
  const { data: recaps = [] } = useQuery<RecapSummary[]>({
    queryKey: ["recaps", tab, trailerScope ?? "all", isCrew ? "crew" : "mgr"],
    queryFn: () => list({ data: {
      scope: isCrew ? "mine" : (tab === "today" ? "today" : tab === "pending" ? "pending" : "all"),
      trailerId: trailerScope ?? undefined,
    } }) as Promise<RecapSummary[]>,
    enabled: !loading && !!session?.access_token,
  });

  const myToday = useMemo(() => recaps.find((r) => r.manager_id === userId && r.recap_date === new Date().toISOString().slice(0,10)), [recaps, userId]);



  return (
    <AppShell>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="label-caps text-muted-foreground">Operations</div>
          <h1 className="font-display text-2xl">DAILY RECAP</h1>
        </div>
        <button onClick={() => { setEditorOpen(true); setOpenId(myToday?.id ?? null); }}
          className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-2 text-xs font-semibold inline-flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" /> {myToday ? "Continue today's recap" : "Start today's recap"}
        </button>
      </div>

      <div className="flex gap-2 mt-2">
        {(["today","pending","history"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] border",
              tab === t ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]" : "bg-card text-muted-foreground border-border",
            )}>
            {t === "today" ? "Today" : t === "pending" ? "Pending Review" : "Historical"}
          </button>
        ))}
      </div>

      <SectionHeader eyebrow={tab} title={tab === "today" ? "Today's Recaps" : tab === "pending" ? "Awaiting Owner Review" : "Historical Log"} />

      <div className="space-y-2">
        {recaps.length === 0 && (
          <EmptyState
            icon={FileText}
            title={tab === "today" ? "No recap for today yet" : tab === "pending" ? "No recaps awaiting review" : "No historical recaps"}
            hint={tab === "today" ? "Capture the shift while it's fresh — your team will thank you."
                : tab === "pending" ? "Submitted recaps will land here for owner sign-off."
                : "Reviewed and archived recaps will appear here."}
            actionLabel={tab === "today" ? "Start today's recap" : undefined}
            onAction={tab === "today" ? () => { setEditorOpen(true); setOpenId(myToday?.id ?? null); } : undefined}
          />
        )}
        {recaps.map((r) => (
          <Card key={r.id} className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm">{r.manager_name} · {trailers.find((t) => t.id === r.trailer_id)?.name ?? r.location ?? "—"}</div>
                <div className="label-caps text-muted-foreground mt-0.5">
                  {r.recap_date} {r.shift_score != null && <>· <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3" /> {r.shift_score}/10</span></>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill tone={TONE[r.status]}>{r.status}</StatusPill>
                <button onClick={() => { setOpenId(r.id); setEditorOpen(true); }} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Open</button>
              </div>
            </div>
            {r.owner_comment && <div className="mt-2 text-xs italic text-muted-foreground">Owner: {r.owner_comment}</div>}
          </Card>
        ))}
      </div>

      {editorOpen && (
        <RecapEditor
          id={openId}
          isOwner={isOwner}
          isCrew={isCrew}
          defaultTrailerId={trailerScope}
          onClose={() => { setEditorOpen(false); setOpenId(null); }}
          onSaved={() => syncDomains(qc, "recaps", "alerts")}
        />
      )}


      <div className="h-6" />
    </AppShell>
  );
}

const SECTIONS: Array<{ heading: string; fields: Array<{ key: string; label: string }> }> = [
  { heading: "Operations", fields: [
    { key: "opsWentWell", label: "What went well" },
    { key: "opsSlowed", label: "What slowed operations" },
    { key: "opsAttention", label: "What needs attention" },
  ]},
  { heading: "Inventory", fields: [
    { key: "invLowStock", label: "Low stock" },
    { key: "invConcerns", label: "Inventory concerns" },
    { key: "invOrders", label: "Orders submitted" },
  ]},
  { heading: "Labor", fields: [
    { key: "laborAttendance", label: "Attendance" },
    { key: "laborStaffing", label: "Staffing concerns" },
    { key: "laborPerformance", label: "Performance notes" },
  ]},
  { heading: "Hospitality", fields: [
    { key: "hospFeedback", label: "Customer feedback" },
    { key: "hospWins", label: "Wins" },
    { key: "hospComplaints", label: "Complaints" },
  ]},
  { heading: "Next Shift Notes", fields: [
    { key: "nextShiftNotes", label: "Anything next crew should know" },
  ]},
];

const FIELD_TO_DB: Record<string, string> = {
  opsWentWell: "ops_went_well", opsSlowed: "ops_slowed", opsAttention: "ops_attention",
  invLowStock: "inv_low_stock", invConcerns: "inv_concerns", invOrders: "inv_orders",
  laborAttendance: "labor_attendance", laborStaffing: "labor_staffing", laborPerformance: "labor_performance",
  hospFeedback: "hosp_feedback", hospWins: "hosp_wins", hospComplaints: "hosp_complaints",
  nextShiftNotes: "next_shift_notes",
};

function RecapEditor({ id, isOwner, isCrew = false, defaultTrailerId, onClose, onSaved }: {
  id: string | null; isOwner: boolean; isCrew?: boolean; defaultTrailerId: string | null;
  onClose: () => void; onSaved: () => void;
}) {

  const { trailers, userId } = useRole();
  const get = useServerFn(getRecap);
  const save = useServerFn(saveRecap);
  const review = useServerFn(reviewRecap);

  const { data: existing, isLoading } = useQuery<any>({
    queryKey: ["recap", id],
    queryFn: () => get({ data: { id: id! } }) as any,
    enabled: !!id,
  });

  const [form, setForm] = useState<Record<string, any>>({});
  const [trailerId, setTrailerId] = useState<string | null>(defaultTrailerId);
  const [shiftScore, setShiftScore] = useState<number | "">("");
  const [location, setLocation] = useState<string>("");
  const [ownerComment, setOwnerComment] = useState("");

  // Initialize when loaded
  const initialized = !id || (existing && !isLoading);
  if (existing && form.__id !== existing.id) {
    const f: Record<string, any> = { __id: existing.id };
    for (const k of Object.keys(FIELD_TO_DB)) f[k] = existing[FIELD_TO_DB[k]] ?? "";
    setForm(f);
    setTrailerId(existing.trailer_id ?? defaultTrailerId);
    setShiftScore(existing.shift_score ?? "");
    setLocation(existing.location ?? "");
    setOwnerComment(existing.owner_comment ?? "");
  }

  const isOwn = !existing || existing.manager_id === userId;
  const status = existing?.status ?? "draft";
  const editable = isOwn && (status === "draft" || !existing);

  const saveM = useMutation({
    mutationFn: (submit: boolean) => save({ data: {
      id: existing?.id,
      submit,
      kind: isCrew ? "crew" : "manager",
      trailerId: trailerId ?? null,
      location: location || null,
      shiftScore: shiftScore === "" ? null : Number(shiftScore),
      ...Object.fromEntries(Object.keys(FIELD_TO_DB).map((k) => [k, form[k] ?? null])),
    } }) as any,

    onSuccess: (_d, submit) => {
      toast.success(submit ? "Submitted to owner" : "Draft saved");
      onSaved(); onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const reviewM = useMutation({
    mutationFn: (action: "review" | "archive") => review({ data: { id: existing!.id, action, comment: ownerComment || undefined } }) as any,
    onSuccess: (_d, action) => { toast.success(action === "archive" ? "Archived" : "Marked reviewed"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl p-5 card-shadow max-h-[92vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h3 className="font-display text-xl">DAILY RECAP</h3>
            {existing && <div className="text-xs text-muted-foreground mt-0.5">{existing.manager_name} · {existing.recap_date} · {status}</div>}
          </div>
          <button onClick={onClose} className="text-muted-foreground text-sm">✕</button>
        </div>

        {id && isLoading ? <div>Loading…</div> : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Location">
                <select disabled={!editable} value={trailerId ?? ""} onChange={(e) => setTrailerId(e.target.value || null)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
                  <option value="">—</option>
                  {trailers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="Shift label (optional)">
                <input disabled={!editable} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Saturday Dinner" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
              </Field>
              <Field label="Shift Score (1–10)">
                <input disabled={!editable} type="number" min={1} max={10} value={shiftScore} onChange={(e) => setShiftScore(e.target.value === "" ? "" : Number(e.target.value))} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
              </Field>
            </div>

            {SECTIONS.map((sec) => (
              <div key={sec.heading} className="border-t border-border pt-3">
                <div className="label-caps text-[var(--color-gold)] mb-2">{sec.heading}</div>
                <div className="space-y-2">
                  {sec.fields.map((f) => (
                    <Field key={f.key} label={f.label}>
                      <textarea disabled={!editable} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        rows={2} className="w-full rounded-md border border-border bg-card p-2 text-sm" />
                    </Field>
                  ))}
                </div>
              </div>
            ))}

            {isOwner && existing && status === "submitted" && (
              <div className="border-t border-border pt-3">
                <div className="label-caps text-[var(--color-gold)] mb-2">Owner Review</div>
                <Field label="Comment (optional)">
                  <textarea value={ownerComment} onChange={(e) => setOwnerComment(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-card p-2 text-sm" />
                </Field>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2 flex-wrap">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm border border-border">Close</button>
          {editable && (
            <>
              <button disabled={saveM.isPending} onClick={() => saveM.mutate(false)} className="rounded-md px-3 py-2 text-sm border border-border disabled:opacity-50">Save Draft</button>
              <button disabled={saveM.isPending} onClick={() => saveM.mutate(true)} className="rounded-md px-4 py-2 text-sm font-semibold bg-[var(--color-gold)] text-[#0A0A0A] inline-flex items-center gap-2 disabled:opacity-50">
                <Send className="h-4 w-4" /> Submit to Owner
              </button>
            </>
          )}
          {isOwner && existing && status === "submitted" && (
            <>
              <button disabled={reviewM.isPending} onClick={() => reviewM.mutate("review")} className="rounded-md px-3 py-2 text-sm font-semibold bg-[var(--color-success)] text-white inline-flex items-center gap-2 disabled:opacity-50">
                <ClipboardCheck className="h-4 w-4" /> Mark Reviewed
              </button>
            </>
          )}
          {isOwner && existing && (status === "reviewed" || status === "submitted") && (
            <button disabled={reviewM.isPending} onClick={() => reviewM.mutate("archive")} className="rounded-md px-3 py-2 text-sm border border-border inline-flex items-center gap-2 disabled:opacity-50">
              <Archive className="h-4 w-4" /> Archive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="label-caps text-muted-foreground mb-1">{label}</div>{children}</label>;
}
