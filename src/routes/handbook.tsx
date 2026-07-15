import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card } from "@/components/gotham/primitives";
import { Search, X, BookOpen, ScrollText, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { syncDomains } from "@/lib/sync-bus";
import { toast } from "sonner";
import { renderStructuredBlocks } from "@/components/gotham/StructuredBlocks";
import {
  getHandbook,
  acknowledgeHandbook,
  getMyHandbookAck,
  getHandbookAckRollup,
  type HandbookSection,
} from "@/lib/handbook.functions";

export const Route = createFileRoute("/handbook")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Employee Handbook · Dip N Shake OS" }] }),
  component: HandbookPage,
});

type ViewMode = "full" | "policies";

function SectionView({ section }: { section: HandbookSection }) {
  const flushed = renderStructuredBlocks(section.body_blocks);

  return (
    <section id={`sec-${section.section_number}`} className="scroll-mt-24 mb-10">
      <div className="label-caps text-muted-foreground text-[11px] mb-1">
        Part {section.part_number} — {section.part_title}
      </div>
      <h2 className="font-display text-xl mb-3">
        Section {section.section_number} — {section.section_title}
      </h2>
      {flushed}
    </section>
  );
}

type MyAck = {
  currentVersion: number;
  isCurrent: boolean;
  ack: { full_name_typed: string; acknowledged_at: string } | null;
};

function AckBanner({ myAck }: { myAck: MyAck | undefined }) {
  const qc = useQueryClient();
  const ackFn = useServerFn(acknowledgeHandbook);
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const ackM = useMutation({
    mutationFn: () => ackFn({ data: { fullNameTyped: name.trim() } }),
    onSuccess: () => {
      toast.success("Handbook acknowledged");
      syncDomains(qc, "handbook");
      setName("");
      setConfirmed(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to record acknowledgment"),
  });

  if (!myAck || myAck.isCurrent) return null;

  const isReack = !!myAck.ack;

  return (
    <Card className="!p-4 mb-4 border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-[var(--color-gold)] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">
            {isReack
              ? "The handbook has been updated — please re-acknowledge"
              : "Please acknowledge the handbook"}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            By typing your full name and confirming below, you acknowledge that you have received,
            read, and understand the Dip N Shake Employee Handbook (version {myAck.currentVersion}).
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              placeholder="Type your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-gold)]/40 sm:w-56"
            />
            <label className="flex items-center gap-1.5 text-xs text-foreground/90">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I have read and understand this handbook
            </label>
            <button
              disabled={!name.trim() || !confirmed || ackM.isPending}
              onClick={() => ackM.mutate()}
              className="inline-flex items-center justify-center rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {ackM.isPending ? "Submitting…" : "Acknowledge"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AckRollupCard() {
  const fetchRollup = useServerFn(getHandbookAckRollup);
  const { data, isLoading } = useQuery({
    queryKey: ["handbook-ack-rollup"],
    queryFn: () => fetchRollup() as Promise<any>,
  });
  const [open, setOpen] = useState(false);

  if (isLoading || !data) return null;

  return (
    <Card className="!p-4 mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-[var(--color-gold)]" />
          Handbook acknowledgment — {data.current.length}/{data.totalUsers} current
        </div>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="label-caps text-muted-foreground mb-1">
              Current ({data.current.length})
            </div>
            {data.current.map((p: any) => (
              <div key={p.id}>{p.name}</div>
            ))}
          </div>
          <div>
            <div className="label-caps text-[var(--color-warning)] mb-1">
              Stale ({data.stale.length})
            </div>
            {data.stale.map((p: any) => (
              <div key={p.id}>{p.name}</div>
            ))}
          </div>
          <div>
            <div className="label-caps text-[var(--color-danger)] mb-1">
              Pending ({data.pending.length})
            </div>
            {data.pending.map((p: any) => (
              <div key={p.id}>{p.name}</div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function HandbookPage() {
  const fetchHandbook = useServerFn(getHandbook);
  const fetchMyAck = useServerFn(getMyHandbookAck);
  const { roleId } = useRole();
  const isOwner = roleId === "owner";
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewMode>("full");
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});

  const { data: sections = [], isLoading } = useQuery<HandbookSection[]>({
    queryKey: ["handbook"],
    queryFn: () => fetchHandbook() as Promise<HandbookSection[]>,
  });

  const { data: myAck } = useQuery<MyAck>({
    queryKey: ["my-handbook-ack"],
    queryFn: () => fetchMyAck() as Promise<MyAck>,
  });

  const baseSections = useMemo(
    () => (view === "policies" ? sections.filter((s) => s.is_policy) : sections),
    [sections, view],
  );

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return baseSections;
    return baseSections.filter((s) => {
      if (s.section_title.toLowerCase().includes(lc) || s.part_title.toLowerCase().includes(lc))
        return true;
      return s.body_blocks.some((b) => "text" in b && b.text.toLowerCase().includes(lc));
    });
  }, [baseSections, q]);

  const partsGrouped = useMemo(() => {
    const m = new Map<number, { title: string; sections: HandbookSection[] }>();
    for (const s of filtered) {
      if (!m.has(s.part_number)) m.set(s.part_number, { title: s.part_title, sections: [] });
      m.get(s.part_number)!.sections.push(s);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  useEffect(() => {
    if (filtered.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveSection(Number(visible.target.id.replace("sec-", "")));
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );
    filtered.forEach((s) => {
      const el = sectionRefs.current[s.section_number];
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [filtered]);

  function jumpTo(sectionNumber: number) {
    const el = sectionRefs.current[sectionNumber];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveSection(sectionNumber);
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">
            {view === "full"
              ? "The full Dip N Shake Employee Handbook — every section, every role."
              : "Company policies only — Employment, Conduct, Operations, and Discipline."}
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border overflow-hidden shrink-0">
          <button
            onClick={() => setView("full")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
              view === "full"
                ? "bg-[#0A0A0A] text-[var(--color-gold)]"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <BookOpen className="h-3.5 w-3.5" /> Full Handbook
          </button>
          <button
            onClick={() => setView("policies")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-l border-border",
              view === "policies"
                ? "bg-[#0A0A0A] text-[var(--color-gold)]"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <ScrollText className="h-3.5 w-3.5" /> Company Policies
          </button>
        </div>
      </div>

      <div className="mt-4">
        {isOwner && <AckRollupCard />}
        <AckBanner myAck={myAck} />
      </div>

      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 mt-4 bg-background/85 backdrop-blur border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search the handbook…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-gold)]/40"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            <div className="label-caps text-muted-foreground mb-2">Contents</div>
            <nav className="flex flex-col gap-3">
              {partsGrouped.map(([partNum, part]) => (
                <div key={partNum}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Part {partNum} — {part.title}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {part.sections.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => jumpTo(s.section_number)}
                        className={cn(
                          "text-left rounded-md px-2 py-1.5 text-sm transition",
                          activeSection === s.section_number
                            ? "bg-[#0A0A0A] text-[var(--color-gold)]"
                            : "text-foreground hover:bg-secondary",
                        )}
                      >
                        {s.section_number}. {s.section_title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <div>
          {isLoading && <Card>Loading…</Card>}
          {!isLoading && filtered.length === 0 && (
            <Card>
              <div className="text-center py-10 text-sm text-muted-foreground">
                {q ? "No sections match your search." : "No handbook content yet."}
              </div>
            </Card>
          )}
          {!isLoading && filtered.length > 0 && (
            <Card className="!p-6">
              {filtered.map((s) => (
                <section
                  key={s.id}
                  ref={(el) => {
                    sectionRefs.current[s.section_number] = el;
                  }}
                >
                  <SectionView section={s} />
                </section>
              ))}
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
