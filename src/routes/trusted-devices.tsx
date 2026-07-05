import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import {
  listKioskDevices, registerKioskDevice, revokeKioskDevice, renameKioskDevice,
  setKioskDeviceRequired, getKioskSettings,
} from "@/lib/kiosk.functions";
import { listTrailerGeofences } from "@/lib/timeclock.functions";
import { Tablet, Copy, Check, ShieldAlert, ShieldCheck } from "lucide-react";

const TOKEN_KEY = "gotham:kiosk-device-token:v1";

export const Route = createFileRoute("/trusted-devices")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  component: TrustedDevicesPage,
  head: () => ({ meta: [{ title: "Trusted Devices · Gotham Halal" }] }),
});

function TrustedDevicesPage() {
  const { roleId, loading, session } = useRole();
  if (loading || !session || !roleId) {
    return (
      <AppShell>
        <Card>Loading…</Card>
      </AppShell>
    );
  }
  if (roleId !== "owner") return <Navigate to="/" />;
  return (
    <AppShell>
      <Inner />
    </AppShell>
  );
}

function Inner() {
  const qc = useQueryClient();
  const listFn = useServerFn(listKioskDevices);
  const trailersFn = useServerFn(listTrailerGeofences);
  const settingsFn = useServerFn(getKioskSettings);
  const registerFn = useServerFn(registerKioskDevice);
  const revokeFn = useServerFn(revokeKioskDevice);
  const renameFn = useServerFn(renameKioskDevice);
  const setRequiredFn = useServerFn(setKioskDeviceRequired);

  const devices = useQuery({ queryKey: ["kiosk", "devices"], queryFn: () => listFn() });
  const trailers = useQuery({ queryKey: ["trailers", "geofences"], queryFn: () => trailersFn() });
  const settings = useQuery({ queryKey: ["kiosk", "settings"], queryFn: () => settingsFn() });

  const [showRegister, setShowRegister] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newTrailerId, setNewTrailerId] = useState<string>("");
  const [issued, setIssued] = useState<{ token: string; label: string; deviceId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const register = useMutation({
    mutationFn: async () => registerFn({ data: { trailerId: newTrailerId, label: newLabel } }),
    onSuccess: (res) => {
      setShowRegister(false);
      setIssued({ token: res.token, label: res.device.label, deviceId: res.device.id });
      setNewLabel(""); setNewTrailerId("");
      qc.invalidateQueries({ queryKey: ["kiosk", "devices"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to register"),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => revokeFn({ data: { deviceId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kiosk", "devices"] });
      toast.success("Device revoked");
    },
  });

  const rename = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => renameFn({ data: { deviceId: id, label } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kiosk", "devices"] }),
  });

  const toggleRequired = useMutation({
    mutationFn: async (enabled: boolean) => setRequiredFn({ data: { enabled } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kiosk", "settings"] });
      toast.success("Kiosk requirement updated");
    },
  });

  const installOnThisDevice = () => {
    if (!issued) return;
    localStorage.setItem(TOKEN_KEY, issued.token);
    toast.success("Installed. Open /kiosk in Safari or add to Home Screen.");
    setIssued(null);
  };

  const trailerName = (id: string) => trailers.data?.find((t: any) => t.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <SectionHeader title="Trusted Devices" eyebrow="Kiosk iPads authorized to clock employees in/out" />

      <Card>
        <div className="flex items-center justify-between gap-4 p-2">
          <div>
            <div className="font-semibold flex items-center gap-2">
              {settings.data?.kioskDeviceRequired ? <ShieldCheck className="w-4 h-4 text-green-500" /> : <ShieldAlert className="w-4 h-4 text-yellow-500" />}
              Kiosk-only clock in/out
            </div>
            <div className="text-sm text-muted-foreground">
              When enabled, employees can only punch in/out from a registered iPad.
              You can still manually clock people in/out from the Time Clock admin.
            </div>
          </div>
          <Switch
            checked={settings.data?.kioskDeviceRequired ?? false}
            onCheckedChange={(v) => toggleRequired.mutate(v)}
            disabled={toggleRequired.isPending || settings.isLoading}
          />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Registered devices</div>
          <Button size="sm" onClick={() => setShowRegister(true)}>Register a device</Button>
        </div>
        {devices.isLoading ? (
          <div className="text-sm text-muted-foreground py-6">Loading…</div>
        ) : devices.data?.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6">
            No devices yet. Register the trailer iPad to enable kiosk mode.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(devices.data ?? []).map((d: any) => (
              <div key={d.id} className="py-3 flex items-center gap-3">
                <Tablet className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      className="font-medium truncate hover:underline"
                      onClick={() => {
                        const label = prompt("Rename device:", d.label);
                        if (label && label.trim() && label !== d.label) {
                          rename.mutate({ id: d.id, label: label.trim() });
                        }
                      }}
                    >{d.label}</button>
                    {d.revoked_at ? (
                      <StatusPill tone="danger">Revoked</StatusPill>
                    ) : (
                      <StatusPill tone="success">Active</StatusPill>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {trailerName(d.trailer_id)} · Registered {new Date(d.approved_at).toLocaleDateString()}
                    {d.last_used_at && ` · Last used ${new Date(d.last_used_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
                  </div>
                </div>
                {!d.revoked_at && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`Revoke "${d.label}"? It will stop accepting punches immediately.`)) {
                        revoke.mutate(d.id);
                      }
                    }}
                  >Revoke</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Register dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register a kiosk device</DialogTitle>
            <DialogDescription>
              Do this on the iPad itself while signed in as owner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Trailer</Label>
              <select
                className="w-full border rounded-md px-3 py-2 bg-background"
                value={newTrailerId}
                onChange={(e) => setNewTrailerId(e.target.value)}
              >
                <option value="">Select…</option>
                {(trailers.data ?? []).map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Device label</Label>
              <Input
                placeholder="e.g. Trailer 1 Kiosk"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRegister(false)}>Cancel</Button>
            <Button
              disabled={!newLabel.trim() || !newTrailerId || register.isPending}
              onClick={() => register.mutate()}
            >{register.isPending ? "Registering…" : "Register"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issued token */}
      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Device registered — save this token now</DialogTitle>
            <DialogDescription>
              This is the only time this token will be shown. Install it on this iPad, or copy it if you're setting it up elsewhere.
            </DialogDescription>
          </DialogHeader>
          {issued && (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded font-mono text-xs break-all">{issued.token}</div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(issued.token);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <><Check className="w-4 h-4 mr-1" /> Copied</> : <><Copy className="w-4 h-4 mr-1" /> Copy</>}
                </Button>
                <Button className="flex-1" onClick={installOnThisDevice}>
                  Install on this iPad
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                After installing, sign out (owner) and open <span className="font-mono">/kiosk</span> — the iPad will boot into kiosk mode. Add to Home Screen for full-screen.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
