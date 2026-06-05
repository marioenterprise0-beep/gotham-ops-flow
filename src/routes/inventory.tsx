import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { AlertTriangle, ClipboardList, FileText, Plus, Trash2, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory · Gotham OS" }] }),
  component: Inventory,
});

type Item = { name: string; unit: string; par: number; begin: number; end: number; waste: number };

const SEED: Record<string, Item[]> = {
  Proteins: [
    { name: "Halal smash patties", unit: "lbs",   par: 100, begin: 100, end: 18,  waste: 1 },
    { name: "Halal chicken",       unit: "lbs",   par: 60,  begin: 60,  end: 32,  waste: 0.5 },
    { name: "Gyro / mixed meat",   unit: "lbs",   par: 40,  begin: 40,  end: 28,  waste: 0 },
    { name: "Falafel",             unit: "balls", par: 200, begin: 200, end: 140, waste: 4 },
  ],
  "Buns & Bread": [
    { name: "Brioche buns", unit: "ea", par: 240, begin: 240, end: 52, waste: 6 },
    { name: "Pita bread",   unit: "ea", par: 120, begin: 120, end: 78, waste: 0 },
  ],
  Sauces: [
    { name: "Gotham sauce",  unit: "qts", par: 10, begin: 10, end: 7,  waste: 0 },
    { name: "White sauce",   unit: "qts", par: 8,  begin: 8,  end: 4,  waste: 0 },
    { name: "Hot sauce",     unit: "qts", par: 6,  begin: 6,  end: 5,  waste: 0 },
    { name: "Garlic sauce",  unit: "qts", par: 6,  begin: 6,  end: 2,  waste: 0 },
    { name: "Ketchup",       unit: "qts", par: 12, begin: 12, end: 14, waste: 0 },
    { name: "Mustard",       unit: "qts", par: 6,  begin: 6,  end: 5,  waste: 0 },
  ],
  Packaging: [
    { name: "Burger wrappers",     unit: "ea", par: 500, begin: 500, end: 220, waste: 0 },
    { name: "Boxes / trays (sm)",  unit: "ea", par: 200, begin: 200, end: 120, waste: 0 },
    { name: "Boxes / trays (lg)",  unit: "ea", par: 150, begin: 150, end: 90,  waste: 0 },
    { name: "Bags",                unit: "ea", par: 300, begin: 300, end: 170, waste: 0 },
    { name: "Forks",               unit: "ea", par: 500, begin: 500, end: 380, waste: 0 },
    { name: "Napkins",             unit: "pk", par: 12,  begin: 12,  end: 9,   waste: 0 },
  ],
  Beverages: [
    { name: "Bottled water", unit: "ea", par: 96, begin: 96, end: 40, waste: 0 },
    { name: "Canned sodas",  unit: "ea", par: 72, begin: 72, end: 28, waste: 0 },
    { name: "Juice",         unit: "ea", par: 36, begin: 36, end: 22, waste: 0 },
    { name: "Cups",          unit: "ea", par: 250, begin: 250, end: 130, waste: 0 },
    { name: "Lids",          unit: "ea", par: 250, begin: 250, end: 130, waste: 0 },
    { name: "Straws",        unit: "ea", par: 400, begin: 400, end: 220, waste: 0 },
  ],
  Cleaning: [
    { name: "Gloves (boxes)",      unit: "bx", par: 12, begin: 12, end: 9, waste: 0 },
    { name: "Paper towels",        unit: "rl", par: 12, begin: 12, end: 5, waste: 0 },
    { name: "Sanitizer solution",  unit: "gal", par: 4, begin: 4, end: 2, waste: 0 },
    { name: "Dish soap",           unit: "gal", par: 2, begin: 2, end: 1, waste: 0 },
    { name: "Trash bags",          unit: "ea",  par: 100, begin: 100, end: 60, waste: 0 },
  ],
};

type Cat = keyof typeof SEED;
const CATS = Object.keys(SEED) as Cat[];

type Status = "CRITICAL" | "LOW" | "OK" | "OVERSTOCKED";
function statusOf(item: Item): Status {
  const ratio = item.par === 0 ? 1 : item.end / item.par;
  if (ratio < 0.25) return "CRITICAL";
  if (ratio < 0.5)  return "LOW";
  if (ratio > 1.1)  return "OVERSTOCKED";
  return "OK";
}

function Inventory() {
  const [cat, setCat] = useState<Cat>("Proteins");
  const [data, setData] = useState(SEED);
  const [showReceive, setShowReceive] = useState(false);
  const [showWaste, setShowWaste] = useState(false);

  const items = data[cat];

  const counts = useMemo(() => {
    const all = (Object.values(data) as Item[][]).flat();
    let crit = 0, low = 0, ok = 0;
    all.forEach((i) => {
      const s = statusOf(i);
      if (s === "CRITICAL") crit++; else if (s === "LOW") low++; else if (s === "OK" || s === "OVERSTOCKED") ok++;
    });
    return { crit, low, ok };
  }, [data]);

  const update = (idx: number, key: "begin" | "end" | "waste", v: number) => {
    setData((d) => ({ ...d, [cat]: d[cat].map((it, i) => i === idx ? { ...it, [key]: v } : it) }));
  };

  return (
    <AppShell>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard tone="danger"  label="Critical"      value={counts.crit} />
        <SummaryCard tone="warning" label="Low Stock"     value={counts.low} />
        <SummaryCard tone="success" label="Fully Stocked" value={counts.ok} />
      </div>

      {/* Category tabs */}
      <div className="mt-4 -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cn(
                "rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-[1.2px] border transition",
                c === cat ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]" : "bg-card text-muted-foreground border-border hover:text-foreground",
              )}>{c}</button>
          ))}
        </div>
      </div>

      <SectionHeader eyebrow={cat} title="Live Counts" action={<StatusPill tone="gold">Beg → End → Variance</StatusPill>} />

      {/* Desktop table */}
      <Card className="p-0 overflow-hidden hidden md:block">
        <div className="grid grid-cols-[1.4fr_60px_90px_90px_100px_80px_120px] items-center gap-3 px-4 py-2.5 label-caps text-muted-foreground bg-[#FAFAF5] border-b border-border">
          <div>Item</div><div>Par</div><div>Begin</div><div>End</div><div>Variance</div><div>Waste</div><div>Status</div>
        </div>
        {items.map((it, i) => {
          const variance = it.end - it.begin;
          const s = statusOf(it);
          return (
            <div key={it.name} className={cn("grid grid-cols-[1.4fr_60px_90px_90px_100px_80px_120px] items-center gap-3 px-4 py-3", i && "border-t border-border")}>
              <div className="font-medium text-sm">{it.name} <span className="text-muted-foreground text-xs">({it.unit})</span></div>
              <div className="text-sm font-semibold">{it.par}</div>
              <NumInput value={it.begin} onChange={(v) => update(i, "begin", v)} />
              <NumInput value={it.end}   onChange={(v) => update(i, "end", v)} />
              <div className={cn("text-sm font-semibold", variance < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]")}>{variance > 0 ? "+" : ""}{variance}</div>
              <NumInput value={it.waste} onChange={(v) => update(i, "waste", v)} />
              <div><StatusPill tone={statusTone(s)}>{s}</StatusPill></div>
            </div>
          );
        })}
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {items.map((it, i) => {
          const variance = it.end - it.begin;
          const s = statusOf(it);
          return (
            <Card key={it.name} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{it.name}</div>
                  <div className="label-caps text-muted-foreground mt-0.5">Par {it.par} {it.unit}</div>
                </div>
                <StatusPill tone={statusTone(s)}>{s}</StatusPill>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <Field label="Begin"><NumInput value={it.begin} onChange={(v) => update(i, "begin", v)} /></Field>
                <Field label="End"><NumInput value={it.end} onChange={(v) => update(i, "end", v)} /></Field>
                <Field label="Waste"><NumInput value={it.waste} onChange={(v) => update(i, "waste", v)} /></Field>
                <Field label="Variance">
                  <div className={cn("h-9 grid place-items-center rounded-md border border-border text-sm font-semibold", variance < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]")}>{variance > 0 ? "+" : ""}{variance}</div>
                </Field>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => setShowReceive(true)} className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 bg-[var(--color-gold)] text-[#0A0A0A] font-semibold text-sm">
          <Truck className="h-4 w-4" /> Receive Inventory
        </button>
        <button onClick={() => setShowWaste(true)} className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 border border-border bg-card text-foreground font-semibold text-sm hover:border-[var(--color-gold)]">
          <Trash2 className="h-4 w-4" /> Log Waste
        </button>
      </div>

      {showReceive && <ReceiveModal onClose={() => setShowReceive(false)} />}
      {showWaste && <WasteModal onClose={() => setShowWaste(false)} />}

      <div className="h-6" />
    </AppShell>
  );
}

function statusTone(s: Status) {
  return s === "CRITICAL" ? "danger" : s === "LOW" ? "warning" : s === "OVERSTOCKED" ? "info" : "success";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-caps text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-full h-9 rounded-md border border-border bg-card px-2 text-sm focus:border-[var(--color-gold)] outline-none text-center" />
  );
}

function SummaryCard({ tone, label, value }: { tone: "danger" | "warning" | "success"; label: string; value: number }) {
  const bg = tone === "danger" ? "bg-[var(--color-danger-bg)]" : tone === "warning" ? "bg-[var(--color-warning-bg)]" : "bg-[var(--color-success-bg)]";
  const fg = tone === "danger" ? "text-[var(--color-danger)]" : tone === "warning" ? "text-[var(--color-warning)]" : "text-[var(--color-success)]";
  const Icon = tone === "danger" ? AlertTriangle : tone === "warning" ? ClipboardList : FileText;
  return (
    <Card className="flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-lg grid place-items-center", bg, fg)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="label-caps text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
    </Card>
  );
}

function ReceiveModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Receive Inventory" onClose={onClose}>
      <div className="space-y-3">
        <Input label="Vendor name" placeholder="e.g. Halal Beef Co." />
        <Input label="Item received" placeholder="e.g. Smash patties" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity" type="number" />
          <Input label="Temp at delivery (°F)" type="number" />
        </div>
        <Input label="Condition notes" placeholder="Sealed, no damage…" />
        <button className="h-12 rounded-md border-2 border-dashed border-border w-full text-sm text-muted-foreground hover:border-[var(--color-gold)]">Tap to sign</button>
      </div>
      <ModalActions onClose={onClose} primary="Log Receipt" />
    </Modal>
  );
}

function WasteModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Log Waste" onClose={onClose}>
      <div className="space-y-3">
        <Input label="Item" placeholder="e.g. Smash patties" />
        <Input label="Quantity wasted" type="number" />
        <div>
          <div className="label-caps text-muted-foreground mb-1">Reason</div>
          <select className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
            <option>Burned</option><option>Over-temp</option><option>Dropped</option><option>Quality reject</option><option>Expired</option>
          </select>
        </div>
        <Input label="Employee" placeholder="Name" />
      </div>
      <ModalActions onClose={onClose} primary="Log Waste" />
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 card-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl">{title.toUpperCase()}</h3>
          <button onClick={onClose} className="text-muted-foreground text-sm">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onClose, primary }: { onClose: () => void; primary: string }) {
  return (
    <div className="mt-5 flex items-center justify-end gap-2">
      <button onClick={onClose} className="rounded-md px-3 py-2 text-sm border border-border">Cancel</button>
      <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold bg-[var(--color-gold)] text-[#0A0A0A] inline-flex items-center gap-2"><Plus className="h-4 w-4" />{primary}</button>
    </div>
  );
}

function Input({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <div className="label-caps text-muted-foreground mb-1">{label}</div>
      <input {...rest} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm focus:border-[var(--color-gold)] outline-none" />
    </label>
  );
}
