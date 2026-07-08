import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { AlertTriangle, ArchiveRestore, ClipboardList, FileText, Plus, Trash2, Truck, Pencil, Download, Boxes, BookOpen, Settings as SettingsIcon, History, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadCSV, openPrintablePDF, htmlTable, kpiBlock, escapeHTML } from "@/lib/exports";
import { listInventory, receiveStock, logWaste, submitCount, upsertInventoryItem, deleteInventoryItem, archiveInventoryItem, restoreInventoryItem, scanInventoryDependencies, listInventoryCategories, createInventoryCategory, archiveInventoryCategory } from "@/lib/inventory.functions";
import { submitInventoryChangeRequest } from "@/lib/inventory-changes.functions";
import { createInventoryOrder, listInventoryOrders, submitDraftInventoryOrder, decideInventoryOrder } from "@/lib/inventory-orders.functions";
import { toast } from "sonner";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { syncDomains } from "@/lib/sync-bus";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/gotham/SignedImage";
import { InventoryGuideView } from "@/routes/inventory-guide";
import { OrderGuideView } from "@/routes/order-guide";
import { InventoryChangesView } from "@/routes/inventory-changes";

export const Route = createFileRoute("/inventory")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? (s.tab as string) : undefined,
    focus: typeof s.focus === "string" ? (s.focus as string) : undefined,
  }),
  head: () => ({ meta: [{ title: "Inventory · Gotham OS" }] }),
  component: InventoryPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  protein: "Proteins", bun: "Buns & Bread", sauce: "Sauces",
  produce: "Produce", dairy: "Dairy", packaging: "Packaging", supplies: "Supplies",
};

export type Item = {
  id: string; name: string; category: string; unit: string;
  par_level: number; low_threshold: number; current_qty: number;
  archived_at?: string | null;
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
function recommendedAction(s: Status): { label: string; tone: "danger" | "warning" | "success" | "info" } {
  if (s === "CRITICAL") return { label: "Order now", tone: "danger" };
  if (s === "LOW") return { label: "Order soon", tone: "warning" };
  if (s === "OVERSTOCKED") return { label: "Hold off ordering", tone: "info" };
  return { label: "Stocked — no action", tone: "success" };
}

/* =================== TABBED SHELL =================== */

const TABS = [
  { key: "live-counts",   label: "Live Counts",   icon: Boxes },
  { key: "count-guide",   label: "Count Guide",   icon: BookOpen },
  { key: "orders",        label: "Orders",        icon: Truck },
  { key: "drafts",        label: "Drafts",        icon: FileText },
  { key: "approvals",     label: "Approvals",     icon: ClipboardList },
  { key: "configuration", label: "Configuration", icon: SettingsIcon },
] as const;
type TabKey = typeof TABS[number]["key"];
const TAB_KEYS = TABS.map((t) => t.key) as readonly TabKey[];
const TAB_STORAGE = "gotham:inventory:tab:v1";

function InventoryPage() {
  const { roleId } = useRole();
  const isOwner = roleId === "owner";
  const isManager = isOwner || roleId === "manager";
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const initial = useMemo<TabKey>(() => {
    if (search.tab && (TAB_KEYS as readonly string[]).includes(search.tab)) return search.tab as TabKey;
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(TAB_STORAGE);
      if (saved && (TAB_KEYS as readonly string[]).includes(saved)) return saved as TabKey;
    }
    return "live-counts";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [tab, setTab] = useState<TabKey>(initial);

  // Sync URL <-> state when user clicks a tab; respect deep links.
  useEffect(() => {
    if (search.tab && search.tab !== tab && (TAB_KEYS as readonly string[]).includes(search.tab)) {
      setTab(search.tab as TabKey);
    }
  }, [search.tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeTab = (next: TabKey, opts?: { focus?: string }) => {
    setTab(next);
    try { window.localStorage.setItem(TAB_STORAGE, next); } catch { /* noop */ }
    navigate({ search: { tab: next, focus: opts?.focus } as any, replace: true });
  };

  // Tabs that aren't relevant for crew → hide visually.
  const visibleTabs = TABS.filter((t) => {
    if (t.key === "approvals") return isManager;
    if (t.key === "configuration") return isManager;
    if (t.key === "drafts") return isOwner;
    // Orders is open to all crew — anyone working a shift can submit an order.
    return true;
  });

  // Make sure crew never lands on a privileged tab via direct URL.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === tab)) {
      changeTab("live-counts");
    }
  }, [roleId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell>
      <div className="mb-4">
        <div className="label-caps text-muted-foreground">Stock</div>
        <h1 className="font-display text-2xl text-foreground">INVENTORY</h1>
      </div>

      <div className="mb-4 -mx-4 px-4 overflow-x-auto border-b border-border">
        <div className="flex gap-1 min-w-max">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => changeTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold uppercase tracking-[1.2px] border-b-2 -mb-px transition",
                  active
                    ? "text-foreground border-[var(--color-gold)]"
                    : "text-muted-foreground border-transparent hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "live-counts"   && <LiveCountsTab />}
      {tab === "count-guide"   && <InventoryGuideView />}
      {tab === "orders"        && <OrdersTab onEditDetails={(itemId) => isManager && changeTab("configuration", { focus: itemId })} />}
      {tab === "drafts"        && isOwner && <DraftOrdersTab />}
      {tab === "approvals"     && isManager && <InventoryChangesView />}
      {tab === "configuration" && isManager && <OrderGuideView focusItemId={search.focus ?? null} />}
    </AppShell>
  );
}

/* =================== DRAFT ORDERS (OWNER-ONLY) =================== */

function DraftOrdersTab() {
  const qc = useQueryClient();
  const list = useServerFn(listInventoryOrders);
  const submitDraft = useServerFn(submitDraftInventoryOrder);

  const { data: orders = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["inv-orders", "drafts"],
    queryFn: () => list({ data: { scope: "all", status: "draft" } }) as any,
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => submitDraft({ data: { id } }) as any,
    onSuccess: () => {
      toast.success("Order submitted — owners notified");
      syncDomains(qc, "inventory", "alerts");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to submit"),
  });

  return (
    <div>
      <SectionHeader
        eyebrow="Cleanup"
        title="Draft inventory orders"
        action={<button onClick={() => refetch()} className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">Refresh</button>}
      />
      <p className="text-xs text-muted-foreground mb-3">
        Orders saved as drafts don't notify anyone. Submit them here to trigger the owner email + alert.
      </p>

      {isLoading ? (
        <Card>Loading…</Card>
      ) : orders.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No draft orders — you're all caught up.</Card>
      ) : (
        <div className="space-y-2">
          {orders.map((o: any) => {
            const items = o.items ?? [];
            const critical = items.filter((i: any) => i.urgency === "critical" || i.urgency === "emergency").length;
            return (
              <Card key={o.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusPill tone="warning">DRAFT</StatusPill>
                      <span className="text-sm font-semibold">{items.length} item{items.length === 1 ? "" : "s"}</span>
                      {critical > 0 && <StatusPill tone="danger">{critical} critical</StatusPill>}
                    </div>
                    <div className="label-caps text-muted-foreground mt-1">
                      Created {new Date(o.created_at).toLocaleString()}
                    </div>
                    {o.notes && <div className="text-xs text-muted-foreground mt-1">Note: {o.notes}</div>}
                    {items.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {items.map((i: any) => `${i.item_name} (${i.requested_qty}${i.unit ? " " + i.unit : ""})`).join(" · ")}
                      </div>
                    )}
                  </div>
                  <button
                    disabled={submitMut.isPending}
                    onClick={() => submitMut.mutate(o.id)}
                    className="shrink-0 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-2 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <Truck className="h-3.5 w-3.5" /> Submit
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <div className="h-6" />
    </div>
  );
}

/* =================== LIVE COUNTS TAB =================== */

function LiveCountsTab() {
  const qc = useQueryClient();
  const { roleId, trailerScope, trailers, session, loading } = useRole();
  const isOwner = roleId === "owner";
  const canPropose = !!session?.access_token;
  const list = useServerFn(listInventory);
  const [showArchived, setShowArchived] = useState(false);
  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["inventory", trailerScope ?? "company", showArchived ? "all" : "active"],
    queryFn: () => list({ data: { trailerId: trailerScope, includeArchived: showArchived } }) as Promise<Item[]>,
    enabled: !loading && !!session?.access_token,
  });
  const trailerLabel = trailerScope
    ? (trailers.find((t) => t.id === trailerScope)?.name ?? "Trailer")
    : "All trailers · Company";

  const listCatsFn = useServerFn(listInventoryCategories);
  const { data: categories = [] } = useQuery<Array<{ id: string; key: string; label: string; sort_order: number; archived_at: string | null }>>({
    queryKey: ["inventory-categories"],
    queryFn: () => listCatsFn({ data: {} }) as any,
    enabled: !loading && !!session?.access_token,
  });
  const catLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.key, c.label);
    for (const [k, v] of Object.entries(CATEGORY_LABELS)) if (!m.has(k)) m.set(k, v);
    return m;
  }, [categories]);
  const cats = useMemo(() => {
    const fromCats = categories.map((c) => c.key);
    const fromItems = Array.from(new Set(items.map((i) => i.category)));
    return Array.from(new Set([...fromCats, ...fromItems]));
  }, [categories, items]);
  const [cat, setCat] = useState<string>("protein");
  useEffect(() => {
    if (cats.length && !cats.includes(cat)) setCat(cats[0]);
  }, [cats.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = items.filter((i) => i.category === cat);

  const createCatFn = useServerFn(createInventoryCategory);
  const createCatMut = useMutation({
    mutationFn: (vars: { key: string; label: string }) => createCatFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(`Category "${vars.label}" added`);
      qc.invalidateQueries({ queryKey: ["inventory-categories"] });
      setCat(vars.key);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const archiveCatFn = useServerFn(archiveInventoryCategory);
  const archiveCatMut = useMutation({
    mutationFn: (id: string) => archiveCatFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Category removed");
      qc.invalidateQueries({ queryKey: ["inventory-categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleAddCategory() {
    const label = window.prompt("New category name (e.g. Packaging):")?.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
    if (!key) { toast.error("Invalid name"); return; }
    createCatMut.mutate({ key, label });
  }
  function handleRemoveCategory() {
    const current = categories.find((c) => c.key === cat);
    if (!current) { toast.error("Pick a category tab first."); return; }
    if (!confirm(`Remove category "${current.label}"? Items in this category must be moved or archived first.`)) return;
    archiveCatMut.mutate(current.id);
  }

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
    onSuccess: () => { toast.success("Count saved"); syncDomains(qc, "inventory"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const FANOUT = ["inventory", "orders", "alerts", "operations", "dashboard", "history"] as const;

  const scanFn = useServerFn(scanInventoryDependencies);
  const deleteFn = useServerFn(deleteInventoryItem);
  const archiveFn = useServerFn(archiveInventoryItem);
  const restoreFn = useServerFn(restoreInventoryItem);

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id } }),
    onSuccess: () => { toast.success("Item archived"); syncDomains(qc, ...FANOUT); },
    onError: (e: Error) => toast.error(e.message),
  });
  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreFn({ data: { id } }),
    onSuccess: () => { toast.success("Item restored"); syncDomains(qc, ...FANOUT); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Item deleted"); syncDomains(qc, ...FANOUT); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleOwnerRemove(it: Item) {
    try {
      const { counts, total } = await scanFn({ data: { id: it.id } }) as { counts: Record<string, number>; total: number };
      if (total === 0) {
        if (confirm(`Permanently delete ${it.name}? No references found.`)) deleteMut.mutate(it.id);
        return;
      }
      const summary = Object.entries(counts).filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${k}`).join(" · ");
      const choice = window.confirm(
        `"${it.name}" is referenced in ${total} place(s): ${summary}.\n\n` +
        `OK = Archive (keeps history, removes from active lists)\nCancel = Keep as-is`
      );
      if (choice) archiveMut.mutate(it.id);
    } catch (e: any) {
      toast.error(e.message ?? "Dependency check failed");
    }
  }

  const requestFn = useServerFn(submitInventoryChangeRequest);
  const requestMut = useMutation({
    mutationFn: (vars: { item: Item; reason: string }) => requestFn({ data: {
      action: "archive", targetItemId: vars.item.id, trailerId: trailerScope,
      payload: { name: vars.item.name }, reason: vars.reason,
    } }),
    onSuccess: () => { toast.success("Archive request sent to owner"); syncDomains(qc, "alerts"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2">
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

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard tone="danger"  label="Critical"      value={counts.crit} />
        <SummaryCard tone="warning" label="Low Stock"     value={counts.low} />
        <SummaryCard tone="success" label="Fully Stocked" value={counts.ok} />
      </div>

      <div className="mt-4 -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max items-center">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cn(
                "rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-[1.2px] border transition",
                c === cat ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]" : "bg-card text-muted-foreground border-border hover:text-foreground",
              )}>{catLabelByKey.get(c) ?? c}</button>
          ))}
          {isOwner && (
            <>
              <button
                onClick={handleAddCategory}
                disabled={createCatMut.isPending}
                title="Add category"
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] disabled:opacity-50">
                <Plus className="h-3.5 w-3.5" /> Category
              </button>
              {categories.some((c) => c.key === cat) && (
                <button
                  onClick={handleRemoveCategory}
                  disabled={archiveCatMut.isPending}
                  title="Remove current category"
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <label className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap pl-3">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                Show archived
              </label>
            </>
          )}
        </div>
      </div>

      <SectionHeader
        eyebrow={catLabelByKey.get(cat) ?? cat}
        title="Live Counts"
        action={
          canPropose ? (
            <button onClick={() => setEditItem("new")} className="inline-flex items-center gap-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-2.5 py-1 text-xs font-semibold">
              <Plus className="h-3.5 w-3.5" /> {isOwner ? "New item" : "Request item"}
            </button>
          ) : null
        }
      />

      {(loading || isLoading) && <Card>Loading…</Card>}

      <div className="space-y-2">
        {visible.map((it) => {
          const s = statusOf(it);
          const action = recommendedAction(s);
          const pct = Math.min(150, Math.round((Number(it.current_qty) / Math.max(1, Number(it.par_level))) * 100));
          return (
            <Card key={it.id} className={cn("p-3", it.archived_at && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{it.name} {it.archived_at && <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground">· archived</span>}</div>
                  <div className="label-caps text-muted-foreground mt-0.5">PAR {Number(it.par_level)} {it.unit}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusPill tone={statusTone(s)}>{s}</StatusPill>
                  <span className={cn(
                    "text-[10px] uppercase tracking-[1.1px] font-semibold",
                    action.tone === "danger"  && "text-[var(--color-danger)]",
                    action.tone === "warning" && "text-[var(--color-warning)]",
                    action.tone === "success" && "text-[var(--color-success)]",
                    action.tone === "info"    && "text-muted-foreground",
                  )}>{action.label}</span>
                </div>
                {canPropose && (
                  <div className="flex gap-1">
                    {it.archived_at ? (
                      isOwner && (
                        <button onClick={() => restoreMut.mutate(it.id)} disabled={restoreMut.isPending} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-[var(--color-success)] disabled:opacity-50" title="Restore">
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        </button>
                      )
                    ) : (
                      <>
                        <button onClick={() => setEditItem(it)} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground" title={isOwner ? "Edit" : "Request edit"}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => {
                          if (isOwner) {
                            handleOwnerRemove(it);
                          } else {
                            const reason = window.prompt(`Request to archive ${it.name}. Reason?`);
                            if (reason !== null) requestMut.mutate({ item: it, reason });
                          }
                        }} disabled={deleteMut.isPending || archiveMut.isPending} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-[var(--color-danger)] disabled:opacity-50" title={isOwner ? "Archive or delete" : "Request archive"}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                <div>
                  <div className="text-2xl font-semibold">{Number(it.current_qty)} <span className="text-xs text-muted-foreground">{it.unit} · {pct}%{(it as any).cost_per_unit > 0 ? ` · $${Number((it as any).cost_per_unit).toFixed(2)}/${it.unit}` : ""}</span></div>
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
      {editItem && <EditItemModal item={editItem === "new" ? null : editItem} defaultCategory={cat} isOwner={isOwner} trailerId={trailerScope} onClose={() => setEditItem(null)} onDone={() => syncDomains(qc, "inventory", "alerts")} />}

      <div className="h-6" />
    </div>
  );
}

/* =================== ORDERS TAB — pending submitted orders =================== */

const PENDING_STATUSES = ["submitted", "pending_owner_review", "approved", "ordered"] as const;

function OrdersTab({ onEditDetails }: { onEditDetails: (itemId: string) => void }) {
  const qc = useQueryClient();
  const { trailerScope, trailers, session, loading } = useRole();
  const listOrders = useServerFn(listInventoryOrders);
  const listItems = useServerFn(listInventory);
  const decide = useServerFn(decideInventoryOrder);

  const { data: orders = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["inv-orders", "pending", trailerScope ?? "all"],
    queryFn: () => listOrders({ data: { scope: "all" } }) as any,
    enabled: !loading && !!session?.access_token,
  });

  // Items for the "New order" builder. Key MUST start with "inventory" so the
  // sync-bus "inventory" domain invalidates it when items are added/edited.
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["inventory", "orders-tab-picker", trailerScope ?? "company"],
    queryFn: () => listItems({ data: { trailerId: trailerScope } }) as Promise<Item[]>,
    enabled: !loading && !!session?.access_token,
    staleTime: 0,
  });

  const trailerLabel = trailerScope
    ? (trailers.find((t) => t.id === trailerScope)?.name ?? "Trailer")
    : "All trailers · Company";

  const [orderOpen, setOrderOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const pending = useMemo(() => {
    const scoped = trailerScope
      ? orders.filter((o) => o.trailer_id === trailerScope || o.trailer_id == null)
      : orders;
    return scoped.filter((o: any) => (PENDING_STATUSES as readonly string[]).includes(o.status));
  }, [orders, trailerScope]);

  const receiveMut = useMutation({
    mutationFn: (id: string) => decide({ data: { id, decision: "received" as any } }) as any,
    onSuccess: () => {
      toast.success("Order marked received — stock updated");
      syncDomains(qc, "orders", "inventory", "alerts");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to mark received"),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => decide({ data: { id, decision: "cancelled" as any } }) as any,
    onSuccess: () => {
      toast.success("Order cancelled");
      syncDomains(qc, "orders", "alerts");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to cancel"),
  });

  const statusLabel = (s: string) =>
    s === "submitted" ? "Awaiting owner"
    : s === "pending_owner_review" ? "Awaiting owner"
    : s === "approved" ? "Approved — ready to pick up"
    : s === "ordered" ? "Picked up — awaiting delivery"
    : s;

  const statusToneFor = (s: string): "warning" | "success" | "info" | "neutral" =>
    s === "approved" ? "success"
    : s === "ordered" ? "info"
    : "warning";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="label-caps text-muted-foreground">Fulfillment</div>
          <h2 className="font-display text-lg text-foreground">OPEN ORDERS · {pending.length}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <History className="h-3.5 w-3.5" /> History
          </button>
          <button onClick={() => { qc.invalidateQueries({ queryKey: ["inventory"] }); setOrderOpen(true); }}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> New order
          </button>
          <div className="text-xs font-semibold uppercase tracking-[1.2px] text-[var(--color-gold)] bg-[#0A0A0A] px-3 py-1.5 rounded-md">{trailerLabel}</div>
        </div>
      </div>

      {(loading || isLoading) && <Card>Loading…</Card>}

      {!isLoading && pending.length === 0 && (
        <Card className="p-8 text-center">
          <div className="label-caps text-muted-foreground mb-1">All clear</div>
          <div className="text-sm text-muted-foreground">No open orders waiting to be fulfilled.</div>
          <button onClick={() => { qc.invalidateQueries({ queryKey: ["inventory"] }); setOrderOpen(true); }}
            className="mt-4 inline-flex items-center gap-1 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-2 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> Create a new order
          </button>
        </Card>
      )}

      <div className="space-y-4">
        {pending.map((o: any) => {
          const items = o.items ?? [];
          const critical = items.filter((i: any) => i.urgency === "critical" || i.urgency === "emergency").length;
          const creatorLabel = o.created_by_name ?? "";
          return (
            <Card key={o.id} className="p-0 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-secondary/40 border-b border-border flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusPill tone={statusToneFor(o.status)}>{statusLabel(o.status)}</StatusPill>
                    {critical > 0 && <StatusPill tone="danger">{critical} critical</StatusPill>}
                    <span className="text-sm font-semibold">{items.length} item{items.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="label-caps text-muted-foreground mt-1 text-[10px]">
                    Submitted {new Date(o.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {creatorLabel ? ` · by ${creatorLabel}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (window.confirm(`Cancel this order (${items.length} items)?`)) cancelMut.mutate(o.id);
                    }}
                    disabled={cancelMut.isPending}
                    className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-[var(--color-danger)] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => receiveMut.mutate(o.id)}
                    disabled={receiveMut.isPending}
                    className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-4 py-2 text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    {receiveMut.isPending && receiveMut.variables === o.id ? "Fulfilling…" : `Fulfill order (${items.length})`}
                  </button>
                </div>
              </div>

              {o.notes && (
                <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border bg-card">
                  Note: {o.notes}
                </div>
              )}

              <div className="divide-y divide-border">
                {items.map((it: any) => (
                  <div key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      onClick={() => it.item_id && onEditDetails(it.item_id)}
                      disabled={!it.item_id}
                      className={cn("min-w-0 flex-1 text-left text-sm font-semibold truncate", it.item_id && "hover:text-[var(--color-gold)]")}
                      title={it.item_id ? "Edit item details" : ""}
                    >
                      {it.item_name}
                      {it.reason && <span className="ml-2 text-[10px] font-normal text-muted-foreground">({it.reason})</span>}
                    </button>
                    {(it.urgency === "critical" || it.urgency === "emergency") && (
                      <StatusPill tone="danger">{it.urgency}</StatusPill>
                    )}
                    <span className="tabular-nums text-sm font-semibold text-[var(--color-gold)] shrink-0">
                      {Number(it.requested_qty)} <span className="text-xs text-muted-foreground font-normal">{it.unit ?? ""}</span>
                    </span>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="px-4 py-3 text-xs text-muted-foreground">No items on this order.</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {orderOpen && <OrderBuilderModal items={items as unknown as Item[]} trailerId={trailerScope} onClose={() => setOrderOpen(false)} onDone={() => { syncDomains(qc, "orders", "inventory", "alerts"); refetch(); }} />}
      {historyOpen && <OrderHistoryModal onClose={() => setHistoryOpen(false)} />}

      <div className="h-6" />
    </div>
  );
}




function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-md bg-secondary/40 px-3 py-2">
      <div className="label-caps text-muted-foreground text-[10px]">{label}</div>
      <div className={cn("font-semibold tabular-nums mt-0.5", emphasis ? "text-base text-[var(--color-gold)]" : "text-sm text-foreground")}>{value}</div>
    </div>
  );
}

/* =================== SHARED PRIMITIVES =================== */

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

export function EditItemModal({ item, defaultCategory, isOwner, trailerId, onClose, onDone }: { item: Item | null; defaultCategory: string; isOwner: boolean; trailerId: string | null; onClose: () => void; onDone: () => void }) {
  const upsert = useServerFn(upsertInventoryItem);
  const requestFn = useServerFn(submitInventoryChangeRequest);
  const listCatsFn = useServerFn(listInventoryCategories);
  const { data: liveCategories = [] } = useQuery<Array<{ key: string; label: string }>>({
    queryKey: ["inventory-categories"],
    queryFn: () => listCatsFn({ data: {} }) as any,
  });
  const it = item as any;
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<string>(item?.category ?? defaultCategory);
  const [unit, setUnit] = useState(item?.unit ?? "unit");
  const [par, setPar] = useState(String(item?.par_level ?? ""));
  const [low, setLow] = useState(String(item?.low_threshold ?? ""));
  const [qty, setQty] = useState(item ? String(item.current_qty) : "");
  const [reason, setReason] = useState("");
  const [imageUrl, setImageUrl] = useState<string>(it?.image_url ?? "");
  const [countInstructions, setCountInstructions] = useState<string>(it?.count_instructions ?? "");
  const [storageLocation, setStorageLocation] = useState<string>(it?.storage_location ?? "");
  const [costPerUnit, setCostPerUnit] = useState<string>(it?.cost_per_unit != null ? String(it.cost_per_unit) : "");
  const [uploading, setUploading] = useState(false);

  const onPickImage = async (file: File) => {
    if (!isOwner) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be ≤ 8 MB"); return; }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `inventory/${item?.id ?? "new"}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("gotham-photos").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) throw error;
      setImageUrl(path);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setUploading(false); }
  };

  const m = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(), category, unit: unit.trim() || "unit",
        parLevel: Number(par) || 0, lowThreshold: Number(low) || 0,
        currentQty: qty === "" ? undefined : Number(qty),
        imageUrl: imageUrl || null,
        countInstructions: countInstructions || null,
        storageLocation: storageLocation || null,
        costPerUnit: costPerUnit !== "" ? Number(costPerUnit) : undefined,
      };
      if (isOwner) {
        await upsert({ data: { id: item?.id, ...payload, category: payload.category as any } });
        return;
      }
      await requestFn({ data: {
        action: item ? "update" : "create",
        targetItemId: item?.id ?? null,
        trailerId,
        payload,
        reason: reason || undefined,
      } });
    },
    onSuccess: () => {
      toast.success(isOwner ? (item ? "Item updated" : "Item added") : "Request sent to owner");
      onDone(); onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const title = isOwner
    ? (item ? `Edit: ${item.name}` : "New inventory item")
    : (item ? `Request edit: ${item.name}` : "Request new item");
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm">
              {(liveCategories.length ? liveCategories : Object.entries(CATEGORY_LABELS).map(([key, label]) => ({ key, label })))
                .map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Unit"><input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="lb, ea, case" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Par level"><input type="number" value={par} onChange={(e) => setPar(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
          <Field label="Low / critical alert ≤"><input type="number" value={low} onChange={(e) => setLow(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current quantity (optional)"><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="leave blank to keep" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" /></Field>
          <Field label="Cost / unit ($)">
            <input
              type="number" step="0.0001" min="0"
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value)}
              placeholder="0.00"
              disabled={!isOwner}
              className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-60"
            />
          </Field>
        </div>

        <div className="border-t border-border pt-3">
          <div className="label-caps text-muted-foreground mb-2">Inventory Guide {isOwner ? "" : "(owner-only)"}</div>
          <Field label="Storage location">
            <input
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="e.g. Walk-in shelf 2, top bin"
              disabled={!isOwner}
              className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-60"
            />
          </Field>
          <div className="mt-3">
            <Field label="Count instructions">
              <textarea
                value={countInstructions}
                onChange={(e) => setCountInstructions(e.target.value.slice(0, 2000))}
                rows={3}
                placeholder="Describe how to count (e.g. case = 24 ea, count opened sleeves too)"
                disabled={!isOwner}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm disabled:opacity-60"
              />
            </Field>
          </div>
          <div className="mt-3">
            <div className="label-caps text-muted-foreground mb-1">Reference image</div>
            <div className="flex items-start gap-3">
              <div className="h-20 w-20 shrink-0 rounded-md bg-secondary overflow-hidden grid place-items-center border border-border">
                {imageUrl
                  ? <SignedImage path={imageUrl} alt="item" className="h-full w-full object-cover" />
                  : <span className="text-[10px] text-muted-foreground">no image</span>}
              </div>
              {isOwner && (
                <div className="flex flex-col gap-2">
                  <label className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold cursor-pointer inline-flex items-center justify-center w-fit">
                    {uploading ? "Uploading…" : (imageUrl ? "Replace image" : "Upload image")}
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickImage(f); e.target.value = ""; }}
                    />
                  </label>
                  {imageUrl && (
                    <button type="button" onClick={() => setImageUrl("")} className="text-xs text-muted-foreground underline w-fit">
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {!isOwner && (
          <Field label="Reason for request">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why this change is needed" className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          </Field>
        )}
      </div>
      <ModalActions onClose={onClose} primary={isOwner ? (item ? "Save changes" : "Create item") : "Submit request"} disabled={!name.trim() || m.isPending || uploading} onSubmit={() => m.mutate()} />
    </Modal>
  );
}

type OrderBuilderRow = {
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
  const [rows, setRows] = useState<OrderBuilderRow[]>([]);
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

  const updateRow = (idx: number, patch: Partial<OrderBuilderRow>) => {
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
