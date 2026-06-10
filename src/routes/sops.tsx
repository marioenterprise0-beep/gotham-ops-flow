import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import {
  ChefHat, Coffee, Shield, Sparkles, Heart, Search, ArrowLeft, Check, Plus,
  Trash2, Pencil, History, Paperclip, X, Upload, Download, BookOpen, Clock,
  Sunrise, Sunset, Package, DollarSign, Brush, Briefcase, Utensils, ListChecks,
  AlertTriangle, Target, ChevronRight, ChevronLeft, PlayCircle, GraduationCap,
  Image as ImageIcon, FileText, Siren, Wrench, ClipboardList, Award, CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/gotham/EmptyState";
import { syncDomains } from "@/lib/sync-bus";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import {
  listSops, upsertSop, deleteSop, listSopVersions, listSopAttachments,
  addSopAttachment, deleteSopAttachment, recordSopView, acknowledgeSop,
  getMySopAcks, getSopAckRollup, scanSopDependencies, archiveSop, restoreSop,
} from "@/lib/sops.functions";
import { useRole } from "@/lib/role";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/sops")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "SOP Library · Gotham OS" }] }),
  component: SOPsPage,
});

// ───────── Categories (curated set, but cards display whatever DB has) ─────────

const CATEGORIES = [
  "Grill", "Prep", "Cashier", "Opening", "Closing", "Inventory",
  "Cash Management", "Hospitality", "Cleaning", "Management", "Food Safety",
  // legacy values still in DB
  "Kitchen", "Front",
] as const;

const CAT_ICON: Record<string, any> = {
  Grill: ChefHat, Prep: Utensils, Cashier: Coffee, Opening: Sunrise,
  Closing: Sunset, Inventory: Package, "Cash Management": DollarSign,
  Hospitality: Heart, Cleaning: Brush, Management: Briefcase,
  "Food Safety": Shield, Kitchen: ChefHat, Front: Coffee,
};

function iconFor(cat?: string | null) {
  if (!cat) return BookOpen;
  return CAT_ICON[cat] ?? BookOpen;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", manager: "Manager", shift_lead: "Shift Lead",
  grill: "Grill", prep: "Prep", cashier: "Cashier",
};

// ───────── Markdown-ish body parser ─────────

type ParsedSop = {
  objective?: string;
  whenToUse?: string;
  tools?: string[];
  steps: { title: string; instruction: string; standard?: string; note?: string }[];
  passStandard?: string;
  errors: string[];
  corrective?: string;
  managerNotes?: string;
  freeform?: string; // fallback if no sections detected
};

function parseSopBody(body: string, fallbackPass?: string | null): ParsedSop {
  const out: ParsedSop = { steps: [], errors: [] };
  if (!body) {
    if (fallbackPass) out.passStandard = fallbackPass;
    return out;
  }
  // Split on `## Heading` blocks
  const re = /^##\s+(.+?)\s*$/gm;
  const sections: { name: string; content: string }[] = [];
  let match: RegExpExecArray | null;
  const indices: { name: string; start: number; end: number }[] = [];
  while ((match = re.exec(body)) !== null) {
    indices.push({ name: match[1].trim().toLowerCase(), start: match.index, end: match.index + match[0].length });
  }
  if (indices.length === 0) {
    out.freeform = body.trim();
    if (fallbackPass) out.passStandard = fallbackPass;
    return out;
  }
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].end;
    const end = i + 1 < indices.length ? indices[i + 1].start : body.length;
    sections.push({ name: indices[i].name, content: body.slice(start, end).trim() });
  }

  const getLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const sec of sections) {
    const n = sec.name;
    if (n.startsWith("objective") || n.startsWith("purpose")) out.objective = sec.content;
    else if (n.startsWith("when")) out.whenToUse = sec.content;
    else if (n.startsWith("tools") || n.startsWith("materials") || n.startsWith("required")) {
      out.tools = getLines(sec.content).map((l) => l.replace(/^[-*•]\s*/, ""));
    } else if (n.startsWith("step")) {
      const lines = getLines(sec.content);
      for (const l of lines) {
        const m = l.match(/^(?:\d+\.|[-*])\s*(.+)$/);
        const text = (m ? m[1] : l).trim();
        if (!text) continue;
        // Split on ": " for "Title: Instruction"
        const colonIdx = text.indexOf(":");
        if (colonIdx > 0 && colonIdx < 40) {
          out.steps.push({ title: text.slice(0, colonIdx).trim(), instruction: text.slice(colonIdx + 1).trim() });
        } else {
          out.steps.push({ title: `Step ${out.steps.length + 1}`, instruction: text });
        }
      }
    } else if (n.startsWith("pass") || n.startsWith("standard")) out.passStandard = sec.content;
    else if (n.startsWith("common") || n.startsWith("error") || n.startsWith("mistake")) {
      out.errors = getLines(sec.content).map((l) => l.replace(/^[-*•]\s*/, ""));
    } else if (n.startsWith("corrective")) out.corrective = sec.content;
    else if (n.startsWith("manager")) out.managerNotes = sec.content;
  }
  if (!out.passStandard && fallbackPass) out.passStandard = fallbackPass;
  return out;
}

function estimatedReadMin(body: string, steps: number) {
  const words = (body ?? "").split(/\s+/).filter(Boolean).length;
  const base = Math.max(1, Math.round(words / 220));
  return Math.max(1, base + Math.round(steps * 0.3));
}

// ───────── Training categories (5 buckets) ─────────

const TRAINING_CATEGORIES = [
  { key: "Operations",    label: "Operations",    icon: ClipboardList, blurb: "Opening, closing, cash, inventory.",
    match: ["Opening", "Closing", "Cash Management", "Management", "Inventory", "Operations"] },
  { key: "Product Build", label: "Product Build", icon: Utensils,      blurb: "Grill, prep, recipe execution.",
    match: ["Grill", "Prep", "Kitchen", "Product Build"] },
  { key: "Hospitality",   label: "Hospitality",   icon: Heart,         blurb: "Guest service, cashier, front line.",
    match: ["Hospitality", "Cashier", "Front"] },
  { key: "Cleaning",      label: "Cleaning",      icon: Brush,         blurb: "Sanitation, deep clean, station resets.",
    match: ["Cleaning"] },
  { key: "Emergency",     label: "Emergency",     icon: Siren,         blurb: "Food safety, incidents, escalation.",
    match: ["Food Safety", "Emergency"] },
] as const;

function bucketFor(category: string | null | undefined): string {
  if (!category) return "Operations";
  for (const b of TRAINING_CATEGORIES) {
    if ((b.match as readonly string[]).includes(category)) return b.key;
  }
  return "Operations";
}

const CAT_BUCKET_ICON: Record<string, any> = Object.fromEntries(
  TRAINING_CATEGORIES.map((c) => [c.key, c.icon]),
);

// ───────── Main page ─────────

function SOPsPage() {
  const qc = useQueryClient();
  const { roleId } = useRole();
  const isOwner = roleId === "owner";
  const isManager = roleId === "owner" || roleId === "manager";

  const [activeBucket, setActiveBucket] = useState<string | "All">("All");
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const listFn = useServerFn(listSops);
  const { data: sops = [], isLoading } = useQuery<any[]>({
    queryKey: ["sops", { showArchived }],
    queryFn: () => listFn({ data: { includeArchived: showArchived } }) as Promise<any[]>,
  });

  const myAcksFn = useServerFn(getMySopAcks);
  const { data: myAcks = [] } = useQuery<any[]>({
    queryKey: ["my-sop-acks"],
    queryFn: () => myAcksFn() as any,
  });
  const myAckMap = useMemo(() => {
    const m = new Map<string, { version: number; acknowledged_at: string }>();
    for (const a of myAcks as any[]) m.set(a.sop_id, { version: a.version, acknowledged_at: a.acknowledged_at });
    return m;
  }, [myAcks]);

  const assigned = useMemo(() => {
    return (sops as any[]).filter((s) => {
      if (s.archived_at) return false;
      if (!s.role) return true;
      if (!roleId) return false;
      if (roleId === "owner" || roleId === "manager") return true;
      return s.role === roleId;
    });
  }, [sops, roleId]);

  const continueSop = useMemo(() => {
    const candidates = assigned.filter((s) => {
      const a = myAckMap.get(s.id);
      return !a || a.version < s.version;
    });
    return candidates[0] ?? null;
  }, [assigned, myAckMap]);

  const completed = useMemo(() => {
    return (sops as any[]).filter((s) => {
      if (s.archived_at) return false;
      const a = myAckMap.get(s.id);
      return a && a.version >= s.version;
    });
  }, [sops, myAckMap]);

  const bucketCounts = useMemo(() => {
    const counts = new Map<string, { total: number; remaining: number }>();
    for (const b of TRAINING_CATEGORIES) counts.set(b.key, { total: 0, remaining: 0 });
    for (const s of (sops as any[])) {
      if (s.archived_at) continue;
      const k = bucketFor(s.category);
      const c = counts.get(k); if (!c) continue;
      c.total++;
      const a = myAckMap.get(s.id);
      if (!a || a.version < s.version) c.remaining++;
    }
    return counts;
  }, [sops, myAckMap]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (sops as any[]).filter((s) => {
      if (s.archived_at && !showArchived) return false;
      if (activeBucket !== "All" && bucketFor(s.category) !== activeBucket) return false;
      if (!term) return true;
      return [s.title, s.body, s.category, s.role].some((v) => (v ?? "").toString().toLowerCase().includes(term));
    });
  }, [sops, activeBucket, q, showArchived]);

  const activeSop = useMemo(() => (sops as any[]).find((s) => s.id === openId) ?? null, [sops, openId]);

  if (activeSop) {
    return (
      <SopDetail
        sop={activeSop}
        onBack={() => setOpenId(null)}
        myAck={myAckMap.get(activeSop.id) ?? null}
        canEdit={isOwner}
        canSignOff={isManager}
        onEdit={() => { setEditId(activeSop.id); setOpenId(null); }}
      />
    );
  }

  const filterActive = activeBucket !== "All" || q.trim().length > 0;

  return (
    <AppShell>
      <Card dark>
        <div className="flex items-center gap-2 label-caps text-white/55">
          <GraduationCap className="h-3.5 w-3.5" />
          Training & Execution
        </div>
        <h1 className="font-display text-3xl mt-1 text-white">SOP TRAINING</h1>
        <p className="mt-2 text-sm text-white/65 max-w-xl leading-relaxed">
          Work the procedures, complete each step, and sign off so the floor knows you're ready.
        </p>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search procedures…"
            className="w-full bg-[#1C1C1C] border border-[#2A2A2A] rounded-md pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-[var(--color-gold)]"
          />
        </div>
      </Card>

      {isOwner && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-gold)] text-[#0A0A0A] px-4 py-2.5 text-sm font-semibold hover:opacity-90">
            <Plus className="h-4 w-4" /> New SOP
          </button>
          <button onClick={() => setShowArchived((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold",
              showArchived
                ? "border-[var(--color-gold)] text-[var(--color-gold)]"
                : "border-border text-muted-foreground hover:text-foreground hover:border-[var(--color-gold)]/40",
            )}>
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
        </div>
      )}

      {!filterActive && continueSop && (
        <div className="mt-5">
          <SectionHeader eyebrow="Pick up where you left off" title="Continue learning" />
          <ContinueCard sop={continueSop} myAck={myAckMap.get(continueSop.id) ?? null} onResume={() => setOpenId(continueSop.id)} />
        </div>
      )}

      {!filterActive && (
        <div className="mt-6">
          <SectionHeader eyebrow="For you" title={`Assigned SOPs · ${assigned.filter((s) => {
            const a = myAckMap.get(s.id); return !a || a.version < s.version;
          }).length} to complete`} />
          {assigned.length === 0 ? (
            <EmptyState icon={GraduationCap} title="Assign first SOP" hint="Owners can publish SOPs and assign them to your role — they'll appear here as required training." />
          ) : (
            <div className="space-y-2">
              {assigned.slice(0, 6).map((s) => (
                <AssignedRow key={s.id} sop={s} myAck={myAckMap.get(s.id) ?? null} onOpen={() => setOpenId(s.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {!filterActive && (
        <div className="mt-6">
          <SectionHeader eyebrow="Browse by area" title="Categories" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TRAINING_CATEGORIES.map((b) => {
              const c = bucketCounts.get(b.key) ?? { total: 0, remaining: 0 };
              const Icon = b.icon;
              return (
                <button key={b.key} onClick={() => setActiveBucket(b.key)}
                  className="text-left rounded-xl border border-border bg-card p-4 hover:border-[var(--color-gold)]/50 transition group">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#0A0A0A] grid place-items-center group-hover:bg-[var(--color-gold)] transition">
                      <Icon className="h-5 w-5 text-[var(--color-gold)] group-hover:text-[#0A0A0A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-lg leading-tight">{b.label}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{b.blurb}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{c.total} {c.total === 1 ? "SOP" : "SOPs"}</span>
                    {c.remaining > 0 ? (
                      <span className="text-[var(--color-gold)] font-semibold">{c.remaining} to complete</span>
                    ) : c.total > 0 ? (
                      <span className="text-[var(--color-success)] font-semibold inline-flex items-center gap-1"><Check className="h-3 w-3" /> All caught up</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!filterActive && (
        <div className="mt-6">
          <SectionHeader eyebrow="Your record" title={`Completed certifications · ${completed.length}`} />
          {completed.length === 0 ? (
            <Card><p className="text-sm text-muted-foreground">Acknowledge an SOP to earn your first certification.</p></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {completed.map((s) => (
                <CertRow key={s.id} sop={s} myAck={myAckMap.get(s.id)!} onOpen={() => setOpenId(s.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {filterActive && (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <SectionHeader eyebrow={activeBucket === "All" ? "Search results" : activeBucket} title={isLoading ? "Loading…" : `${filtered.length} ${filtered.length === 1 ? "procedure" : "procedures"}`} />
            <button onClick={() => { setActiveBucket("All"); setQ(""); }}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Back to dashboard
            </button>
          </div>
          {filtered.length === 0 ? (
            <Card><p className="text-sm text-muted-foreground">No procedures match.</p></Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => (
                <AssignedRow key={s.id} sop={s} myAck={myAckMap.get(s.id) ?? null} onOpen={() => setOpenId(s.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {isOwner && <SopAckRollup />}

      {(showAdd || editId) && isOwner && (
        <SopEditorModal
          sop={editId ? (sops as any[]).find((s) => s.id === editId) ?? null : null}
          onClose={() => { setShowAdd(false); setEditId(null); }}
          onSaved={() => { setShowAdd(false); setEditId(null); syncDomains(qc, "sops"); }}
        />
      )}

      <div className="h-6" />
    </AppShell>
  );
}

// ───────── Continue / Assigned / Cert rows ─────────

function ContinueCard({ sop, myAck, onResume }: { sop: any; myAck: { version: number } | null; onResume: () => void }) {
  const parsed = useMemo(() => parseSopBody(sop.body ?? "", sop.pass_standard), [sop.body, sop.pass_standard]);
  const readMin = estimatedReadMin(sop.body ?? "", parsed.steps.length);
  const reAck = myAck && myAck.version < sop.version;
  const Icon = CAT_BUCKET_ICON[bucketFor(sop.category)] ?? BookOpen;
  return (
    <Card goldAccent className="relative overflow-hidden">
      <div className="flex items-start gap-4">
        <div className="hidden sm:grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#0A0A0A]">
          <Icon className="h-6 w-6 text-[var(--color-gold)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="label-caps text-[var(--color-gold)] flex items-center gap-1.5">
            <PlayCircle className="h-3.5 w-3.5" /> {reAck ? "Re-acknowledge required" : "In progress"}
          </div>
          <h3 className="font-display text-xl mt-1 leading-tight">{sop.title}</h3>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{sop.category}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />~{readMin} min</span>
            <span>{parsed.steps.length || 1} steps</span>
            <span>v{sop.version}</span>
          </div>
        </div>
        <button onClick={onResume}
          className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-[var(--color-gold)] text-[#0A0A0A] px-4 py-2.5 text-sm font-semibold hover:opacity-90">
          Resume <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}

function AssignedRow({ sop, myAck, onOpen }: { sop: any; myAck: { version: number } | null; onOpen: () => void }) {
  const parsed = useMemo(() => parseSopBody(sop.body ?? "", sop.pass_standard), [sop.body, sop.pass_standard]);
  const readMin = estimatedReadMin(sop.body ?? "", parsed.steps.length);
  const Icon = CAT_BUCKET_ICON[bucketFor(sop.category)] ?? BookOpen;
  const ackCurrent = !!myAck && myAck.version >= sop.version;
  const ackStale = !!myAck && myAck.version < sop.version;
  const tone = ackCurrent ? "success" : ackStale ? "warning" : "gold";
  const label = ackCurrent ? "Certified" : ackStale ? "Re-ack" : "Start";
  return (
    <button onClick={onOpen}
      className="w-full text-left rounded-lg border border-border bg-card p-3 flex items-center gap-3 hover:border-[var(--color-gold)]/40 transition">
      <div className="h-10 w-10 shrink-0 rounded-md bg-secondary border border-border grid place-items-center">
        <Icon className="h-4 w-4 text-[var(--color-gold)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{sop.title}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {sop.category} · {parsed.steps.length || 1} steps · ~{readMin} min · v{sop.version}
        </div>
      </div>
      <StatusPill tone={tone as any}>{label}</StatusPill>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function CertRow({ sop, myAck, onOpen }: { sop: any; myAck: { version: number; acknowledged_at: string }; onOpen: () => void }) {
  return (
    <button onClick={onOpen}
      className="text-left rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] p-3 flex items-center gap-3 hover:border-[var(--color-success)]/60 transition">
      <div className="h-10 w-10 shrink-0 rounded-full bg-[#0A0A0A] grid place-items-center">
        <Award className="h-5 w-5 text-[var(--color-gold)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{sop.title}</div>
        <div className="text-[11px] text-muted-foreground">
          v{myAck.version} · signed {new Date(myAck.acknowledged_at).toLocaleDateString()}
        </div>
      </div>
      <Check className="h-4 w-4 text-[var(--color-success)]" />
    </button>
  );
}

// ───────── Detail view (training / execution) ─────────

type StepRunState = { done: boolean; note: string };

function SopDetail({
  sop, onBack, myAck, canEdit, canSignOff, onEdit,
}: {
  sop: any; onBack: () => void;
  myAck: { version: number; acknowledged_at: string } | null;
  canEdit: boolean; canSignOff: boolean; onEdit: () => void;
}) {
  const qc = useQueryClient();
  const Icon = CAT_BUCKET_ICON[bucketFor(sop.category)] ?? BookOpen;
  const parsed = useMemo(() => parseSopBody(sop.body ?? "", sop.pass_standard), [sop.body, sop.pass_standard]);
  const readMin = estimatedReadMin(sop.body ?? "", parsed.steps.length);
  const ackCurrent = !!myAck && myAck.version >= sop.version;
  const ackStale = !!myAck && myAck.version < sop.version;

  const steps = useMemo(() => {
    if (parsed.steps.length > 0) return parsed.steps;
    return [{ title: "Read & understand", instruction: parsed.freeform ?? sop.body ?? "", standard: undefined as any, note: undefined as any }];
  }, [parsed, sop.body]);

  const [active, setActive] = useState(0);
  const [runState, setRunState] = useState<StepRunState[]>(() => steps.map(() => ({ done: false, note: "" })));
  const [confirmed, setConfirmed] = useState(ackCurrent);

  useEffect(() => {
    setRunState(steps.map(() => ({ done: false, note: "" })));
    setActive(0);
    setConfirmed(ackCurrent);
  }, [sop.id, sop.version, steps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const recordViewFn = useServerFn(recordSopView);
  const ackFn = useServerFn(acknowledgeSop);
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    void recordViewFn({ data: { sopId: sop.id } }).catch(() => {});
  }, [sop.id]);

  const ackM = useMutation({
    mutationFn: () => ackFn({ data: { sopId: sop.id, version: sop.version } }),
    onSuccess: () => {
      toast.success("SOP acknowledged");
      qc.invalidateQueries({ queryKey: ["my-sop-acks"] });
      qc.invalidateQueries({ queryKey: ["sop-ack-rollup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const attachFn = useServerFn(listSopAttachments);
  const { data: attachments = [] } = useQuery<any[]>({
    queryKey: ["sop-attachments", sop.id],
    queryFn: () => attachFn({ data: { sopId: sop.id } }) as any,
  });

  const completedSteps = runState.filter((r) => r.done).length;
  const allStepsDone = completedSteps === steps.length;
  const pct = Math.round((completedSteps / Math.max(1, steps.length)) * 100);
  const canAck = (allStepsDone || ackCurrent) && confirmed && !ackCurrent;

  const step = steps[active];
  const stepImages = useMemo(() => attachments.filter((a) => (a.content_type ?? "").startsWith("image/")), [attachments]);
  const stepDocs = useMemo(() => attachments.filter((a) => !(a.content_type ?? "").startsWith("image/")), [attachments]);

  const toggleDone = (i: number) => setRunState((rs) => rs.map((r, idx) => idx === i ? { ...r, done: !r.done } : r));
  const updateNote = (i: number, v: string) => setRunState((rs) => rs.map((r, idx) => idx === i ? { ...r, note: v } : r));

  return (
    <AppShell>
      <div className="pb-28 lg:pb-6">
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to training
        </button>

        <Card dark>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 label-caps text-[var(--color-gold)]">
              <Icon className="h-4 w-4" />
              {bucketFor(sop.category)} · {sop.category}
            </div>
            {canEdit && (
              <button onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/70 hover:text-white hover:border-[var(--color-gold)]/50">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </div>
          <h1 className="font-display text-3xl mt-2 text-white leading-tight">{sop.title}</h1>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetaCell label="Category" value={bucketFor(sop.category)} />
            <MetaCell label="Version" value={`v${sop.version}`} />
            <MetaCell label="Est. completion" value={`~${readMin} min`} />
            <MetaCell label="Status" value={ackCurrent ? "Certified" : ackStale ? "Re-ack needed" : "In progress"}
              accent={ackCurrent ? "success" : ackStale ? "warning" : "gold"} />
          </div>
          {ackStale && (
            <div className="mt-3 rounded-md border border-[var(--color-warning,#C9973A)]/40 bg-[var(--color-warning,#C9973A)]/10 px-3 py-2 text-xs text-white/80">
              SOP updated since your last sign-off (you acknowledged v{myAck?.version}). Please review and re-acknowledge.
            </div>
          )}
        </Card>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_280px] gap-4">
          {/* LEFT — step navigator */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Card>
              <div className="label-caps text-muted-foreground mb-2">Steps</div>
              <div className="space-y-1">
                {steps.map((s, i) => {
                  const isActive = active === i;
                  const isDone = runState[i]?.done;
                  return (
                    <button key={i} onClick={() => setActive(i)}
                      className={cn(
                        "w-full text-left flex items-start gap-2 px-2 py-2 rounded-md text-sm border",
                        isActive
                          ? "bg-[#FAF7EE] border-[var(--color-gold)]/40 text-foreground"
                          : "border-transparent hover:bg-secondary text-foreground/80",
                      )}>
                      <span className={cn(
                        "mt-0.5 h-5 w-5 shrink-0 rounded-full grid place-items-center text-[10px] font-bold border",
                        isDone
                          ? "bg-[var(--color-success)] text-white border-[var(--color-success)]"
                          : isActive ? "border-[var(--color-gold)] text-[var(--color-gold)]" : "border-border text-muted-foreground",
                      )}>{isDone ? <Check className="h-3 w-3" /> : i + 1}</span>
                      <span className="flex-1 leading-snug">{s.title}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>Progress</span><span>{completedSteps}/{steps.length}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-[var(--color-gold)] transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </Card>
          </aside>

          {/* CENTER — step content */}
          <section className="min-w-0 space-y-4">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="label-caps text-muted-foreground">Step {active + 1} of {steps.length}</div>
                  <h2 className="font-display text-2xl mt-1 leading-tight">{step.title}</h2>
                </div>
                <button onClick={() => toggleDone(active)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[1.1px] border transition",
                    runState[active]?.done
                      ? "bg-[var(--color-success-bg)] border-[var(--color-success)]/40 text-[var(--color-success)]"
                      : "border-border text-foreground hover:border-[var(--color-gold)]/50",
                  )}>
                  {runState[active]?.done ? <><Check className="h-3.5 w-3.5" /> Done</> : <><CircleDot className="h-3.5 w-3.5" /> Mark complete</>}
                </button>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{step.instruction}</p>

              {step.standard && (
                <div className="mt-4 rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] px-3 py-2 text-sm">
                  <div className="label-caps text-[var(--color-success)] mb-1 flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> Standard</div>
                  <div className="text-foreground">{step.standard}</div>
                </div>
              )}

              <div className="mt-4">
                <div className="label-caps text-muted-foreground mb-1">Your notes</div>
                <textarea
                  value={runState[active]?.note ?? ""}
                  onChange={(e) => updateNote(active, e.target.value)}
                  placeholder="Capture anything to remember — questions, callouts, mistakes…"
                  rows={3}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button disabled={active === 0} onClick={() => setActive((a) => Math.max(0, a - 1))}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40">
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <button
                  disabled={active === steps.length - 1}
                  onClick={() => { if (!runState[active]?.done) toggleDone(active); setActive((a) => Math.min(steps.length - 1, a + 1)); }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#0A0A0A] text-white px-3 py-2 text-xs font-semibold disabled:opacity-40">
                  Next step <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </Card>

            {parsed.passStandard && (
              <Card>
                <Section title="Standards checklist" icon={Target} />
                <p className="text-sm leading-relaxed text-foreground">{parsed.passStandard}</p>
              </Card>
            )}

            {parsed.errors.length > 0 && (
              <Card>
                <Section title="Common mistakes" icon={AlertTriangle} tone="danger" />
                <ul className="space-y-1.5 text-sm">
                  {parsed.errors.map((e, i) => (
                    <li key={i} className="flex gap-2"><span className="text-[var(--color-danger)]">✕</span><span>{e}</span></li>
                  ))}
                </ul>
                {parsed.corrective && (
                  <div className="mt-3 rounded-md border border-border bg-secondary px-3 py-2 text-sm">
                    <div className="label-caps text-muted-foreground mb-1">Corrective action</div>
                    <div>{parsed.corrective}</div>
                  </div>
                )}
              </Card>
            )}

            {(parsed.objective || parsed.whenToUse || (parsed.tools && parsed.tools.length > 0)) && (
              <Card>
                <Section title="Context" icon={BookOpen} />
                {parsed.objective && (
                  <div className="mb-3">
                    <div className="label-caps text-muted-foreground mb-1">Purpose</div>
                    <p className="text-sm text-foreground">{parsed.objective}</p>
                  </div>
                )}
                {parsed.whenToUse && (
                  <div className="mb-3">
                    <div className="label-caps text-muted-foreground mb-1">When to use</div>
                    <p className="text-sm text-foreground">{parsed.whenToUse}</p>
                  </div>
                )}
                {parsed.tools && parsed.tools.length > 0 && (
                  <div>
                    <div className="label-caps text-muted-foreground mb-1">Required tools</div>
                    <ul className="space-y-1 text-sm">
                      {parsed.tools.map((t, i) => (
                        <li key={i} className="flex gap-2"><span className="text-[var(--color-gold)]">•</span><span>{t}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}
          </section>

          {/* RIGHT — media panel */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Card>
              <div className="label-caps text-muted-foreground mb-2 flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Media & reference
              </div>
              {attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No reference media for this SOP yet.</p>
              ) : (
                <div className="space-y-3">
                  {stepImages.length > 0 && (
                    <div className="space-y-2">
                      {stepImages.map((a) => (
                        <a key={a.id} href={a.url ?? "#"} target="_blank" rel="noreferrer"
                          className="block rounded-md overflow-hidden border border-border bg-secondary hover:border-[var(--color-gold)]/50 transition">
                          {a.url ? (
                            <img src={a.url} alt={a.label ?? "Reference"} className="w-full h-32 object-cover" />
                          ) : (
                            <div className="h-32 grid place-items-center text-xs text-muted-foreground">Image unavailable</div>
                          )}
                          {a.label && <div className="px-2 py-1 text-[11px] text-muted-foreground truncate">{a.label}</div>}
                        </a>
                      ))}
                    </div>
                  )}
                  {stepDocs.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="label-caps text-muted-foreground">Documents</div>
                      {stepDocs.map((a) => (
                        <a key={a.id} href={a.url ?? "#"} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 rounded-md border border-border p-2 text-xs hover:border-[var(--color-gold)]/40">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="flex-1 truncate">{a.label ?? "Document"}</span>
                          <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </aside>
        </div>

        {/* BOTTOM — completion, acknowledge, manager sign-off */}
        <div className="mt-4">
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="label-caps text-muted-foreground">Completion</div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="font-display text-2xl">{pct}%</div>
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-[var(--color-gold)] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-sm text-muted-foreground">{completedSteps}/{steps.length} steps</div>
                </div>
                <label className="mt-4 flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
                    disabled={ackCurrent}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-gold)]" />
                  <span>I have completed every step and will execute this SOP to standard.</span>
                </label>
              </div>
              <div className="flex flex-col gap-2 justify-center">
                <button
                  onClick={() => ackM.mutate()}
                  disabled={!canAck || ackM.isPending}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition",
                    ackCurrent
                      ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/40"
                      : "bg-[var(--color-gold)] text-[#0A0A0A] disabled:opacity-50",
                  )}>
                  {ackCurrent
                    ? <><Check className="h-4 w-4" /> Acknowledged v{myAck?.version}</>
                    : ackM.isPending ? "Saving…" : ackStale ? "Re-acknowledge SOP" : "Acknowledge SOP"}
                </button>
                {!allStepsDone && !ackCurrent && (
                  <p className="text-[11px] text-muted-foreground text-center">Finish all steps to enable sign-off.</p>
                )}
                {canSignOff && (
                  <div className="mt-1 rounded-md border border-border bg-secondary px-3 py-2 text-[11px] text-muted-foreground">
                    <div className="label-caps text-muted-foreground mb-0.5">Manager sign-off</div>
                    Owners and managers verify completion from the SOP rollup on the training dashboard.
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {!ackCurrent && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur p-3">
          <button
            onClick={() => { if (!confirmed) setConfirmed(true); ackM.mutate(); }}
            disabled={!allStepsDone || ackM.isPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-gold)] text-[#0A0A0A] px-4 py-3 text-sm font-bold uppercase tracking-[1.1px] disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> {ackM.isPending ? "Saving…" : allStepsDone ? (ackStale ? "Re-acknowledge" : "Acknowledge SOP") : `${completedSteps}/${steps.length} steps complete`}
          </button>
        </div>
      )}
    </AppShell>
  );
}

function MetaCell({ label, value, accent }: { label: string; value: string; accent?: "success" | "warning" | "gold" }) {
  const color =
    accent === "success" ? "text-[var(--color-success)]"
    : accent === "warning" ? "text-[var(--color-warning,#C9973A)]"
    : accent === "gold" ? "text-[var(--color-gold)]"
    : "text-white";
  return (
    <div className="rounded-md bg-[#1C1C1C] border border-[#2A2A2A] px-3 py-2">
      <div className="label-caps text-white/50">{label}</div>
      <div className={cn("text-sm font-semibold mt-0.5", color)}>{value}</div>
    </div>
  );
}

function Section({ title, icon: Icon, tone }: { title: string; icon?: any; tone?: "danger" }) {
  return (
    <div className={cn(
      "flex items-center gap-2 mb-3",
      tone === "danger" ? "text-[var(--color-danger)]" : "text-foreground",
    )}>
      {Icon && <Icon className="h-4 w-4" />}
      <h2 className="font-display text-lg leading-none">{title}</h2>
    </div>
  );
}


// ───────── Editor modal (owner-only: create / edit / archive / delete) ─────────

function SopEditorModal({ sop, onClose, onSaved }: { sop: any | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: sop?.title ?? "",
    category: sop?.category ?? "Grill",
    role: sop?.role ?? "",
    body: sop?.body ??
      "## Purpose\n\n\n## When to use\n\n\n## Required tools\n- \n\n## Steps\n1. Step title: Instruction\n2. \n\n## Pass standard\n\n\n## Common mistakes\n- \n\n## Corrective action\n",
    passStandard: sop?.pass_standard ?? "",
  });

  const upsertFn = useServerFn(upsertSop);
  const scanFn = useServerFn(scanSopDependencies);
  const archiveFnSrv = useServerFn(archiveSop);
  const restoreFnSrv = useServerFn(restoreSop);
  const deleteFn = useServerFn(deleteSop);

  const [tab, setTab] = useState<"edit" | "history" | "attach">("edit");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [depReport, setDepReport] = useState<{ counts: Record<string, { label: string; count: number }>; totalRefs: number } | null>(null);
  const [archiveReason, setArchiveReason] = useState("");

  const saveM = useMutation({
    mutationFn: () => upsertFn({ data: {
      id: sop?.id, title: form.title.trim(), category: form.category,
      role: (form.role || undefined) as any, body: form.body.trim(),
      passStandard: form.passStandard.trim() || undefined,
    } }),
    onSuccess: () => { toast.success(sop ? "SOP updated" : "SOP created"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const archiveM = useMutation({
    mutationFn: () => archiveFnSrv({ data: { id: sop!.id, reason: archiveReason || undefined } }),
    onSuccess: () => { toast.success("SOP archived"); setRemoveOpen(false); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const restoreM = useMutation({
    mutationFn: () => restoreFnSrv({ data: { id: sop!.id } }),
    onSuccess: () => { toast.success("SOP restored"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: () => deleteFn({ data: { id: sop!.id } }),
    onSuccess: () => { toast.success("Deleted"); setRemoveOpen(false); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const startRemove = async () => {
    setRemoveOpen(true);
    setDepReport(null);
    setArchiveReason("");
    try {
      const r = await scanFn({ data: { id: sop!.id } });
      setDepReport(r);
    } catch (e: any) { toast.error(e.message ?? "Scan failed"); setRemoveOpen(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/70 p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="w-full sm:max-w-2xl rounded-none sm:rounded-xl border border-border bg-card p-5 my-0 sm:my-8"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="label-caps text-muted-foreground">{sop ? "Edit SOP" : "New SOP"}</div>
            <h2 className="font-display text-xl mt-1">{sop?.title || "Create procedure"}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {sop && (
          <div className="flex gap-1 mb-3 border-b border-border">
            {(["edit", "history", "attach"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.1px] border-b-2 -mb-px",
                  tab === t ? "border-[var(--color-gold)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}>
                {t === "edit" ? "Edit" : t === "history" ? "History" : "Attachments"}
              </button>
            ))}
          </div>
        )}

        {tab === "edit" && (
          <div className="space-y-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="SOP title"
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--color-gold)]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="bg-secondary border border-border rounded-md px-3 py-2 text-sm">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="bg-secondary border border-border rounded-md px-3 py-2 text-sm">
                <option value="">Any role</option>
                <option value="manager">Manager</option>
                <option value="shift_lead">Shift Lead</option>
                <option value="grill">Grill</option>
                <option value="prep">Prep</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>
            <div>
              <div className="label-caps text-muted-foreground mb-1">Body (markdown sections)</div>
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={14}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-[var(--color-gold)]" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use <code className="bg-muted px-1">## Purpose</code>, <code className="bg-muted px-1">## Steps</code> (numbered),
                <code className="bg-muted px-1">## Pass standard</code>, <code className="bg-muted px-1">## Common mistakes</code>, etc.
                Steps render best as <code className="bg-muted px-1">1. Title: Instruction</code>.
              </p>
            </div>
            <input value={form.passStandard} onChange={(e) => setForm({ ...form, passStandard: e.target.value })}
              placeholder="Quick pass standard (optional)"
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm outline-none" />

            <div className="flex flex-wrap gap-2 pt-2">
              {sop && !sop.archived_at && (
                <button onClick={startRemove}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-danger)]/40 text-[var(--color-danger)] px-3 py-2 text-xs font-semibold hover:bg-[var(--color-danger-bg)]">
                  <Trash2 className="h-3.5 w-3.5" /> Archive / Delete
                </button>
              )}
              {sop && sop.archived_at && (
                <button onClick={() => restoreM.mutate()} disabled={restoreM.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-success)]/40 text-[var(--color-success)] px-3 py-2 text-xs font-semibold hover:bg-[var(--color-success-bg)]">
                  Restore
                </button>
              )}
              <div className="flex-1" />
              <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
              <button onClick={() => saveM.mutate()}
                disabled={!form.title.trim() || !form.body.trim() || saveM.isPending}
                className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {saveM.isPending ? "Saving…" : sop ? "Save changes" : "Create SOP"}
              </button>
            </div>
          </div>
        )}

        {tab === "history" && sop && <SopHistoryDrawer sop={sop} />}
        {tab === "attach" && sop && <SopAttachDrawer sop={sop} canEdit />}

        {/* Remove confirmation */}
        {removeOpen && sop && (
          <div className="mt-4 rounded-lg border border-border p-4 bg-background">
            <div className="label-caps text-muted-foreground">Remove SOP</div>
            <h3 className="font-display text-lg mt-1">{sop.title}</h3>
            {!depReport ? (
              <p className="mt-3 text-sm text-muted-foreground">Scanning references…</p>
            ) : depReport.totalRefs === 0 ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">No history references. Safe to delete permanently.</p>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setRemoveOpen(false)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Cancel</button>
                  <button onClick={() => delM.mutate()} disabled={delM.isPending}
                    className="rounded-md bg-[var(--color-danger)] text-white px-3 py-2 text-xs font-semibold disabled:opacity-60">
                    {delM.isPending ? "Deleting…" : "Delete permanently"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm">
                  {depReport.totalRefs} historical reference{depReport.totalRefs === 1 ? "" : "s"} found. Archive to preserve them.
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground max-h-40 overflow-auto">
                  {Object.entries(depReport.counts).map(([k, v]) => (
                    <li key={k} className="flex justify-between border-b border-border/50 py-1">
                      <span>{v.label}</span><span className="font-mono">{v.count}</span>
                    </li>
                  ))}
                </ul>
                <input value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="mt-3 w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm" />
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setRemoveOpen(false)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Cancel</button>
                  <button onClick={() => archiveM.mutate()} disabled={archiveM.isPending}
                    className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-2 text-xs font-semibold disabled:opacity-60">
                    {archiveM.isPending ? "Archiving…" : "Archive SOP"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── History / attachments (used inside editor modal) ─────────

function SopHistoryDrawer({ sop }: { sop: any }) {
  const fn = useServerFn(listSopVersions);
  const { data: versions = [], isLoading } = useQuery<any[]>({
    queryKey: ["sop-versions", sop.id],
    queryFn: () => fn({ data: { sopId: sop.id } }) as any,
  });
  return (
    <div>
      {isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
      {!isLoading && versions.length === 0 && (
        <div className="text-xs text-muted-foreground">No previous versions yet — edits will be recorded here.</div>
      )}
      <div className="space-y-2 max-h-[60vh] overflow-auto">
        {versions.map((v) => (
          <div key={v.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">v{v.version} · {v.title}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(v.edited_at).toLocaleString()}</span>
            </div>
            <div className="mt-2 text-[12px] text-muted-foreground whitespace-pre-wrap line-clamp-6">{v.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SopAttachDrawer({ sop, canEdit }: { sop: any; canEdit: boolean }) {
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
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setUploading(false); }
  };

  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["sop-attachments", sop.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
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
    </div>
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
                          <div className="h-full"
                            style={{ width: `${pct}%`, background: pct >= 80 ? "var(--color-success)" : pct >= 40 ? "var(--color-warning, #C9973A)" : "var(--color-danger)" }} />
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
                            {r.pending.map((p: any) => (<li key={p.id} className="text-xs">· {p.name}</li>))}
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
