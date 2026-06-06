import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Plus, Save, Trash2, Truck, X } from "lucide-react";
import { deleteInventoryItem, listInventory, updateOrderGuide, upsertInventoryItem } from "@/lib/inventory.functions";
import { toast } from "sonner";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";

export const Route = createFileRoute("/order-guide")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Order Guide · Gotham OS" }] }),
  component: OrderGuide,
});

type Row = {
  id: string;
  name: string;
  category: string;
  unit: string;
  vendor: string | null;
  pack_size: string | null;
  current_qty: number;
  par_level: number;
  low_threshold: number;
  minimum_qty: number;
  preferred_order_qty: number;
  estimated_cost: number;
  last_ordered_at: string | null;
  last_received_at: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  protein: "Proteins", bun: "Buns & Bread", sauce: "Sauces",
  produce: "Produce", packaging: "Packaging", supplies: "Supplies",
};

function OrderGuide() {
  const qc = useQueryClient();
  const { roleId, trailerScope, trailers, session, loading } = useRole();
  const canEdit = roleId === "owner" || roleId === "manager";
  const list = useServerFn(listInventory);
  const update = useServerFn(updateOrderGuide);
  const create = useServerFn(upsertInventoryItem);
  const remove = useServerFn(deleteInventoryItem);

  const { data: items = [], isLoading } = useQuery<Row[]>({
    queryKey: ["order-guide", trailerScope ?? "company"],
    queryFn: () => list({ data: { trailerId: trailerScope } }) as Promise<Row[]>,
    enabled: !loading && !!session?.access_token,
  });

  const trailerLabel = trailerScope
    ? (trailers.find((t) => t.id === trailerScope)?.name ?? "Trailer")
    : "All trailers · Company";

  const [drafts, setDrafts] = useState<Record<string, Partial<Row>>>({});
  const [filter, setFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState<{
    name: string; category: string; unit: string; vendor: string; pack_size: string;
    par_level: number; low_threshold: number; minimum_qty: number; preferred_order_qty: number; estimated_cost: number;
  }>({ name: "", category: "supplies", unit: "unit", vendor: "", pack_size: "", par_level: 0, low_threshold: 0, minimum_qty: 0, preferred_order_qty: 0, estimated_cost: 0 });

  useEffect(() => { setDrafts({}); }, [items.length]);

  const cats = useMemo(() => ["all", ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const visible = filter === "all" ? items : items.filter((i) => i.category === filter);

  const saveMut = useMutation({
    mutationFn: (vars: { id: string; patch: any }) => update({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success("Saved");
      setDrafts((prev) => { const n = { ...prev }; delete n[vars.id]; return n; });
      qc.invalidateQueries({ queryKey: ["order-guide"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: (vars: any) => create({ data: vars }),
    onSuccess: () => {
      toast.success("Item added");
      setShowAdd(false);
      setNewItem({ name: "", category: "supplies", unit: "unit", vendor: "", pack_size: "", par_level: 0, low_threshold: 0, minimum_qty: 0, preferred_order_qty: 0, estimated_cost: 0 });
      qc.invalidateQueries({ queryKey: ["order-guide"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Item removed");
      qc.invalidateQueries({ queryKey: ["order-guide"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submitNew() {
    if (!newItem.name.trim()) { toast.error("Name required"); return; }
    createMut.mutate({
      name: newItem.name.trim(),
      category: newItem.category,
      unit: newItem.unit || "unit",
      parLevel: Number(newItem.par_level) || 0,
      lowThreshold: Number(newItem.low_threshold) || 0,
      vendor: newItem.vendor || null,
      packSize: newItem.pack_size || null,
      minimumQty: Number(newItem.minimum_qty) || 0,
      preferredOrderQty: Number(newItem.preferred_order_qty) || 0,
      estimatedCost: Number(newItem.estimated_cost) || 0,
      trailerId: trailerScope ?? undefined,
    });
  }

  function setField<K extends keyof Row>(id: string, key: K, value: Row[K]) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  }
  function valueOf<K extends keyof Row>(row: Row, key: K): Row[K] {
    const d = drafts[row.id];
    return (d && key in d ? (d as any)[key] : row[key]) as Row[K];
  }
  function save(row: Row) {
    const d = drafts[row.id];
    if (!d) return;
    saveMut.mutate({ id: row.id, patch: d });
  }

  return (
    <AppShell>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="label-caps text-muted-foreground">Purchasing</div>
          <h1 className="font-display text-2xl text-foreground">ORDER GUIDE</h1>
        </div>
        <div className="text-xs font-semibold uppercase tracking-[1.2px] text-[var(--color-gold)] bg-[#0A0A0A] px-3 py-1.5 rounded-md">{trailerLabel}</div>
      </div>

      <div className="-mx-4 px-4 overflow-x-auto mb-3">
        <div className="flex gap-2 min-w-max">
          {cats.map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-[1.2px] border transition ${
                c === filter ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]" : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}>
              {c === "all" ? "All" : (CATEGORY_LABELS[c] ?? c)}
            </button>
          ))}
        </div>
      </div>

      <SectionHeader
        eyebrow="Vendor · Pack · Par · Cost"
        title={canEdit ? "Editable order guide" : "Order guide"}
        action={
          <div className="flex items-center gap-2">
            <StatusPill tone={canEdit ? "gold" : "info"}>{canEdit ? "Edit enabled" : "Read only"}</StatusPill>
            {canEdit && (
              <button
                onClick={() => setShowAdd((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-2.5 py-1 text-xs font-semibold"
              >
                {showAdd ? <><X className="h-3.5 w-3.5" /> Close</> : <><Plus className="h-3.5 w-3.5" /> Add item</>}
              </button>
            )}
          </div>
        }
      />

      {canEdit && showAdd && (
        <Card className="p-3 mb-2 border-[var(--color-gold)]">
          <div className="label-caps text-[var(--color-gold)] mb-2">New item</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <TxtField label="Name *" value={newItem.name} onChange={(v) => setNewItem({ ...newItem, name: v })} />
            <label className="block">
              <div className="label-caps text-muted-foreground mb-1">Category</div>
              <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                className="w-full h-9 rounded-md border border-border bg-card px-2 text-sm">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <TxtField label="Unit" value={newItem.unit} onChange={(v) => setNewItem({ ...newItem, unit: v })} />
            <TxtField label="Vendor" value={newItem.vendor} onChange={(v) => setNewItem({ ...newItem, vendor: v })} />
            <TxtField label="Pack size" value={newItem.pack_size} onChange={(v) => setNewItem({ ...newItem, pack_size: v })} />
            <NumField label="Est. cost / unit" value={newItem.estimated_cost} onChange={(v) => setNewItem({ ...newItem, estimated_cost: v })} />
            <NumField label="Par level" value={newItem.par_level} onChange={(v) => setNewItem({ ...newItem, par_level: v })} />
            <NumField label="Low threshold" value={newItem.low_threshold} onChange={(v) => setNewItem({ ...newItem, low_threshold: v })} />
            <NumField label="Min order qty" value={newItem.minimum_qty} onChange={(v) => setNewItem({ ...newItem, minimum_qty: v })} />
            <NumField label="Preferred order qty" value={newItem.preferred_order_qty} onChange={(v) => setNewItem({ ...newItem, preferred_order_qty: v })} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
            <button disabled={createMut.isPending} onClick={submitNew}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" /> {createMut.isPending ? "Adding…" : "Add item"}
            </button>
          </div>
        </Card>
      )}

      {(loading || isLoading) && <Card>Loading…</Card>}

      <div className="space-y-2">
        {visible.map((it) => {
          const dirty = !!drafts[it.id] && Object.keys(drafts[it.id]).length > 0;
          return (
            <Card key={it.id} className="p-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{it.name}</div>
                  <div className="label-caps text-muted-foreground mt-0.5">
                    {CATEGORY_LABELS[it.category] ?? it.category} · on hand {Number(it.current_qty)} {it.unit}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      disabled={!dirty || saveMut.isPending}
                      onClick={() => save(it)}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
                    >
                      <Save className="h-3.5 w-3.5" /> Save
                    </button>
                    <button
                      disabled={deleteMut.isPending}
                      onClick={() => { if (confirm(`Delete "${it.name}"? This cannot be undone.`)) deleteMut.mutate(it.id); }}
                      className="inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive h-7 w-7 disabled:opacity-40"
                      aria-label="Delete item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <TxtField label="Vendor" disabled={!canEdit}
                  value={(valueOf(it, "vendor") ?? "") as string}
                  onChange={(v) => setField(it.id, "vendor", v || null as any)} />
                <TxtField label="Pack size" disabled={!canEdit}
                  value={(valueOf(it, "pack_size") ?? "") as string}
                  onChange={(v) => setField(it.id, "pack_size", v || null as any)} />
                <TxtField label="Unit" disabled={!canEdit}
                  value={valueOf(it, "unit") as string}
                  onChange={(v) => setField(it.id, "unit", v as any)} />
                <NumField label="Est. cost / unit" disabled={!canEdit}
                  value={Number(valueOf(it, "estimated_cost") ?? 0)}
                  onChange={(v) => setField(it.id, "estimated_cost", v as any)} />
                <NumField label="Par level" disabled={!canEdit}
                  value={Number(valueOf(it, "par_level") ?? 0)}
                  onChange={(v) => setField(it.id, "par_level", v as any)} />
                <NumField label="Low threshold" disabled={!canEdit}
                  value={Number(valueOf(it, "low_threshold") ?? 0)}
                  onChange={(v) => setField(it.id, "low_threshold", v as any)} />
                <NumField label="Min order qty" disabled={!canEdit}
                  value={Number(valueOf(it, "minimum_qty") ?? 0)}
                  onChange={(v) => setField(it.id, "minimum_qty", v as any)} />
                <NumField label="Preferred order qty" disabled={!canEdit}
                  value={Number(valueOf(it, "preferred_order_qty") ?? 0)}
                  onChange={(v) => setField(it.id, "preferred_order_qty", v as any)} />
              </div>

              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" /> Last ordered: {it.last_ordered_at ? new Date(it.last_ordered_at).toLocaleDateString() : "—"}</span>
                <span>Last received: {it.last_received_at ? new Date(it.last_received_at).toLocaleDateString() : "—"}</span>
              </div>
            </Card>
          );
        })}
        {!isLoading && visible.length === 0 && <Card>No items.</Card>}
      </div>

      <div className="h-6" />
    </AppShell>
  );
}

function TxtField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <div className="label-caps text-muted-foreground mb-1">{label}</div>
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-border bg-card px-2 text-sm disabled:opacity-60" />
    </label>
  );
}

function NumField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <div className="label-caps text-muted-foreground mb-1">{label}</div>
      <input type="number" step="0.01" value={Number.isFinite(value) ? value : 0} disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="w-full h-9 rounded-md border border-border bg-card px-2 text-sm disabled:opacity-60" />
    </label>
  );
}
