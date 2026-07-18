// Cross-model data-integrity sweep. Verifies that references between modules
// (schedules ↔ labor ↔ weekly hours, inventory orders ↔ inventory items,
// permissions ↔ navigation tabs) remain consistent. Read-only — reports
// issues without mutating data. Owner-only.

import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { requireManager } from "@/lib/auth-guards";

// Canonical tab keys understood by the nav. Keep in sync with AppShell ALL_TABS.
export const NAV_TAB_KEYS = [
  "dashboard",
  "my-tasks",
  "time-clock",
  "cash",
  "operations",
  "recaps",
  "schedule",
  "labor",
  "inventory",
  "order-guide",
  "sops",
  "handbook",
  "hr-documents",
  "hospitality",
  "maintenance",
  "health",
  "alerts",
  "manager",
  "users",
  "permissions",
  "audit",
  "change-log",
  "analytics",
  "settings",
] as const;

export type IntegrityIssue = {
  category: "schedule" | "labor" | "inventory" | "permissions" | "users";
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
  count: number;
  sampleIds?: string[];
};

export type IntegrityReport = {
  ranAt: string;
  ok: boolean;
  totals: { critical: number; warning: number; info: number };
  issues: IntegrityIssue[];
};

function pushIssue(out: IntegrityIssue[], i: IntegrityIssue) {
  if (i.count > 0) out.push(i);
}

export const runIntegritySweep = createServerFn({ method: "GET" })
  .middleware([requireActiveOrg])
  .handler(async ({ context }): Promise<IntegrityReport> => {
    const { supabase } = context;
    await requireManager(supabase, context.userId);

    const issues: IntegrityIssue[] = [];

    // -------- SCHEDULE ↔ LABOR --------
    const [shiftsRes, schedulesRes, punchesRes, profilesRes] = await Promise.all([
      supabase
        .from("schedule_shifts")
        .select(
          "id, schedule_id, employee_id, shift_date, start_time, end_time, trailer_id, schedules!inner(archived_at)",
        )
        .is("schedules.archived_at", null)
        .is("archived_at", null),
      supabase.from("schedules").select("id, status").is("archived_at", null),
      supabase
        .from("time_punches")
        .select("id, employee_id, clock_in_at, clock_out_at, trailer_id")
        .is("archived_at", null)
        .gte("clock_in_at", new Date(Date.now() - 30 * 86400000).toISOString()),
      supabase.from("profiles").select("id, active, trailer_id, archived_at"),
    ]);

    const shifts = shiftsRes.data ?? [];
    const schedules = schedulesRes.data ?? [];
    const punches = punchesRes.data ?? [];
    const profiles = profilesRes.data ?? [];

    const scheduleIds = new Set(schedules.map((s: any) => s.id));
    // All known profiles (including archived) — used for FK existence checks so
    // historical rows (punches, role rows) tied to archived users aren't flagged
    // as "missing profile". Active/live sets are derived below for other checks.
    const profileIds = new Set(profiles.map((p: any) => p.id));
    const activeProfileIds = new Set(
      profiles.filter((p: any) => p.active && !p.archived_at).map((p: any) => p.id),
    );

    const orphanedShifts = shifts.filter((s: any) => !scheduleIds.has(s.schedule_id));
    pushIssue(issues, {
      category: "schedule",
      severity: "critical",
      code: "shift_orphan_schedule",
      message: "Schedule shifts reference a missing schedule.",
      count: orphanedShifts.length,
      sampleIds: orphanedShifts.slice(0, 5).map((s: any) => s.id),
    });

    const shiftsBadEmployee = shifts.filter(
      (s: any) => s.employee_id && !profileIds.has(s.employee_id),
    );
    pushIssue(issues, {
      category: "schedule",
      severity: "critical",
      code: "shift_missing_employee",
      message: "Shifts assigned to a user who no longer has a profile.",
      count: shiftsBadEmployee.length,
      sampleIds: shiftsBadEmployee.slice(0, 5).map((s: any) => s.id),
    });

    const shiftsInactiveEmployee = shifts.filter(
      (s: any) =>
        s.employee_id && profileIds.has(s.employee_id) && !activeProfileIds.has(s.employee_id),
    );
    pushIssue(issues, {
      category: "schedule",
      severity: "warning",
      code: "shift_inactive_employee",
      message: "Shifts assigned to a deactivated user.",
      count: shiftsInactiveEmployee.length,
      sampleIds: shiftsInactiveEmployee.slice(0, 5).map((s: any) => s.id),
    });

    const shiftsBadTime = shifts.filter((s: any) => {
      if (!s.start_time || !s.end_time) return true;
      // Overnight shifts (end < start) are valid — only flag zero-length.
      return String(s.end_time) === String(s.start_time);
    });
    pushIssue(issues, {
      category: "schedule",
      severity: "warning",
      code: "shift_bad_time",
      message: "Shifts with missing times or zero-length duration.",
      count: shiftsBadTime.length,
      sampleIds: shiftsBadTime.slice(0, 5).map((s: any) => s.id),
    });

    const punchesBadEmployee = punches.filter((p: any) => !profileIds.has(p.employee_id));
    pushIssue(issues, {
      category: "labor",
      severity: "critical",
      code: "punch_missing_employee",
      message: "Time punches reference a missing user profile.",
      count: punchesBadEmployee.length,
      sampleIds: punchesBadEmployee.slice(0, 5).map((p: any) => p.id),
    });

    // Stuck open punches: clocked in over 18h ago with no clock-out
    const stuckMs = 18 * 3600_000;
    const stuckPunches = punches.filter(
      (p: any) => !p.clock_out_at && Date.now() - new Date(p.clock_in_at).getTime() > stuckMs,
    );
    pushIssue(issues, {
      category: "labor",
      severity: "warning",
      code: "punch_stuck_open",
      message: "Open punches over 18 hours with no clock-out (likely forgotten).",
      count: stuckPunches.length,
      sampleIds: stuckPunches.slice(0, 5).map((p: any) => p.id),
    });

    // Weekly-hours sanity: any employee with >70h actual in last 7 days
    const sevenAgo = Date.now() - 7 * 86400000;
    const byEmp = new Map<string, number>();
    for (const p of punches) {
      const start = new Date(p.clock_in_at).getTime();
      if (start < sevenAgo) continue;
      const end = p.clock_out_at ? new Date(p.clock_out_at).getTime() : Date.now();
      const hrs = Math.max(0, (end - start) / 3600_000);
      byEmp.set(p.employee_id, (byEmp.get(p.employee_id) ?? 0) + hrs);
    }
    const overworked = [...byEmp.entries()].filter(([, h]) => h > 70).map(([id]) => id);
    pushIssue(issues, {
      category: "labor",
      severity: "warning",
      code: "weekly_hours_over_cap",
      message: "Employees with over 70 worked hours in the last 7 days.",
      count: overworked.length,
      sampleIds: overworked.slice(0, 5),
    });

    // -------- INVENTORY ORDERS ↔ INVENTORY --------
    const [ordersRes, orderItemsRes, itemsRes] = await Promise.all([
      supabase.from("inventory_orders").select("id, status, trailer_id"),
      supabase
        .from("inventory_order_items")
        .select("id, order_id, item_id, requested_qty, item_name"),
      supabase.from("inventory_items").select("id, name, current_qty, low_threshold, trailer_id"),
    ]);

    const orders = ordersRes.data ?? [];
    const orderItems = orderItemsRes.data ?? [];
    const items = itemsRes.data ?? [];
    const orderIds = new Set(orders.map((o: any) => o.id));
    const itemIds = new Set(items.map((i: any) => i.id));

    const orphanedOrderItems = orderItems.filter((oi: any) => !orderIds.has(oi.order_id));
    pushIssue(issues, {
      category: "inventory",
      severity: "critical",
      code: "order_item_orphan_order",
      message: "Inventory order items reference a missing order.",
      count: orphanedOrderItems.length,
      sampleIds: orphanedOrderItems.slice(0, 5).map((o: any) => o.id),
    });

    const itemRefBroken = orderItems.filter((oi: any) => oi.item_id && !itemIds.has(oi.item_id));
    pushIssue(issues, {
      category: "inventory",
      severity: "warning",
      code: "order_item_missing_inventory",
      message: "Order line items reference a deleted inventory item.",
      count: itemRefBroken.length,
      sampleIds: itemRefBroken.slice(0, 5).map((o: any) => o.id),
    });

    const badQty = orderItems.filter((oi: any) => !(Number(oi.requested_qty) > 0));
    pushIssue(issues, {
      category: "inventory",
      severity: "warning",
      code: "order_item_zero_qty",
      message: "Order line items with zero or invalid requested quantity.",
      count: badQty.length,
      sampleIds: badQty.slice(0, 5).map((o: any) => o.id),
    });

    const negativeStock = items.filter((i: any) => Number(i.current_qty) < 0);
    pushIssue(issues, {
      category: "inventory",
      severity: "critical",
      code: "item_negative_stock",
      message: "Inventory items with negative on-hand quantity.",
      count: negativeStock.length,
      sampleIds: negativeStock.slice(0, 5).map((i: any) => i.id),
    });

    // -------- PERMISSIONS ↔ NAVIGATION --------
    const { data: permRows } = await supabase
      .from("tab_permissions")
      .select("id, tab_key, scope_type, scope_id");
    const knownTabs = new Set<string>(NAV_TAB_KEYS);
    const orphanedPerms = (permRows ?? []).filter((p: any) => !knownTabs.has(p.tab_key));
    pushIssue(issues, {
      category: "permissions",
      severity: "warning",
      code: "perm_unknown_tab",
      message: "Permission rows targeting tabs that no longer exist in navigation.",
      count: orphanedPerms.length,
      sampleIds: orphanedPerms.slice(0, 5).map((p: any) => p.id),
    });

    const badScope = (permRows ?? []).filter(
      (p: any) => p.scope_type !== "role" && p.scope_type !== "user",
    );
    pushIssue(issues, {
      category: "permissions",
      severity: "warning",
      code: "perm_bad_scope",
      message: "Permission rows with unknown scope type (must be role or user).",
      count: badScope.length,
      sampleIds: badScope.slice(0, 5).map((p: any) => p.id),
    });

    const userPerms = (permRows ?? []).filter((p: any) => p.scope_type === "user");
    const danglingUserPerms = userPerms.filter((p: any) => !profileIds.has(p.scope_id));
    pushIssue(issues, {
      category: "permissions",
      severity: "warning",
      code: "perm_dangling_user",
      message: "User-scoped permissions for users with no profile.",
      count: danglingUserPerms.length,
      sampleIds: danglingUserPerms.slice(0, 5).map((p: any) => p.id),
    });

    // -------- USERS ↔ ROLES --------
    const { data: userRoles } = await supabase.from("user_roles").select("user_id, role");
    const userIdsWithRole = new Set((userRoles ?? []).map((r: any) => r.user_id));
    const profilesNoRole = profiles.filter((p: any) => !userIdsWithRole.has(p.id));
    pushIssue(issues, {
      category: "users",
      severity: "critical",
      code: "profile_no_role",
      message: "Profiles without any assigned role (cannot access app).",
      count: profilesNoRole.length,
      sampleIds: profilesNoRole.slice(0, 5).map((p: any) => p.id),
    });

    const rolesNoProfile = (userRoles ?? []).filter((r: any) => !profileIds.has(r.user_id));
    pushIssue(issues, {
      category: "users",
      severity: "warning",
      code: "role_no_profile",
      message: "Role rows for users with no profile.",
      count: rolesNoProfile.length,
      sampleIds: rolesNoProfile.slice(0, 5).map((r: any) => r.user_id),
    });

    const totals = {
      critical: issues.filter((i) => i.severity === "critical").reduce((s, i) => s + i.count, 0),
      warning: issues.filter((i) => i.severity === "warning").reduce((s, i) => s + i.count, 0),
      info: issues.filter((i) => i.severity === "info").reduce((s, i) => s + i.count, 0),
    };

    return {
      ranAt: new Date().toISOString(),
      ok: issues.length === 0,
      totals,
      issues,
    };
  });
