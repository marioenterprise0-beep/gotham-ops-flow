import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type RoleId = "owner" | "manager" | "shift_lead" | "grill" | "prep" | "cashier";

export const ROLES: Record<RoleId, { id: RoleId; name: string; short: string; blurb: string; color: string }> = {
  owner:      { id: "owner",      name: "Owner",            short: "OW", blurb: "Full visibility across all stores and KPIs.",            color: "#C9973A" },
  manager:    { id: "manager",    name: "Manager",          short: "MG", blurb: "Approvals, analytics, crew oversight.",                   color: "#C0392B" },
  shift_lead: { id: "shift_lead", name: "Shift Lead",       short: "SL", blurb: "Runs the shift. Signs off opening & closing.",           color: "#C9973A" },
  grill:      { id: "grill",      name: "Grill Master",     short: "GR", blurb: "Owns the flat top. Smash standard & temps.",             color: "#8B4513" },
  prep:       { id: "prep",       name: "Prep",             short: "PR", blurb: "Mise en place, thaw protocol, stock.",                   color: "#2D6CDF" },
  cashier:    { id: "cashier",    name: "Cashier / Front",  short: "CA", blurb: "Greet, take orders, drinks, packaging.",                 color: "#7B3FA0" },
};

type Ctx = {
  roleId: RoleId | null;
  setRoleId: (r: RoleId | null) => void;
  user: string;
  setUser: (n: string) => void;
};

const RoleCtx = createContext<Ctx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [roleId, setRole] = useState<RoleId | null>(null);
  const [user, setUserState] = useState<string>("Marcus T.");

  useEffect(() => {
    try {
      const r = localStorage.getItem("gotham:role") as RoleId | null;
      const u = localStorage.getItem("gotham:user");
      if (r) setRole(r);
      if (u) setUserState(u);
    } catch {}
  }, []);

  const setRoleId = (r: RoleId | null) => {
    setRole(r);
    try { r ? localStorage.setItem("gotham:role", r) : localStorage.removeItem("gotham:role"); } catch {}
  };
  const setUser = (n: string) => {
    setUserState(n);
    try { localStorage.setItem("gotham:user", n); } catch {}
  };

  return <RoleCtx.Provider value={{ roleId, setRoleId, user, setUser }}>{children}</RoleCtx.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleCtx);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}

export function canSee(roleId: RoleId | null, module: "manager" | "analytics" | "hospitality_log") {
  if (!roleId) return false;
  if (module === "manager" || module === "analytics") return roleId === "owner" || roleId === "manager";
  if (module === "hospitality_log") return roleId === "owner" || roleId === "manager" || roleId === "shift_lead";
  return true;
}

export function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
