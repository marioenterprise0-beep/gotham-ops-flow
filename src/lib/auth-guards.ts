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

async function getRoles(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role as string);
}

export async function requireManager(supabase: any, userId: string) {
  const roles = await getRoles(supabase, userId);
  if (!roles.some((r) => r === "owner" || r === "manager")) {
    throw new Error("Manager role required");
  }
}

export async function requireOwner(supabase: any, userId: string) {
  const roles = await getRoles(supabase, userId);
  if (!roles.includes("owner")) {
    throw new Error("Owner role required");
  }
}

export async function isOwner(supabase: any, userId: string): Promise<boolean> {
  const roles = await getRoles(supabase, userId);
  return roles.includes("owner");
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
  const roles = await getRoles(supabase, userId);
  if (roles.includes("owner")) return;

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
    else if (roles.some((r) => ["shift_lead", "grill", "prep", "cashier"].includes(r))) effective = "view";
    else effective = "none";
  }

  if (LEVEL_RANK[effective ?? "none"] < LEVEL_RANK[required]) {
    throw new Error(`Access denied for ${tabKey} (need ${required})`);
  }
}
