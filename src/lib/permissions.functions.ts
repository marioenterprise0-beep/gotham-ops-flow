import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => r.role === "owner");
  if (!ok) throw new Error("Owner role required");
}

export const listAllTabPermissions = createServerFn({ method: "GET" })
  .middleware([requireActiveOrg])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const [{ data: perms }, { data: profiles }, { data: roles }] = await Promise.all([
      context.supabase
        .from("tab_permissions")
        .select("id, scope_type, scope_id, tab_key, enabled, access_level, updated_at"),
      context.supabase.from("profiles").select("id, display_name"),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    return {
      perms: perms ?? [],
      profiles: profiles ?? [],
      roles: roles ?? [],
    };
  });

export const listMyTabPermissions = createServerFn({ method: "GET" })
  .middleware([requireActiveOrg])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    const { data: perms } = await supabase
      .from("tab_permissions")
      .select("scope_type, scope_id, tab_key, enabled, access_level");
    const mine = (perms ?? []).filter(
      (p: any) =>
        (p.scope_type === "user" && p.scope_id === userId) ||
        (p.scope_type === "role" && roles.includes(p.scope_id)),
    );
    return mine;
  });

export const setTabPermission = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        scopeType: z.enum(["role", "user"]),
        scopeId: z.string().min(1).max(80),
        tabKey: z.string().min(1).max(60),
        accessLevel: z.enum(["none", "view", "edit"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("tab_permissions").upsert(
      {
        scope_type: data.scopeType,
        scope_id: data.scopeId,
        tab_key: data.tabKey,
        enabled: data.accessLevel !== "none",
        access_level: data.accessLevel,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "scope_type,scope_id,tab_key" },
    );
    if (error) throw error;
    return { ok: true };
  });

// Default tab access by role. Tabs not listed default to "edit" for managers/owner
// and effectively whatever the role row says. Crew roles (grill/prep/cashier) share
// the same preset.
export const ROLE_PRESETS: Record<string, Record<string, "none" | "view" | "edit">> = {
  owner: {
    dashboard: "edit",
    "my-tasks": "edit",
    "time-clock": "edit",
    operations: "edit",
    recaps: "edit",
    schedule: "edit",
    labor: "edit",
    inventory: "edit",
    "order-guide": "edit",
    sops: "edit",
    hospitality: "edit",
    health: "edit",
    alerts: "edit",
    cash: "edit",
    manager: "edit",
    users: "edit",
    audit: "edit",
    "change-log": "edit",
    analytics: "edit",
    settings: "edit",
  },
  manager: {
    dashboard: "edit",
    "my-tasks": "edit",
    "time-clock": "edit",
    operations: "edit",
    recaps: "edit",
    schedule: "edit",
    labor: "edit",
    inventory: "edit",
    "order-guide": "edit",
    sops: "edit",
    hospitality: "edit",
    health: "edit",
    alerts: "edit",
    cash: "edit",
    manager: "edit",
    users: "edit",
    audit: "view",
    "change-log": "view",
    analytics: "edit",
    settings: "view",
  },
  shift_lead: {
    dashboard: "edit",
    "my-tasks": "edit",
    "time-clock": "edit",
    operations: "edit",
    recaps: "edit",
    schedule: "view",
    labor: "view",
    inventory: "edit",
    "order-guide": "view",
    sops: "view",
    hospitality: "edit",
    health: "view",
    alerts: "view",
    cash: "edit",
    manager: "none",
    users: "none",
    audit: "none",
    "change-log": "none",
    analytics: "none",
    settings: "none",
  },
  // Crew preset — applied to grill, prep, cashier
  crew: {
    dashboard: "view",
    "my-tasks": "edit",
    "time-clock": "edit",
    operations: "view",
    recaps: "none",
    schedule: "view",
    labor: "none",
    inventory: "view",
    "order-guide": "none",
    sops: "view",
    hospitality: "view",
    health: "none",
    alerts: "view",
    cash: "edit",
    manager: "none",
    users: "none",
    audit: "none",
    "change-log": "none",
    analytics: "none",
    settings: "none",
  },
};

export const applyDefaultPresets = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ overwrite: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await assertOwner(context.supabase, context.userId);
    const roleMap: Record<string, Record<string, "none" | "view" | "edit">> = {
      owner: ROLE_PRESETS.owner,
      manager: ROLE_PRESETS.manager,
      shift_lead: ROLE_PRESETS.shift_lead,
      grill: ROLE_PRESETS.crew,
      prep: ROLE_PRESETS.crew,
      cashier: ROLE_PRESETS.crew,
    };

    let existing: any[] = [];
    if (!data.overwrite) {
      const { data: existingRows } = await context.supabase
        .from("tab_permissions")
        .select("scope_type, scope_id, tab_key")
        .eq("scope_type", "role");
      existing = existingRows ?? [];
    }
    const existingKey = new Set(existing.map((p) => `${p.scope_id}|${p.tab_key}`));

    const rows: any[] = [];
    for (const [roleId, tabs] of Object.entries(roleMap)) {
      for (const [tabKey, level] of Object.entries(tabs)) {
        if (!data.overwrite && existingKey.has(`${roleId}|${tabKey}`)) continue;
        rows.push({
          scope_type: "role",
          scope_id: roleId,
          tab_key: tabKey,
          enabled: level !== "none",
          access_level: level,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        });
      }
    }
    if (rows.length === 0) return { ok: true, applied: 0 };
    const { error } = await context.supabase
      .from("tab_permissions")
      .upsert(rows, { onConflict: "scope_type,scope_id,tab_key" });
    if (error) throw error;
    return { ok: true, applied: rows.length };
  });

// ---------------------------------------------------------------------------
// Email routing policy: which alert categories get emailed to each role
// ---------------------------------------------------------------------------

export const EMAIL_CATEGORIES = [
  "critical",
  "operations",
  "schedule",
  "time_clock",
  "inventory",
  "cash",
  "training",
  "announcements",
] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

// Defaults mirror the migration seed so "Apply defaults" stays consistent.
export const EMAIL_POLICY_DEFAULTS: Record<string, Record<EmailCategory, boolean>> = {
  owner: {
    critical: true,
    operations: true,
    schedule: true,
    time_clock: true,
    inventory: true,
    cash: true,
    training: true,
    announcements: true,
  },
  manager: {
    critical: true,
    operations: true,
    schedule: true,
    time_clock: true,
    inventory: true,
    cash: true,
    training: true,
    announcements: true,
  },
  shift_lead: {
    critical: true,
    operations: true,
    schedule: true,
    time_clock: true,
    inventory: true,
    cash: true,
    training: true,
    announcements: true,
  },
  grill: {
    critical: true,
    operations: true,
    schedule: true,
    time_clock: true,
    inventory: true,
    cash: false,
    training: true,
    announcements: true,
  },
  prep: {
    critical: true,
    operations: true,
    schedule: true,
    time_clock: true,
    inventory: true,
    cash: false,
    training: true,
    announcements: true,
  },
  cashier: {
    critical: true,
    operations: false,
    schedule: true,
    time_clock: true,
    inventory: false,
    cash: true,
    training: true,
    announcements: true,
  },
};

export const listRoleEmailPolicies = createServerFn({ method: "GET" })
  .middleware([requireActiveOrg])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("role_email_policies" as any)
      .select("role, category, enabled");
    if (error) throw error;
    return {
      policies: (data ?? []) as unknown as { role: string; category: string; enabled: boolean }[],
    };
  });

export const setRoleEmailPolicy = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        role: z.enum(["owner", "manager", "shift_lead", "grill", "prep", "cashier"]),
        category: z.enum(EMAIL_CATEGORIES),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("role_email_policies" as any).upsert(
      {
        role: data.role,
        category: data.category,
        enabled: data.enabled,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "role,category" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const applyEmailPolicyDefaults = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ overwrite: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await assertOwner(context.supabase, context.userId);
    let existing: { role: string; category: string }[] = [];
    if (!data.overwrite) {
      const { data: rows } = await context.supabase
        .from("role_email_policies" as any)
        .select("role, category");
      existing = (rows ?? []) as any[];
    }
    const has = new Set(existing.map((r) => `${r.role}|${r.category}`));
    const upserts: any[] = [];
    for (const [role, cats] of Object.entries(EMAIL_POLICY_DEFAULTS)) {
      for (const [category, enabled] of Object.entries(cats)) {
        if (!data.overwrite && has.has(`${role}|${category}`)) continue;
        upserts.push({
          role,
          category,
          enabled,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        });
      }
    }
    if (upserts.length === 0) return { ok: true, applied: 0 };
    const { error } = await context.supabase
      .from("role_email_policies" as any)
      .upsert(upserts, { onConflict: "role,category" });
    if (error) throw error;
    return { ok: true, applied: upserts.length };
  });
