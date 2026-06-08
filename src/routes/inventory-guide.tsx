import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader } from "@/components/gotham/primitives";
import { listInventory } from "@/lib/inventory.functions";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { Input } from "@/components/ui/input";
import { Boxes, Search } from "lucide-react";
import { SignedImage } from "@/components/gotham/SignedImage";

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
  const fetchInv = useServerFn(listInventory);
  const [q, setQ] = useState("");
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory-guide"],
    queryFn: () => fetchInv({ data: {} }),
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
      <SectionHeader eyebrow="Inventory" title="Inventory Guide" />
      <p className="text-sm text-muted-foreground -mt-2 mb-4">How to count and store every item.</p>
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
                    <div className="font-semibold truncate">{it.name}</div>
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
    </AppShell>
  );
}
