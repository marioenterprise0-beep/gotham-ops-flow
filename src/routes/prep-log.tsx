import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { logPrepEntry, listPrepLog, deletePrepEntry } from "@/lib/prep-log.functions";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { syncDomains } from "@/lib/sync-bus";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChefHat, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/prep-log")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Prep Log · Gotham OS" }] }),
  component: PrepLogPage,
});

const PREP_CATEGORIES = [
  { key: "proteins",  label: "Proteins" },
  { key: "buns",      label: "Buns & Bread" },
  { key: "sauces",    label: "Sauces" },
  { key: "produce",   label: "Produce" },
  { key: "dairy",     label: "Dairy" },
  { key: "supplies",  label: "Supplies" },
  { key: "general",   label: "General" },
];

const COMMON_UNITS = ["lbs", "oz", "kg", "g", "pieces", "trays", "portions", "gallons", "quarts", "cups", "bags", "cases", "units"];

function PrepLogPage() {
  const qc = useQueryClient();
  const { roleId, trailerScope } = useRole();
  const isManager = roleId === "owner" || roleId === "manager";

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const logFn = useServerFn(logPrepEntry);
  const listFn = useServerFn(listPrepLog);
  const delFn = useServerFn(deletePrepEntry);

  const { data: entries = [], isLoading } = useQuery<any[]>({
    queryKey: ["prep-log", date, trailerScope],
    queryFn: () => listFn({ data: { date, trailerId: trailerScope ?? null } }) as Promise<any[]>,
  });

  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("proteins");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [customUnit, setCustomUnit] = useState("");
  const [notes, setNotes] = useState("");

  const addM = useMutation({
    mutationFn: () => logFn({
      data: {
        itemName: itemName.trim(),
        category,
        quantity: Number(quantity),
        unit: unit === "__custom" ? customUnit.trim() : unit,
        notes: notes.trim() || undefined,
        trailerId: trailerScope ?? null,
      },
    }),
    onSuccess: () => {
      toast.success("Prep logged");
      setItemName(""); setQuantity(""); setNotes("");
      syncDomains(qc, "prep");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Entry removed"); syncDomains(qc, "prep"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const byCategory = PREP_CATEGORIES.map((c) => ({
    ...c,
    items: entries.filter((e) => e.category === c.key),
  })).filter((c) => c.items.length > 0);

  const canSubmit = itemName.trim() && Number(quantity) > 0 && (unit !== "__custom" || customUnit.trim());

  return (
    <AppShell>
      <SectionHeader eyebrow="Kitchen" title="Prep Log" />

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <ChefHat className="h-4 w-4 text-[var(--color-gold)]" />
          <span className="text-sm font-semibold">Log prep for</span>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40 h-8 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Item prepped</Label>
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Chicken thighs marinated"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {PREP_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Unit</Label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {COMMON_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              <option value="__custom">Other…</option>
            </select>
            {unit === "__custom" && (
              <Input
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                placeholder="Custom unit"
                className="mt-1"
              />
            )}
          </div>
          <div className="md:col-span-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Marinated overnight, extra seasoning batch"
              rows={2}
              className="mt-1"
            />
          </div>
        </div>

        <Button
          onClick={() => addM.mutate()}
          disabled={!canSubmit || addM.isPending}
          className="mt-4"
        >
          <Plus className="h-4 w-4 mr-1" />
          {addM.isPending ? "Logging…" : "Log prep item"}
        </Button>
      </Card>

      {isLoading ? (
        <Card>Loading…</Card>
      ) : entries.length === 0 ? (
        <Card className="text-center py-8">
          <ChefHat className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm font-medium">No prep logged for {date}</div>
          <div className="text-xs text-muted-foreground mt-1">Log what you prepped above and it'll appear here.</div>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between mt-2 mb-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              {entries.length} item{entries.length !== 1 ? "s" : ""} prepped
            </span>
          </div>

          {byCategory.map((cat) => (
            <div key={cat.key} className="mb-4">
              <div className="label-caps text-muted-foreground mb-1">{cat.label}</div>
              <Card className="p-0 overflow-hidden">
                {cat.items.map((e: any, i: number) => (
                  <div key={e.id} className={cn("p-3 flex items-center justify-between gap-3", i && "border-t border-border")}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{e.item_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {Number(e.quantity)} {e.unit}
                        {e.notes && <span> · {e.notes}</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {e.logged_by_name} · {new Date(e.logged_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}
                      </div>
                    </div>
                    {(isManager || e.logged_by === e.logged_by) && (
                      <button
                        onClick={() => delM.mutate(e.id)}
                        disabled={delM.isPending}
                        className="shrink-0 text-muted-foreground hover:text-[var(--color-danger)] transition"
                        title="Remove entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </>
      )}

      <div className="h-6" />
    </AppShell>
  );
}
