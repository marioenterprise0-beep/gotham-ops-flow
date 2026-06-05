import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, MetricStat, ProgressBar, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Beef, CupSoda, Package, Sandwich, Sparkles, Wheat } from "lucide-react";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory · Gotham OS" }] }),
  component: Inventory,
});

const items = [
  { cat: "Protein", name: "Smash Patties 5oz", unit: "lbs", on: 22, par: 100, icon: Beef, tone: "danger" as const },
  { cat: "Bread", name: "Brioche Buns", unit: "ea", on: 96, par: 240, icon: Sandwich, tone: "warning" as const },
  { cat: "Dairy", name: "American Cheese", unit: "slices", on: 410, par: 600, icon: Package, tone: "neutral" as const },
  { cat: "Sauces", name: "Gotham Sauce", unit: "qts", on: 8, par: 10, icon: Sparkles, tone: "success" as const },
  { cat: "Sides", name: "Hand-Cut Fries", unit: "lbs", on: 35, par: 60, icon: Wheat, tone: "warning" as const },
  { cat: "Beverage", name: "Mint Lemonade Mix", unit: "qts", on: 12, par: 14, icon: CupSoda, tone: "success" as const },
];

function Inventory() {
  return (
    <AppShell>
      <Card dark>
        <div className="text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/60">Inventory</div>
        <h1 className="font-display text-2xl font-semibold mt-1">Stock & Variance</h1>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <DarkStat label="On Par" value="71%" />
          <DarkStat label="Waste" value="2.4%" />
          <DarkStat label="Variance" value="–$48" />
        </div>
      </Card>

      <SectionHeader eyebrow="Live Counts" title="Stock Levels" action={<StatusPill tone="gold">2 low</StatusPill>} />
      <Card className="p-0 overflow-hidden">
        {items.map((it, i) => {
          const pct = Math.round((it.on / it.par) * 100);
          const Icon = it.icon;
          return (
            <div key={it.name} className={`p-4 ${i ? "border-t border-border" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary grid place-items-center">
                  <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{it.cat}</span>
                    <StatusPill tone={it.tone}>{it.tone === "danger" ? "Reorder" : it.tone === "warning" ? "Low" : it.tone === "success" ? "On par" : "OK"}</StatusPill>
                  </div>
                  <div className="font-medium truncate">{it.name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-lg font-semibold leading-none">{it.on}<span className="text-xs text-muted-foreground">/{it.par}</span></div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-1">{it.unit}</div>
                </div>
              </div>
              <div className="mt-3"><ProgressBar value={pct} tone={it.tone === "success" ? "success" : "gold"} /></div>
            </div>
          );
        })}
      </Card>

      <SectionHeader eyebrow="Today" title="Variance Snapshot" />
      <div className="grid grid-cols-3 gap-3">
        <Card><MetricStat label="Begin" value="$1,840" /></Card>
        <Card><MetricStat label="Used" value="$612" /></Card>
        <Card><MetricStat label="Waste" value="$44" tone="gold" /></Card>
      </div>

      <div className="h-6" />
    </AppShell>
  );
}

function DarkStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sidebar-accent/40 border border-sidebar-border p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">{label}</div>
      <div className="font-display text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
