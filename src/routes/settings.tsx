import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, RoleBadge } from "@/components/gotham/primitives";
import { getMyProfile, updateMyProfile, updateStoreInfo } from "@/lib/settings.functions";
import { getAutomationSettings, updateAutomationSettings, listRolloverRuns } from "@/lib/automation.functions";
import { GeofencePanel } from "@/components/gotham/geofence-panel";
import {
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/notifications.functions";
import { syncDomains } from "@/lib/sync-bus";
import { useRole, ROLES } from "@/lib/role";
import { useBranding, refreshBranding, applyThemeColors } from "@/lib/branding";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { Bell, BellOff, LogOut, Mail, Save, Zap } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Settings · Dip N Shake OS" }] }),
  component: Settings,
});

function Settings() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { signOut, roleId, refreshRoles } = useRole();
  const isMgr = roleId === "owner" || roleId === "manager";

  const fetchProfile = useServerFn(getMyProfile);
  const updateProfile = useServerFn(updateMyProfile);
  const updateStore = useServerFn(updateStoreInfo);

  const { data } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });

  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeLoc, setStoreLoc] = useState("");
  const [storeShort, setStoreShort] = useState("");
  const [storeTagline, setStoreTagline] = useState("");
  const [storeSupportEmail, setStoreSupportEmail] = useState("");
  // Defaults mirror the current app theme (see :root in src/styles.css) so the
  // pickers reflect what the user actually sees when no color is saved yet.
  const [bgColor, setBgColor] = useState("#08090B");
  const [fgColor, setFgColor] = useState("#F5F5F4");
  const [accentColor, setAccentColor] = useState("#22C55E");
  const [livePreview, setLivePreview] = useState(false);

  // When live preview is on, push the current pickers to the global CSS vars.
  // When it turns off, reload the saved branding so the app reverts cleanly.
  useEffect(() => {
    if (!livePreview) return;
    applyThemeColors({ bgColor, fgColor, accentColor });
  }, [livePreview, bgColor, fgColor, accentColor]);

  useEffect(() => {
    if (livePreview) return;
    // Turned off (or never on) — sync back to saved values.
    refreshBranding();
  }, [livePreview]);

  // Ensure the live preview doesn't persist when leaving the page.
  useEffect(() => () => { if (livePreview) refreshBranding(); }, [livePreview]);

  useEffect(() => {
    if (data?.profile?.display_name) setName(data.profile.display_name);
    if (data?.store) {
      setStoreName(data.store.name ?? "");
      setStoreLoc(data.store.location ?? "");
      setStoreShort((data.store as any).short_name ?? "");
      setStoreTagline((data.store as any).tagline ?? "");
      setStoreSupportEmail((data.store as any).support_email ?? "");
      if ((data.store as any).bg_color) setBgColor((data.store as any).bg_color);
      if ((data.store as any).fg_color) setFgColor((data.store as any).fg_color);
      if ((data.store as any).accent_color) setAccentColor((data.store as any).accent_color);
    }
  }, [data]);

  const saveProfile = useMutation({
    mutationFn: () => updateProfile({ data: { displayName: name.trim() } }),
    onSuccess: () => { toast.success("Profile saved"); syncDomains(qc, "profiles", "users"); refreshRoles(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveStore = useMutation({
    mutationFn: () => updateStore({ data: {
      storeId: data!.store!.id,
      name: storeName.trim(),
      location: storeLoc.trim() || undefined,
      shortName: storeShort.trim() || null,
      tagline: storeTagline.trim() || null,
      supportEmail: storeSupportEmail.trim() || null,
      bgColor,
      fgColor,
      accentColor,
    } }),
    onSuccess: () => {
      toast.success("Branding saved");
      syncDomains(qc, "profiles");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      refreshBranding();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <SectionHeader eyebrow="Account" title="Your Profile" />
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <div className="label-caps text-muted-foreground mb-1">Display name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
          </div>
          <button disabled={!name.trim() || saveProfile.isPending} onClick={() => saveProfile.mutate()}
            className="h-10 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-4 text-xs font-semibold uppercase tracking-[1.2px] inline-flex items-center gap-2 disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Role:</span>
          {roleId ? <RoleBadge role={ROLES[roleId].name} /> : <span className="text-muted-foreground">No role</span>}
        </div>
        {data?.profile?.created_at && (
          <div className="mt-2 text-xs text-muted-foreground">Member since {new Date(data.profile.created_at).toLocaleDateString()}</div>
        )}
      </Card>

      {isMgr && data?.store && (
        <>
          <SectionHeader eyebrow="Branding" title="Organization Branding" />
          <Card>
            <div className="space-y-3">
              <div>
                <div className="label-caps text-muted-foreground mb-1">Organization name</div>
                <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. Acme Coffee Co." className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
                <div className="mt-1 text-[11px] text-muted-foreground">Full name shown on invoices and PDFs.</div>
              </div>
              <div>
                <div className="label-caps text-muted-foreground mb-1">Short name / wordmark</div>
                <input value={storeShort} onChange={(e) => setStoreShort(e.target.value)} maxLength={40} placeholder="e.g. ACME" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
                <div className="mt-1 text-[11px] text-muted-foreground">Displayed in the top header, sign-in page, and browser tab.</div>
              </div>
              <div>
                <div className="label-caps text-muted-foreground mb-1">Tagline</div>
                <input value={storeTagline} onChange={(e) => setStoreTagline(e.target.value)} maxLength={200} placeholder="Short line shown on the sign-in page." className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
              </div>
              <div>
                <div className="label-caps text-muted-foreground mb-1">Support email</div>
                <input type="email" value={storeSupportEmail} onChange={(e) => setStoreSupportEmail(e.target.value)} placeholder="ops@yourcompany.com" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
              </div>
              <div>
                <div className="label-caps text-muted-foreground mb-1">Primary location / address</div>
                <input value={storeLoc} onChange={(e) => setStoreLoc(e.target.value)} placeholder="e.g. 6th Ave & W 53rd St" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
              </div>
              <div className="pt-3 mt-3 border-t border-border">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-semibold mb-1">Theme colors</div>
                    <div className="text-[11px] text-muted-foreground">Applied instantly across every page for all users.</div>
                  </div>
                  <LivePreviewToggle
                    active={livePreview}
                    onToggle={() => setLivePreview((v) => !v)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ColorField label="Background" value={bgColor} onChange={setBgColor} />
                  <ColorField label="Text" value={fgColor} onChange={setFgColor} />
                  <ColorField label="Accent" value={accentColor} onChange={setAccentColor} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PresetButton label="Midnight Green" onClick={() => { setBgColor("#08090B"); setFgColor("#F5F5F4"); setAccentColor("#22C55E"); }} />
                  <PresetButton label="Midnight Gold" onClick={() => { setBgColor("#08090B"); setFgColor("#F5F5F4"); setAccentColor("#EAB308"); }} />
                  <PresetButton label="Slate" onClick={() => { setBgColor("#0F172A"); setFgColor("#E2E8F0"); setAccentColor("#3B82F6"); }} />
                  <PresetButton label="Espresso" onClick={() => { setBgColor("#1C1917"); setFgColor("#FAFAF9"); setAccentColor("#F97316"); }} />
                  <PresetButton label="Paper" onClick={() => { setBgColor("#FAFAF9"); setFgColor("#0A0A0A"); setAccentColor("#EF4444"); }} />
                </div>
                <ContrastReport bg={bgColor} fg={fgColor} accent={accentColor} />
                <ThemePreview
                  bg={bgColor}
                  fg={fgColor}
                  accent={accentColor}
                  orgName={storeName || "Your Organization"}
                  shortName={storeShort || storeName || "Ops"}
                  tagline={storeTagline || "Internal operating system for your team."}
                />
                <DevicePreview
                  bg={bgColor}
                  fg={fgColor}
                  accent={accentColor}
                  orgName={storeName || "Your Organization"}
                  shortName={storeShort || storeName || "Ops"}
                />
              </div>
              <div className="flex justify-end">
                <button disabled={!storeName.trim() || saveStore.isPending} onClick={() => saveStore.mutate()}
                  className="h-10 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-4 text-xs font-semibold uppercase tracking-[1.2px] inline-flex items-center gap-2 disabled:opacity-50">
                  <Save className="h-3.5 w-3.5" /> Save branding
                </button>
              </div>
            </div>
          </Card>
        </>
      )}

      <PushNotificationsPanel />
      <NotificationsPanel />

      {roleId === "owner" && <AutomationPanel />}
      {roleId === "owner" && <GeofencePanel />}

      <SectionHeader eyebrow="Session" title="Sign out" />
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">End your session on this device.</div>
          <button onClick={async () => { await signOut(); nav({ to: "/auth" }); }}
            className="h-10 rounded-md border border-border px-4 text-xs font-semibold uppercase tracking-[1.2px] inline-flex items-center gap-2 hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </Card>

      <div className="h-6" />
    </AppShell>
  );
}

function AutomationPanel() {
  return _AutomationPanel();
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <div>
      <div className="label-caps text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-md border border-border bg-card cursor-pointer p-1"
          aria-label={`${label} color`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          placeholder="#000000"
          className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm font-mono uppercase"
        />
      </div>
    </div>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded-md border border-border px-3 text-xs font-semibold uppercase tracking-[1px] hover:border-[var(--color-gold)]"
    >
      {label}
    </button>
  );
}

function LivePreviewToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={active}
      aria-label="Live preview across app shell"
      className={`shrink-0 inline-flex items-center gap-2 h-8 px-3 rounded-md border text-[11px] font-semibold uppercase tracking-[1px] transition-colors ${
        active
          ? "border-[var(--color-gold)] text-[var(--color-gold)] bg-[var(--color-gold)]/10"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-[var(--color-gold)] animate-pulse" : "bg-muted-foreground"
        }`}
        aria-hidden="true"
      />
      Live preview {active ? "on" : "off"}
    </button>
  );
}

// ---------- WCAG contrast utilities ----------
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}
function relLum({ r, g, b }: { r: number; g: number; b: number }) {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}
function contrastRatio(a: string, b: string): number | null {
  const ra = hexToRgb(a); const rb = hexToRgb(b);
  if (!ra || !rb) return null;
  const la = relLum(ra); const lb = relLum(rb);
  const [lo, hi] = la < lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

type Rating = { level: "AAA" | "AA" | "AA Large" | "Fail"; tone: "ok" | "warn" | "bad" };
function rate(ratio: number): Rating {
  if (ratio >= 7) return { level: "AAA", tone: "ok" };
  if (ratio >= 4.5) return { level: "AA", tone: "ok" };
  if (ratio >= 3) return { level: "AA Large", tone: "warn" };
  return { level: "Fail", tone: "bad" };
}

function ContrastReport({ bg, fg, accent }: { bg: string; fg: string; accent: string }) {
  const pairs: Array<{ label: string; a: string; b: string; hint: string }> = [
    { label: "Text on background", a: fg, b: bg, hint: "Body copy readability" },
    { label: "Accent on background", a: accent, b: bg, hint: "Buttons, links, focus rings" },
    { label: "Text on accent", a: fg, b: accent, hint: "Text inside accent-filled buttons" },
  ];
  const anyFail = pairs.some((p) => {
    const r = contrastRatio(p.a, p.b);
    return r !== null && r < 4.5;
  });
  return (
    <div className="mt-4 rounded-md border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">
          Contrast check (WCAG 2.1)
        </div>
        {anyFail && (
          <span className="text-[10px] font-semibold uppercase tracking-[1px] text-[var(--color-danger,#ef4444)]">
            Accessibility warning
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {pairs.map((p) => {
          const ratio = contrastRatio(p.a, p.b);
          const rating = ratio !== null ? rate(ratio) : null;
          const toneClass =
            rating?.tone === "ok"
              ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
              : rating?.tone === "warn"
              ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
              : "bg-red-500/15 text-red-500 border-red-500/30";
          return (
            <li key={p.label} className="flex items-center gap-3">
              <div
                className="h-9 w-16 shrink-0 rounded-md border border-border flex items-center justify-center text-[11px] font-semibold"
                style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(p.b) ? p.b : undefined, color: /^#[0-9a-fA-F]{6}$/.test(p.a) ? p.a : undefined }}
                aria-hidden="true"
              >
                Aa
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{p.label}</div>
                <div className="text-[11px] text-muted-foreground">{p.hint}</div>
              </div>
              <div className="text-[11px] font-mono tabular-nums text-muted-foreground">
                {ratio !== null ? `${ratio.toFixed(2)}:1` : "—"}
              </div>
              {rating && (
                <span className={`text-[10px] font-semibold uppercase tracking-[1px] px-2 py-1 rounded border ${toneClass}`}>
                  {rating.level}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {anyFail && (
        <div className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
          One or more pairs fall below the WCAG AA minimum of 4.5:1 for normal text (3:1 for large text). Users with low vision may struggle to read these combinations.
        </div>
      )}
    </div>
  );
}

// ---------- Live theme preview ----------
function ThemePreview({
  bg, fg, accent, orgName, shortName, tagline,
}: {
  bg: string; fg: string; accent: string;
  orgName: string; shortName: string; tagline: string;
}) {
  const safe = (v: string, fallback: string) =>
    /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
  const b = safe(bg, "#0A0A0A");
  const f = safe(fg, "#F5F5F5");
  const a = safe(accent, "#EAB308");
  // Derive a subtle muted foreground from the text color (60% opacity).
  const muted = f + "99";
  const surface = f + "0F"; // ~6% overlay for card surfaces
  const border = f + "22";  // ~13% overlay for hairlines

  return (
    <div className="mt-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">
        Live preview
      </div>
      <div
        className="rounded-lg border overflow-hidden"
        style={{ backgroundColor: b, color: f, borderColor: border }}
        aria-label="Theme preview"
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: border, backgroundColor: surface }}
        >
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-md grid place-items-center text-[10px] font-bold"
              style={{ backgroundColor: a, color: b }}
            >
              {shortName.slice(0, 1).toUpperCase()}
            </div>
            <div className="text-sm font-semibold tracking-wide truncate">{shortName}</div>
          </div>
          <div className="flex items-center gap-3 text-[11px]" style={{ color: muted }}>
            <span>Dashboard</span>
            <span>Schedule</span>
            <span style={{ color: a, fontWeight: 600 }}>Reports</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-[1.2px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: a + "22", color: a, border: `1px solid ${a}55` }}
            >
              Live
            </span>
            <div className="text-[11px]" style={{ color: muted }}>{orgName}</div>
          </div>
          <div className="text-lg font-semibold leading-tight">{tagline}</div>
          <p className="text-[13px] leading-relaxed" style={{ color: muted }}>
            This is how body copy appears against your chosen background. Interactive elements use your accent color.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              className="h-9 px-4 rounded-md text-xs font-semibold uppercase tracking-[1.2px]"
              style={{ backgroundColor: a, color: b }}
            >
              Primary action
            </button>
            <button
              type="button"
              className="h-9 px-4 rounded-md text-xs font-semibold uppercase tracking-[1.2px] border"
              style={{ borderColor: border, color: f, backgroundColor: "transparent" }}
            >
              Secondary
            </button>
            <a
              className="text-xs font-medium underline underline-offset-4"
              style={{ color: a }}
              href="#preview"
              onClick={(e) => e.preventDefault()}
            >
              Text link
            </a>
          </div>

          <div
            className="mt-2 rounded-md p-3 border"
            style={{ backgroundColor: surface, borderColor: border }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[1.2px] mb-1" style={{ color: muted }}>
              Card surface
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Today's shifts</div>
              <div className="text-sm font-mono tabular-nums" style={{ color: a }}>12</div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Preview only — changes apply everywhere after you save.
      </div>
    </div>
  );
}

function _AutomationPanel() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAutomationSettings);
  const saveFn = useServerFn(updateAutomationSettings);
  const runsFn = useServerFn(listRolloverRuns);
  const { data: settings } = useQuery({ queryKey: ["automation-settings"], queryFn: () => getFn() });
  const { data: runs = [] } = useQuery<any[]>({
    queryKey: ["rollover-runs"],
    queryFn: () => runsFn({ data: { limit: 10 } }) as any,
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => saveFn({ data: patch as any }),
    onSuccess: () => { toast.success("Automation updated"); qc.invalidateQueries({ queryKey: ["automation-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!settings) return null;

  return (
    <>
      <SectionHeader eyebrow="Automation" title="Daily Rollover & Approvals" />
      <Card>
        <div className="space-y-4">
          <ToggleRow
            label="Daily rollover"
            help="At each location's local rollover hour, close active shifts, mark incomplete checklist items missed, auto clock-out open punches, and archive old resolved alerts. History is preserved."
            checked={settings.rollover_enabled}
            onChange={(v) => save.mutate({ rolloverEnabled: v })}
          />
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Rollover hour (location local time)</div>
              <div className="text-xs text-muted-foreground">Runs every 15 minutes; fires once when local hour matches.</div>
            </div>
            <select
              value={settings.rollover_hour}
              onChange={(e) => save.mutate({ rolloverHour: Number(e.target.value) })}
              className="h-10 rounded-md border border-border bg-card px-3 text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                <option key={h} value={h}>{new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric", hour12: true })}</option>
              ))}
            </select>
          </div>
          <ToggleRow
            label="Auto clock-out at rollover"
            help="If an employee is still on the clock at rollover, stamp them out and mark the punch as auto closed."
            checked={settings.auto_clock_out_enabled}
            onChange={(v) => save.mutate({ autoClockOutEnabled: v })}
          />
          <ToggleRow
            label="Manager self-approval (schedules)"
            help="When on, managers can approve and publish their own schedules without owner sign-off."
            checked={settings.manager_self_approval}
            onChange={(v) => save.mutate({ managerSelfApproval: v })}
          />
          <ToggleRow
            label="Email notifications"
            help="Master switch for outgoing emails (schedules, approvals, alerts). Defaults to on."
            checked={settings.email_enabled}
            onChange={(v) => save.mutate({ emailEnabled: v })}
          />
        </div>
      </Card>

      <SectionHeader eyebrow="History" title="Recent Rollover Runs" />
      <Card className="p-0 overflow-hidden">
        {runs.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground text-center">No rollovers yet. The dispatcher runs every 15 minutes.</div>
        )}
        {runs.map((r: any, i: number) => (
          <div key={r.id} className={i ? "border-t border-border p-3 text-sm" : "p-3 text-sm"}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium inline-flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-[var(--color-gold)]" />
                {new Date(r.ran_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              </div>
              <div className="text-xs text-muted-foreground">{r.notes ?? "ok"}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              shifts {r.shifts_closed} · punches {r.punches_auto_closed} · tasks missed {r.tasks_missed} · alerts archived {r.alerts_archived}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

// ---------- Device preview (mobile / tablet mocks) ----------
function DevicePreview({
  bg, fg, accent, orgName, shortName,
}: {
  bg: string; fg: string; accent: string; orgName: string; shortName: string;
}) {
  const [device, setDevice] = useState<"mobile" | "tablet">("mobile");
  const [screen, setScreen] = useState<"dashboard" | "schedule" | "signin">("dashboard");

  const safe = (v: string, fallback: string) =>
    /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
  const b = safe(bg, "#0A0A0A");
  const f = safe(fg, "#F5F5F5");
  const a = safe(accent, "#EAB308");
  const muted = f + "99";
  const surface = f + "0F";
  const border = f + "22";

  const frame =
    device === "mobile"
      ? { w: 260, h: 520, radius: 34, notch: true }
      : { w: 460, h: 340, radius: 22, notch: false };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">
          Device preview
        </div>
        <div className="flex items-center gap-2">
          <SegBtn active={device === "mobile"} onClick={() => setDevice("mobile")}>Mobile</SegBtn>
          <SegBtn active={device === "tablet"} onClick={() => setDevice("tablet")}>Tablet</SegBtn>
          <div className="mx-1 h-4 w-px bg-border" />
          <SegBtn active={screen === "dashboard"} onClick={() => setScreen("dashboard")}>Dashboard</SegBtn>
          <SegBtn active={screen === "schedule"} onClick={() => setScreen("schedule")}>Schedule</SegBtn>
          <SegBtn active={screen === "signin"} onClick={() => setScreen("signin")}>Sign-in</SegBtn>
        </div>
      </div>

      <div className="flex justify-center rounded-lg border border-border bg-muted/20 p-5 overflow-hidden">
        <div
          className="relative shadow-xl"
          style={{
            width: frame.w,
            height: frame.h,
            borderRadius: frame.radius,
            padding: 8,
            background: "#0B0B0D",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          aria-label={`${device} preview of ${screen}`}
        >
          <div
            className="relative overflow-hidden h-full w-full"
            style={{
              borderRadius: frame.radius - 8,
              backgroundColor: b,
              color: f,
            }}
          >
            {frame.notch && (
              <div
                className="absolute left-1/2 -translate-x-1/2 top-1.5 h-4 w-20 rounded-full z-10"
                style={{ background: "#0B0B0D" }}
              />
            )}
            <InScreenContrastBadges bg={b} fg={f} accent={a} />

            {screen === "dashboard" && (
              <DashboardMock b={b} f={f} a={a} muted={muted} surface={surface} border={border} shortName={shortName} />
            )}
            {screen === "schedule" && (
              <ScheduleMock f={f} a={a} muted={muted} surface={surface} border={border} shortName={shortName} />
            )}
            {screen === "signin" && (
              <SigninMock b={b} f={f} a={a} muted={muted} surface={surface} border={border} orgName={orgName} shortName={shortName} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 px-2.5 rounded-md text-[11px] font-semibold uppercase tracking-[1px] border transition-colors ${
        active
          ? "border-[var(--color-gold)] text-[var(--color-gold)] bg-[var(--color-gold)]/10"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

type MockProps = {
  b?: string; f: string; a: string; muted: string; surface: string; border: string;
  shortName?: string; orgName?: string;
};

function TopBar({ f, a, muted, border, surface, shortName }: MockProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: border, backgroundColor: surface }}>
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="h-4 w-4 rounded grid place-items-center text-[8px] font-bold shrink-0" style={{ backgroundColor: a, color: "#000" }}>
          {shortName?.slice(0, 1).toUpperCase() ?? "O"}
        </div>
        <div className="text-[10px] font-semibold truncate" style={{ color: f }}>{shortName}</div>
      </div>
      <div className="flex items-center gap-1">
        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: a }} />
        <div className="text-[9px]" style={{ color: muted }}>Live</div>
      </div>
    </div>
  );
}

function DashboardMock({ f, a, muted, surface, border, shortName }: MockProps) {
  return (
    <div className="h-full w-full flex flex-col">
      <TopBar f={f} a={a} muted={muted} border={border} surface={surface} shortName={shortName} />
      <div className="p-3 space-y-2 overflow-hidden">
        <div className="text-[9px] uppercase tracking-[1px]" style={{ color: muted }}>Today</div>
        <div className="text-sm font-semibold">Good morning</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "On shift", value: "6" },
            { label: "Sales", value: "$1.2k" },
            { label: "Tasks", value: "8/12" },
            { label: "Alerts", value: "2" },
          ].map((s) => (
            <div key={s.label} className="rounded-md p-2 border" style={{ borderColor: border, backgroundColor: surface }}>
              <div className="text-[8px] uppercase tracking-[1px]" style={{ color: muted }}>{s.label}</div>
              <div className="text-sm font-semibold" style={{ color: s.label === "Sales" ? a : f }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-md p-2 border" style={{ borderColor: border, backgroundColor: surface }}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[9px] uppercase tracking-[1px]" style={{ color: muted }}>Next up</div>
            <div className="text-[9px] font-semibold" style={{ color: a }}>View all</div>
          </div>
          {["Prep station open", "Lunch rush", "Cash drop"].map((t, i) => (
            <div key={t} className="flex items-center justify-between py-1" style={{ borderTop: i === 0 ? "none" : `1px solid ${border}` }}>
              <div className="text-[10px]" style={{ color: f }}>{t}</div>
              <div className="text-[9px]" style={{ color: muted }}>{9 + i}:00</div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="h-8 w-full rounded-md text-[10px] font-semibold uppercase tracking-[1.2px]"
          style={{ backgroundColor: a, color: "#000" }}
        >
          Clock in
        </button>
      </div>
    </div>
  );
}

function ScheduleMock({ f, a, muted, surface, border, shortName }: MockProps) {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const shifts = [
    { name: "Alex", role: "Grill", time: "9–3", tone: a },
    { name: "Sam", role: "Cashier", time: "11–5", tone: f },
    { name: "Jordan", role: "Prep", time: "6–12", tone: f },
    { name: "Kai", role: "Lead", time: "12–8", tone: a },
  ];
  return (
    <div className="h-full w-full flex flex-col">
      <TopBar f={f} a={a} muted={muted} border={border} surface={surface} shortName={shortName} />
      <div className="p-3 space-y-2 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">This week</div>
          <div className="text-[9px] uppercase tracking-[1px]" style={{ color: muted }}>Jun 3–9</div>
        </div>
        <div className="flex items-center justify-between">
          {days.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="text-[9px]" style={{ color: muted }}>{d}</div>
              <div
                className="h-6 w-6 rounded-full grid place-items-center text-[10px] font-semibold"
                style={
                  i === 2
                    ? { backgroundColor: a, color: "#000" }
                    : { border: `1px solid ${border}`, color: f }
                }
              >
                {i + 3}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-md border overflow-hidden" style={{ borderColor: border, backgroundColor: surface }}>
          {shifts.map((s, i) => (
            <div
              key={s.name}
              className="flex items-center justify-between px-2 py-1.5"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${border}` }}
            >
              <div className="min-w-0">
                <div className="text-[10px] font-semibold truncate" style={{ color: f }}>{s.name}</div>
                <div className="text-[9px]" style={{ color: muted }}>{s.role}</div>
              </div>
              <div className="text-[10px] font-mono tabular-nums" style={{ color: s.tone }}>{s.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SigninMock({ b, f, a, muted, surface, border, orgName, shortName }: MockProps) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-4 gap-3 text-center">
      <div className="h-10 w-10 rounded-xl grid place-items-center text-sm font-bold" style={{ backgroundColor: a, color: b }}>
        {shortName?.slice(0, 1).toUpperCase() ?? "O"}
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[1.4px]" style={{ color: muted }}>Welcome to</div>
        <div className="text-base font-semibold leading-tight" style={{ color: f }}>{orgName}</div>
      </div>
      <div className="w-full space-y-1.5">
        <div className="h-7 w-full rounded-md border px-2 text-[10px] flex items-center" style={{ borderColor: border, backgroundColor: surface, color: muted }}>
          you@work.com
        </div>
        <div className="h-7 w-full rounded-md border px-2 text-[10px] flex items-center" style={{ borderColor: border, backgroundColor: surface, color: muted }}>
          ••••••••
        </div>
        <button
          type="button"
          className="h-8 w-full rounded-md text-[10px] font-semibold uppercase tracking-[1.4px]"
          style={{ backgroundColor: a, color: b }}
        >
          Sign in
        </button>
      </div>
      <div className="text-[9px]" style={{ color: muted }}>Secure staff access</div>
    </div>
  );
}

function ToggleRow({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{help}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full border transition shrink-0 ${checked ? "bg-[var(--color-gold)] border-[var(--color-gold)]" : "bg-card border-border"}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function PushNotificationsPanel() {
  const { permission, requestPermission } = usePushNotifications();
  const [busy, setBusy] = useState(false);

  if (permission === "unsupported") return null;

  const handleEnable = async () => {
    setBusy(true);
    const result = await requestPermission();
    setBusy(false);
    if (result === "granted") toast.success("Push notifications enabled");
    else if (result === "denied") toast.error("Notifications blocked — enable them in your browser settings");
  };

  return (
    <>
      <SectionHeader eyebrow="Notifications" title="Push Alerts" />
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold inline-flex items-center gap-2">
              {permission === "granted"
                ? <Bell className="h-3.5 w-3.5 text-[var(--color-gold)]" />
                : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
              Browser push notifications
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {permission === "granted"
                ? "You'll receive alerts even when the app is in the background."
                : permission === "denied"
                ? "Notifications are blocked. Allow them in your browser / device settings."
                : "Get notified of critical alerts and announcements when the app is in the background."}
            </div>
          </div>
          {permission !== "granted" && permission !== "denied" && (
            <button
              onClick={handleEnable}
              disabled={busy}
              className="shrink-0 h-9 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-4 text-xs font-semibold uppercase tracking-[1.2px] inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Bell className="h-3.5 w-3.5" />
              {busy ? "Requesting…" : "Enable"}
            </button>
          )}
          {permission === "granted" && (
            <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <Bell className="h-3.5 w-3.5" /> Active
            </span>
          )}
        </div>
      </Card>
    </>
  );
}

function NotificationsPanel() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyNotificationPreferences);
  const saveFn = useServerFn(updateMyNotificationPreferences);
  const { data: prefs } = useQuery({ queryKey: ["my-notif-prefs"], queryFn: () => getFn() });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => saveFn({ data: patch as any }),
    onSuccess: () => { toast.success("Preferences saved"); qc.invalidateQueries({ queryKey: ["my-notif-prefs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!prefs) return null;
  const categories = (prefs.categories ?? {}) as Record<NotificationCategory, boolean>;

  const CATEGORY_LABELS: Record<NotificationCategory, string> = {
    schedule: "Schedule changes",
    time_clock: "Time clock & punches",
    inventory: "Inventory orders & low stock",
    cash: "Cash drawer & variance",
    operations: "Daily recaps & ops",
    training: "Training assignments",
    announcements: "Announcements",
    critical: "Critical alerts",
  };

  return (
    <>
      <SectionHeader eyebrow="Notifications" title="Email Preferences" />
      <Card>
        <div className="space-y-4">
          <ToggleRow
            label="Email notifications"
            help="Master switch. When off, you will not receive any system emails (auth emails are unaffected)."
            checked={prefs.email_enabled}
            onChange={(v) => save.mutate({ emailEnabled: v })}
          />
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold inline-flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-[var(--color-gold)]" /> Delivery frequency
              </div>
              <div className="text-xs text-muted-foreground">Immediate sends each event live; daily digest batches; critical-only suppresses non-urgent.</div>
            </div>
            <select
              disabled={!prefs.email_enabled}
              value={prefs.frequency}
              onChange={(e) => save.mutate({ frequency: e.target.value })}
              className="h-10 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-50"
            >
              <option value="immediate">Immediate</option>
              <option value="daily_digest">Daily digest</option>
              <option value="critical_only">Critical only</option>
            </select>
          </div>
          <div className="pt-2 border-t border-border space-y-2">
            <div className="label-caps text-muted-foreground">Quiet hours</div>
            <div className="text-xs text-muted-foreground -mt-1">Non-critical emails are held during this window in your timezone. Critical alerts always go through.</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
              <div>
                <div className="label-caps text-muted-foreground mb-1 text-[10px]">Start</div>
                <input
                  type="time"
                  disabled={!prefs.email_enabled}
                  value={prefs.quiet_hours_start?.slice(0, 5) ?? ""}
                  onChange={(e) => save.mutate({ quietHoursStart: e.target.value || null })}
                  className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <div className="label-caps text-muted-foreground mb-1 text-[10px]">End</div>
                <input
                  type="time"
                  disabled={!prefs.email_enabled}
                  value={prefs.quiet_hours_end?.slice(0, 5) ?? ""}
                  onChange={(e) => save.mutate({ quietHoursEnd: e.target.value || null })}
                  className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <div className="label-caps text-muted-foreground mb-1 text-[10px]">Timezone</div>
                <select
                  disabled={!prefs.email_enabled}
                  value={prefs.quiet_hours_timezone ?? "America/New_York"}
                  onChange={(e) => save.mutate({ quietHoursTimezone: e.target.value })}
                  className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-50"
                >
                  {["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","America/Phoenix","America/Anchorage","Pacific/Honolulu","UTC"].map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border space-y-2">
            <div className="label-caps text-muted-foreground">Categories</div>
            {NOTIFICATION_CATEGORIES.map((cat) => (
              <ToggleRow
                key={cat}
                label={CATEGORY_LABELS[cat]}
                help={cat === "critical" ? "Always recommended on — covers safety and outage events." : ""}
                checked={categories[cat] !== false}
                onChange={(v) => save.mutate({ categories: { ...categories, [cat]: v } })}
              />
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}

