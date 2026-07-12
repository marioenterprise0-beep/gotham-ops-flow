import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { EmbedShell } from "@/components/gotham/EmbedShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { listChangeLog, recordChange, type ChangeLogRow } from "@/lib/change-log.functions";
import { syncDomains } from "@/lib/sync-bus";
import { canSee, useRole } from "@/lib/role";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { cn } from "@/lib/utils";
import { ScrollText, Search, X } from "lucide-react";

export const Route = createFileRoute("/change-log")({
  ssr: false,
  beforeLoad: () => { throw redirect({ to: "/admin", search: { tab: "activity" } as any }); },
  head: () => ({ meta: [{ title: "Change Log · Dip N Shake OS" }] }),
  component: ChangeLogPage,
});

const ENTITIES = ["", "inventory_item", "inventory_order", "schedule", "time_punch", "time_correction", "alert", "recap"];

const TONE: Record<string, "success" | "warning" | "danger" | "info" | "gold"> = {
  create: "success",
  approve: "success",
  update: "info",
  adjust: "warning",
  unlock: "warning",
  reject: "danger",
  delete: "danger",
  close: "info",
};

export function ChangeLogPage() {
  const { roleId } = useRole();
  if (roleId !== "owner") return <Navigate to="/" />;

  const fetchLog = useServerFn(listChangeLog);
  const insertLog = useServerFn(recordChange);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState<string>("");
  const [days, setDays] = useState(30);
  const [selected, setSelected] = useState<ChangeLogRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["change-log", search, entity, days],
    queryFn: () => fetchLog({ data: { search, entity: entity || undefined, days } }),
    refetchInterval: 30_000,
  });

  // Demo seed for the very first visit so the page isn't empty.
  const seed = useMutation({
    mutationFn: () => insertLog({ data: { entity: "system", action: "create", summary: "Change Log enabled", reason: "Module 9 rollout" } }),
    onSuccess: () => syncDomains(qc, "history"),
  });

  const grouped = useMemo(() => {
    const m = new Map<string, ChangeLogRow[]>();
    for (const r of rows) {
      const d = new Date(r.created_at).toLocaleDateString();
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(r);
    }
    return Array.from(m.entries());
  }, [rows]);

  return (
    <EmbedShell>
      <SectionHeader
        eyebrow="Activity"
        title="Change Log"
        action={<StatusPill tone="gold">{rows.length} changes</StatusPill>}
      />

      <Card className="p-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor, reason, summary…"
              className="w-full bg-background border border-border rounded-md pl-8 pr-2 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
            />
          </div>
          <select value={entity} onChange={(e) => setEntity(e.target.value)}
            className="bg-background border border-border rounded-md px-2 py-2 text-sm outline-none focus:border-[var(--color-gold)]">
            {ENTITIES.map((e) => <option key={e} value={e}>{e ? e.replace(/_/g, " ") : "All entities"}</option>)}
          </select>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="bg-background border border-border rounded-md px-2 py-2 text-sm outline-none focus:border-[var(--color-gold)]">
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={0}>All time</option>
          </select>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <ScrollText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <div>No changes recorded yet.</div>
            <button onClick={() => seed.mutate()} disabled={seed.isPending}
              className="mt-3 inline-flex items-center gap-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold">
              {seed.isPending ? "…" : "Record a test entry"}
            </button>
          </div>
        )}
        {grouped.map(([day, list], di) => (
          <div key={day}>
            <div className={cn("px-4 py-2 text-xs font-semibold text-muted-foreground bg-secondary/40", di && "border-t border-border")}>
              {day} · {list.length}
            </div>
            {list.map((r) => (
              <button key={r.id} onClick={() => setSelected(r)}
                className="w-full text-left p-4 grid grid-cols-1 md:grid-cols-[140px_140px_1fr_auto] gap-3 items-start border-t border-border hover:bg-secondary/30 transition">
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}
                </div>
                <div className="text-sm font-medium truncate">{r.actor_name ?? "—"}</div>
                <div className="text-sm">
                  <span className="font-semibold">{r.action.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground"> · {r.entity}</span>
                  {r.summary && <div className="text-xs text-muted-foreground mt-0.5 truncate">{r.summary}</div>}
                  {r.reason && <div className="text-xs text-foreground/70 mt-0.5 truncate"><span className="text-muted-foreground">Reason:</span> {r.reason}</div>}
                </div>
                <StatusPill tone={TONE[r.action] ?? "info"}>{r.action.split("_")[0]}</StatusPill>
              </button>
            ))}
          </div>
        ))}
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-xl max-h-[85vh] overflow-auto">
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{selected.action.replace(/_/g, " ")} · {selected.entity}</div>
                <div className="text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleString()} · {selected.actor_name}</div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              {selected.summary && <div><div className="label-caps text-muted-foreground mb-1">Summary</div><div>{selected.summary}</div></div>}
              {selected.reason && <div><div className="label-caps text-muted-foreground mb-1">Reason</div><div>{selected.reason}</div></div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="label-caps text-muted-foreground mb-1">Before</div>
                  <pre className="bg-background border border-border rounded p-2 text-xs overflow-auto max-h-64">{JSON.stringify(selected.before, null, 2) || "—"}</pre>
                </div>
                <div>
                  <div className="label-caps text-muted-foreground mb-1">After</div>
                  <pre className="bg-background border border-border rounded p-2 text-xs overflow-auto max-h-64">{JSON.stringify(selected.after, null, 2) || "—"}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="h-6" />
    </EmbedShell>
  );
}
