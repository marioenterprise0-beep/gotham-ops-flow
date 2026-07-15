// Shared role + tab-permission gates for server functions. Use after the
// `requireSupabaseAuth` middleware so `context.supabase` is the authenticated
// client and `context.userId` is the verified bearer subject.
//
// These helpers fail fast with a clear error so endpoints can't be reached by
// crafted client calls even when the UI hides the button. RLS at the database
// layer is the second line of defense.

export type TabAccessLevel = "none" | "view" | "edit";

const LEVEL_RANK: Record<TabAccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
};

// All role checks are scoped to the caller's active organization via the
// pre-request GUC `app.active_organization_id` (set by public.set_active_org_context).
// The 2-arg RPC wrappers (is_manager(uid), has_role(uid, role)) filter user_roles
// by that GUC, so a user with a role in a different org cannot pass these gates.
export async function requireManager(supabase: any, userId: string) {
  const { data: mgr } = await supabase.rpc("is_manager", { _user_id: userId });
  if (mgr !== true) throw new Error("Manager role required");
}

export async function requireOwner(supabase: any, userId: string) {
  const { data: own } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (own !== true) throw new Error("Owner role required");
}

export async function isOwner(supabase: any, userId: string): Promise<boolean> {
  const { data: own } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
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
  tabKey: string,
  required: TabAccessLevel = "edit",
) {
  // Owner bypass, org-scoped.
  const { data: own } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (own === true) return;

  // Fetch the caller's roles for the active org only (RLS on user_roles
  // allows any org the caller belongs to, so we use an org-scoped RPC).
  const { data: activeRoles } = await supabase.rpc("my_active_org_roles");
  const roles: string[] = (activeRoles ?? []) as string[];

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
