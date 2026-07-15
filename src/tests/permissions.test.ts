import { describe, it, expect } from "vitest";

// Pure functions extracted from src/lib/role.tsx for unit testing.
// These don't import React or Supabase so they run in isolation.

type RoleId = "owner" | "manager" | "shift_lead" | "grill" | "prep" | "cashier";
type TabAccess = "none" | "view" | "edit";

const ROLE_RANK: Record<RoleId, number> = {
  owner: 6,
  manager: 5,
  shift_lead: 4,
  grill: 3,
  prep: 2,
  cashier: 1,
};

const RANK: Record<TabAccess, number> = { none: 0, view: 1, edit: 2 };

function pickPrimary(rs: RoleId[]): RoleId | null {
  if (rs.length === 0) return null;
  return [...rs].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
}

function getTabAccess(
  tabKey: string,
  isOwner: boolean,
  tabAccess: Record<string, TabAccess>,
): TabAccess {
  if (isOwner) return "edit";
  return tabAccess[tabKey] ?? "view"; // safe default — never grant unknown tabs
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function canSee(
  roleId: RoleId | null,
  module: "manager" | "analytics" | "hospitality_log",
): boolean {
  if (!roleId) return false;
  if (module === "manager" || module === "analytics")
    return roleId === "owner" || roleId === "manager";
  if (module === "hospitality_log")
    return roleId === "owner" || roleId === "manager" || roleId === "shift_lead";
  return true;
}

// Mirrors the server-side tab access resolution in auth-guards.ts
function resolveTabAccess(
  roles: RoleId[],
  tabKey: string,
  perms: Array<{
    scope_type: "role" | "user";
    scope_id: string;
    access_level: TabAccess;
    enabled: boolean;
  }>,
  userId: string,
): TabAccess {
  if (roles.includes("owner")) return "edit";

  const userRow = perms.find((p) => p.scope_type === "user" && p.scope_id === userId);
  if (userRow) return userRow.enabled ? userRow.access_level : "none";

  const roleRows = perms.filter(
    (p) => p.scope_type === "role" && roles.includes(p.scope_id as RoleId),
  );
  if (roleRows.length > 0) {
    return roleRows.reduce<TabAccess>((best, r) => {
      const lvl: TabAccess = r.enabled ? r.access_level : "none";
      return RANK[lvl] > RANK[best] ? lvl : best;
    }, "none");
  }

  // Fallback baseline
  if (roles.includes("manager")) return "edit";
  if (roles.some((r) => ["shift_lead", "grill", "prep", "cashier"].includes(r))) return "view";
  return "none";
}

// --------------------------------------------------------------------------

describe("pickPrimary", () => {
  it("returns null for empty role list", () => {
    expect(pickPrimary([])).toBeNull();
  });

  it("returns the single role when only one is present", () => {
    expect(pickPrimary(["cashier"])).toBe("cashier");
  });

  it("returns the highest-ranked role", () => {
    expect(pickPrimary(["cashier", "shift_lead", "grill"])).toBe("shift_lead");
    expect(pickPrimary(["manager", "owner"])).toBe("owner");
    expect(pickPrimary(["prep", "manager"])).toBe("manager");
  });
});

describe("getTabAccess", () => {
  it("owners always get edit regardless of tab", () => {
    expect(getTabAccess("inventory", true, {})).toBe("edit");
    expect(getTabAccess("admin", true, { admin: "none" })).toBe("edit");
  });

  it("returns the stored access level when present", () => {
    expect(getTabAccess("inventory", false, { inventory: "edit" })).toBe("edit");
    expect(getTabAccess("analytics", false, { analytics: "view" })).toBe("view");
    expect(getTabAccess("admin", false, { admin: "none" })).toBe("none");
  });

  it("defaults to view (not edit) when tab has no entry — critical security default", () => {
    expect(getTabAccess("some-new-tab", false, {})).toBe("view");
    expect(getTabAccess("unknown-tab", false, { other: "edit" })).toBe("view");
  });
});

describe("resolveTabAccess", () => {
  const uid = "user-123";

  it("owner always gets edit", () => {
    expect(resolveTabAccess(["owner"], "anything", [], uid)).toBe("edit");
  });

  it("user-scoped row takes priority over role-scoped rows", () => {
    const perms = [
      {
        scope_type: "role" as const,
        scope_id: "manager",
        access_level: "edit" as const,
        enabled: true,
      },
      { scope_type: "user" as const, scope_id: uid, access_level: "view" as const, enabled: true },
    ];
    expect(resolveTabAccess(["manager"], "analytics", perms, uid)).toBe("view");
  });

  it("disabled user-scoped row returns none", () => {
    const perms = [
      { scope_type: "user" as const, scope_id: uid, access_level: "edit" as const, enabled: false },
    ];
    expect(resolveTabAccess(["manager"], "analytics", perms, uid)).toBe("none");
  });

  it("takes most permissive across multiple role rows", () => {
    const perms = [
      {
        scope_type: "role" as const,
        scope_id: "shift_lead",
        access_level: "view" as const,
        enabled: true,
      },
      {
        scope_type: "role" as const,
        scope_id: "manager",
        access_level: "edit" as const,
        enabled: true,
      },
    ];
    expect(resolveTabAccess(["manager", "shift_lead"], "labor", perms, uid)).toBe("edit");
  });

  it("crew falls back to view when no explicit permission row exists", () => {
    expect(resolveTabAccess(["cashier"], "schedule", [], uid)).toBe("view");
  });

  it("manager falls back to edit when no explicit permission row exists", () => {
    expect(resolveTabAccess(["manager"], "analytics", [], uid)).toBe("edit");
  });

  it("unknown roles fall back to none", () => {
    expect(resolveTabAccess([] as any, "admin", [], uid)).toBe("none");
  });
});

describe("canSee", () => {
  it("returns false for null role", () => {
    expect(canSee(null, "manager")).toBe(false);
  });

  it("manager module is visible to owner and manager only", () => {
    expect(canSee("owner", "manager")).toBe(true);
    expect(canSee("manager", "manager")).toBe(true);
    expect(canSee("shift_lead", "manager")).toBe(false);
    expect(canSee("cashier", "manager")).toBe(false);
  });

  it("analytics module is visible to owner and manager only", () => {
    expect(canSee("owner", "analytics")).toBe(true);
    expect(canSee("manager", "analytics")).toBe(true);
    expect(canSee("grill", "analytics")).toBe(false);
  });

  it("hospitality_log is visible to owner, manager, and shift_lead", () => {
    expect(canSee("owner", "hospitality_log")).toBe(true);
    expect(canSee("manager", "hospitality_log")).toBe(true);
    expect(canSee("shift_lead", "hospitality_log")).toBe(true);
    expect(canSee("prep", "hospitality_log")).toBe(false);
    expect(canSee("cashier", "hospitality_log")).toBe(false);
  });
});

describe("initials", () => {
  it("returns up to 2 uppercase initials", () => {
    expect(initials("Mario Rodriguez")).toBe("MR");
    expect(initials("Juan")).toBe("J");
    expect(initials("A B C D")).toBe("AB");
  });

  it("handles single word names", () => {
    expect(initials("Chef")).toBe("C");
  });
});
