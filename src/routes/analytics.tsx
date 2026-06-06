import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, MetricStat, SectionHeader } from "@/components/gotham/primitives";
import { canSee, useRole } from "@/lib/role";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { getAnalytics } from "@/lib/analytics.functions";

export const Route = createFileRoute("/analytics")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Analytics · Gotham OS" }] }),
  component: AnalyticsPage,
});

const GOLD = "#C9973A";
const RANGES = [
  { label: "Today", key: "today" as const },
  { label: "Week", key: "week" as const },
  { label: "Month", key: "month" as const },
];
type RangeKey = (typeof RANGES)[number]["key"];

function AnalyticsPage() {
  const { roleId, trailers, trailerScope, setTrailerScope } = useRole();
  if (!canSee(roleId, "analytics")) return <Navigate to="/" />;
  const [range, setRange] = useState<RangeKey>("week");

  const fn = useServerFn(getAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", range, trailerScope],
    queryFn: () => fn({ data: { range, trailerId: trailerScope ?? null } }),
    refetchInterval: 60_000,
  });

  const scopeLabel = trailerScope
    ? (trailers.find((t) => t.id === trailerScope)?.name ?? "Trailer")
    : "Company · All trailers";

  const k = data?.kpis;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps text-muted-foreground">Performance · {scopeLabel}</div>
          <h1 className="font-display text-3xl text-foreground">ANALYTICS</h1>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-card p-1">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={cn("px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] rounded-sm", range === r.key ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "text-muted-foreground hover:text-foreground")}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto">
        {trailers.map((t) => (
          <button key={t.id} onClick={() => setTrailerScope(t.id)}
            className={cn("px-4 py-2 text-xs font-semibold uppercase tracking-[1.2px] rounded-md border transition shrink-0",
              trailerScope === t.id ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]" : "bg-card text-muted-foreground border-border hover:text-foreground")}>
            {t.name}
          </button>
        ))}
        <button onClick={() => setTrailerScope(null)}
          className={cn("px-4 py-2 text-xs font-semibold uppercase tracking-[1.2px] rounded-md border transition shrink-0",
            trailerScope === null ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]" : "bg-card text-muted-foreground border-border hover:text-foreground")}>
          Company
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><MetricStat label="Opening %"  value={k ? `${k.openingPct}%` : "—"} /></Card>
        <Card><MetricStat label="Closing %"  value={k ? `${k.closingPct}%` : "—"} /></Card>
        <Card><MetricStat label="Inv. Var."  value={k ? `${k.invVarPct}%` : "—"} /></Card>
        <Card><MetricStat label="Task Comp." value={k ? `${k.taskCompPct}%` : "—"} /></Card>
        <Card><MetricStat label="Waste"      value={k ? `${k.wastePct}` : "—"} tone="gold" /></Card>
        <Card><MetricStat label="Hosp."      value={k ? `${k.hospScore}` : "—"} /></Card>
      </div>

      <DataQualityAlerts totals={data?.totals} rangeLabel={RANGES.find(r => r.key === range)!.label.toLowerCase()} />

      {isLoading && <div className="mt-4 text-sm text-muted-foreground">Loading analytics…</div>}

      <SectionHeader eyebrow="Trend" title="Task Completion" />
      <Card dark>
        <div className="h-64 -ml-2">
          <ResponsiveContainer>
            <LineChart data={data?.taskTrend ?? []}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="d" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#0A0A0A", border: "1px solid #1C1C1C", borderRadius: 8 }} labelStyle={{ color: "#fff" }} />
              <Line type="monotone" dataKey="v" stroke={GOLD} strokeWidth={2.5} dot={{ r: 4, fill: GOLD }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <SectionHeader eyebrow="Loss" title="Waste by Category" />
          <Card>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data?.wasteByCat ?? []}>
                  <CartesianGrid stroke="#EAEAE5" vertical={false} />
                  <XAxis dataKey="c" stroke="#6B6B6B" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6B6B6B" tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "rgba(201,151,58,0.08)" }} />
                  <Bar dataKey="v" fill={GOLD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div>
          <SectionHeader eyebrow="Opening" title="Opening Lateness (min past 9:00)" />
          <Card>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data?.openingTrend ?? []}>
                  <CartesianGrid stroke="#EAEAE5" vertical={false} />
                  <XAxis dataKey="d" stroke="#6B6B6B" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6B6B6B" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="v" name="Minutes" fill="#0A0A0A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      <SectionHeader eyebrow="Quality" title="Hospitality Breakdown" />
      <Card>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data?.hospBreakdown ?? []} layout="vertical">
              <CartesianGrid stroke="#EAEAE5" horizontal={false} />
              <XAxis type="number" stroke="#6B6B6B" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <YAxis type="category" dataKey="c" stroke="#6B6B6B" tick={{ fontSize: 11 }} width={100} />
              <Tooltip cursor={{ fill: "rgba(201,151,58,0.08)" }} />
              <Bar dataKey="v" fill={GOLD} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {data?.totals && (
        <div className="mt-3 text-xs text-muted-foreground">
          {data.totals.tasks} tasks · {data.totals.wasteEntries} waste entries · {data.totals.countEntries} counts · {data.totals.incidents} incidents · {data.totals.shifts} shifts in range
        </div>
      )}

      <div className="h-6" />
    </AppShell>
  );
}

type Totals = {
  tasks: number;
  wasteEntries: number;
  countEntries: number;
  incidents: number;
  shifts: number;
};

function DataQualityAlerts({ totals, rangeLabel }: { totals?: Totals; rangeLabel: string }) {
  if (!totals || totals.tasks === 0) return null;

  const alerts: { level: "warn" | "info"; title: string; detail: string }[] = [];
  if (totals.wasteEntries === 0) {
    alerts.push({
      level: "warn",
      title: "No waste logged",
      detail: `${totals.tasks} tasks recorded ${rangeLabel} but zero waste entries — crew may be skipping the waste log.`,
    });
  }
  if (totals.countEntries === 0) {
    alerts.push({
      level: "warn",
      title: "No inventory counts",
      detail: `No counts recorded ${rangeLabel}. Variance & waste % cannot be calculated until counts are entered.`,
    });
  }
  if (totals.incidents === 0 && totals.shifts > 0) {
    alerts.push({
      level: "info",
      title: "No hospitality incidents",
      detail: `Zero incidents logged across ${totals.shifts} shift(s). Confirm crew is using the hospitality log, not just skipping it.`,
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="label-caps text-muted-foreground">Data Quality</div>
      {alerts.map((a, i) => (
        <div
          key={i}
          className={cn(
            "rounded-md border p-3 text-sm flex gap-3",
            a.level === "warn"
              ? "border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5"
              : "border-border bg-card",
          )}
        >
          <div
            className={cn(
              "mt-1 h-2 w-2 rounded-full shrink-0",
              a.level === "warn" ? "bg-[var(--color-gold)]" : "bg-muted-foreground",
            )}
          />
          <div>
            <div className="font-semibold text-foreground">{a.title}</div>
            <div className="text-muted-foreground text-xs mt-0.5">{a.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

