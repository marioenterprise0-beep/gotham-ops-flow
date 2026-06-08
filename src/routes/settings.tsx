import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, RoleBadge } from "@/components/gotham/primitives";
import { getMyProfile, updateMyProfile, updateStoreInfo } from "@/lib/settings.functions";
import { getAutomationSettings, updateAutomationSettings, listRolloverRuns } from "@/lib/automation.functions";
import {
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/notifications.functions";
import { syncDomains } from "@/lib/sync-bus";
import { useRole, ROLES } from "@/lib/role";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { LogOut, Mail, Save, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Settings · Gotham OS" }] }),
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

  useEffect(() => {
    if (data?.profile?.display_name) setName(data.profile.display_name);
    if (data?.store) { setStoreName(data.store.name ?? ""); setStoreLoc(data.store.location ?? ""); }
  }, [data]);

  const saveProfile = useMutation({
    mutationFn: () => updateProfile({ data: { displayName: name.trim() } }),
    onSuccess: () => { toast.success("Profile saved"); syncDomains(qc, "profiles", "users"); refreshRoles(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveStore = useMutation({
    mutationFn: () => updateStore({ data: { storeId: data!.store!.id, name: storeName.trim(), location: storeLoc.trim() || undefined } }),
    onSuccess: () => { toast.success("Store updated"); syncDomains(qc, "profiles"); },
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
          <SectionHeader eyebrow="Store" title="Store Info" />
          <Card>
            <div className="space-y-3">
              <div>
                <div className="label-caps text-muted-foreground mb-1">Store name</div>
                <input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
              </div>
              <div>
                <div className="label-caps text-muted-foreground mb-1">Location</div>
                <input value={storeLoc} onChange={(e) => setStoreLoc(e.target.value)} placeholder="e.g. 6th Ave & W 53rd St" className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm" />
              </div>
              <div className="flex justify-end">
                <button disabled={!storeName.trim() || saveStore.isPending} onClick={() => saveStore.mutate()}
                  className="h-10 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-4 text-xs font-semibold uppercase tracking-[1.2px] inline-flex items-center gap-2 disabled:opacity-50">
                  <Save className="h-3.5 w-3.5" /> Save store
                </button>
              </div>
            </div>
          </Card>
        </>
      )}

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
            help="At each trailer's local rollover hour, close active shifts, mark incomplete checklist items missed, auto clock-out open punches, and archive old resolved alerts. History is preserved."
            checked={settings.rollover_enabled}
            onChange={(v) => save.mutate({ rolloverEnabled: v })}
          />
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Rollover hour (trailer local time)</div>
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
