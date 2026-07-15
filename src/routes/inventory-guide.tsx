import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/gotham/primitives";
import {
  archiveInventoryItem,
  deleteInventoryItem,
  listInventory,
  scanInventoryDependencies,
  submitCount,
} from "@/lib/inventory.functions";
import { Input } from "@/components/ui/input";
import {
  Beef,
  Boxes,
  Carrot,
  Croissant,
  Milk,
  Package,
  Plus,
  Search,
  Soup,
  Sparkles,
  X,
} from "lucide-react";
import { EditItemModal, type Item } from "@/routes/inventory";
import { useRole } from "@/lib/role";
import { syncDomains } from "@/lib/sync-bus";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InventoryItemCard, statusOf } from "@/components/gotham/InventoryItemCard";

// Legacy URL — redirect to the unified Inventory page on the Count Guide tab.
export const Route = createFileRoute("/inventory-guide")({
  beforeLoad: () => {
    throw redirect({ to: "/inventory", search: { tab: "count-guide" } as any });
  },
  component: () => null,
});

const CATEGORY_ORDER = [
  "protein",
  "bun",
  "produce",
  "sauce",
  "packaging",
  "supplies",
  "other",
] as const;
const CATEGORY_LABELS: Record<string, string> = {
  protein: "Proteins",
  bun: "Buns & Bread",
  sauce: "Sauces",
  produce: "Produce",
  dairy: "Dairy",
  packaging: "Packaging",
  supplies: "Supplies",
  other: "Other",
};
const CATEGORY_ICON: Record<string, typeof Beef> = {
  protein: Beef,
  bun: Croissant,
  sauce: Soup,
  produce: Carrot,
  dairy: Milk,
  packaging: Package,
  supplies: Sparkles,
  other: Boxes,
};

export function InventoryGuideView() {
  const qc = useQueryClient();
  const { roleId, trailerScope } = useRole();
  const isOwner = roleId === "owner";
  const isManager = roleId === "owner" || roleId === "manager";
  const fetchInv = useServerFn(listInventory);
  const removeFn = useServerFn(deleteInventoryItem);
  const archiveFn = useServerFn(archiveInventoryItem);
  const scanFn = useServerFn(scanInventoryDependencies);
  const countFn = useServerFn(submitCount);
  const [q, setQ] = useState("");
  const [editItem, setEditItem] = useState<Item | "new" | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["inventory-guide"],
    queryFn: () => fetchInv({ data: {} }) as Promise<Item[]>,
  });

  const FANOUT = ["inventory", "orders", "alerts", "operations", "dashboard", "history"] as const;
  const archiveM = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Item archived");
      syncDomains(qc, ...FANOUT);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delM = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Item deleted");
      syncDomains(qc, ...FANOUT);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove item"),
  });
  async function handleRemove(item: Item) {
    try {
      const { counts, total } = (await scanFn({ data: { id: item.id } })) as {
        counts: Record<string, number>;
        total: number;
      };
      if (total === 0) {
        if (confirm(`Permanently delete ${item.name}? No references found.`)) delM.mutate(item.id);
        return;
      }
      const summary = Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${k}`)
        .join(" · ");
      if (
        confirm(
          `"${item.name}" is referenced in ${total} place(s): ${summary}.\n\nOK = Archive (keeps history)\nCancel = Keep`,
        )
      ) {
        archiveM.mutate(item.id);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Dependency check failed");
    }
  }

  const countM = useMutation({
    mutationFn: ({ itemId, countQty }: { itemId: string; countQty: number }) =>
      countFn({ data: { itemId, countQty } }),
    onSuccess: () => {
      toast.success("Count recorded");
      syncDomains(qc, "inventory");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    return (items as any[]).filter((it) => {
      if (it.archived_at) return false;
      if (!lc) return true;
      return [it.name, it.category, it.storage_location, it.count_instructions].some((v) =>
        (v ?? "").toString().toLowerCase().includes(lc),
      );
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
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">How to count and store every item.</p>
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

      <div className="grid grid-cols-3 gap-2 mt-4">
        <Card className="!p-3">
          <div className="label-caps text-muted-foreground text-[10px]">Tracked</div>
          <div className="text-2xl font-semibold leading-none mt-1">{totalItems}</div>
        </Card>
        <Card className="!p-3">
          <div className="label-caps text-[var(--color-danger)] text-[10px]">Critical</div>
          <div className="text-2xl font-semibold leading-none mt-1 text-[var(--color-danger)]">
            {criticalCount}
          </div>
        </Card>
        <Card className="!p-3">
          <div className="label-caps text-[var(--color-warning)] text-[10px]">Low</div>
          <div className="text-2xl font-semibold leading-none mt-1 text-[var(--color-warning)]">
            {lowCount}
          </div>
        </Card>
      </div>

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

      <div className="mt-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
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
                    <span
                      className={cn(
                        "text-[11px] tabular-nums rounded-full px-1.5 py-0.5",
                        active
                          ? "bg-[var(--color-gold)]/15 text-[var(--color-gold)]"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {byCat[c]?.length ?? 0}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

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
                ref={(el) => {
                  sectionRefs.current[cat] = el;
                }}
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
                    <InventoryItemCard
                      key={it.id}
                      item={it}
                      isOwner={isOwner}
                      isManager={isManager}
                      onEdit={() => setEditItem(it)}
                      onDelete={() => handleRemove(it)}
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
    </div>
  );
}
