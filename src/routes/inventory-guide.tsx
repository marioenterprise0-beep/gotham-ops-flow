import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader } from "@/components/gotham/primitives";
import { deleteInventoryItem, listInventory } from "@/lib/inventory.functions";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { Input } from "@/components/ui/input";
import { Boxes, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { SignedImage } from "@/components/gotham/SignedImage";
import { EditItemModal, type Item } from "@/routes/inventory";
import { useRole } from "@/lib/role";
import { syncDomains } from "@/lib/sync-bus";
import { toast } from "sonner";

export const Route = createFileRoute("/inventory-guide")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Inventory Guide · Gotham OS" }] }),
  component: InventoryGuide,
});

const CATEGORY_LABELS: Record<string, string> = {
  protein: "Proteins", bun: "Buns & Bread", sauce: "Sauces",
  produce: "Produce", packaging: "Packaging", supplies: "Supplies",
};

function InventoryGuide() {
  const qc = useQueryClient();
  const { roleId, trailerScope } = useRole();
  const isOwner = roleId === "owner";
  const fetchInv = useServerFn(listInventory);
  const removeFn = useServerFn(deleteInventoryItem);
  const [q, setQ] = useState("");
  const [editItem, setEditItem] = useState<Item | "new" | null>(null);

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["inventory-guide"],
    queryFn: () => fetchInv({ data: {} }) as Promise<Item[]>,
  });

  const delM = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => { toast.success("Item removed"); syncDomains(qc, "inventory"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    return (items as any[]).filter((it) => {
      if (it.archived_at) return false;
      if (!lc) return true;
      return [it.name, it.category, it.storage_location].some((v) => (v ?? "").toString().toLowerCase().includes(lc));
    });
  }, [items, q]);

  const byCat: Record<string, any[]> = {};
  for (const it of filtered) {
    const k = it.category ?? "other";
    (byCat[k] ??= []).push(it);
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionHeader eyebrow="Inventory" title="Inventory Guide" />
          <p className="text-sm text-muted-foreground -mt-2 mb-4">How to count and store every item.</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setEditItem("new")}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Add item
          </button>
        )}
      </div>
      <Card className="mb-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search items, categories, locations…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      {isLoading && <Card>Loading…</Card>}
      {!isLoading && filtered.length === 0 && (
        <Card><div className="text-sm text-muted-foreground">No items match.</div></Card>
      )}

      <div className="flex flex-col gap-6">
        {Object.entries(byCat).map(([cat, list]) => (
          <section key={cat}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {CATEGORY_LABELS[cat] ?? cat}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((it) => (
                <Card key={it.id} className="flex gap-3">
                  <div className="h-20 w-20 shrink-0 rounded-md bg-secondary overflow-hidden grid place-items-center">
                    {it.image_url ? (
                      <SignedImage path={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                    ) : (
                      <Boxes className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold truncate">{it.name}</div>
                      {isOwner && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setEditItem(it)}
                            className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            disabled={delM.isPending}
                            onClick={() => { if (confirm(`Delete "${it.name}"? This cannot be undone.`)) delM.mutate(it.id); }}
                            className="rounded-md border border-border p-1 text-muted-foreground hover:text-destructive hover:border-destructive disabled:opacity-40"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Unit: <span className="font-medium text-foreground">{it.unit}</span>
                      {" · "}
                      PAR: <span className="font-medium text-foreground">{it.par_level}</span>
                    </div>
                    {it.storage_location && (
                      <div className="text-xs text-muted-foreground mt-1">📦 {it.storage_location}</div>
                    )}
                    {it.count_instructions && (
                      <div className="text-xs mt-1.5 whitespace-pre-wrap text-foreground/80">{it.count_instructions}</div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
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
