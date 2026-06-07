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
  | "recaps"
  | "hospitality"
  | "history"
  | "dashboard"
  | "integrity";

const MAP: Record<SyncDomain, string[][]> = {
  users:        [["users"], ["employees"], ["my-profile"], ["dashboard-stats"], ["change-log"]],
  roles:        [["users"], ["my-profile"], ["all-tab-permissions"], ["dashboard-stats"]],
  permissions:  [["all-tab-permissions"], ["users"]],
  profiles:     [["my-profile"], ["users"], ["employees"]],
  invites:      [["invites-v2"], ["users"], ["access-logs"]],
  schedule:     [["schedule-range"], ["schedule"], ["employees"], ["labor-dash"], ["emp-week"], ["my-week"], ["dashboard-stats"], ["alerts"], ["change-log"]],
  timeclock:    [["my-active-punch"], ["my-week"], ["emp-week"], ["labor-dash"], ["labor-reqs"], ["my-requests"], ["dashboard-stats"], ["change-log"]],
  labor:        [["labor-dash"], ["labor-reqs"], ["emp-week"], ["my-week"], ["dashboard-stats"], ["alerts"], ["change-log"]],
  inventory:    [["inventory"], ["order-guide"], ["dashboard-stats"], ["change-log"]],
  orders:       [["inv-orders"], ["inventory"], ["order-guide"], ["alerts"], ["dashboard-stats"], ["change-log"]],
  cash:         [["cash-drawers"], ["cash-sessions"], ["cash-session"], ["cash-session-pre"], ["alerts"], ["dashboard-stats"], ["change-log"]],
  alerts:       [["alerts"], ["dashboard-stats"]],
  operations:   [["shift"], ["roster"], ["tasks"], ["dashboard-stats"], ["change-log"]],
  tasks:        [["tasks"], ["operations"], ["dashboard-stats"]],
  sops:         [["sops"], ["sop-versions"], ["sop-attachments"], ["change-log"]],
  recaps:       [["recaps"], ["recap"], ["alerts"], ["dashboard-stats"], ["change-log"]],
  hospitality:  [["hospitality"], ["dashboard-stats"]],
  history:      [["change-log"], ["audit-log"], ["access-logs"]],
  dashboard:    [["dashboard-stats"]],
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
}

/** Refresh literally everything — use sparingly (sign-in, role change, big imports). */
export function syncAll(qc: QueryClient) {
  qc.invalidateQueries();
}
