// Shared role + tab-permission gates for server functions. Use after the
// `requireActiveOrg` middleware chain so `context.supabase` is the
// authenticated client, `context.userId` is the verified bearer subject,
// and `context.activeOrgId` is the caller's active organization.
//
// Every helper takes an explicit `orgId` and calls the 3-arg / 2-arg
// org-scoped RPCs (`has_role(_user_id,_org_id,_role)`,
// `is_manager(_user_id,_org_id)`). The legacy 1-arg / 2-arg overloads
// (uid-only) are being dropped from the DB after this sweep — do not
// re-introduce callers to them.
//
// RLS at the database layer is the second line of defense.

export type TabAccessLevel = "none" | "view" | "edit";

const LEVEL_RANK: Record<TabAccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
};

export async function requireManager(supabase: any, userId: string, orgId: string) {
  const { data: mgr } = await supabase.rpc("is_manager", {
    _user_id: userId,
    _org_id: orgId,
  });
  if (mgr !== true) throw new Error("Manager role required");
}

export async function requireOwner(supabase: any, userId: string, orgId: string) {
  const { data: own } = await supabase.rpc("has_role", {
    _user_id: userId,
    _org_id: orgId,
    _role: "owner",
  });
  if (own !== true) throw new Error("Owner role required");
}

export async function isOwner(
  supabase: any,
  userId: string,
  orgId: string,
): Promise<boolean> {
  const { data: own } = await supabase.rpc("has_role", {
    _user_id: userId,
    _org_id: orgId,
    _role: "owner",
  });
  return own === true;
}

// Enforces tab-level permission for the requesting user.
//
// Resolution order (highest precedence first):
//   1. Owner role → always allowed.
//   2. Explicit user-scoped row in `tab_permissions` for this tab.
//   3. Most permissive role-scoped row across the user's roles.
//   4. Fallback: managers get "edit", crew get "view".
//
// `required` is the minimum level the caller needs. "edit" for mutations,
// "view" for reads that need protection beyond standard auth.
export async function requireTabAccess(
  supabase: any,
  userId: string,
  orgId: string,
  tabKey: string,
  required: TabAccessLevel = "edit",
) {
  // Owner bypass, org-scoped via explicit 3-arg call.
  const { data: own } = await supabase.rpc("has_role", {
    _user_id: userId,
    _org_id: orgId,
    _role: "owner",
  });
  if (own === true) return;

  // Fetch the caller's roles in the active org via an explicit filter — no
  // reliance on a session GUC and no dependency on the (going-away) helper
  // `my_active_org_roles`. RLS on `user_roles` still applies as the caller.
  const { data: roleRowsRaw } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId);
  const roles: string[] = ((roleRowsRaw ?? []) as Array<{ role: string }>).map(
    (r) => r.role,
  );

  const { data: perms } = await supabase
    .from("tab_permissions")
    .select("scope_type, scope_id, tab_key, enabled, access_level")
    .eq("tab_key", tabKey);

  const rows = perms ?? [];
  const userRow = rows.find((p: any) => p.scope_type === "user" && p.scope_id === userId);
  const roleRows = rows.filter((p: any) => p.scope_type === "role" && roles.includes(p.scope_id));

  let effective: TabAccessLevel | null = null;
  if (userRow) {
    effective = userRow.enabled ? (userRow.access_level as TabAccessLevel) : "none";
  } else if (roleRows.length > 0) {
    // Most permissive across the user's roles
    for (const r of roleRows) {
      const lvl: TabAccessLevel = r.enabled ? (r.access_level as TabAccessLevel) : "none";
      if (effective === null || LEVEL_RANK[lvl] > LEVEL_RANK[effective]) effective = lvl;
    }
  } else {
    // No explicit row → fall back to role baseline
    if (roles.includes("manager")) effective = "edit";
    else if (roles.some((r) => ["shift_lead", "grill", "prep", "cashier"].includes(r)))
      effective = "view";
    else effective = "none";
  }

  if (LEVEL_RANK[effective ?? "none"] < LEVEL_RANK[required]) {
    throw new Error(`Access denied for ${tabKey} (need ${required})`);
  }
}
