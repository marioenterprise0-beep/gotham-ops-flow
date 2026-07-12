import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X, History } from "lucide-react";
import { Card } from "@/components/gotham/primitives";
import { cn } from "@/lib/utils";
import { listTaskTemplates, upsertTaskTemplate, deleteTaskTemplate, listTemplateVersions } from "@/lib/task-templates.functions";
import { listTrailers } from "@/lib/users.functions";
import { useRole } from "@/lib/role";


type Role = "owner" | "manager" | "shift_lead" | "grill" | "prep" | "cashier";
type Phase = "opening" | "mid" | "closing" | "emergency";

const ROLE_OPTS: { id: Role; label: string }[] = [
  { id: "cashier", label: "Cashier" },
  { id: "prep", label: "Prep" },
  { id: "grill", label: "Grill" },
  { id: "shift_lead", label: "Shift Lead" },
  { id: "manager", label: "Manager" },
  { id: "owner", label: "Owner" },
];
const PHASE_OPTS: Phase[] = ["opening", "mid", "closing", "emergency"];

type Template = {
  id: string;
  trailer_id: string | null;
  role: Role;
  phase: Phase;
  title: string;
  description: string | null;
  requires_signoff: boolean;
  position: number;
  active: boolean;
};

type DraftTemplate = Omit<Template, "id"> & { id?: string };

export function TaskTemplatesPanel() {
  const qc = useQueryClient();
  const { roleId } = useRole();
  const canEdit = roleId === "owner";
  const fetchTemplates = useServerFn(listTaskTemplates);
  const fetchTrailers = useServerFn(listTrailers);
  const upsertFn = useServerFn(upsertTaskTemplate);
  const deleteFn = useServerFn(deleteTaskTemplate);


  const [editing, setEditing] = useState<DraftTemplate | null>(null);
  const [historyFor, setHistoryFor] = useState<Template | null>(null);
  const [filterPhase, setFilterPhase] = useState<Phase | "all">("all");
  const [filterRole, setFilterRole] = useState<Role | "all">("all");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["task-templates"],
    queryFn: () => fetchTemplates() as Promise<Template[]>,
  });
  const { data: trailers = [] } = useQuery({
    queryKey: ["trailers"],
    queryFn: () => fetchTrailers(),
  });

  const filtered = useMemo(() => {
    return templates.filter((t) =>
      (filterPhase === "all" || t.phase === filterPhase) &&
      (filterRole === "all" || t.role === filterRole)
    );
  }, [templates, filterPhase, filterRole]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["task-templates"] });
  };

  const upsertMut = useMutation({
    mutationFn: (d: DraftTemplate) => upsertFn({ data: d as any }),
    onSuccess: () => {
      toast.success("Template saved · applies to next clock-in");
      invalidate();
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Template removed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const trailerName = (id: string | null) =>
    id ? (trailers.find((t: any) => t.id === id)?.name ?? "—") : "All locations";

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-border bg-[#FAFAF5] flex flex-wrap items-end gap-3">
        <div>
          <div className="label-caps text-muted-foreground mb-1">Phase</div>
          <select value={filterPhase} onChange={(e) => setFilterPhase(e.target.value as any)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
            <option value="all">All phases</option>
            {PHASE_OPTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <div className="label-caps text-muted-foreground mb-1">Role</div>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as any)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
            <option value="all">All roles</option>
            {ROLE_OPTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div className="ml-auto">
          {canEdit ? (
            <button
              onClick={() => setEditing({ trailer_id: null, role: "cashier", phase: "opening", title: "", description: "", requires_signoff: false, position: 0, active: true })}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-2 text-xs font-semibold uppercase tracking-[1.2px]"
            >
              <Plus className="h-3.5 w-3.5" /> New template
            </button>
          ) : (
            <span className="label-caps text-muted-foreground">Read-only · Owner manages master templates</span>
          )}
        </div>
      </div>


      <div className="hidden md:grid grid-cols-[1.6fr_120px_110px_140px_90px_120px] gap-3 px-4 py-2.5 label-caps text-muted-foreground bg-[#FAFAF5] border-b border-border">
        <div>Title</div><div>Role</div><div>Phase</div><div>Trailer</div><div>Sign-off</div><div className="text-right">Actions</div>
      </div>

      {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading templates…</div>}
      {!isLoading && filtered.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No templates yet. New tasks created here will auto-assign on the next employee clock-in.
        </div>
      )}
      {filtered.map((t, i) => (
        <div key={t.id} className={cn("grid grid-cols-1 md:grid-cols-[1.6fr_120px_110px_140px_90px_120px] gap-3 px-4 py-3 text-sm items-center", i && "border-t border-border", !t.active && "opacity-60")}>
          <div>
            <div className="font-medium truncate">{t.title}</div>
            {t.description && <div className="text-xs text-muted-foreground truncate">{t.description}</div>}
          </div>
          <div className="uppercase text-xs tracking-wider">{ROLE_OPTS.find((r) => r.id === t.role)?.label ?? t.role}</div>
          <div className="uppercase text-xs tracking-wider">{t.phase}</div>
          <div className="text-xs text-muted-foreground truncate">{trailerName(t.trailer_id)}</div>
          <div className="text-xs">{t.requires_signoff ? "Required" : "—"}</div>
          <div className="flex gap-2 md:justify-end">
            <button onClick={() => setHistoryFor(t)} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1"><History className="h-3 w-3" /> History</button>
            {canEdit && (
              <>
                <button onClick={() => setEditing(t)} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</button>
                <button
                  onClick={() => { if (confirm(`Delete "${t.title}"? This stops auto-assigning it.`)) deleteMut.mutate(t.id); }}
                  disabled={deleteMut.isPending}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1 text-[var(--color-danger)] disabled:opacity-50"
                ><Trash2 className="h-3 w-3" /></button>
              </>
            )}
          </div>

        </div>
      ))}

      {editing && (
        <TemplateModal
          draft={editing}
          trailers={trailers as any}
          saving={upsertMut.isPending}
          onClose={() => setEditing(null)}
          onSave={(d) => upsertMut.mutate(d)}
        />
      )}

      {historyFor && (
        <HistoryModal template={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </Card>
  );
}

function TemplateModal({
  draft, trailers, saving, onClose, onSave,
}: {
  draft: DraftTemplate;
  trailers: { id: string; name: string }[];
  saving: boolean;
  onClose: () => void;
  onSave: (d: DraftTemplate) => void;
}) {
  const [d, setD] = useState<DraftTemplate>(draft);
  const valid = d.title.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-5 card-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl">{d.id ? "EDIT TEMPLATE" : "NEW TEMPLATE"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <input
            value={d.title}
            onChange={(e) => setD({ ...d, title: e.target.value })}
            placeholder="Title (e.g. Sanitize prep surfaces)"
            className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm"
          />
          <textarea
            rows={2}
            value={d.description ?? ""}
            onChange={(e) => setD({ ...d, description: e.target.value })}
            placeholder="Description (optional)"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="label-caps text-muted-foreground mb-1">Role</div>
              <select value={d.role} onChange={(e) => setD({ ...d, role: e.target.value as Role })} className="w-full h-10 rounded-md border border-border bg-card px-2 text-sm">
                {ROLE_OPTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <div className="label-caps text-muted-foreground mb-1">Phase</div>
              <select value={d.phase} onChange={(e) => setD({ ...d, phase: e.target.value as Phase })} className="w-full h-10 rounded-md border border-border bg-card px-2 text-sm">
                {PHASE_OPTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <div className="label-caps text-muted-foreground mb-1">Trailer</div>
              <select value={d.trailer_id ?? ""} onChange={(e) => setD({ ...d, trailer_id: e.target.value || null })} className="w-full h-10 rounded-md border border-border bg-card px-2 text-sm">
                <option value="">All trailers</option>
                {trailers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <div className="label-caps text-muted-foreground mb-1">Position</div>
              <input
                type="number"
                value={d.position}
                onChange={(e) => setD({ ...d, position: parseInt(e.target.value || "0", 10) })}
                className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm"
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={d.requires_signoff} onChange={(e) => setD({ ...d, requires_signoff: e.target.checked })} />
                Sign-off
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} />
                Active
              </label>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm border border-border">Cancel</button>
          <button
            disabled={!valid || saving}
            onClick={() => onSave({ ...d, title: d.title.trim(), description: d.description?.trim() || null })}
            className="rounded-md px-4 py-2 text-sm font-semibold bg-[var(--color-gold)] text-[#0A0A0A] disabled:opacity-50"
          >
            {saving ? "Saving…" : d.id ? "Save changes" : "Create template"}
          </button>
        </div>
      </div>
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  trailer_id: "Trailer",
  role: "Role",
  phase: "Phase",
  title: "Title",
  description: "Description",
  requires_signoff: "Sign-off required",
  position: "Position",
  active: "Active",
};

type VersionRow = {
  id: string;
  version: number;
  action: "create" | "update" | "delete";
  actor_id: string | null;
  actor_name: string;
  changed_at: string;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  changed_fields: string[];
};

function formatValue(field: string, value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function HistoryModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const fetchVersions = useServerFn(listTemplateVersions);
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["template-versions", template.id],
    queryFn: () => fetchVersions({ data: { templateId: template.id } }) as Promise<VersionRow[]>,
  });

  const actionTone = (a: VersionRow["action"]) =>
    a === "create" ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
    : a === "delete" ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
    : "bg-[var(--color-warning-bg)] text-[#7C3A00]";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col card-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-display text-xl">VERSION HISTORY</h3>
            <div className="text-xs text-muted-foreground mt-0.5">{template.title}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          {isLoading && <div className="text-center text-sm text-muted-foreground py-6">Loading history…</div>}
          {!isLoading && versions.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6">No history recorded.</div>
          )}
          {versions.map((v) => {
            const ts = new Date(v.changed_at);
            return (
              <div key={v.id} className="rounded-md border border-border overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#FAFAF5] border-b border-border">
                  <span className={cn("inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded", actionTone(v.action))}>
                    v{v.version} · {v.action}
                  </span>
                  <span className="text-xs text-muted-foreground">{ts.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground ml-auto">by {v.actor_name}</span>
                </div>
                <div className="text-xs text-muted-foreground px-3 pt-2">
                  Applied to shifts opened after {ts.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
                <div className="p-3 space-y-1.5">
                  {v.action === "create" && (
                    <div className="text-xs">
                      Created with title <span className="font-semibold">{v.after?.title}</span>, role <span className="font-semibold">{v.after?.role}</span>, phase <span className="font-semibold">{v.after?.phase}</span>.
                    </div>
                  )}
                  {v.action === "delete" && (
                    <div className="text-xs">Template deleted. Stopped auto-assigning at the time above.</div>
                  )}
                  {v.action === "update" && v.changed_fields.map((f) => (
                    <div key={f} className="grid grid-cols-[120px_1fr] gap-2 text-xs items-start">
                      <div className="font-semibold text-muted-foreground">{FIELD_LABEL[f] ?? f}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="line-through text-[var(--color-danger)] bg-[var(--color-danger-bg)] px-1.5 py-0.5 rounded">
                          {formatValue(f, v.before?.[f])}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-[var(--color-success)] bg-[var(--color-success-bg)] px-1.5 py-0.5 rounded font-medium">
                          {formatValue(f, v.after?.[f])}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
