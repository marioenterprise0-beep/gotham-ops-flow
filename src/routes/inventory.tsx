import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { AlertTriangle, ClipboardList, FileText, Plus, Trash2, Truck, Pencil, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadCSV, openPrintablePDF, htmlTable, kpiBlock, escapeHTML } from "@/lib/exports";
import { listInventory, receiveStock, logWaste, submitCount, upsertInventoryItem, deleteInventoryItem } from "@/lib/inventory.functions";
import { submitInventoryChangeRequest } from "@/lib/inventory-changes.functions";
import { Link } from "@tanstack/react-router";
import { createInventoryOrder, listInventoryOrders } from "@/lib/inventory-orders.functions";
import { toast } from "sonner";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { syncDomains } from "@/lib/sync-bus";


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
  const { roleId, trailerScope, trailers, session, loading } = useRole();
  const isOwner = roleId === "owner";
  const isManager = roleId === "owner" || roleId === "manager";
  const canPropose = !!session?.access_token;
  const list = useServerFn(listInventory);
  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["inventory", trailerScope ?? "company"],
    queryFn: () => list({ data: { trailerId: trailerScope } }) as Promise<Item[]>,
    enabled: !loading && !!session?.access_token,
  });
  const trailerLabel = trailerScope
    ? (trailers.find((t) => t.id === trailerScope)?.name ?? "Trailer")
    : "All trailers · Company";

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
  const [orderOpen, setOrderOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const submitCountFn = useServerFn(submitCount);
  const countMut = useMutation({
    mutationFn: (vars: { itemId: string; countQty: number }) => submitCountFn({ data: vars }),
    onSuccess: () => { toast.success("Count saved"); syncDomains(qc, "inventory"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFn = useServerFn(deleteInventoryItem);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Item removed"); syncDomains(qc, "inventory", "orders"); },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <AppShell>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="label-caps text-muted-foreground">Stock</div>
          <h1 className="font-display text-2xl text-foreground">INVENTORY</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportVarianceCSV(items, trailerLabel)}
            disabled={!items.length}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
            title="Export variance CSV">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button
            onClick={() => exportVariancePDF(items, trailerLabel, counts)}
            disabled={!items.length}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
            title="Export variance PDF">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
          <div className="text-xs font-semibold uppercase tracking-[1.2px] text-[var(--color-gold)] bg-[#0A0A0A] px-3 py-1.5 rounded-md">{trailerLabel}</div>
        </div>
      </div>

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
          <div className="flex gap-2">
            <button onClick={() => setOrderOpen(true)} className="inline-flex items-center gap-1 rounded-md bg-[#0A0A0A] text-[var(--color-gold)] px-2.5 py-1 text-xs font-semibold">
              <Truck className="h-3.5 w-3.5" /> Create order
            </button>
            <button onClick={() => setEditItem("new")} className="inline-flex items-center gap-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-2.5 py-1 text-xs font-semibold">
              <Plus className="h-3.5 w-3.5" /> New item
            </button>
          </div>
        ) : <StatusPill tone="gold">On-hand vs Par</StatusPill>}
      />


      {(loading || isLoading) && <Card>Loading…</Card>}

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

      {receiveItem && <ReceiveModal item={receiveItem} onClose={() => setReceiveItem(null)} onDone={() => syncDomains(qc, "inventory")} />}
      {wasteItem && <WasteModal item={wasteItem} onClose={() => setWasteItem(null)} onDone={() => syncDomains(qc, "inventory")} />}
      {editItem && <EditItemModal item={editItem === "new" ? null : editItem} defaultCategory={cat} onClose={() => setEditItem(null)} onDone={() => syncDomains(qc, "inventory")} />}
      {orderOpen && <OrderBuilderModal items={items} trailerId={trailerScope} onClose={() => setOrderOpen(false)} onDone={() => syncDomains(qc, "orders", "inventory", "alerts")} />}
      {historyOpen && <OrderHistoryModal onClose={() => setHistoryOpen(false)} />}
      {isManager && (
        <div className="mt-4 flex justify-end">
          <button onClick={() => setHistoryOpen(true)} className="text-xs underline text-muted-foreground hover:text-foreground">View my orders</button>
        </div>
      )}


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

function EditItemModal({ item, defaultCategory, onClose, onDone }: { item: Item | null; defaultCategory: string; onClose: () => void; onDone: () => void }) {
  const upsert = useServerFn(upsertInventoryItem);
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<string>(item?.category ?? defaultCategory);
  const [unit, setUnit] = useState(item?.unit ?? "unit");
  const [par, setPar] = useState(String(item?.par_level ?? ""));
  const [low, setLow] = useState(String(item?.low_threshold ?? ""));
  const [qty, setQty] = useState(item ? String(item.current_qty) : "");
  const m = useMutation({
    mutationFn: () => upsert({ data: {
      id: item?.id, name: name.trim(), category: category as any, unit: unit.trim() || "unit",
      parLevel: Number(par) || 0, lowThreshold: Number(low) || 0,
      currentQty: qty === "" ? undefined : Number(qty),
    } }),
    onSuccess: () => { toast.success(item ? "Item updated" : "Item added"); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal title={item ? `Edit: ${item.name}` : "New inventory item"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Unit"><input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="lb, ea, case" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Par level"><input type="number" value={par} onChange={(e) => setPar(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
          <Field label="Low / critical alert ≤"><input type="number" value={low} onChange={(e) => setLow(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
        </div>
        <Field label="Current quantity (optional)"><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="leave blank to keep" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
      </div>
      <ModalActions onClose={onClose} primary={item ? "Save changes" : "Create item"} disabled={!name.trim() || m.isPending} onSubmit={() => m.mutate()} />
    </Modal>
  );
}

type OrderRow = {
  itemId?: string | null; itemName: string; category?: string; unit?: string;
  currentQty: number; parQty: number; requestedQty: number;
  urgency: "normal" | "needed_soon" | "critical" | "emergency";
  reason?: string; notes?: string;
};

const URGENCY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "needed_soon", label: "Needed Soon" },
  { value: "critical", label: "Critical" },
  { value: "emergency", label: "Emergency" },
] as const;

function OrderBuilderModal({ items, trailerId, onClose, onDone }: { items: Item[]; trailerId: string | null; onClose: () => void; onDone: () => void }) {
  const createOrder = useServerFn(createInventoryOrder);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [notes, setNotes] = useState("");
  const [picker, setPicker] = useState("");

  const addItem = (id: string) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    setRows((r) => [...r, {
      itemId: it.id, itemName: it.name, category: it.category, unit: it.unit,
      currentQty: Number(it.current_qty), parQty: Number(it.par_level),
      requestedQty: Math.max(0, Number(it.par_level) - Number(it.current_qty)),
      urgency: Number(it.current_qty) <= Number(it.low_threshold) ? "critical" : "normal",
    }]);
    setPicker("");
  };

  const updateRow = (idx: number, patch: Partial<OrderRow>) => {
    setRows((r) => r.map((row, i) => i === idx ? { ...row, ...patch } : row));
  };
  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));

  const m = useMutation({
    mutationFn: (submit: boolean) => createOrder({ data: { trailerId, notes: notes || undefined, submit, items: rows } }) as any,
    onSuccess: (_d, submit) => {
      toast.success(submit ? "Order submitted to owner" : "Draft saved");
      onDone(); onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl p-5 card-shadow max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl">CREATE INVENTORY ORDER</h3>
          <button onClick={onClose} className="text-muted-foreground text-sm">✕</button>
        </div>

        <div className="space-y-3">
          <Field label="Add item from inventory">
            <select value={picker} onChange={(e) => addItem(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
              <option value="">Pick an item…</option>
              {items.filter((i) => !rows.some((r) => r.itemId === i.id)).map((i) => (
                <option key={i.id} value={i.id}>{i.name} — {Number(i.current_qty)}/{Number(i.par_level)} {i.unit}</option>
              ))}
            </select>
          </Field>

          {rows.length === 0 ? (
            <Card><div className="text-center py-6 text-sm text-muted-foreground">Add items to build the order</div></Card>
          ) : (
            <div className="border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary">
                  <tr className="text-left">
                    <th className="p-2">Item</th><th className="p-2">Current</th><th className="p-2">PAR</th>
                    <th className="p-2">Request</th><th className="p-2">Urgency</th><th className="p-2">Reason</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-medium">{row.itemName}<div className="text-muted-foreground text-[10px]">{row.unit}</div></td>
                      <td className="p-2">{row.currentQty}</td>
                      <td className="p-2">{row.parQty}</td>
                      <td className="p-2">
                        <input type="number" value={row.requestedQty} onChange={(e) => updateRow(i, { requestedQty: Number(e.target.value) })}
                          className="w-20 h-8 rounded border border-border px-2 text-xs" />
                      </td>
                      <td className="p-2">
                        <select value={row.urgency} onChange={(e) => updateRow(i, { urgency: e.target.value as any })}
                          className="h-8 rounded border border-border px-1 text-xs">
                          {URGENCY_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <input value={row.reason ?? ""} onChange={(e) => updateRow(i, { reason: e.target.value })} placeholder="optional"
                          className="w-32 h-8 rounded border border-border px-2 text-xs" />
                      </td>
                      <td className="p-2"><button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-3 w-3" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Field label="Order notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-card p-2 text-sm" />
          </Field>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm border border-border">Cancel</button>
          <button disabled={rows.length === 0 || m.isPending} onClick={() => m.mutate(false)} className="rounded-md px-3 py-2 text-sm border border-border disabled:opacity-50">Save Draft</button>
          <button disabled={rows.length === 0 || m.isPending} onClick={() => m.mutate(true)}
            className="rounded-md px-4 py-2 text-sm font-semibold bg-[var(--color-gold)] text-[#0A0A0A] inline-flex items-center gap-2 disabled:opacity-50">
            <Truck className="h-4 w-4" /> Submit Order
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderHistoryModal({ onClose }: { onClose: () => void }) {
  const list = useServerFn(listInventoryOrders);
  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["inv-orders", "mine"],
    queryFn: () => list({ data: { scope: "mine" } }) as any,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl p-5 card-shadow max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl">MY INVENTORY ORDERS</h3>
          <button onClick={onClose} className="text-muted-foreground text-sm">✕</button>
        </div>
        {isLoading ? <div>Loading…</div> : orders.length === 0 ? <div className="text-sm text-muted-foreground py-8 text-center">No orders yet</div> : (
          <div className="space-y-2">
            {orders.map((o) => (
              <Card key={o.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{new Date(o.created_at).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{(o.items ?? []).length} items{o.notes ? ` · ${o.notes}` : ""}</div>
                    {o.owner_comment && <div className="text-xs mt-1 italic">Owner: {o.owner_comment}</div>}
                  </div>
                  <StatusPill tone={o.status === "approved" || o.status === "received" ? "success" : o.status === "declined" ? "danger" : o.status === "changes_requested" ? "warning" : "neutral"}>
                    {o.status.replace(/_/g, " ")}
                  </StatusPill>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function exportVarianceCSV(items: Item[], _trailerLabel: string) {
  const rows = items.map((it) => {
    const variance = Number(it.current_qty) - Number(it.par_level);
    const pct = it.par_level === 0 ? "" : ((Number(it.current_qty) / Number(it.par_level)) * 100).toFixed(0) + "%";
    return [
      CATEGORY_LABELS[it.category] ?? it.category,
      it.name,
      it.unit,
      Number(it.current_qty),
      Number(it.par_level),
      Number(it.low_threshold),
      variance.toFixed(2),
      pct,
      statusOf(it),
    ];
  });
  downloadCSV(
    `inventory-variance-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Category", "Item", "Unit", "On Hand", "Par", "Low Threshold", "Variance", "% of Par", "Status"],
    rows,
  );
}

function exportVariancePDF(items: Item[], trailerLabel: string, counts: { crit: number; low: number; ok: number }) {
  const rows = items
    .slice()
    .sort((a, b) => {
      const sa = statusOf(a), sb = statusOf(b);
      if (sa === sb) return a.name.localeCompare(b.name);
      return sa === "CRITICAL" ? -1 : sb === "CRITICAL" ? 1 : sa === "LOW" ? -1 : 1;
    })
    .map((it) => {
      const v = Number(it.current_qty) - Number(it.par_level);
      const pct = it.par_level === 0 ? "—" : Math.round((Number(it.current_qty) / Number(it.par_level)) * 100) + "%";
      return [
        CATEGORY_LABELS[it.category] ?? it.category,
        it.name,
        `${Number(it.current_qty)} ${it.unit}`,
        `${Number(it.par_level)} ${it.unit}`,
        `${v.toFixed(1)} ${it.unit}`,
        pct,
        statusOf(it),
      ];
    });
  const html = `
    <h1>Inventory Variance — ${escapeHTML(trailerLabel)}</h1>
    <div class="meta">As of ${new Date().toLocaleString()}</div>
    ${kpiBlock([
      { label: "Critical", value: counts.crit, tone: counts.crit ? "danger" : "ok" },
      { label: "Low", value: counts.low, tone: counts.low ? "warn" : "ok" },
      { label: "OK / Stocked", value: counts.ok, tone: "ok" },
      { label: "Total Items", value: items.length },
    ])}
    <h2>Variance vs Par</h2>
    ${htmlTable(["Category", "Item", "On Hand", "Par", "Variance", "% Par", "Status"], rows)}
  `;
  openPrintablePDF("Inventory Variance", html);
}
