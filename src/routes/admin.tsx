import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { useRole, type RoleId } from "@/lib/role";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { cn } from "@/lib/utils";
import { EmbeddedProvider } from "@/components/gotham/EmbedShell";
import { Users as UsersIcon, KeyRound, MapPin, ScrollText, HeartPulse, Shield, ChevronRight, Sparkles, SlidersHorizontal, Tablet } from "lucide-react";

import { UsersPage } from "@/routes/users";
import { PermissionsPage } from "@/routes/permissions";
import { LocationRequests } from "@/routes/location-requests";
import { AuditPage } from "@/routes/audit";
import { ChangeLogPage } from "@/routes/change-log";
import { DataHealthPage } from "@/routes/data-health";

type TabKey = "people" | "roles" | "permissions" | "locations" | "devices" | "activity" | "system";

// Admin is OWNER ONLY. Managers operate, owners govern.
const TABS: { key: TabKey; label: string; icon: any; blurb: string }[] = [
  { key: "people",      label: "People",        icon: UsersIcon,    blurb: "Invite crew, set roles, deactivate" },
  { key: "roles",       label: "Roles",         icon: Shield,       blurb: "Role templates and defaults" },
  { key: "permissions", label: "Permissions",   icon: KeyRound,     blurb: "Tab access matrix (advanced)" },
  { key: "locations",   label: "Locations",     icon: MapPin,       blurb: "Approve location access requests" },
  { key: "devices",     label: "Kiosk Devices", icon: Tablet,       blurb: "Trusted iPads for clock in/out" },
  { key: "activity",    label: "Activity",      icon: ScrollText,   blurb: "Audit log and change history" },
  { key: "system",      label: "System Health", icon: HeartPulse,   blurb: "Data integrity and platform health" },
];

const ADMIN_TAB_KEY = "gotham:admin-tab:v1";
const ACTIVITY_SUBTAB_KEY = "gotham:admin-activity-sub:v1";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  validateSearch: (s: Record<string, unknown>) => ({ tab: (s.tab as TabKey | undefined) ?? undefined }),
  head: () => ({ meta: [{ title: "Admin · Gotham OS" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { roleId, loading, session } = useRole();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const isOwner = roleId === "owner";

  const allowed = TABS;

  const initial: TabKey = useMemo(() => {
    const fromUrl = search.tab && allowed.some((t) => t.key === search.tab) ? search.tab : null;
    if (fromUrl) return fromUrl;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(ADMIN_TAB_KEY) as TabKey | null;
      if (saved && allowed.some((t) => t.key === saved)) return saved;
    }
    return allowed[0]?.key ?? "people";
  }, [search.tab, allowed]);

  const [tab, setTab] = useState<TabKey>(initial);

  useEffect(() => {
    if (search.tab && search.tab !== tab && allowed.some((t) => t.key === search.tab)) {
      setTab(search.tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.tab]);

  useEffect(() => {
    try { localStorage.setItem(ADMIN_TAB_KEY, tab); } catch {}
  }, [tab]);

  if (loading || !session || !roleId) return <AppShell><Card>Loading…</Card></AppShell>;
  // Owner-only — managers should never reach this screen.
  if (!isOwner) return <Navigate to="/" />;

  function choose(next: TabKey) {
    setTab(next);
    navigate({ search: { tab: next } as any, replace: true });
  }

  return (
    <AppShell>
      <SectionHeader eyebrow="Administration" title="Admin" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        {allowed.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => choose(t.key)}
              className={cn("text-left rounded-xl border p-3 transition-colors",
                active ? "border-[var(--color-gold)] bg-card" : "border-border bg-card hover:border-foreground/30")}>
              <div className="flex items-center justify-between">
                <Icon className={cn("h-4 w-4", active ? "text-[var(--color-gold)]" : "text-muted-foreground")} />
                {active && <ChevronRight className="h-3 w-3 text-[var(--color-gold)]" />}
              </div>
              <div className="mt-2 text-xs font-semibold uppercase tracking-wide">{t.label}</div>
              <div className="text-[10px] text-muted-foreground line-clamp-2">{t.blurb}</div>
            </button>
          );
        })}
      </div>

      <EmbeddedProvider>
        {tab === "people" && <UsersPage />}
        {tab === "roles" && <RolesTab roleId={roleId} />}
        {tab === "permissions" && <PermissionsPage />}
        {tab === "locations" && <LocationRequests />}
        {tab === "devices" && (
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold flex items-center gap-2"><Tablet className="h-4 w-4" /> Trusted Kiosk Devices</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Register the trailer iPad so employees can only clock in/out from an approved device.
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/trusted-devices" })}>
                Open <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        )}
        {tab === "activity" && <ActivityTab />}
        {tab === "system" && <DataHealthPage />}
      </EmbeddedProvider>
    </AppShell>
  );
}

/* ----------------------------- Roles tab ----------------------------- */

type RoleTemplate = {
  id: "owner" | "manager" | "shift_lead" | "crew";
  label: string;
  tagline: string;
  members: string;
  highlights: string[];
  scope: string;
};

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "owner",
    label: "Owner",
    tagline: "Full access. Sees everything.",
    members: "Founders, partners",
    scope: "All locations · All modules",
    highlights: [
      "Approves orders, schedules, recaps",
      "Manages users, roles, permissions",
      "Reads audit log and analytics",
    ],
  },
  {
    id: "manager",
    label: "Manager",
    tagline: "Runs the shift. Owns the floor.",
    members: "General managers, ops managers",
    scope: "Assigned locations · Operations",
    highlights: [
      "Schedules, labor, inventory orders",
      "Hospitality, SOPs, command center",
      "Cannot edit permissions or roles",
    ],
  },
  {
    id: "shift_lead",
    label: "Shift Lead",
    tagline: "Crew with extra responsibility.",
    members: "Lead grill, lead cashier",
    scope: "Single location · Shift",
    highlights: [
      "Everything crew can do",
      "Hospitality log, schedule visibility",
      "Cannot approve or edit permissions",
    ],
  },
  {
    id: "crew",
    label: "Crew",
    tagline: "Came to work. Tasks first.",
    members: "Cashier, prep, grill",
    scope: "Single location · Shift",
    highlights: [
      "Dashboard, My Tasks, Time Clock",
      "Operations checklist, SOPs, inventory counts",
      "Alerts assigned to them",
    ],
  },
];

function RolesTab({ roleId }: { roleId: RoleId | null }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isOwner = roleId === "owner";

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-[var(--color-gold)] mt-0.5" />
            <div>
              <div className="font-display text-lg">Role templates</div>
              <div className="text-sm text-muted-foreground">Most teams stick with these four. Custom permissions are available in advanced mode.</div>
            </div>
          </div>
          {isOwner && (
            <Button size="sm" variant={showAdvanced ? "default" : "outline"} onClick={() => setShowAdvanced((v) => !v)}>
              <SlidersHorizontal className="h-3 w-3 mr-1" />
              {showAdvanced ? "Hide advanced" : "Advanced mode"}
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ROLE_TEMPLATES.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-lg">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.tagline}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-secondary text-foreground/70">{t.id}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <div className="uppercase tracking-wide text-muted-foreground">Typical</div>
                <div className="text-foreground/80">{t.members}</div>
              </div>
              <div>
                <div className="uppercase tracking-wide text-muted-foreground">Scope</div>
                <div className="text-foreground/80">{t.scope}</div>
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-foreground/80">
              {t.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2">
                  <span className="mt-1 h-1 w-1 rounded-full bg-[var(--color-gold)] shrink-0" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {showAdvanced && (
        <Card>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="font-semibold text-sm">Advanced permissions matrix</div>
              <div className="text-xs text-muted-foreground">Override tab access per role or per user — only if templates don't fit.</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => {
              const ev = new CustomEvent("gotham:admin-go", { detail: { tab: "permissions" } });
              window.dispatchEvent(ev);
            }}>Open matrix editor</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/* --------------------------- Activity tab --------------------------- */

function ActivityTab() {
  const [sub, setSub] = useState<"audit" | "changes">(() => {
    if (typeof window === "undefined") return "audit";
    return (localStorage.getItem(ACTIVITY_SUBTAB_KEY) as any) ?? "audit";
  });
  useEffect(() => { try { localStorage.setItem(ACTIVITY_SUBTAB_KEY, sub); } catch {} }, [sub]);

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border border-border bg-background p-0.5">
        {(["audit", "changes"] as const).map((s) => (
          <button key={s} onClick={() => setSub(s)}
            className={cn("px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded",
              sub === s ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "text-muted-foreground hover:text-foreground")}>
            {s === "audit" ? "Audit log" : "Change log"}
          </button>
        ))}
      </div>
      {sub === "audit" ? <AuditPage /> : <ChangeLogPage />}
    </div>
  );
}
