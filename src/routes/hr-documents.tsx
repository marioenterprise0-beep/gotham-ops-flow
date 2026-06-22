import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card } from "@/components/gotham/primitives";
import {
  ClipboardList, Users, X, FileText, Upload, CheckCircle2, Clock, Ban, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { useRole } from "@/lib/role";
import { syncDomains, type SyncDomain } from "@/lib/sync-bus";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { renderStructuredBlocks, type FieldValues } from "@/components/gotham/StructuredBlocks";
import {
  getMyHrDocuments, getEmployeeHrDocuments, getHrAssignmentDetail, listHrTemplates,
  assignHrDocument, signHrDocument, markHrDocumentViewed, voidHrAssignment, fillHrDocumentFields,
  getHrCompletionOverview,
  type HrDocumentAssignment, type HrDocumentTemplate, type HrDocCategory,
} from "@/lib/hr-documents.functions";
import { listUsers } from "@/lib/users.functions";

export const Route = createFileRoute("/hr-documents")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "HR Documents · Gotham OS" }] }),
  component: HrDocumentsPage,
});

const CATEGORY_LABEL: Record<HrDocCategory, string> = {
  onboarding: "Onboarding", training: "Training", hr: "HR", operations: "Operations",
};

function StatusBadge({ status }: { status: HrDocumentAssignment["status"] }) {
  const map = {
    pending: { label: "Action needed", cls: "text-[var(--color-warning)] bg-[var(--color-warning)]/10", icon: Clock },
    viewed: { label: "Action needed", cls: "text-[var(--color-warning)] bg-[var(--color-warning)]/10", icon: Clock },
    signed: { label: "Signed", cls: "text-[var(--color-success)] bg-[var(--color-success)]/10", icon: CheckCircle2 },
    voided: { label: "Voided", cls: "text-muted-foreground bg-secondary", icon: Ban },
  } as const;
  const m = map[status];
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", m.cls)}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

function AssignmentCard({ a, onOpen }: { a: HrDocumentAssignment; onOpen: () => void }) {
  const signedCount = a.signatures.filter((s) => s.signed_at).length;
  return (
    <button onClick={onOpen} className="w-full text-left rounded-lg border border-border bg-card p-3 hover:border-foreground/30 transition">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm">{a.title}</div>
        <StatusBadge status={a.status} />
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {signedCount}/{a.required_signer_roles.length} signed
        {a.due_date && <> · Due {new Date(a.due_date).toLocaleDateString()}</>}
      </div>
    </button>
  );
}

function AssignmentList({ assignments, onOpen }: { assignments: HrDocumentAssignment[]; onOpen: (id: string) => void }) {
  const needsAction = assignments.filter((a) => a.status === "pending" || a.status === "viewed");
  const signed = assignments.filter((a) => a.status === "signed");
  const voided = assignments.filter((a) => a.status === "voided");

  if (assignments.length === 0) {
    return <Card><div className="text-center py-8 text-sm text-muted-foreground">No documents here yet.</div></Card>;
  }

  return (
    <div className="space-y-5">
      {needsAction.length > 0 && (
        <div>
          <div className="label-caps text-[var(--color-warning)] mb-2">Action needed ({needsAction.length})</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {needsAction.map((a) => <AssignmentCard key={a.id} a={a} onOpen={() => onOpen(a.id)} />)}
          </div>
        </div>
      )}
      {signed.length > 0 && (
        <div>
          <div className="label-caps text-muted-foreground mb-2">Signed ({signed.length})</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {signed.map((a) => <AssignmentCard key={a.id} a={a} onOpen={() => onOpen(a.id)} />)}
          </div>
        </div>
      )}
      {voided.length > 0 && (
        <div>
          <div className="label-caps text-muted-foreground mb-2">Voided ({voided.length})</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {voided.map((a) => <AssignmentCard key={a.id} a={a} onOpen={() => onOpen(a.id)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

const EMPLOYEE_LABEL_RE = /employee/i;
const DIRECTOR_LABEL_RE = /director of operations/i;

function AssignmentDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { userId, actualRoleId } = useRole();
  // Real role, not the effective/"view as" one — signing and voiding are
  // real actions whose availability shouldn't disappear just because an
  // owner is previewing the app as another role (the server enforces the
  // real check regardless; hiding the button here would only confuse the
  // actual owner without adding any real security).
  const isOwner = actualRoleId === "owner";
  const isManager = actualRoleId === "owner" || actualRoleId === "manager";
  const fetchDetail = useServerFn(getHrAssignmentDetail);
  const markViewedFn = useServerFn(markHrDocumentViewed);
  const signFn = useServerFn(signHrDocument);
  const voidFn = useServerFn(voidHrAssignment);
  const fillFn = useServerFn(fillHrDocumentFields);
  const [signingRole, setSigningRole] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [draftValues, setDraftValues] = useState<FieldValues>({});

  const { data, isLoading } = useQuery<any>({
    queryKey: ["hr-assignment-detail", id],
    queryFn: () => fetchDetail({ data: { id } }),
  });

  useEffect(() => {
    markViewedFn({ data: { id } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const FANOUT: SyncDomain[] = ["hr_documents"];
  const signM = useMutation({
    mutationFn: (signerRoleLabel: string) => signFn({ data: { assignmentId: id, signerRoleLabel, typedFullName: name.trim(), confirmed: true } }),
    onSuccess: () => {
      toast.success("Signed");
      qc.invalidateQueries({ queryKey: ["hr-assignment-detail", id] });
      syncDomains(qc, ...FANOUT);
      setSigningRole(null); setName(""); setConfirmed(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to sign"),
  });

  const voidM = useMutation({
    mutationFn: () => voidFn({ data: { id, reason: prompt("Reason for voiding (optional)") ?? undefined } }),
    onSuccess: () => { toast.success("Voided"); qc.invalidateQueries({ queryKey: ["hr-assignment-detail", id] }); syncDomains(qc, ...FANOUT); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to void"),
  });

  const fillM = useMutation({
    mutationFn: () => fillFn({ data: { assignmentId: id, values: draftValues } }),
    onSuccess: () => {
      toast.success("Answers saved");
      setDraftValues({});
      qc.invalidateQueries({ queryKey: ["hr-assignment-detail", id] });
      syncDomains(qc, ...FANOUT);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  // Training docs are reference/instructional material (e.g. a Cash
  // Handling Guide's example denomination table) — their blanks are
  // illustrative, not real data to capture, so they stay read-only.
  const isFillableCategory = data?.category !== "training";
  const isEditable = data && data.status !== "voided" && data.status !== "signed" && isFillableCategory;
  const hasUnsavedAnswers = Object.values(draftValues).some((v) => v.trim() !== "");

  function canSign(label: string): boolean {
    if (EMPLOYEE_LABEL_RE.test(label)) return data?.employee_id === userId;
    if (DIRECTOR_LABEL_RE.test(label)) return isOwner;
    return isManager;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-full sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-xl border border-border bg-card my-0 sm:my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="font-display text-lg">{data?.title ?? "Document"}</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">

        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

        {data && (
          <>
            {data.status === "voided" && data.void_reason && (
              <div className="mb-3 text-xs rounded-md border border-border bg-secondary px-3 py-2 text-muted-foreground">
                Voided{data.void_reason ? `: ${data.void_reason}` : ""}
              </div>
            )}

            {data.body_blocks && (
              <div className="rounded-md border border-border p-4 mb-2">
                {renderStructuredBlocks(data.body_blocks, {
                  fieldValues: data.field_values,
                  draftValues,
                  onDraftChange: (key, value) => setDraftValues((prev) => ({ ...prev, [key]: value })),
                  editable: isEditable,
                })}
              </div>
            )}
            {!isFillableCategory && data.body_blocks && (
              <p className="text-[11px] text-muted-foreground mb-4">This is reference material — nothing to fill in, just review and sign.</p>
            )}
            {isEditable && data.body_blocks && (
              <div className="flex items-center justify-between gap-2 mb-4">
                <p className="text-[11px] text-muted-foreground">Gold fields are filled in and locked. Type in the blanks, then save — each answer locks once saved.</p>
                <button disabled={!hasUnsavedAnswers || fillM.isPending} onClick={() => fillM.mutate()}
                  className="shrink-0 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
                  {fillM.isPending ? "Saving…" : "Save answers"}
                </button>
              </div>
            )}
            {data.fileUrl && (
              <a href={data.fileUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-gold)] underline mb-4">
                <FileText className="h-3.5 w-3.5" /> Open uploaded document
              </a>
            )}

            <div className="label-caps text-muted-foreground mb-2">Signatures</div>
            <div className="space-y-2">
              {data.signatures.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{s.signer_role_label}</div>
                    {s.signed_at ? (
                      <div className="text-xs text-muted-foreground">
                        Signed by {s.typed_full_name} · {new Date(s.signed_at).toLocaleString()}
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--color-warning)]">Awaiting signature</div>
                    )}
                  </div>
                  {!s.signed_at && data.status !== "voided" && canSign(s.signer_role_label) && signingRole !== s.signer_role_label && (
                    <button onClick={() => setSigningRole(s.signer_role_label)}
                      className="shrink-0 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold">
                      Sign
                    </button>
                  )}
                </div>
              ))}
            </div>

            {signingRole && (
              <div className="mt-3 rounded-md border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5 p-3">
                <div className="text-xs font-semibold mb-2">Signing as: {signingRole}</div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your full name"
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none sm:w-56" />
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                    I confirm this signature
                  </label>
                  <button disabled={!name.trim() || !confirmed || signM.isPending}
                    onClick={() => signM.mutate(signingRole)}
                    className="rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-xs font-semibold disabled:opacity-40">
                    {signM.isPending ? "Submitting…" : "Confirm signature"}
                  </button>
                </div>
              </div>
            )}

            {isManager && data.status !== "voided" && data.status !== "signed" && (
              <div className="mt-4 pt-3 border-t border-border">
                <button onClick={() => voidM.mutate()} disabled={voidM.isPending}
                  className="text-xs text-[var(--color-danger)] hover:underline">
                  Void this document
                </button>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

function SendDocumentModal({ defaultEmployeeId, onClose }: { defaultEmployeeId?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const listUsersFn = useServerFn(listUsers);
  const listTemplatesFn = useServerFn(listHrTemplates);
  const assignFn = useServerFn(assignHrDocument);

  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? "");
  const [source, setSource] = useState<"template" | "upload">("template");
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fieldValues, setFieldValues] = useState<FieldValues>({});

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["users-for-hr-send"],
    queryFn: () => listUsersFn({ data: {} }) as Promise<any[]>,
  });
  const { data: templates = [] } = useQuery<HrDocumentTemplate[]>({
    queryKey: ["hr-templates"],
    queryFn: () => listTemplatesFn({ data: {} }) as Promise<HrDocumentTemplate[]>,
  });

  const filteredTemplates = useMemo(() => {
    const lc = templateQuery.trim().toLowerCase();
    const list = lc ? templates.filter((t) => t.title.toLowerCase().includes(lc) || t.doc_code.toLowerCase().includes(lc)) : templates;
    const byCat: Record<string, HrDocumentTemplate[]> = {};
    for (const t of list) (byCat[t.category] ??= []).push(t);
    return byCat;
  }, [templates, templateQuery]);

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);

  function pickTemplate(t: HrDocumentTemplate) {
    setTemplateId(t.id);
    setFieldValues({}); // switching documents clears any in-progress answers for the previous one
  }

  const sendM = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("Pick an employee");
      if (source === "template") {
        if (!templateId) throw new Error("Pick a document");
        return assignFn({ data: { employeeId, templateId, dueDate: dueDate || undefined, fieldValues } });
      }
      if (!customFile) throw new Error("Choose a file to upload");
      if (!customTitle.trim()) throw new Error("Give the document a title");
      setUploading(true);
      const path = `hr-docs/${employeeId}/${Date.now()}-${customFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("gotham-photos").upload(path, customFile, {
        cacheControl: "3600", upsert: false, contentType: customFile.type,
      });
      setUploading(false);
      if (error) throw error;
      return assignFn({
        data: {
          employeeId, customTitle: customTitle.trim(), customStoragePath: path,
          customContentType: customFile.type, dueDate: dueDate || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Document sent");
      syncDomains(qc, "hr_documents");
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-full sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-xl border border-border bg-card my-0 sm:my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="font-display text-lg">Send a document</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
        <div className="space-y-3">
          <div>
            <div className="label-caps text-muted-foreground mb-1">Employee</div>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm">
              <option value="">Select an employee…</option>
              {employees.map((u: any) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
            </select>
          </div>

          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button onClick={() => setSource("template")}
              className={cn("px-3 py-1.5 text-xs font-semibold uppercase", source === "template" ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "text-muted-foreground")}>
              From template library
            </button>
            <button onClick={() => setSource("upload")}
              className={cn("px-3 py-1.5 text-xs font-semibold uppercase border-l border-border", source === "upload" ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "text-muted-foreground")}>
              Custom upload
            </button>
          </div>

          {source === "template" ? (
            <div>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input value={templateQuery} onChange={(e) => setTemplateQuery(e.target.value)} placeholder="Search documents…"
                  className="w-full bg-secondary border border-border rounded-md pl-8 pr-3 py-2 text-sm" />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-3">
                {Object.entries(filteredTemplates).map(([cat, list]) => (
                  <div key={cat}>
                    <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">{CATEGORY_LABEL[cat as HrDocCategory]}</div>
                    <div className="space-y-1">
                      {list.map((t) => (
                        <button key={t.id} onClick={() => pickTemplate(t)}
                          className={cn("w-full text-left rounded-md px-2.5 py-1.5 text-sm border",
                            templateId === t.id ? "border-[var(--color-gold)] bg-[var(--color-gold)]/10" : "border-border hover:border-foreground/30")}>
                          {t.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {templates.length === 0 && <div className="text-xs text-muted-foreground">No templates available.</div>}
              </div>

              {selectedTemplate && selectedTemplate.category !== "training" && (
                <div className="mt-3">
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    Fill in anything you know now — these lock immediately once sent and the employee won't be able to change them. Leave the rest blank for the employee to fill in themselves.
                  </p>
                  <div className="max-h-56 overflow-y-auto rounded-md border border-border p-3">
                    {renderStructuredBlocks(selectedTemplate.body_blocks, {
                      draftValues: fieldValues,
                      onDraftChange: (key, value) => setFieldValues((prev) => ({ ...prev, [key]: value })),
                      editable: true,
                    })}
                  </div>
                </div>
              )}
              {selectedTemplate && selectedTemplate.category === "training" && (
                <p className="mt-3 text-[11px] text-muted-foreground">This is reference material — nothing for you to fill in before sending.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="Document title"
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm cursor-pointer hover:border-foreground/30">
                <Upload className="h-4 w-4 text-muted-foreground" />
                {customFile ? customFile.name : "Choose a file to upload"}
                <input type="file" className="hidden" onChange={(e) => setCustomFile(e.target.files?.[0] ?? null)} />
              </label>
              <p className="text-[11px] text-muted-foreground">Defaults to a single "Employee Signature" requirement.</p>
            </div>
          )}

          <div>
            <div className="label-caps text-muted-foreground mb-1">Due date (optional)</div>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm" />
          </div>

          <button onClick={() => sendM.mutate()} disabled={sendM.isPending || uploading}
            className="w-full rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-2 text-sm font-semibold disabled:opacity-40">
            {sendM.isPending || uploading ? "Sending…" : "Send document"}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

function TeamPanel({ onOpenAssignment }: { onOpenAssignment: (id: string) => void }) {
  const listUsersFn = useServerFn(listUsers);
  const fetchEmployeeDocs = useServerFn(getEmployeeHrDocuments);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["users-for-hr-team"],
    queryFn: () => listUsersFn({ data: {} }) as Promise<any[]>,
  });

  const { data: docs = [], isLoading } = useQuery<HrDocumentAssignment[]>({
    queryKey: ["hr-employee-docs", employeeId],
    queryFn: () => fetchEmployeeDocs({ data: { employeeId: employeeId! } }) as Promise<HrDocumentAssignment[]>,
    enabled: !!employeeId,
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select value={employeeId ?? ""} onChange={(e) => setEmployeeId(e.target.value || null)}
          className="bg-secondary border border-border rounded-md px-3 py-2 text-sm">
          <option value="">Select a team member…</option>
          {employees.map((u: any) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
        </select>
        <button onClick={() => setSendOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-2 text-sm font-semibold">
          <ClipboardList className="h-3.5 w-3.5" /> Send a document
        </button>
      </div>

      {employeeId && (isLoading ? <Card>Loading…</Card> : <AssignmentList assignments={docs} onOpen={onOpenAssignment} />)}
      {!employeeId && <Card><div className="text-center py-8 text-sm text-muted-foreground">Pick a team member to see their HR file.</div></Card>}

      {sendOpen && <SendDocumentModal defaultEmployeeId={employeeId ?? undefined} onClose={() => setSendOpen(false)} />}
    </div>
  );
}

// "Skipped" maps to status='voided' — reuses the existing void action
// rather than a separate concept (see getHrCompletionOverview's comment).
function trackingStatus(status: HrDocumentAssignment["status"]): "completed" | "pending" | "skipped" {
  if (status === "signed") return "completed";
  if (status === "voided") return "skipped";
  return "pending";
}

function TrackingPanel({ onOpenAssignment }: { onOpenAssignment: (id: string) => void }) {
  const fetchOverview = useServerFn(getHrCompletionOverview);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending" | "skipped">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | HrDocCategory>("all");

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["hr-completion-overview"],
    queryFn: () => fetchOverview() as Promise<any[]>,
  });

  const filtered = useMemo(() => {
    const lc = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && trackingStatus(r.status) !== statusFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (!lc) return true;
      return r.employee_name?.toLowerCase().includes(lc) || r.title?.toLowerCase().includes(lc);
    });
  }, [rows, query, statusFilter, categoryFilter]);

  const counts = useMemo(() => {
    const c = { completed: 0, pending: 0, skipped: 0 };
    for (const r of rows) c[trackingStatus(r.status)]++;
    return c;
  }, [rows]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Card className="!p-3">
          <div className="label-caps text-muted-foreground text-[10px]">Completed</div>
          <div className="text-2xl font-semibold leading-none mt-1 text-[var(--color-success)]">{counts.completed}</div>
        </Card>
        <Card className="!p-3">
          <div className="label-caps text-[var(--color-warning)] text-[10px]">Pending</div>
          <div className="text-2xl font-semibold leading-none mt-1 text-[var(--color-warning)]">{counts.pending}</div>
        </Card>
        <Card className="!p-3">
          <div className="label-caps text-muted-foreground text-[10px]">Skipped</div>
          <div className="text-2xl font-semibold leading-none mt-1">{counts.skipped}</div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee or document…"
            className="w-full bg-secondary border border-border rounded-md pl-8 pr-3 py-2 text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
          className="bg-secondary border border-border rounded-md px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="skipped">Skipped</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)}
          className="bg-secondary border border-border rounded-md px-3 py-2 text-sm">
          <option value="all">All document types</option>
          {Object.entries(CATEGORY_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {isLoading && <Card>Loading…</Card>}
      {!isLoading && filtered.length === 0 && (
        <Card><div className="text-center py-8 text-sm text-muted-foreground">No documents match.</div></Card>
      )}
      {!isLoading && filtered.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary text-left text-[11px] uppercase text-muted-foreground">
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Sent</th>
                <th className="px-3 py-2">Completed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} onClick={() => onOpenAssignment(r.id)}
                  className={cn("cursor-pointer hover:bg-secondary/60 border-t border-border", i % 2 === 1 && "bg-card/50")}>
                  <td className="px-3 py-2 font-medium">{r.employee_name}</td>
                  <td className="px-3 py-2">{r.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.category ? CATEGORY_LABEL[r.category as HrDocCategory] : "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(r.assigned_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HrDocumentsPage() {
  const { roleId } = useRole();
  const isManager = roleId === "owner" || roleId === "manager";
  const [view, setView] = useState<"mine" | "team" | "tracking">("mine");
  const [detailId, setDetailId] = useState<string | null>(null);

  const fetchMine = useServerFn(getMyHrDocuments);
  const { data: mine = [], isLoading } = useQuery<HrDocumentAssignment[]>({
    queryKey: ["my-hr-documents"],
    queryFn: () => fetchMine() as Promise<HrDocumentAssignment[]>,
  });

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Documents sent to you to view, sign, or acknowledge — no more paper copies.
        </p>
        {isManager && (
          <div className="inline-flex rounded-md border border-border overflow-hidden shrink-0">
            <button onClick={() => setView("mine")}
              className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
                view === "mine" ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "bg-card text-muted-foreground hover:text-foreground")}>
              My Documents
            </button>
            <button onClick={() => setView("team")}
              className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-l border-border",
                view === "team" ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "bg-card text-muted-foreground hover:text-foreground")}>
              <Users className="h-3.5 w-3.5" /> Team
            </button>
            <button onClick={() => setView("tracking")}
              className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-l border-border",
                view === "tracking" ? "bg-[#0A0A0A] text-[var(--color-gold)]" : "bg-card text-muted-foreground hover:text-foreground")}>
              <ClipboardList className="h-3.5 w-3.5" /> Tracking
            </button>
          </div>
        )}
      </div>

      <div className="mt-4">
        {view === "mine" && (isLoading ? <Card>Loading…</Card> : <AssignmentList assignments={mine} onOpen={setDetailId} />)}
        {view === "team" && isManager && <TeamPanel onOpenAssignment={setDetailId} />}
        {view === "tracking" && isManager && <TrackingPanel onOpenAssignment={setDetailId} />}
      </div>

      {detailId && <AssignmentDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </AppShell>
  );
}
