import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { getHealthScore, type HealthScore } from "@/lib/health.functions";
import { canSee, useRole } from "@/lib/role";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";
import { EmptyState } from "@/components/gotham/EmptyState";

export const Route = createFileRoute("/health")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Store Health · Gotham OS" }] }),
  component: HealthPage,
});

const RANGES = [
  { v: 1, label: "Today" },
  { v: 7, label: "Week" },
  { v: 30, label: "Month" },
];

function bandTone(band: HealthScore["band"]) {
  return band === "green" ? "success" : band === "yellow" ? "warning" : "danger";
}
function bandLabel(b: HealthScore["band"]) {
  return b === "green" ? "Healthy" : b === "yellow" ? "Needs Attention" : "Action Needed";
}
function bandColor(b: HealthScore["band"]) {
  return b === "green" ? "var(--color-success)" : b === "yellow" ? "var(--color-warning)" : "var(--color-danger)";
}

function Sparkline({ data, color }: { data: { date: string; score: number }[]; color: string }) {
  if (data.length === 0) return null;
  const w = 600, h = 80, pad = 4;
  const xs = (i: number) => pad + (i * (w - pad * 2)) / (data.length - 1);
  const ys = (v: number) => h - pad - (v / 100) * (h - pad * 2);
  const d = data.map((p, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(p.score)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
      <path d={`${d} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`} fill={color} fillOpacity="0.1" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" />
      {data.map((p, i) => <circle key={i} cx={xs(i)} cy={ys(p.score)} r="2.5" fill={color} />)}
    </svg>
  );
}

function HealthPage() {
  const { roleId, trailerScope } = useRole();
  if (!canSee(roleId, "manager")) return <Navigate to="/" />;
  const fetch = useServerFn(getHealthScore);
  const [days, setDays] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["health", trailerScope, days],
    queryFn: () => fetch({ data: { trailerId: trailerScope ?? null, days } }),
    refetchInterval: 60_000,
  });

  return (
    <AppShell>
      <SectionHeader
        eyebrow="Operations"
        title="Store Health Score"
        action={
          <div className="flex gap-1 rounded-md border border-border p-0.5 bg-background">
            {RANGES.map((r) => (
              <button key={r.v} onClick={() => setDays(r.v)}
                className={cn("px-3 py-1 text-xs font-semibold rounded",
                  days === r.v ? "bg-[var(--color-gold)] text-[#0A0A0A]" : "text-muted-foreground hover:text-foreground")}>
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {isLoading && <Card><div className="p-6 text-center text-sm text-muted-foreground">Calculating…</div></Card>}

      {data && (
        <>
          <Card goldAccent className="mb-3">
            <div className="flex items-center justify-between gap-6 flex-wrap">
              <div className="flex items-center gap-5">
                <div className="grid place-items-center h-24 w-24 rounded-full border-4"
                  style={{ borderColor: bandColor(data.band), color: bandColor(data.band) }}>
                  <span className="font-display text-4xl font-bold">{data.overall}</span>
                </div>
                <div>
                  <div className="label-caps text-muted-foreground">Overall Score</div>
                  <div className="font-display text-2xl">{bandLabel(data.band)}</div>
                  <StatusPill tone={bandTone(data.band)}>{data.band.toUpperCase()}</StatusPill>
                </div>
              </div>
              <div className="flex-1 min-w-[280px]">
                <div className="label-caps text-muted-foreground mb-1">14-day Trend</div>
                <Sparkline data={data.trend} color={bandColor(data.band)} />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.components.map((c) => {
              const b = c.score >= 80 ? "green" : c.score >= 60 ? "yellow" : "red";
              return (
                <Card key={c.key}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{c.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(c.weight * 100)}%</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-display text-3xl" style={{ color: bandColor(b) }}>{c.score}</span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-2">
                    <div className="h-full" style={{ width: `${c.score}%`, backgroundColor: bandColor(b) }} />
                  </div>
                  <div className="text-xs text-muted-foreground">{c.detail}</div>
                </Card>
              );
            })}
          </div>
        </>
      )}
      <div className="h-6" />
    </AppShell>
  );
}
