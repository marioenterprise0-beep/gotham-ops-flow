import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { AlertTriangle, ClipboardList, FileText, Plus, Trash2, Truck, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { listInventory, receiveStock, logWaste, submitCount, upsertInventoryItem, deleteInventoryItem } from "@/lib/inventory.functions";
import { toast } from "sonner";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";


export const Route = createFileRoute("/inventory")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Inventory · Gotham OS" }] }),
  component: Inventory,
});

const CATEGORY_LABELS: Record<string, string> = {
  protein: "Proteins", bun: "Buns & Bread", sauce: "Sauces",
  produce: "Produce", packaging: "Packaging", supplies: "Supplies",
};

type Item = {
  id: string; name: string; category: string; unit: string;
  par_level: number; low_threshold: number; current_qty: number;
};

type Status = "CRITICAL" | "LOW" | "OK" | "OVERSTOCKED";
function statusOf(it: Item): Status {
  const ratio = it.par_level === 0 ? 1 : Number(it.current_qty) / Number(it.par_level);
  if (Number(it.current_qty) <= Number(it.low_threshold)) return "CRITICAL";
  if (ratio < 0.5) return "LOW";
  if (ratio > 1.1) return "OVERSTOCKED";
  return "OK";
}
function statusTone(s: Status) {
  return s === "CRITICAL" ? "danger" : s === "LOW" ? "warning" : s === "OVERSTOCKED" ? "info" : "success";
}

function Inventory() {
  const qc = useQueryClient();
  const { roleId } = useRole();
  const isManager = roleId === "owner" || roleId === "manager";
  const list = useServerFn(listInventory);
  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["inventory"],
    queryFn: () => list() as Promise<Item[]>,
  });

  const cats = Array.from(new Set(items.map((i) => i.category)));
  const [cat, setCat] = useState<string>("protein");
  const visible = items.filter((i) => i.category === cat);

  const counts = items.reduce((acc, it) => {
    const s = statusOf(it);
    if (s === "CRITICAL") acc.crit++; else if (s === "LOW") acc.low++; else acc.ok++;
    return acc;
  }, { crit: 0, low: 0, ok: 0 });

  const [receiveItem, setReceiveItem] = useState<Item | null>(null);
  const [wasteItem, setWasteItem] = useState<Item | null>(null);
  const [editItem, setEditItem] = useState<Item | "new" | null>(null);

  const submitCountFn = useServerFn(submitCount);
  const countMut = useMutation({
    mutationFn: (vars: { itemId: string; countQty: number }) => submitCountFn({ data: vars }),
    onSuccess: () => { toast.success("Count saved"); qc.invalidateQueries({ queryKey: ["inventory"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFn = useServerFn(deleteInventoryItem);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Item removed"); qc.invalidateQueries({ queryKey: ["inventory"] }); },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <AppShell>
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard tone="danger"  label="Critical"      value={counts.crit} />
        <SummaryCard tone="warning" label="Low Stock"     value={counts.low} />
        <SummaryCard tone="success" label="Fully Stocked" value={counts.ok} />
      </div>

      <div className="mt-4 -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cn(
                "rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-[1.2px] border transition",
                c === cat ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]" : "bg-card text-muted-foreground border-border hover:text-foreground",
              )}>{CATEGORY_LABELS[c] ?? c}</button>
          ))}
        </div>
      </div>

      <SectionHeader
        eyebrow={CATEGORY_LABELS[cat] ?? cat}
        title="Live Counts"
        action={isManager ? (
          <button onClick={() => setEditItem("new")} className="inline-flex items-center gap-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-2.5 py-1 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> New item
          </button>
        ) : <StatusPill tone="gold">On-hand vs Par</StatusPill>}
      />


      {isLoading && <Card>Loading…</Card>}

      <div className="space-y-2">
        {visible.map((it) => {
          const s = statusOf(it);
          const pct = Math.min(150, Math.round((Number(it.current_qty) / Math.max(1, Number(it.par_level))) * 100));
          return (
            <Card key={it.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{it.name}</div>
                  <div className="label-caps text-muted-foreground mt-0.5">Par {Number(it.par_level)} · Low ≤ {Number(it.low_threshold)} {it.unit}</div>
                </div>
                <StatusPill tone={statusTone(s)}>{s}</StatusPill>
                {isManager && (
                  <div className="flex gap-1">
                    <button onClick={() => setEditItem(it)} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { if (confirm(`Delete ${it.name}?`)) deleteMut.mutate(it.id); }} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-[var(--color-danger)]" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                <div>
                  <div className="text-2xl font-semibold">{Number(it.current_qty)} <span className="text-xs text-muted-foreground">{it.unit} · {pct}%</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-[#EAEAE5] overflow-hidden">
                    <div className={cn("h-full rounded-full", s === "CRITICAL" ? "bg-[var(--color-danger)]" : s === "LOW" ? "bg-[var(--color-warning)]" : "bg-[var(--color-success)]")} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
                <button onClick={() => setReceiveItem(it)} className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-2 text-xs font-semibold inline-flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" /> Receive
                </button>
                <button onClick={() => setWasteItem(it)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold inline-flex items-center gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> Waste
                </button>
              </div>
              <CountStrip onSubmit={(n) => countMut.mutate({ itemId: it.id, countQty: n })} />
            </Card>
          );
        })}
        {!isLoading && visible.length === 0 && <Card>No items in this category.</Card>}
      </div>

      {receiveItem && <ReceiveModal item={receiveItem} onClose={() => setReceiveItem(null)} onDone={() => qc.invalidateQueries({ queryKey: ["inventory"] })} />}
      {wasteItem && <WasteModal item={wasteItem} onClose={() => setWasteItem(null)} onDone={() => qc.invalidateQueries({ queryKey: ["inventory"] })} />}
      {editItem && <EditItemModal item={editItem === "new" ? null : editItem} defaultCategory={cat} onClose={() => setEditItem(null)} onDone={() => qc.invalidateQueries({ queryKey: ["inventory"] })} />}


      <div className="h-6" />
    </AppShell>
  );
}

function CountStrip({ onSubmit }: { onSubmit: (n: number) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="mt-3 flex items-center gap-2">
      <input type="number" placeholder="Recount" value={v} onChange={(e) => setV(e.target.value)}
        className="h-9 w-32 rounded-md border border-border bg-card px-2 text-sm" />
      <button disabled={!v} onClick={() => { onSubmit(Number(v)); setV(""); }}
        className="h-9 px-3 rounded-md border border-border text-xs font-semibold disabled:opacity-40">Submit count</button>
    </div>
  );
}

function SummaryCard({ tone, label, value }: { tone: "danger" | "warning" | "success"; label: string; value: number }) {
  const bg = tone === "danger" ? "bg-[var(--color-danger-bg)]" : tone === "warning" ? "bg-[var(--color-warning-bg)]" : "bg-[var(--color-success-bg)]";
  const fg = tone === "danger" ? "text-[var(--color-danger)]" : tone === "warning" ? "text-[var(--color-warning)]" : "text-[var(--color-success)]";
  const Icon = tone === "danger" ? AlertTriangle : tone === "warning" ? ClipboardList : FileText;
  return (
    <Card className="flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-lg grid place-items-center", bg, fg)}><Icon className="h-5 w-5" /></div>
      <div>
        <div className="label-caps text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
    </Card>
  );
}

function ReceiveModal({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const recv = useServerFn(receiveStock);
  const [qty, setQty] = useState(""); const [supplier, setSupplier] = useState(""); const [notes, setNotes] = useState("");
  const m = useMutation({
    mutationFn: () => recv({ data: { itemId: item.id, qty: Number(qty), supplier: supplier || undefined, notes: notes || undefined } }),
    onSuccess: () => { toast.success("Stock received"); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal title={`Receive: ${item.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label={`Quantity (${item.unit})`}><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
        <Field label="Supplier"><input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
        <Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
      </div>
      <ModalActions onClose={onClose} primary="Log Receipt" disabled={!qty || m.isPending} onSubmit={() => m.mutate()} />
    </Modal>
  );
}

function WasteModal({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const waste = useServerFn(logWaste);
  const [qty, setQty] = useState(""); const [reason, setReason] = useState("Burned");
  const m = useMutation({
    mutationFn: () => waste({ data: { itemId: item.id, qty: Number(qty), reason } }),
    onSuccess: () => { toast.success("Waste logged"); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal title={`Waste: ${item.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label={`Quantity (${item.unit})`}><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
        <Field label="Reason">
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
            <option>Burned</option><option>Dropped</option><option>Quality reject</option><option>Expired</option><option>Over-temp</option>
          </select>
        </Field>
      </div>
      <ModalActions onClose={onClose} primary="Log Waste" disabled={!qty || m.isPending} onSubmit={() => m.mutate()} />
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="label-caps text-muted-foreground mb-1">{label}</div>{children}</label>;
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

function ModalActions({ onClose, primary, disabled, onSubmit }: { onClose: () => void; primary: string; disabled?: boolean; onSubmit: () => void }) {
  return (
    <div className="mt-5 flex items-center justify-end gap-2">
      <button onClick={onClose} className="rounded-md px-3 py-2 text-sm border border-border">Cancel</button>
      <button disabled={disabled} onClick={onSubmit} className="rounded-md px-4 py-2 text-sm font-semibold bg-[var(--color-gold)] text-[#0A0A0A] inline-flex items-center gap-2 disabled:opacity-50">
        <Plus className="h-4 w-4" />{primary}
      </button>
    </div>
  );
}
