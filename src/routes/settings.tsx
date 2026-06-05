import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, RoleBadge } from "@/components/gotham/primitives";
import { getMyProfile, updateMyProfile, updateStoreInfo } from "@/lib/settings.functions";
import { useRole, ROLES } from "@/lib/role";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { LogOut, Save } from "lucide-react";
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
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["my-profile"] }); refreshRoles(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveStore = useMutation({
    mutationFn: () => updateStore({ data: { storeId: data!.store!.id, name: storeName.trim(), location: storeLoc.trim() || undefined } }),
    onSuccess: () => { toast.success("Store updated"); qc.invalidateQueries({ queryKey: ["my-profile"] }); },
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
