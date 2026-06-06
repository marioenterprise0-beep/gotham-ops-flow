import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type RoleId = "owner" | "manager" | "shift_lead" | "grill" | "prep" | "cashier";

export const ROLES: Record<RoleId, { id: RoleId; name: string; short: string; blurb: string; color: string }> = {
  owner:      { id: "owner",      name: "Owner",            short: "OW", blurb: "Full visibility across all stores and KPIs.",            color: "#C9973A" },
  manager:    { id: "manager",    name: "Manager",          short: "MG", blurb: "Approvals, analytics, crew oversight.",                   color: "#C0392B" },
  shift_lead: { id: "shift_lead", name: "Shift Lead",       short: "SL", blurb: "Runs the shift. Signs off opening & closing.",           color: "#C9973A" },
  grill:      { id: "grill",      name: "Grill Master",     short: "GR", blurb: "Owns the flat top. Smash standard & temps.",             color: "#8B4513" },
  prep:       { id: "prep",       name: "Prep",             short: "PR", blurb: "Mise en place, thaw protocol, stock.",                   color: "#2D6CDF" },
  cashier:    { id: "cashier",    name: "Cashier / Front",  short: "CA", blurb: "Greet, take orders, drinks, packaging.",                 color: "#7B3FA0" },
};

const ROLE_RANK: Record<RoleId, number> = { owner: 6, manager: 5, shift_lead: 4, grill: 3, prep: 2, cashier: 1 };

export type Trailer = { id: string; name: string };

type Ctx = {
  loading: boolean;
  session: Session | null;
  roleId: RoleId | null;
  roles: RoleId[];
  user: string;
  userId: string | null;
  homeTrailerId: string | null;
  trailers: Trailer[];
  trailerScope: string | null;
  setTrailerScope: (id: string | null) => void;
  setRoleId: (r: RoleId | null) => void;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  disabledTabs: Set<string>;
  refreshPermissions: () => Promise<void>;
};

const RoleCtx = createContext<Ctx | null>(null);

function pickPrimary(rs: RoleId[]): RoleId | null {
  if (rs.length === 0) return null;
  return [...rs].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleId[]>([]);
  const [user, setUser] = useState<string>("Crew");
  const [homeTrailerId, setHomeTrailerId] = useState<string | null>(null);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [trailerScope, setTrailerScopeState] = useState<string | null>(null);
  const [disabledTabs, setDisabledTabs] = useState<Set<string>>(new Set());

  const loadProfileAndRoles = async (uid: string) => {
    const [{ data: roleRows }, { data: profile }, { data: trailerRows }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("display_name, trailer_id").eq("id", uid).maybeSingle(),
      supabase.from("trailers").select("id, name").eq("active", true).order("name"),
    ]);
    const rs = ((roleRows ?? []) as { role: RoleId }[]).map((r) => r.role);
    setRoles(rs);
    if (profile?.display_name) setUser(profile.display_name);
    const tid = (profile as any)?.trailer_id ?? null;
    setHomeTrailerId(tid);
    setTrailers((trailerRows ?? []) as Trailer[]);
    // Initialize scope: crew locked to home; managers default to home (can switch to others or Company)
    setTrailerScopeState(tid);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => { loadProfileAndRoles(s.user.id); }, 0);
        if (event === "SIGNED_IN") {
          setTimeout(() => {
            void supabase.from("access_log").insert({
              user_id: s.user.id, event: "login",
              user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
            });
            void supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", s.user.id);
          }, 0);
        }
      } else {
        setRoles([]); setUser("Crew"); setHomeTrailerId(null); setTrailers([]); setTrailerScopeState(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadProfileAndRoles(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshRoles = async () => {
    if (session?.user) await loadProfileAndRoles(session.user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const primary = pickPrimary(roles);
  const isManager = primary === "owner" || primary === "manager";

  const setTrailerScope = (id: string | null) => {
    // Crew can only operate on their home trailer
    if (!isManager) { setTrailerScopeState(homeTrailerId); return; }
    setTrailerScopeState(id);
  };

  return (
    <RoleCtx.Provider value={{
      loading,
      session,
      roleId: primary,
      roles,
      user,
      userId: session?.user?.id ?? null,
      homeTrailerId,
      trailers,
      trailerScope: isManager ? trailerScope : homeTrailerId,
      setTrailerScope,
      setRoleId: () => { void signOut(); },
      signOut,
      refreshRoles,
    }}>{children}</RoleCtx.Provider>
  );
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
