import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, MetricStat, SectionHeader } from "@/components/gotham/primitives";
import { canSee, useRole } from "@/lib/role";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics · Gotham OS" }] }),
  component: AnalyticsPage,
});

const TASK_COMPLETION = [
  { d: "Mon", v: 78 }, { d: "Tue", v: 84 }, { d: "Wed", v: 91 }, { d: "Thu", v: 88 },
  { d: "Fri", v: 95 }, { d: "Sat", v: 82 }, { d: "Sun", v: 90 },
];
const WASTE_BY_CAT = [
  { c: "Proteins", v: 4.2 }, { c: "Buns", v: 3.1 }, { c: "Sauces", v: 1.2 },
  { c: "Beverage", v: 0.8 }, { c: "Sides", v: 2.5 }, { c: "Packaging", v: 0.4 },
];
const OPENING_TIME = [
  { d: "Mon", v: 22 }, { d: "Tue", v: 19 }, { d: "Wed", v: 21 }, { d: "Thu", v: 18 },
  { d: "Fri", v: 17 }, { d: "Sat", v: 20 }, { d: "Sun", v: 19 },
];
const HOSP_BREAKDOWN = [
  { c: "Greeting", v: 92 }, { c: "Accuracy", v: 88 }, { c: "Upsell", v: 71 },
  { c: "Wait Ack", v: 85 }, { c: "Recovery", v: 95 },
];

const GOLD = "#C9973A";

const RANGES = ["Today", "Week", "Month", "Custom"] as const;
type Range = (typeof RANGES)[number];

function AnalyticsPage() {
  const { roleId } = useRole();
  if (!canSee(roleId, "analytics")) return <Navigate to="/" />;
  const [range, setRange] = useState<Range>("Week");

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps text-muted-foreground">Performance</div>
          <h1 className="font-display text-3xl text-foreground">ANALYTICS</h1>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-card p-1">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={cn("px-3 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] rounded-sm", range === r ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "text-muted-foreground hover:text-foreground")}>{r}</button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><MetricStat label="Opening %"  value="94%" sub="+2 vs avg" /></Card>
        <Card><MetricStat label="Closing %"  value="89%" sub="-3 vs avg" /></Card>
        <Card><MetricStat label="Inv. Var."  value="2.1%" /></Card>
        <Card><MetricStat label="Task Comp." value="91%" /></Card>
        <Card><MetricStat label="Waste %"    value="3.4%" tone="gold" /></Card>
        <Card><MetricStat label="Hosp."      value="87" /></Card>
      </div>

      <SectionHeader eyebrow="Trend" title="Task Completion" />
      <Card dark>
        <div className="h-64 -ml-2">
          <ResponsiveContainer>
            <LineChart data={TASK_COMPLETION}>
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
                <BarChart data={WASTE_BY_CAT}>
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
          <SectionHeader eyebrow="Opening" title="Opening Time vs 20-min Target" />
          <Card>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={OPENING_TIME}>
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
            <BarChart data={HOSP_BREAKDOWN} layout="vertical">
              <CartesianGrid stroke="#EAEAE5" horizontal={false} />
              <XAxis type="number" stroke="#6B6B6B" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <YAxis type="category" dataKey="c" stroke="#6B6B6B" tick={{ fontSize: 11 }} width={80} />
              <Tooltip cursor={{ fill: "rgba(201,151,58,0.08)" }} />
              <Bar dataKey="v" fill={GOLD} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="h-6" />
    </AppShell>
  );
}
