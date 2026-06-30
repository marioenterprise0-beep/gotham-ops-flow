import type { QueryClient } from "@tanstack/react-query";

/**
 * Central sync bus — maps high-level "domains" to the React Query keys
 * that must refresh when that domain mutates. Keeping all cross-module
 * propagation in one place means a mutation in any module forces every
 * dependent view (dashboards, alerts, labor, reports, history…) to refetch.
 *
 * Usage:
 *   onSuccess: () => syncDomains(qc, "schedule")
 *   onSuccess: () => syncDomains(qc, "inventory", "alerts")
 */
export type SyncDomain =
  | "users"
  | "roles"
  | "permissions"
  | "profiles"
  | "invites"
  | "schedule"
  | "timeclock"
  | "labor"
  | "inventory"
  | "orders"
  | "cash"
  | "alerts"
  | "operations"
  | "tasks"
  | "sops"
  | "handbook"
  | "hr_documents"
  | "recaps"
  | "hospitality"
  | "history"
  | "dashboard"
  | "integrity"
  | "prep"
  | "swaps"
  | "maintenance";

const MAP: Record<SyncDomain, string[][]> = {
  users:        [["users"], ["employees"], ["my-profile"], ["dashboard-stats"], ["change-log"]],
  roles:        [["users"], ["my-profile"], ["all-tab-permissions"], ["dashboard-stats"]],
  permissions:  [["all-tab-permissions"], ["users"]],
  profiles:     [["my-profile"], ["users"], ["employees"]],
  invites:      [["invites-v2"], ["users"], ["access-logs"]],
  schedule:     [["schedule-range"], ["schedule"], ["employees"], ["labor-dash"], ["emp-week"], ["my-week"], ["dashboard-stats"], ["alerts"], ["change-log"]],
  timeclock:    [["my-active-punch"], ["my-week"], ["emp-week"], ["labor-dash"], ["labor-reqs"], ["my-requests"], ["schedule"], ["schedule-range"], ["dashboard-stats"], ["change-log"]],
  labor:        [["labor-dash"], ["labor-reqs"], ["emp-week"], ["my-week"], ["dashboard-stats"], ["alerts"], ["change-log"]],
  inventory:    [["inventory"], ["order-guide"], ["inventory-guide"], ["dashboard-stats"], ["change-log"]],
  orders:       [["inv-orders"], ["inventory"], ["order-guide"], ["inventory-guide"], ["alerts"], ["dashboard-stats"], ["change-log"]],
  cash:         [["cash-drawers"], ["cash-sessions"], ["cash-session"], ["cash-session-pre"], ["alerts"], ["dashboard-stats"], ["change-log"]],
  alerts:       [["alerts"], ["dashboard-stats"]],
  operations:   [["shift"], ["roster"], ["tasks"], ["dashboard-stats"], ["change-log"]],
  tasks:        [["tasks"], ["operations"], ["dashboard-stats"]],
  sops:         [["sops"], ["sop-versions"], ["sop-attachments"], ["sop-ack-rollup"], ["my-sop-acks"], ["dashboard-stats"], ["change-log"]],
  handbook:     [["handbook"], ["my-handbook-ack"], ["handbook-ack-rollup"], ["dashboard-stats"], ["change-log"]],
  hr_documents: [["my-hr-documents"], ["hr-employee-docs"], ["hr-assignment-detail"], ["hr-templates"], ["alerts"], ["dashboard-stats"], ["change-log"]],
  recaps:       [["recaps"], ["recap"], ["alerts"], ["dashboard-stats"], ["change-log"]],
  hospitality:  [["hospitality"], ["dashboard-stats"]],
  maintenance:  [["maintenance-requests"], ["alerts"], ["dashboard-stats"], ["change-log"]],
  history:      [["change-log"], ["audit-log"], ["access-logs"]],
  dashboard:    [["dashboard-stats"]],
  integrity:    [["integrity-sweep"]],
  prep:         [["prep-log"], ["dashboard-stats"]],
  swaps:        [["swap-requests"], ["my-swaps"], ["schedule-range"], ["alerts"]],
};

export function syncDomains(qc: QueryClient, ...domains: SyncDomain[]) {
  const seen = new Set<string>();
  for (const d of domains) {
    for (const key of MAP[d] ?? []) {
      const sig = JSON.stringify(key);
      if (seen.has(sig)) continue;
      seen.add(sig);
      qc.invalidateQueries({ queryKey: key });
    }
  }
  // Every mutation also bumps history + dashboard summaries.
  if (!domains.includes("history")) qc.invalidateQueries({ queryKey: ["change-log"] });
  if (!domains.includes("dashboard")) qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  // Every mutation also flags the data-integrity sweep as stale so the
  // owner's diagnostics page reflects current cross-model consistency.
  if (!domains.includes("integrity")) qc.invalidateQueries({ queryKey: ["integrity-sweep"] });
}

/** Refresh literally everything — use sparingly (sign-in, role change, big imports). */
export function syncAll(qc: QueryClient) {
  qc.invalidateQueries();
}
