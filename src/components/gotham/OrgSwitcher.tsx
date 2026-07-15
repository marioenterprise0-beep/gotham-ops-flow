import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Plus } from "lucide-react";

import {
  createOrganization,
  listMyOrganizations,
  setActiveOrganization,
} from "@/lib/organizations.functions";
import { useRole } from "@/lib/role";

// Compact org switcher for the top bar. Server-side guarantees do the heavy
// lifting: RLS scopes the list, is_org_member gates the switch, and
// current_user_org_ids clamps every downstream fetch.
export function OrgSwitcher() {
  const { session } = useRole();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const listFn = useServerFn(listMyOrganizations);
  const switchFn = useServerFn(setActiveOrganization);
  const createFn = useServerFn(createOrganization);

  const { data } = useQuery({
    queryKey: ["my-organizations"],
    queryFn: () => listFn(),
    enabled: !!session?.user?.id,
    staleTime: 60_000,
  });

  const switchMut = useMutation({
    mutationFn: (organizationId: string) => switchFn({ data: { organizationId } }),
    onSuccess: async () => {
      toast.success("Switched organization");
      await qc.invalidateQueries();
    },
    onError: (e: unknown) => toast.error((e as Error).message ?? "Switch failed"),
  });

  const createMut = useMutation({
    mutationFn: (name: string) => createFn({ data: { name } }),
    onSuccess: async (res) => {
      toast.success(`Created ${res.name}`);
      await qc.invalidateQueries({ queryKey: ["my-organizations"] });
      await qc.invalidateQueries();
      setCreating(false);
    },
    onError: (e: unknown) => toast.error((e as Error).message ?? "Create failed"),
  });

  if (!session?.user) return null;
  const orgs = data?.organizations ?? [];
  const active = data?.activeOrganizationId ?? "";

  return (
    <div className="hidden md:flex items-center gap-1.5">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#1C1C1C] border border-[#2A2A2A]">
        <Building2 className="h-3.5 w-3.5 text-[var(--color-gold)]" />
        <select
          value={active}
          disabled={orgs.length === 0 || switchMut.isPending}
          onChange={(e) => {
            const id = e.target.value;
            if (id && id !== active) switchMut.mutate(id);
          }}
          className="bg-transparent text-xs font-medium text-white outline-none pr-1"
          title="Active organization"
        >
          {orgs.length === 0 && <option value="">No organizations</option>}
          {orgs.map((o) => (
            <option key={o.id} value={o.id} className="bg-[#1C1C1C]">
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => setCreating(true)}
        title="Create organization"
        className="grid h-9 w-9 place-items-center rounded-md bg-[#1C1C1C] border border-[#2A2A2A] text-white/60 hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] transition"
      >
        <Plus className="h-4 w-4" />
      </button>

      {creating && (
        <CreateOrgDialog
          pending={createMut.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(name) => createMut.mutate(name)}
        />
      )}
    </div>
  );
}

function CreateOrgDialog({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={onCancel}>
      <div
        className="w-[min(420px,92vw)] rounded-lg bg-[#111] border border-[#2A2A2A] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-white mb-1">New organization</h2>
        <p className="text-xs text-white/60 mb-4">
          Creates a tenant with you as org owner. You can switch to it any time from the top bar.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Restaurants"
          className="w-full rounded-md bg-[#0A0A0A] border border-[#2A2A2A] px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-gold)]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim().length >= 2 && !pending) onSubmit(name.trim());
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-3 py-1.5 rounded-md border border-[#2A2A2A] text-xs text-white/70 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || name.trim().length < 2}
            onClick={() => onSubmit(name.trim())}
            className="px-3 py-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] text-xs font-semibold disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}