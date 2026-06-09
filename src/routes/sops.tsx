import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { ChefHat, Coffee, Shield, Sparkles, Heart, Search, ArrowLeft, Check, Plus, Trash2, Pencil, History, Paperclip, X, Upload, Download, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncDomains } from "@/lib/sync-bus";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { listSops, upsertSop, deleteSop, listSopVersions, listSopAttachments, addSopAttachment, deleteSopAttachment, recordSopView, acknowledgeSop, getMySopAcks, getSopAckRollup, scanSopDependencies, archiveSop, restoreSop } from "@/lib/sops.functions";
import { useRole } from "@/lib/role";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/sops")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "SOP Library · Gotham OS" }] }),
  component: SOPs,
});


type Cat = "All" | "Kitchen" | "Front" | "Management" | "Cleaning" | "Hospitality";

type SOP = {
  id: string; title: string; cat: Exclude<Cat, "All">; role: string; readMin: number;
  updated: string;
  objective: string;
  steps: string[];
  standard: string;
  errors: string[];
};

const SOPS: SOP[] = [
  // Kitchen
  { id: "k1", title: "How to Smash and Cook a Burger Patty", cat: "Kitchen", role: "Grill Master", readMin: 4, updated: "2 days ago",
    objective: "Produce a 4 oz patty with crisp lace edge and pink interior at 160°F.",
    steps: ["Pull ball from cold storage", "Place on 400°F flat top", "Smash with press for 8 seconds", "Salt immediately", "Flip at 90 seconds", "Cheese at flip, melt 30s", "Plate within 15 seconds of pull"],
    standard: "Internal temp 160°F. Lace edge visible. Melted cheese.",
    errors: ["Press not held flat", "Salted before smash (steams)", "Flipped too early"] },
  { id: "k2", title: "Grill Startup and Shutdown Procedure", cat: "Kitchen", role: "Grill Master", readMin: 3, updated: "1 week ago",
    objective: "Safely bring grill to operating temp and shut down without residue buildup.",
    steps: ["Confirm hood vent on", "Ignite at low for 90s", "Ramp to 400°F", "Scrape & oil at shutdown", "Cover when cool"],
    standard: "Reaches 400°F within 8 min. No carbon buildup.",
    errors: ["Ramped before vent on", "Skipped scrape on shutdown"] },
  { id: "k3", title: "Cold Storage Temperature Protocol", cat: "Kitchen", role: "Grill Master", readMin: 2, updated: "today",
    objective: "Maintain 34–38°F at all times. Verify every shift.",
    steps: ["Open door for ≤10s", "Verify thermometer reads 34–38°F", "Log on opening checklist", "If outside range, escalate"],
    standard: "Reading 34–38°F. Logged twice daily.",
    errors: ["Door left ajar", "Reading from rear of unit only"] },
  { id: "k4", title: "Mise en Place Setup Standard", cat: "Kitchen", role: "Prep", readMin: 3, updated: "3 days ago",
    objective: "All ingredients staged before service.", steps: ["Stage sauces", "Slice toppings", "Portion patties", "Label & cover"],
    standard: "All bins labeled, dated, covered.", errors: ["Unlabeled bins", "Mixed dates"] },
  { id: "k5", title: "Protein Thaw and Holding Protocol", cat: "Kitchen", role: "Prep", readMin: 2, updated: "1 week ago",
    objective: "Thaw safely under refrigeration. Never on counter.",
    steps: ["Pull from freezer 24h prior", "Hold below 38°F", "Use within 48h"],
    standard: "FIFO. No counter thaw.",
    errors: ["Counter thaw", "Lost date tags"] },
  // Front
  { id: "f1", title: "Guest Greeting Standard", cat: "Front", role: "Cashier", readMin: 1, updated: "today",
    objective: "Greet every guest within 5 seconds.",
    steps: ["Make eye contact", "Smile", "Say: 'Welcome to Gotham Halal!'", "Offer combo upsell"],
    standard: "5-second rule. Verbal greeting + eye contact.",
    errors: ["Silent greeting", "No eye contact"] },
  { id: "f2", title: "Order Taking and Upsell Script", cat: "Front", role: "Cashier", readMin: 2, updated: "2 weeks ago",
    objective: "Confirm order and upsell drink or combo on every ticket.",
    steps: ["Repeat back order", "Ask drink", "Confirm size/combo", "Read total"],
    standard: "Upsell asked 100% of orders.",
    errors: ["Skipped upsell", "Did not confirm total"] },
  { id: "f3", title: "Drink Station Setup", cat: "Front", role: "Cashier", readMin: 2, updated: "1 week ago",
    objective: "Stage cups, lids, straws, ice for full shift.",
    steps: ["Stack cups L→S", "Lids matched", "Ice topped at start"], standard: "Station fully stocked at open.", errors: ["Ice empty", "Mismatched lids"] },
  { id: "f4", title: "Counter Cleanliness Cycle", cat: "Front", role: "Cashier", readMin: 2, updated: "today",
    objective: "Wipe-down every 15 minutes during service.",
    steps: ["Clear debris", "Sanitize wipe", "Restock napkins"], standard: "15-min cadence. No visible debris.", errors: ["Cycle skipped", "Wet counter"] },
  // Management
  { id: "m1", title: "Shift Handoff Protocol", cat: "Management", role: "Shift Lead", readMin: 3, updated: "4 days ago",
    objective: "Transfer all relevant state to next shift lead.",
    steps: ["Walk inventory together", "Review open issues", "Sign handoff log"], standard: "Both leads signed.", errors: ["Verbal-only handoff"] },
  { id: "m2", title: "Corrective Action Documentation", cat: "Management", role: "Manager", readMin: 4, updated: "1 week ago",
    objective: "Document any task failure with timestamp + action taken.",
    steps: ["Capture failure", "Note corrective action", "Sign + timestamp", "Escalate if needed"], standard: "Every fail has documented action.", errors: ["No corrective action recorded"] },
  { id: "m3", title: "Inventory Receiving Procedure", cat: "Management", role: "Shift Lead", readMin: 3, updated: "2 weeks ago",
    objective: "Verify quantity, temp, and condition at delivery.",
    steps: ["Check invoice vs items", "Temp probe proteins", "Sign receipt"], standard: "Proteins ≤40°F.", errors: ["No temp probe"] },
  { id: "m4", title: "End of Shift Summary Process", cat: "Management", role: "Shift Lead", readMin: 3, updated: "today",
    objective: "Summarize tickets, waste, hospitality, incidents.",
    steps: ["Pull POS report", "Reconcile waste log", "Submit summary"], standard: "Submitted within 30 min of close.", errors: ["Late submission"] },
  // Cleaning
  { id: "c1", title: "30-Minute Cleaning Cycle", cat: "Cleaning", role: "Cashier", readMin: 2, updated: "today",
    objective: "Rotate cleaning every 30 minutes during service.",
    steps: ["Counter wipe", "Trash check", "Floor sweep"], standard: "30-min cadence verified.", errors: ["Skipped cycles"] },
  { id: "c2", title: "Grill Deep Clean Protocol", cat: "Cleaning", role: "Grill Master", readMin: 5, updated: "1 week ago",
    objective: "Weekly deep clean of flat top.",
    steps: ["Cool to 200°F", "Scrape carbon", "Degreaser", "Rinse + season"], standard: "No residue. Seasoned.", errors: ["Cleaned hot (warps)"] },
  { id: "c3", title: "Front Counter Reset Standard", cat: "Cleaning", role: "Cashier", readMin: 2, updated: "3 days ago",
    objective: "Reset counter to spec between rushes.",
    steps: ["Clear", "Wipe", "Restock"], standard: "Spec photo matched.", errors: ["Skipped restock"] },
  // Hospitality
  { id: "h1", title: "Guest Recovery Protocol", cat: "Hospitality", role: "Shift Lead", readMin: 3, updated: "2 days ago",
    objective: "Recover any unhappy guest within 60 seconds: Acknowledge, Apologize, Act.",
    steps: ["Acknowledge issue", "Apologize sincerely", "Take action (remake / refund)", "Confirm satisfaction"], standard: "Resolved within 60s.", errors: ["Excuses instead of apology"] },
  { id: "h2", title: "Reading the Line (Queue Management)", cat: "Hospitality", role: "Shift Lead", readMin: 2, updated: "1 week ago",
    objective: "Anticipate wait pain points before guests escalate.",
    steps: ["Scan line every 60s", "Acknowledge waits >3 min", "Offer water / sample"], standard: "Every >3 min wait acknowledged.", errors: ["Wait ignored"] },
  { id: "h3", title: "Handling Special Requests", cat: "Hospitality", role: "Cashier", readMin: 2, updated: "5 days ago",
    objective: "Accommodate or politely decline with alternative.",
    steps: ["Listen fully", "Check feasibility", "Confirm or offer alt"], standard: "No flat 'no' without alt.", errors: ["Refused without alternative"] },
];

const CAT_ICON: Record<Exclude<Cat, "All">, typeof ChefHat> = {
  Kitchen: ChefHat, Front: Coffee, Management: Shield, Cleaning: Sparkles, Hospitality: Heart,
};
const CAT_COLOR: Record<Exclude<Cat, "All">, string> = {
  Kitchen: "#8B4513", Front: "#7B3FA0", Management: "#C0392B", Cleaning: "#2D6CDF", Hospitality: "#C9973A",
};

function SOPs() {
  const qc = useQueryClient();
  const { roleId } = useRole();
  const isManager = roleId === "owner" || roleId === "manager";
  const [cat, setCat] = useState<Cat>("All");
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", category: "Kitchen", role: "", body: "", passStandard: "" });

  const [showArchived, setShowArchived] = useState(false);
  const listFn = useServerFn(listSops);
  const { data: customSops = [] } = useQuery<any[]>({
    queryKey: ["sops", { showArchived }],
    queryFn: () => listFn({ data: { includeArchived: showArchived } }) as Promise<any[]>,
  });

  const upsertFn = useServerFn(upsertSop);
  const deleteFn = useServerFn(deleteSop);
  const addM = useMutation({
    mutationFn: () => upsertFn({ data: {
      title: form.title.trim(), category: form.category, role: (form.role || undefined) as any,
      body: form.body.trim(), passStandard: form.passStandard.trim() || undefined,
    } }),
    onSuccess: () => {
      toast.success("SOP saved");
      setShowAdd(false); setForm({ title: "", category: "Kitchen", role: "", body: "", passStandard: "" });
      syncDomains(qc, "sops");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  void deleteFn;


  const customList = useMemo(() => customSops.filter((s: any) =>
    (cat === "All" || s.category === cat) && (s.title ?? "").toLowerCase().includes(q.toLowerCase())
  ), [customSops, cat, q]);



  return (
    <AppShell>
      <Card dark>
        <div className="label-caps text-white/55">Standard Operating Procedures</div>
        <h1 className="font-display text-3xl mt-1 text-white">SOP LIBRARY</h1>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search procedures…"
            className="w-full bg-[#1C1C1C] border border-[#2A2A2A] rounded-md pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-[var(--color-gold)]" />
        </div>
      </Card>

      <div className="mt-4 -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {(["All","Kitchen","Front","Management","Cleaning","Hospitality"] as Cat[]).map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] border transition",
                c === cat ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]" : "bg-card text-muted-foreground border-border hover:text-foreground",
              )}>{c}</button>
          ))}
        </div>
      </div>

      {isManager && (
        <div className="mt-4">
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 border border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-[var(--color-gold)]">
              <Plus className="h-4 w-4" /> New SOP
            </button>
          ) : (
            <Card>
              <div className="label-caps text-muted-foreground mb-2">New procedure</div>
              <div className="space-y-2">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
                <div className="flex gap-2">
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm">
                    {["Kitchen","Front","Management","Cleaning","Hospitality"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm">
                    <option value="">Any role</option>
                    <option value="manager">Manager</option>
                    <option value="shift_lead">Shift lead</option>
                    <option value="grill">Grill</option>
                    <option value="prep">Prep</option>
                    <option value="cashier">Cashier</option>
                  </select>
                </div>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Procedure body / steps"
                  rows={4}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
                <input value={form.passStandard} onChange={(e) => setForm({ ...form, passStandard: e.target.value })} placeholder="Pass standard (optional)"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowAdd(false)} className="flex-1 rounded-md border border-border py-2 text-sm">Cancel</button>
                  <button onClick={() => addM.mutate()} disabled={!form.title.trim() || !form.body.trim() || addM.isPending}
                    className="flex-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] py-2 text-sm font-semibold disabled:opacity-60">
                    {addM.isPending ? "Saving…" : "Save SOP"}
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {roleId === "owner" && <SopAckRollup />}

      {customList.length > 0 ? (
        <>
          <SectionHeader
            eyebrow={cat}
            title={`${customList.length} procedures`}
            action={isManager ? (
              <button
                onClick={() => setShowArchived((v) => !v)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold",
                  showArchived ? "border-[var(--color-gold)] text-[var(--color-gold)]" : "border-border hover:border-[var(--color-gold)]",
                )}>
                {showArchived ? "Hide archived" : "Show archived"}
              </button>
            ) : null}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customList.map((s: any) => (
              <CustomSopCard key={s.id} sop={s} canEdit={isManager} />
            ))}
          </div>
        </>
      ) : (
        <Card className="mt-6">
          <div className="flex flex-col items-center text-center py-10 px-4">
            <div className="h-14 w-14 rounded-full bg-secondary border border-border grid place-items-center mb-4">
              <BookOpen className="h-6 w-6 text-[var(--color-gold)]" />
            </div>
            <div className="label-caps text-muted-foreground">SOP Library</div>
            <h2 className="font-display text-2xl mt-1">No procedures yet</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
              {isManager
                ? "Your SOP library is empty. Document a procedure so your crew has a single source of truth for how this trailer operates — kitchen, front, cleaning, and more."
                : "There are no SOPs published yet. Check back once a manager adds the first procedure."}
            </p>
            {isManager && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--color-gold)] text-[#0A0A0A] px-4 py-2.5 text-sm font-semibold hover:opacity-90">
                <Plus className="h-4 w-4" /> Create your first SOP
              </button>
            )}
          </div>
        </Card>

      )}


      <div className="h-6" />
    </AppShell>
  );
}

function SOPDetail({ sop, onBack }: { sop: SOP; onBack: () => void }) {
  const Icon = CAT_ICON[sop.cat]; const color = CAT_COLOR[sop.cat];
  const [signed, setSigned] = useState(false);
  return (
    <AppShell>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to library
      </button>

      <Card>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="label-caps" style={{ color }}>{sop.cat}</span>
          <span className="label-caps text-muted-foreground">· {sop.role}</span>
        </div>
        <h1 className="font-display text-3xl text-foreground">{sop.title.toUpperCase()}</h1>
        <div className="mt-1 text-xs text-muted-foreground">Updated {sop.updated} · {sop.readMin} min read</div>

        <div className="mt-5 pl-3 border-l-2 border-[var(--color-gold)]">
          <div className="label-caps text-muted-foreground mb-1">Objective</div>
          <div className="text-sm text-foreground leading-relaxed">{sop.objective}</div>
        </div>

        <h2 className="mt-6 font-semibold text-lg">Step by step</h2>
        <ol className="mt-3 space-y-2.5">
          {sop.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <div className="h-6 w-6 shrink-0 rounded-full bg-[#0A0A0A] text-white text-xs font-semibold grid place-items-center">{i + 1}</div>
              <div className="text-sm leading-snug pt-0.5">{step}</div>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-md bg-[var(--color-success-bg)] border border-[var(--color-success)]/30 p-3">
          <div className="label-caps text-[var(--color-success)] mb-1">Pass Standard</div>
          <div className="text-sm text-foreground">{sop.standard}</div>
        </div>

        <div className="mt-3 rounded-md bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 p-3">
          <div className="label-caps text-[var(--color-danger)] mb-2">Common Errors</div>
          <ul className="space-y-1 text-sm">
            {sop.errors.map((e) => <li key={e}>· {e}</li>)}
          </ul>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="aspect-video rounded-md bg-secondary border border-dashed border-border grid place-items-center text-xs text-muted-foreground">Photo slot</div>
          <div className="aspect-video rounded-md bg-secondary border border-dashed border-border grid place-items-center text-xs text-muted-foreground">Illustration slot</div>
        </div>

        <button
          onClick={() => setSigned(true)}
          disabled={signed}
          className={cn(
            "mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-sm",
            signed ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/40" : "bg-[var(--color-gold)] text-[#0A0A0A]",
          )}>
          {signed ? (<><Check className="h-4 w-4" /> Signed off at {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}</>) : "Sign off — I've read this SOP"}
        </button>
      </Card>

      <div className="h-6" />
    </AppShell>
  );
}

// ───────── Editable SOP card with inline edit, history, attachments ─────────

function CustomSopCard({ sop, canEdit }: { sop: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"view" | "edit" | "history" | "attach">("view");
  const [form, setForm] = useState({
    title: sop.title, category: sop.category, role: sop.role ?? "",
    body: sop.body, passStandard: sop.pass_standard ?? "",
  });

  const upsertFn = useServerFn(upsertSop);
  const deleteFn = useServerFn(deleteSop);
  const scanFn = useServerFn(scanSopDependencies);
  const archiveFnSrv = useServerFn(archiveSop);
  const restoreFnSrv = useServerFn(restoreSop);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [depReport, setDepReport] = useState<{ counts: Record<string, { label: string; count: number }>; totalRefs: number } | null>(null);
  const [archiveReason, setArchiveReason] = useState("");

  const refreshSops = () => syncDomains(qc, "sops");

  const saveM = useMutation({
    mutationFn: () => upsertFn({ data: {
      id: sop.id, title: form.title.trim(), category: form.category,
      role: (form.role || undefined) as any, body: form.body.trim(),
      passStandard: form.passStandard.trim() || undefined,
    } }),
    onSuccess: () => { toast.success("SOP updated"); setMode("view"); refreshSops(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const archiveM = useMutation({
    mutationFn: () => archiveFnSrv({ data: { id: sop.id, reason: archiveReason || undefined } }),
    onSuccess: () => { toast.success("SOP archived"); setRemoveOpen(false); setDepReport(null); setArchiveReason(""); refreshSops(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const restoreM = useMutation({
    mutationFn: () => restoreFnSrv({ data: { id: sop.id } }),
    onSuccess: () => { toast.success("SOP restored"); refreshSops(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: () => deleteFn({ data: { id: sop.id } }),
    onSuccess: () => { toast.success("Removed"); setRemoveOpen(false); refreshSops(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const startRemove = async () => {
    setRemoveOpen(true);
    setDepReport(null);
    setArchiveReason("");
    try {
      const r = await scanFn({ data: { id: sop.id } });
      setDepReport(r);
    } catch (e: any) {
      toast.error(e.message ?? "Scan failed");
      setRemoveOpen(false);
    }
  };

  const isArchived = !!sop.archived_at;

  if (mode === "history") return <SopHistoryDrawer sop={sop} onClose={() => setMode("view")} />;
  if (mode === "attach")  return <SopAttachDrawer  sop={sop} canEdit={canEdit} onClose={() => setMode("view")} />;

  if (mode === "edit") {
    return (
      <Card className="h-full">
        <div className="space-y-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--color-gold)]" />
          <div className="flex gap-2">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm">
              {["Kitchen","Front","Management","Cleaning","Hospitality"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm">
              <option value="">Any role</option>
              <option value="manager">Manager</option>
              <option value="shift_lead">Shift lead</option>
              <option value="grill">Grill</option>
              <option value="prep">Prep</option>
              <option value="cashier">Cashier</option>
            </select>
          </div>
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6}
            placeholder="Body — Markdown supported (**bold**, # headings, - lists)"
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)] font-mono" />
          <input value={form.passStandard} onChange={(e) => setForm({ ...form, passStandard: e.target.value })} placeholder="Pass standard (optional)"
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none" />
          <div className="flex gap-2 pt-1">
            <button onClick={() => setMode("view")} className="flex-1 rounded-md border border-border py-2 text-sm">Cancel</button>
            <button onClick={() => saveM.mutate()} disabled={!form.title.trim() || !form.body.trim() || saveM.isPending}
              className="flex-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] py-2 text-sm font-semibold disabled:opacity-60">
              {saveM.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  const recordViewFn = useServerFn(recordSopView);
  const ackFn = useServerFn(acknowledgeSop);
  const myAcksFn = useServerFn(getMySopAcks);
  const { data: myAcks = [] } = useQuery<any[]>({
    queryKey: ["my-sop-acks"],
    queryFn: () => myAcksFn() as any,
  });
  const myAck = (myAcks as any[]).find((a) => a.sop_id === sop.id);
  const ackCurrent = !!myAck && myAck.version >= sop.version;
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    void recordViewFn({ data: { sopId: sop.id } }).catch(() => {});
  }, [sop.id]);
  const ackM = useMutation({
    mutationFn: () => ackFn({ data: { sopId: sop.id, version: sop.version } }),
    onSuccess: () => { toast.success("Acknowledged"); qc.invalidateQueries({ queryKey: ["my-sop-acks"] }); qc.invalidateQueries({ queryKey: ["sop-ack-rollup"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="label-caps text-[var(--color-gold)]">{sop.category}{sop.role ? ` · ${sop.role}` : ""}</span>
        {canEdit && (
          <div className="flex items-center gap-1">
            <button onClick={() => setMode("history")} title="History" className="text-muted-foreground hover:text-foreground p-1"><History className="h-3.5 w-3.5" /></button>
            <button onClick={() => setMode("attach")}  title="Attachments" className="text-muted-foreground hover:text-foreground p-1"><Paperclip className="h-3.5 w-3.5" /></button>
            <button onClick={() => setMode("edit")}    title="Edit" className="text-muted-foreground hover:text-foreground p-1"><Pencil className="h-3.5 w-3.5" /></button>
            <button onClick={() => { if (confirm(`Delete "${sop.title}"?`)) delM.mutate(); }} title="Delete" className="text-muted-foreground hover:text-[var(--color-danger)] p-1"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
      <div className="font-semibold text-[15px] leading-snug">{sop.title}</div>
      <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap line-clamp-5">{sop.body}</div>
      {sop.pass_standard && <div className="mt-2 text-[11px] text-[var(--color-success)]">Pass: {sop.pass_standard}</div>}
      <div className="mt-2 text-[10px] text-muted-foreground">v{sop.version} · updated {new Date(sop.updated_at).toLocaleDateString()}</div>
      <button
        onClick={() => ackM.mutate()}
        disabled={ackCurrent || ackM.isPending}
        className={cn(
          "mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold",
          ackCurrent
            ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/40"
            : myAck
              ? "bg-[var(--color-warning-bg,#3a2f12)] text-[var(--color-warning,#C9973A)] border border-[var(--color-warning,#C9973A)]/40"
              : "bg-[var(--color-gold)] text-[#0A0A0A]",
        )}
      >
        {ackCurrent
          ? <><Check className="h-3.5 w-3.5" /> Acknowledged v{myAck.version}</>
          : myAck
            ? <>Re-acknowledge — updated to v{sop.version}</>
            : "I've read this SOP"}
      </button>
    </Card>
  );
}

function SopHistoryDrawer({ sop, onClose }: { sop: any; onClose: () => void }) {
  const fn = useServerFn(listSopVersions);
  const { data: versions = [], isLoading } = useQuery<any[]>({
    queryKey: ["sop-versions", sop.id],
    queryFn: () => fn({ data: { sopId: sop.id } }) as any,
  });
  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="label-caps text-[var(--color-gold)]">History · {sop.title}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      {isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
      {!isLoading && versions.length === 0 && (
        <div className="text-xs text-muted-foreground">No previous versions yet — edits will be recorded here.</div>
      )}
      <div className="space-y-2 max-h-72 overflow-auto">
        {versions.map((v) => (
          <div key={v.id} className="rounded-md border border-border p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">v{v.version} · {v.title}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(v.edited_at).toLocaleString()}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-4">{v.body}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SopAttachDrawer({ sop, canEdit, onClose }: { sop: any; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listSopAttachments);
  const addFn = useServerFn(addSopAttachment);
  const delFn = useServerFn(deleteSopAttachment);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [], isLoading } = useQuery<any[]>({
    queryKey: ["sop-attachments", sop.id],
    queryFn: () => listFn({ data: { sopId: sop.id } }) as any,
  });

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `sops/${sop.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("gotham-photos").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) throw error;
      await addFn({ data: { sopId: sop.id, storagePath: path, label: file.name, contentType: file.type } });
      toast.success("Uploaded");
      qc.invalidateQueries({ queryKey: ["sop-attachments", sop.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setUploading(false); }
  };

  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["sop-attachments", sop.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="label-caps text-[var(--color-gold)]">Attachments · {sop.title}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      {canEdit && (
        <>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full rounded-md border border-dashed border-border py-2 text-xs font-semibold inline-flex items-center justify-center gap-2 hover:border-[var(--color-gold)]">
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Attach photo / PDF"}
          </button>
        </>
      )}
      {isLoading && <div className="mt-2 text-xs text-muted-foreground">Loading…</div>}
      <div className="mt-2 space-y-1.5 max-h-60 overflow-auto">
        {attachments.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded-md border border-border p-2">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="text-xs flex-1 truncate">{a.label ?? a.storage_path}</div>
            {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /></a>}
            {canEdit && <button onClick={() => delM.mutate(a.id)} className="text-muted-foreground hover:text-[var(--color-danger)]"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
        {!isLoading && attachments.length === 0 && <div className="text-xs text-muted-foreground">No attachments.</div>}
      </div>
    </Card>
  );
}

function ImportBuiltinsButton({ existing }: { existing: any[] }) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertSop);
  const titles = useMemo(() => new Set(existing.map((s) => s.title)), [existing]);
  const pending = useMemo(() => SOPS.filter((s) => !titles.has(s.title)), [titles]);
  const [running, setRunning] = useState(false);

  if (pending.length === 0) return null;

  const ROLE_MAP: Record<string, string> = {
    "Grill Master": "grill", "Prep": "prep", "Cashier": "cashier",
    "Shift Lead": "shift_lead", "Manager": "manager",
  };

  const run = async () => {
    setRunning(true);
    try {
      for (const s of pending) {
        const body = [
          `## Objective`, s.objective, "",
          `## Steps`, ...s.steps.map((st, i) => `${i + 1}. ${st}`), "",
          `## Common errors`, ...s.errors.map((e) => `- ${e}`),
        ].join("\n");
        await upsertFn({ data: {
          title: s.title, category: s.cat, role: (ROLE_MAP[s.role] ?? "cashier") as any,
          body, passStandard: s.standard,
        } });
      }
      toast.success(`Imported ${pending.length} built-in SOPs — now fully editable`);
      syncDomains(qc, "sops");
    } catch (e: any) { toast.error(e.message ?? "Import failed"); }
    finally { setRunning(false); }
  };

  return (
    <button onClick={run} disabled={running}
      className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 border border-[var(--color-gold)]/40 bg-[#FAF7EE] text-sm font-semibold text-foreground hover:border-[var(--color-gold)] disabled:opacity-60">
      <Download className="h-4 w-4" /> {running ? "Importing…" : `Import ${pending.length} built-in SOPs to editable library`}
    </button>
  );
}

// ───────── Owner-only acknowledgement rollup ─────────

function SopAckRollup() {
  const fn = useServerFn(getSopAckRollup);
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["sop-ack-rollup"],
    queryFn: () => fn() as any,
    refetchInterval: 30000,
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const totals = useMemo(() => {
    const totalUsers = rows[0]?.total_users ?? 0;
    const slots = rows.length * totalUsers;
    const ack = rows.reduce((n, r) => n + (r.ack_current ?? 0), 0);
    const stale = rows.reduce((n, r) => n + (r.ack_stale ?? 0), 0);
    return { totalUsers, slots, ack, stale };
  }, [rows]);

  return (
    <div className="mt-5">
      <SectionHeader eyebrow="Acknowledgements" title="SOP sign-off rollup" />
      <Card>
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="text-sm text-muted-foreground">No SOPs yet.</div>
        )}
        {!isLoading && rows.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Stat label="Crew tracked" value={totals.totalUsers} />
              <Stat label="Current sign-offs" value={`${totals.ack}/${totals.slots}`} accent="success" />
              <Stat label="Stale (re-ack needed)" value={totals.stale} accent={totals.stale > 0 ? "warn" : undefined} />
            </div>
            <div className="space-y-2">
              {rows.map((r) => {
                const pct = r.total_users > 0 ? Math.round((r.ack_current / r.total_users) * 100) : 0;
                const isOpen = openId === r.sop_id;
                return (
                  <div key={r.sop_id} className="rounded-md border border-border">
                    <button
                      onClick={() => setOpenId(isOpen ? null : r.sop_id)}
                      className="w-full text-left p-2.5 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{r.title}</div>
                        <div className="text-[11px] text-muted-foreground">
                          v{r.version} · {r.category} · viewed by {r.viewed_count}/{r.total_users}
                        </div>
                      </div>
                      <div className="w-24 shrink-0">
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full"
                            style={{ width: `${pct}%`, background: pct >= 80 ? "var(--color-success)" : pct >= 40 ? "var(--color-warning, #C9973A)" : "var(--color-danger)" }}
                          />
                        </div>
                        <div className="mt-1 text-[10px] text-right text-muted-foreground">{pct}% ack</div>
                      </div>
                      <StatusPill tone={r.ack_stale > 0 ? "warning" : "success"}>
                        {r.ack_current}/{r.total_users}
                      </StatusPill>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="label-caps text-muted-foreground mb-1">Pending ({r.pending.length})</div>
                          {r.pending.length === 0 && <div className="text-xs text-muted-foreground">All caught up</div>}
                          <ul className="space-y-1">
                            {r.pending.map((p: any) => (
                              <li key={p.id} className="text-xs">· {p.name}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="label-caps text-muted-foreground mb-1">Acknowledged ({r.acknowledged.length})</div>
                          {r.acknowledged.length === 0 && <div className="text-xs text-muted-foreground">None yet</div>}
                          <ul className="space-y-1">
                            {r.acknowledged.map((a: any) => (
                              <li key={a.id} className="text-xs flex justify-between gap-2">
                                <span>· {a.name} <span className="text-muted-foreground">v{a.version}</span></span>
                                <span className="text-[10px] text-muted-foreground">{new Date(a.at).toLocaleDateString()}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: "success" | "warn" }) {
  const color =
    accent === "success" ? "text-[var(--color-success)]"
    : accent === "warn" ? "text-[var(--color-warning,#C9973A)]"
    : "text-foreground";
  return (
    <div className="rounded-md border border-border p-2">
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-display text-xl", color)}>{value}</div>
    </div>
  );
}
