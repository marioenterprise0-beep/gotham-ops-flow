import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, StatusPill } from "@/components/gotham/primitives";
import { Plus, X, Wrench, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncDomains } from "@/lib/sync-bus";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  submitMaintenanceRequest, listMaintenanceRequests, updateMaintenanceStatus,
  type MaintenanceRequest, type MaintenanceStatus,
} from "@/lib/maintenance.functions";

export const Route = createFileRoute("/maintenance")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Maintenance · Dip N Shake OS" }] }),
  component: MaintenancePage,
});

const STATUS_TONE: Record<MaintenanceStatus, "warning" | "info" | "success"> = {
  open: "warning", in_progress: "info", resolved: "success",
};
const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  open: "Open", in_progress: "In Progress", resolved: "Resolved",
};
const PRIORITY_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  critical: "danger", high: "warning", normal: "neutral", low: "neutral",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function MaintenancePage() {
  const { roleId } = useRole();
  const isManager = roleId === "owner" || roleId === "manager";
  const [reportOpen, setReportOpen] = useState(false);
  const [includeResolved, setIncludeResolved] = useState(false);

  const listFn = useServerFn(listMaintenanceRequests);
  const { data: requests = [], isLoading } = useQuery<MaintenanceRequest[]>({
    queryKey: ["maintenance-requests", includeResolved],
    queryFn: () => listFn({ data: { includeResolved } }) as Promise<MaintenanceRequest[]>,
  });

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Report a broken or unsafe piece of equipment — managers are notified right away.
        </p>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={includeResolved} onChange={(e) => setIncludeResolved(e.target.checked)} />
            Show resolved
          </label>
          <button onClick={() => setReportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-2 text-sm font-semibold">
            <Plus className="h-3.5 w-3.5" /> Report an Issue
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && <Card>Loading…</Card>}
        {!isLoading && requests.length === 0 && (
          <Card><div className="text-center py-8 text-sm text-muted-foreground">No maintenance issues reported.</div></Card>
        )}
        {requests.map((r) => (
          <RequestCard key={r.id} request={r} isManager={isManager} />
        ))}
      </div>

      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
    </AppShell>
  );
}

function RequestCard({ request, isManager }: { request: MaintenanceRequest; isManager: boolean }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateMaintenanceStatus);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const updateM = useMutation({
    mutationFn: (vars: { status: MaintenanceStatus; note?: string }) =>
      updateFn({ data: { id: request.id, status: vars.status, note: vars.note } }),
    onSuccess: () => {
      toast.success("Updated");
      syncDomains(qc, "maintenance");
      setNoteOpen(false);
      setNote("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update"),
  });

  return (
    <Card className="!p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{request.title}</span>
            <StatusPill tone={PRIORITY_TONE[request.priority] ?? "neutral"}>{request.priority}</StatusPill>
          </div>
          {request.description && <p className="text-sm text-muted-foreground mt-1">{request.description}</p>}
          <div className="text-[11px] text-muted-foreground mt-1.5">Reported {fmtDate(request.created_at)}</div>
          {request.resolution_note && (
            <div className="text-[11px] text-[var(--color-success)] mt-1">Resolved: {request.resolution_note}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusPill tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</StatusPill>
          {isManager && request.status !== "resolved" && (
            <div className="flex gap-1.5">
              {request.status === "open" && (
                <button onClick={() => updateM.mutate({ status: "in_progress" })} disabled={updateM.isPending}
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:border-[var(--color-gold)]">
                  Start
                </button>
              )}
              <button onClick={() => setNoteOpen(true)}
                className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-2 py-1 text-[11px] font-semibold">
                Resolve
              </button>
            </div>
          )}
        </div>
      </div>
      {noteOpen && (
        <div className="mt-2 pt-2 border-t border-border flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note (optional)"
            className="flex-1 bg-secondary border border-border rounded-md px-2.5 py-1.5 text-sm" />
          <button onClick={() => updateM.mutate({ status: "resolved", note })} disabled={updateM.isPending}
            className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold">
            Confirm
          </button>
        </div>
      )}
    </Card>
  );
}

function ReportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitMaintenanceRequest);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"critical" | "high" | "normal" | "low">("normal");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onPickPhoto = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be ≤ 8 MB"); return; }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `maintenance/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("gotham-photos").upload(path, file, { contentType: file.type });
      if (error) throw error;
      setPhotoUrl(path);
      toast.success("Photo attached");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally { setUploading(false); }
  };

  const submitM = useMutation({
    mutationFn: () => submitFn({ data: { title: title.trim(), description: description.trim() || undefined, priority, photoUrl } }),
    onSuccess: () => {
      toast.success("Reported — managers have been notified");
      syncDomains(qc, "maintenance");
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to report"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-none sm:rounded-xl border border-border bg-card p-5 my-0 sm:my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="font-display text-lg flex items-center gap-2"><Wrench className="h-4 w-4 text-[var(--color-gold)]" /> Report an Issue</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`What's broken? (e.g. "Fryer #2 won't heat up")`}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details (optional)" rows={3}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm" />
          <div>
            <div className="label-caps text-muted-foreground mb-1">Urgency</div>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              {(["low", "normal", "high", "critical"] as const).map((p) => (
                <button key={p} onClick={() => setPriority(p)}
                  className={cn("px-3 py-1.5 text-xs font-semibold capitalize", priority === p ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "text-muted-foreground")}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm cursor-pointer hover:border-foreground/30">
            <Upload className="h-4 w-4 text-muted-foreground" />
            {uploading ? "Uploading…" : photoUrl ? "Photo attached" : "Add a photo (optional)"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPickPhoto(e.target.files[0])} />
          </label>
          <button onClick={() => submitM.mutate()} disabled={!title.trim() || submitM.isPending || uploading}
            className="w-full rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-2 text-sm font-semibold disabled:opacity-40">
            {submitM.isPending ? "Reporting…" : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
