import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Search, ChevronRight, ChefHat, Coffee, Sparkles, Shield, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sops")({
  head: () => ({ meta: [{ title: "SOP Library · Gotham OS" }] }),
  component: SOPs,
});

const categories = [
  { key: "Kitchen", icon: ChefHat },
  { key: "Front", icon: Coffee },
  { key: "Cleaning", icon: Sparkles },
  { key: "Management", icon: Shield },
  { key: "Hospitality", icon: Heart },
] as const;

const sops = [
  { cat: "Kitchen", title: "Smash Burger Build · Single", role: "Grill Master", time: "90s", certified: true },
  { cat: "Kitchen", title: "Smash Burger Build · Double", role: "Grill Master", time: "120s", certified: true },
  { cat: "Kitchen", title: "Hand-Cut Fries Prep", role: "Prep", time: "20m", certified: true },
  { cat: "Front", title: "Greet & Order Take", role: "Cashier", time: "—", certified: true },
  { cat: "Front", title: "Drink Build · Mint Lemonade", role: "Cashier", time: "45s", certified: false },
  { cat: "Cleaning", title: "Flat Top Scrape & Season", role: "Grill Master", time: "8m", certified: true },
  { cat: "Cleaning", title: "Front Counter · 15-min Cycle", role: "Cashier", time: "3m", certified: true },
  { cat: "Hospitality", title: "Guest Recovery Protocol", role: "Shift Lead", time: "—", certified: false },
  { cat: "Management", title: "Cash Drop & Close-Out", role: "Manager", time: "12m", certified: true },
];

function SOPs() {
  const [cat, setCat] = useState<string>("Kitchen");
  const [q, setQ] = useState("");
  const filtered = sops.filter((s) => s.cat === cat && s.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell>
      <Card dark>
        <div className="text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/60">Standard Operating Procedures</div>
        <h1 className="font-display text-2xl font-semibold mt-1">SOP Library</h1>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search procedures…"
            className="w-full bg-sidebar-accent/50 border border-sidebar-border rounded-lg pl-10 pr-3 py-2.5 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/40 outline-none focus:border-gold/60"
          />
        </div>
      </Card>

      <div className="mt-4 -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {categories.map((c) => {
            const Icon = c.icon;
            const active = cat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs uppercase tracking-[0.14em] font-medium transition",
                  active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {c.key}
              </button>
            );
          })}
        </div>
      </div>

      <SectionHeader eyebrow={cat} title={`${filtered.length} procedures`} />
      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">No matching SOPs.</div>
        )}
        {filtered.map((s, i) => (
          <button key={s.title} className={cn("w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/60 transition", i && "border-t border-border")}>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold tracking-tight truncate">{s.title}</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-1">
                {s.role} · {s.time}
              </div>
            </div>
            {s.certified && <StatusPill tone="gold">Certified</StatusPill>}
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </Card>

      <div className="h-6" />
    </AppShell>
  );
}
