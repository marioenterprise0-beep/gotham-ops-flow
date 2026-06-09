
# Single Source of Truth — Phase 1: Inventory (then propagate)

The codebase already has the bones (sync-bus, `archived_at` column, audit log).
The failure you're seeing is in three places:

1. `deleteInventoryItem` hard-deletes — breaks references in orders/recaps/counts.
2. Read queries (`listInventory`, dashboard, guide, order builder) don't filter by `archived_at IS NULL`.
3. The UI mutation hooks don't all call `syncDomains("inventory","orders","alerts","dashboard")`, so caches stay stale.

I'll tackle inventory end-to-end first (your stated failing example), then apply the identical pattern to the other domains. Doing all domains in one pass = unreviewable change + high regression risk.

## Phase 1 — Inventory becomes canonical (this turn)

### 1. Server: archive-not-delete + dependency scan
- New `scanInventoryDependencies({ id })` server fn — counts references in:
  `inventory_order_items`, `inventory_counts`, `inventory_receipts`, `waste_log`, `inventory_change_requests`, `alerts` (source_id), `tasks` (description match optional, skip).
- Replace `deleteInventoryItem` with `archiveInventoryItem({ id, force? })`:
  - If dependencies exist and `force !== true` → throw a structured error `{ code: "HAS_DEPENDENCIES", counts, totalRefs }`.
  - Otherwise set `archived_at = now()`, write audit row, return `{ archived: true }`.
- Add `restoreInventoryItem({ id })` — clears `archived_at`.
- Add `hardDeleteInventoryItem({ id })` owner-only, only succeeds when dependency count is 0. (Kept for items created in error with zero history.)

### 2. Server: every read filters archived by default
- `listInventory({ includeArchived? })` adds `.is("archived_at", null)` unless flag set.
- `dashboard.functions.ts`, `health.functions.ts`, `manager.functions.ts`, `alerts.functions.ts`, `analytics.functions.ts`, `inventory-orders.functions.ts` — same filter on `inventory_items` queries.
- Order guide / inventory guide pages call `listInventory()` → they pick up the filter automatically.

### 3. UI: dependency-aware delete flow
- Inventory page "Delete" button → calls `scanInventoryDependencies` first.
  - 0 refs → confirm "Permanently delete" → `hardDeleteInventoryItem`.
  - >0 refs → modal: "Referenced in N places: 4 orders · 2 counts · 1 alert". Options: **Archive** / **Cancel**. (Replace is out of scope this phase.)
- Archived items: surfaced via "Show archived" toggle on the inventory page with a Restore action.

### 4. Cross-module fan-out
- Every inventory mutation hook calls
  `syncDomains(qc, "inventory","orders","alerts","operations","dashboard","history")`.
- Audit each call site in `src/routes/inventory.tsx`, `inventory-guide.tsx`, `order-guide.tsx`, `inventory-changes.tsx`, manager reorder action.

### 5. Reconciliation check
- Extend the existing integrity sweep (`integrity-sweep` query) with an "Orphaned references" row: count of order items / counts / alerts pointing at a missing inventory item. Owner sees it on `/integrity`.

## Phase 2 (separate turns, after you confirm Phase 1 looks right)

Apply the same archive-not-delete + dependency-scan + read-filter + sync fan-out pattern to: Users, Schedules, SOPs, Cash drawers, Trailers, Training. Each domain = its own focused PR-sized change so you can verify and roll back if needed.

## Out of scope (call out so you know)

- Realtime postgres_changes subscriptions for live multi-tab sync — the React Query invalidation pattern already covers a single user across tabs via window-focus refetch. True realtime is a separate decision (cost, RLS on broadcast channels).
- "Replace item X with item Y" merge tool — useful but a distinct workflow.
- A nightly cron reconciliation job — Phase 2 once read-filters land everywhere.

## Confirm one thing before I start

The plan above assumes **archive** is the right default and hard-delete is reserved for items with zero history. If you actually want a one-click destructive purge that nukes history too, say so — but it will erase your audit trail for that item.
