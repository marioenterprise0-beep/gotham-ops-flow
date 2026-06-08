import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card } from "@/components/gotham/primitives";
import { deleteInventoryItem, listInventory, submitCount } from "@/lib/inventory.functions";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { Input } from "@/components/ui/input";
import {
  Beef, Boxes, Carrot, Croissant, Package, Plus, Search, Soup, Sparkles, X,
} from "lucide-react";
import { EditItemModal, type Item } from "@/routes/inventory";
import { useRole } from "@/lib/role";
import { syncDomains } from "@/lib/sync-bus";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InventoryItemCard, statusOf } from "@/components/gotham/InventoryItemCard";

export const Route = createFileRoute("/inventory-guide")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Inventory Guide · Gotham OS" }] }),
  component: InventoryGuide,
});

const CATEGORY_ORDER = ["protein", "bun", "produce", "sauce", "packaging", "supplies", "other"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  protein: "Proteins", bun: "Buns & Bread", sauce: "Sauces",
  produce: "Produce", packaging: "Packaging", supplies: "Supplies", other: "Other",
};
const CATEGORY_ICON: Record<string, typeof Beef> = {
  protein: Beef, bun: Croissant, sauce: Soup, produce: Carrot,
  packaging: Package, supplies: Sparkles, other: Boxes,
};

type Status = "CRITICAL" | "LOW" | "OK" | "OVER";
function statusOf(it: any): Status {
  const par = Number(it.par_level) || 0;
  const qty = Number(it.current_qty) || 0;
  const low = Number(it.low_threshold) || 0;
  if (qty <= low) return "CRITICAL";
  const r = par === 0 ? 1 : qty / par;
  if (r < 0.5) return "LOW";
  if (r > 1.1) return "OVER";
  return "OK";
}
const STATUS_STYLE: Record<Status, { bg: string; fg: string; bar: string; label: string }> = {
  CRITICAL: { bg: "bg-[var(--color-danger-bg)]", fg: "text-[var(--color-danger)]", bar: "bg-[var(--color-danger)]", label: "Critical" },
  LOW:      { bg: "bg-[var(--color-warning-bg)]", fg: "text-[var(--color-warning)]", bar: "bg-[var(--color-warning)]", label: "Low" },
  OK:       { bg: "bg-[var(--color-success-bg)]", fg: "text-[var(--color-success)]", bar: "bg-[var(--color-success)]", label: "On par" },
  OVER:     { bg: "bg-secondary", fg: "text-muted-foreground", bar: "bg-muted-foreground/60", label: "Overstocked" },
};

function InventoryGuide() {
  const qc = useQueryClient();
  const { roleId, trailerScope } = useRole();
  const isOwner = roleId === "owner";
  const isManager = roleId === "owner" || roleId === "manager";
  const fetchInv = useServerFn(listInventory);
  const removeFn = useServerFn(deleteInventoryItem);
  const countFn = useServerFn(submitCount);
  const [q, setQ] = useState("");
  const [editItem, setEditItem] = useState<Item | "new" | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["inventory-guide"],
    queryFn: () => fetchInv({ data: {} }) as Promise<Item[]>,
  });

  const delM = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => { toast.success("Item removed"); syncDomains(qc, "inventory"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const countM = useMutation({
    mutationFn: ({ itemId, countQty }: { itemId: string; countQty: number }) =>
      countFn({ data: { itemId, countQty } }),
    onSuccess: () => { toast.success("Count recorded"); syncDomains(qc, "inventory"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    return (items as any[]).filter((it) => {
      if (it.archived_at) return false;
      if (!lc) return true;
      return [it.name, it.category, it.storage_location, it.count_instructions]
        .some((v) => (v ?? "").toString().toLowerCase().includes(lc));
    });
  }, [items, q]);

  const byCat = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const it of filtered) {
      const k = (it.category ?? "other") as string;
      (m[k] ??= []).push(it);
    }
    return m;
  }, [filtered]);

  const categories = useMemo(() => {
    const present = Object.keys(byCat);
    const ordered = CATEGORY_ORDER.filter((c) => present.includes(c));
    const extras = present.filter((c) => !CATEGORY_ORDER.includes(c as any));
    return [...ordered, ...extras];
  }, [byCat]);

  // Spy on scroll to highlight the active category in the rail.
  useEffect(() => {
    if (categories.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveCat(visible.target.id.replace("cat-", ""));
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    categories.forEach((c) => {
      const el = sectionRefs.current[c];
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [categories]);

  const jumpTo = (c: string) => {
    const el = sectionRefs.current[c];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveCat(c);
  };

  const totalItems = filtered.length;
  const criticalCount = filtered.filter((it) => statusOf(it) === "CRITICAL").length;
  const lowCount = filtered.filter((it) => statusOf(it) === "LOW").length;

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label-caps text-muted-foreground">Inventory</div>
          <h1 className="font-display text-3xl mt-1">Inventory Guide</h1>
          <p className="text-sm text-muted-foreground mt-1">How to count and store every item.</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setEditItem("new")}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3.5 py-2 text-sm font-semibold hover:opacity-90 shrink-0"
          >
            <Plus className="h-4 w-4" /> Add item
          </button>
        )}
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <Card className="!p-3">
          <div className="label-caps text-muted-foreground text-[10px]">Tracked</div>
          <div className="text-2xl font-semibold leading-none mt-1">{totalItems}</div>
        </Card>
        <Card className="!p-3">
          <div className="label-caps text-[var(--color-danger)] text-[10px]">Critical</div>
          <div className="text-2xl font-semibold leading-none mt-1 text-[var(--color-danger)]">{criticalCount}</div>
        </Card>
        <Card className="!p-3">
          <div className="label-caps text-[var(--color-warning)] text-[10px]">Low</div>
          <div className="text-2xl font-semibold leading-none mt-1 text-[var(--color-warning)]">{lowCount}</div>
        </Card>
      </div>

      {/* Sticky search */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 mt-4 bg-background/85 backdrop-blur border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items, categories, locations, instructions…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 pr-9"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile category chip rail */}
      {categories.length > 0 && (
        <div className="lg:hidden -mx-4 px-4 pt-3 pb-1 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {categories.map((c) => {
              const Icon = CATEGORY_ICON[c] ?? Boxes;
              const active = activeCat === c;
              return (
                <button
                  key={c}
                  onClick={() => jumpTo(c)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition",
                    active
                      ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]"
                      : "bg-card text-muted-foreground border-border hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {CATEGORY_LABELS[c] ?? c}
                  <span className="text-[10px] opacity-70">{byCat[c]?.length ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Layout: sticky rail + scrollable list */}
      <div className="mt-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        {/* Sticky category rail (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <div className="label-caps text-muted-foreground mb-2">Categories</div>
            <nav className="flex flex-col gap-1">
              {categories.map((c) => {
                const Icon = CATEGORY_ICON[c] ?? Boxes;
                const active = activeCat === c;
                return (
                  <button
                    key={c}
                    onClick={() => jumpTo(c)}
                    className={cn(
                      "group flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm border transition text-left",
                      active
                        ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]"
                        : "bg-card text-foreground border-transparent hover:border-border hover:bg-secondary",
                    )}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{CATEGORY_LABELS[c] ?? c}</span>
                    </span>
                    <span className={cn(
                      "text-[11px] tabular-nums rounded-full px-1.5 py-0.5",
                      active ? "bg-[var(--color-gold)]/15 text-[var(--color-gold)]" : "bg-secondary text-muted-foreground",
                    )}>{byCat[c]?.length ?? 0}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Scrollable content */}
        <div className="flex flex-col gap-8">
          {isLoading && <Card>Loading…</Card>}
          {!isLoading && filtered.length === 0 && (
            <Card>
              <div className="text-center py-10 text-sm text-muted-foreground">
                {q ? "No items match your search." : "No inventory items yet."}
                {isOwner && !q && (
                  <div className="mt-3">
                    <button
                      onClick={() => setEditItem("new")}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add your first item
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {categories.map((cat) => {
            const list = byCat[cat] ?? [];
            const Icon = CATEGORY_ICON[cat] ?? Boxes;
            return (
              <section
                key={cat}
                id={`cat-${cat}`}
                ref={(el) => { sectionRefs.current[cat] = el; }}
                className="scroll-mt-24"
              >
                <div className="flex items-end justify-between gap-2 mb-3">
                  <h2 className="font-display text-xl flex items-center gap-2">
                    <Icon className="h-5 w-5 text-[var(--color-gold)]" />
                    {CATEGORY_LABELS[cat] ?? cat}
                  </h2>
                  <span className="label-caps text-muted-foreground">{list.length} items</span>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3">
                  {list.map((it) => (
                    <ItemCard
                      key={it.id}
                      item={it}
                      isOwner={isOwner}
                      isManager={isManager}
                      onEdit={() => setEditItem(it)}
                      onDelete={() => { if (confirm(`Delete "${it.name}"? This cannot be undone.`)) delM.mutate(it.id); }}
                      onCount={(qty) => countM.mutate({ itemId: it.id, countQty: qty })}
                      counting={countM.isPending}
                      deleting={delM.isPending}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {editItem && (
        <EditItemModal
          item={editItem === "new" ? null : editItem}
          defaultCategory={editItem !== "new" ? (editItem as any).category : "supplies"}
          isOwner={isOwner}
          trailerId={trailerScope}
          onClose={() => setEditItem(null)}
          onDone={() => syncDomains(qc, "inventory")}
        />
      )}
    </AppShell>
  );
}

function ItemCard({
  item, isOwner, isManager, onEdit, onDelete, onCount, counting, deleting,
}: {
  item: any; isOwner: boolean; isManager: boolean;
  onEdit: () => void; onDelete: () => void;
  onCount: (qty: number) => void; counting: boolean; deleting: boolean;
}) {
  const status = statusOf(item);
  const style = STATUS_STYLE[status];
  const par = Math.max(1, Number(item.par_level) || 0);
  const qty = Number(item.current_qty) || 0;
  const pct = Math.min(150, Math.round((qty / par) * 100));
  const [countOpen, setCountOpen] = useState(false);
  const [draft, setDraft] = useState<string>(String(qty));

  useEffect(() => { setDraft(String(qty)); }, [qty, countOpen]);

  const submit = () => {
    const n = Number(draft);
    if (Number.isNaN(n) || n < 0) { toast.error("Enter a valid count"); return; }
    onCount(n);
    setCountOpen(false);
  };

  return (
    <Card className="flex flex-col gap-3 h-full">
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 rounded-md bg-secondary overflow-hidden grid place-items-center border border-border">
          {item.image_url ? (
            <SignedImage path={item.image_url} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <Boxes className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-[15px] leading-tight line-clamp-2">{item.name}</div>
              <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                <span>PAR <span className="text-foreground font-medium">{Number(item.par_level)} {item.unit}</span></span>
                <span>Low ≤ <span className="text-foreground font-medium">{Number(item.low_threshold)}</span></span>
              </div>
            </div>
            <span className={cn("label-caps shrink-0 rounded-full px-2 py-0.5 text-[10px]", style.bg, style.fg)}>
              {style.label}
            </span>
          </div>



          {/* Stock bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>On hand</span>
              <span className="tabular-nums">
                <span className="text-foreground font-semibold">{qty}</span>
                <span className="opacity-70"> / {Number(item.par_level)} {item.unit}</span>
                <span className="ml-1 opacity-70">· {pct}%</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className={cn("h-full transition-all", style.bar)} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {item.storage_location && (
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-[var(--color-gold)]" />
          <span className="truncate">{item.storage_location}</span>
        </div>
      )}

      {item.count_instructions && (
        <div className="rounded-md border border-border bg-secondary/40 p-2.5">
          <div className="label-caps text-muted-foreground text-[10px] mb-1">How to count</div>
          <div className="text-xs whitespace-pre-wrap leading-relaxed text-foreground/85">
            {item.count_instructions}
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        {isManager ? (
          countOpen ? (
            <div className="flex items-center gap-1.5 flex-1">
              <Input
                type="number"
                min={0}
                step="any"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setCountOpen(false); }}
                autoFocus
                className="h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">{item.unit}</span>
              <button
                onClick={submit}
                disabled={counting}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] disabled:opacity-60"
                title="Save count"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCountOpen(false)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-muted-foreground"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCountOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
            >
              <Check className="h-3.5 w-3.5" /> Quick count
            </button>
          )
        ) : <span />}

        {isOwner && !countOpen && (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={deleting}
              onClick={onDelete}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive disabled:opacity-40"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
