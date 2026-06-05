import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, MetricStat, ProgressBar, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics · Gotham OS" }] }),
  component: Analytics,
});

const weekly = [62, 78, 71, 88, 94, 81, 90];

function Analytics() {
  return (
    <AppShell>
      <Card dark>
        <div className="text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/60">Performance</div>
        <h1 className="font-display text-2xl font-semibold mt-1">This Week</h1>
        <div className="mt-5 flex items-end justify-between gap-1 h-32">
          {weekly.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full rounded-md shimmer-gold" style={{ height: `${v}%`, opacity: 0.4 + v / 200 }} />
              <div className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/50">{["M","T","W","T","F","S","S"][i]}</div>
            </div>
          ))}
        </div>
      </Card>

      <SectionHeader eyebrow="KPIs" title="Compliance & Quality" />
      <div className="grid grid-cols-2 gap-3">
        <KPI label="Opening Completion" value="98%" delta="+2" up />
        <KPI label="Closing Completion" value="91%" delta="-3" />
        <KPI label="Hospitality Score" value="4.8" delta="+0.2" up />
        <KPI label="Ticket Speed" value="3:42" delta="-0:18" up />
      </div>

      <SectionHeader eyebrow="Operations" title="Compliance Trend" />
      <Card>
        {[
          { label: "Task Compliance", v: 94 },
          { label: "Inventory Variance", v: 88 },
          { label: "Waste Control", v: 76 },
          { label: "SOP Certification", v: 82 },
        ].map((r) => (
          <div key={r.label} className="py-2 first:pt-0 last:pb-0">
            <div className="flex justify-between text-sm mb-1.5">
              <span>{r.label}</span>
              <span className="font-display font-semibold">{r.v}%</span>
            </div>
            <ProgressBar value={r.v} />
          </div>
        ))}
      </Card>

      <SectionHeader eyebrow="Snapshot" title="Today" />
      <div className="grid grid-cols-3 gap-3">
        <Card><MetricStat label="Tickets" value="142" sub="+12 vs avg" /></Card>
        <Card><MetricStat label="Avg Speed" value="3:42" tone="gold" /></Card>
        <Card><MetricStat label="Score" value="96" sub="Store rank #1" /></Card>
      </div>

      <div className="h-6" />
    </AppShell>
  );
}

function KPI({ label, value, delta, up }: { label: string; value: string; delta: string; up?: boolean }) {
  return (
    <Card>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-end justify-between">
        <div className="font-display text-2xl font-semibold tracking-tight">{value}</div>
        <StatusPill tone={up ? "success" : "warning"}>
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta}
        </StatusPill>
      </div>
    </Card>
  );
}
