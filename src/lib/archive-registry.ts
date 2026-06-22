// Unified registry of every archivable domain in the system.
// Each entry: table name, human label, optional dependency map (child table + FK column).
// Used by archive-center.functions, data-health.functions, and archive-purge cron.

export type ArchiveDomain = {
  table: string;
  label: string;
  // Manager can archive; only owner can hard-delete. Some tables (trailers, stores)
  // require owner even to archive — flag as ownerOnly.
  ownerOnlyArchive?: boolean;
  // Display column for naming a row in lists
  nameColumn?: string;
  // Live (non-archived) children that block a hard delete
  deps: Array<{ table: string; column: string; label: string }>;
};

export const ARCHIVE_DOMAINS: ArchiveDomain[] = [
  { table: "sops", label: "SOPs", nameColumn: "title", deps: [
    { table: "sop_versions", column: "sop_id", label: "Versions" },
    { table: "sop_attachments", column: "sop_id", label: "Attachments" },
    { table: "sop_acknowledgements", column: "sop_id", label: "Acknowledgements" },
  ]},
  { table: "hr_document_templates", label: "HR Document Templates", ownerOnlyArchive: true, nameColumn: "title", deps: [
    { table: "hr_document_template_versions", column: "template_id", label: "Versions" },
    { table: "hr_document_assignments", column: "template_id", label: "Sent assignments" },
  ]},
  { table: "task_templates", label: "Task Templates", nameColumn: "title", deps: [
    { table: "tasks", column: "template_id", label: "Generated tasks" },
  ]},
  { table: "schedules", label: "Schedules", nameColumn: "name", deps: [
    { table: "schedule_shifts", column: "schedule_id", label: "Shifts" },
  ]},
  { table: "schedule_shifts", label: "Schedule Shifts", deps: [
    { table: "time_punches", column: "shift_id", label: "Time punches" },
  ]},
  { table: "shift_notes", label: "Shift Notes", deps: [] },
  { table: "shifts", label: "Shifts", deps: [
    { table: "tasks", column: "shift_id", label: "Tasks" },
    { table: "checklist_sessions", column: "shift_id", label: "Checklists" },
    { table: "shift_notes", column: "shift_id", label: "Notes" },
    { table: "time_punches", column: "shift_id", label: "Time punches" },
  ]},
  { table: "tasks", label: "Tasks", nameColumn: "title", deps: [] },
  { table: "checklist_sessions", label: "Checklists", deps: [] },
  { table: "daily_recaps", label: "Daily Recaps", deps: [] },
  { table: "hospitality_incidents", label: "Hospitality Incidents", deps: [] },
  { table: "waste_log", label: "Waste Log", deps: [] },
  { table: "inventory_items", label: "Inventory Items", nameColumn: "name", deps: [
    { table: "inventory_change_requests", column: "item_id", label: "Change requests" },
    { table: "inventory_order_items", column: "item_id", label: "Order line items" },
  ]},
  { table: "inventory_counts", label: "Inventory Counts", deps: [] },
  { table: "inventory_orders", label: "Inventory Orders", deps: [
    { table: "inventory_order_items", column: "order_id", label: "Order items" },
    { table: "inventory_receipts", column: "order_id", label: "Receipts" },
  ]},
  { table: "inventory_order_items", label: "Order Items", deps: [] },
  { table: "inventory_receipts", label: "Order Receipts", deps: [] },
  { table: "inventory_change_requests", label: "Change Requests", deps: [] },
  { table: "alerts", label: "Alerts", nameColumn: "title", deps: [
    { table: "alert_actions", column: "alert_id", label: "Actions" },
  ]},
  { table: "alert_actions", label: "Alert Actions", deps: [] },
  { table: "location_access_requests", label: "Location Access Requests", deps: [] },
  { table: "trailers", label: "Trailers", nameColumn: "name", ownerOnlyArchive: true, deps: [
    { table: "profiles", column: "trailer_id", label: "Profiles" },
    { table: "inventory_items", column: "trailer_id", label: "Inventory items" },
    { table: "schedules", column: "trailer_id", label: "Schedules" },
    { table: "schedule_shifts", column: "trailer_id", label: "Schedule shifts" },
    { table: "time_punches", column: "trailer_id", label: "Time punches" },
    { table: "shifts", column: "trailer_id", label: "Shifts" },
    { table: "cash_drawers", column: "trailer_id", label: "Cash drawers" },
  ]},
  { table: "stores", label: "Stores", nameColumn: "name", ownerOnlyArchive: true, deps: [
    { table: "profiles", column: "store_id", label: "Profiles" },
    { table: "inventory_items", column: "store_id", label: "Inventory items" },
  ]},
  { table: "shift_templates", label: "Shift Templates", nameColumn: "name", deps: [] },
  { table: "time_punches", label: "Time Punches", deps: [] },
  { table: "time_corrections", label: "Time Corrections", deps: [] },
  { table: "time_off_requests", label: "Time-Off Requests", deps: [] },
  { table: "cash_drawers", label: "Cash Drawers", nameColumn: "name", deps: [
    { table: "cash_drawer_sessions", column: "drawer_id", label: "Sessions" },
    { table: "cash_drops", column: "drawer_id", label: "Cash drops" },
  ]},
  { table: "cash_drawer_sessions", label: "Drawer Sessions", deps: [] },
  { table: "cash_drops", label: "Cash Drops", deps: [] },
];

export const DOMAIN_BY_TABLE: Record<string, ArchiveDomain> = Object.fromEntries(
  ARCHIVE_DOMAINS.map((d) => [d.table, d])
);

export const ARCHIVE_TABLES = ARCHIVE_DOMAINS.map((d) => d.table);

// Default retention before nightly purge — overridable per-domain via automation_settings
export const DEFAULT_RETENTION_DAYS = 90;
