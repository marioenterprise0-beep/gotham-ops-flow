import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireManager, requireOwner } from "@/lib/auth-guards";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import type { HandbookBlock } from "@/lib/handbook.functions";

export type HrAssignmentStatus = "pending" | "viewed" | "signed" | "voided";

export type HrDocumentSignature = {
  id: string;
  signer_role_label: string;
  signer_user_id: string | null;
  typed_full_name: string | null;
  signed_at: string | null;
};

export type HrDocumentAssignment = {
  id: string;
  employee_id: string;
  template_id: string | null;
  title: string;
  category: HrDocCategory | null;
  required_signer_roles: string[];
  status: HrAssignmentStatus;
  assigned_by: string;
  assigned_at: string;
  due_date: string | null;
  viewed_at: string | null;
  completed_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  field_values: Record<string, string>;
  signatures: HrDocumentSignature[];
};

export type HrDocCategory = "onboarding" | "training" | "hr" | "operations";

export type HrDocumentTemplate = {
  id: string;
  doc_code: string;
  category: HrDocCategory;
  title: string;
  body_blocks: HandbookBlock[];
  signer_roles: string[];
  owner_only: boolean;
  version: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

// RLS on hr_document_templates already hides owner_only (Operations
// category) rows from non-owners — this function just queries; the
// category split is enforced at the database layer, not here.
export const listHrTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ category: z.enum(["onboarding", "training", "hr", "operations"]).optional() }).optional().parse(d ?? {}))
  .handler(async ({ context, data }) => {
    let q = (context.supabase as any)
      .from("hr_document_templates")
      .select("id, doc_code, category, title, body_blocks, signer_roles, owner_only, version, archived_at, created_at, updated_at")
      .is("archived_at", null)
      .order("category", { ascending: true })
      .order("doc_code", { ascending: true });
    if (data?.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as HrDocumentTemplate[];
  });

const assignInputSchema = z
  .object({
    employeeId: z.string().uuid(),
    templateId: z.string().uuid().optional(),
    customTitle: z.string().min(1).max(200).optional(),
    customStoragePath: z.string().min(1).max(500).optional(),
    customContentType: z.string().max(120).optional(),
    customSignerRoles: z.array(z.string().min(1).max(120)).max(5).optional(),
    dueDate: z.string().optional(),
    fieldValues: z.record(z.string().min(1).max(60), z.string().max(2000)).optional(),
  })
  .refine((d) => !!d.templateId !== !!d.customStoragePath, {
    message: "Provide exactly one of templateId or customStoragePath",
  });

// Sent from a template, title/body_blocks/required_signer_roles are copied
// at send-time — an immutable snapshot, so a later template edit never
// retroactively changes a document someone already signed. RLS on
// hr_document_templates already hides owner_only templates from
// non-owners, so a manager passing an Operations template's id simply
// gets "Template not found" here rather than needing a second check.
export const assignHrDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => assignInputSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);

    let title: string;
    let bodyBlocks: HandbookBlock[] | null = null;
    let signerRoles: string[];
    let category: HrDocCategory | null = null;

    if (data.templateId) {
      const { data: tpl, error } = await (supabase as any)
        .from("hr_document_templates")
        .select("title, body_blocks, signer_roles, category")
        .eq("id", data.templateId)
        .maybeSingle();
      if (error) throw error;
      if (!tpl) throw new Error("Template not found");
      title = tpl.title;
      bodyBlocks = tpl.body_blocks;
      signerRoles = tpl.signer_roles ?? [];
      category = tpl.category ?? null;
    } else {
      title = data.customTitle ?? "Custom document";
      signerRoles = data.customSignerRoles?.length ? data.customSignerRoles : ["Employee Signature"];
    }

    // Only non-blank values lock a field — an empty string sent by the form
    // just means "left blank for now", same rule as fillHrDocumentFields().
    const initialFieldValues: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.fieldValues ?? {})) {
      if (v.trim() !== "") initialFieldValues[k] = v;
    }

    const { data: inserted, error: insErr } = await (supabase as any)
      .from("hr_document_assignments")
      .insert({
        employee_id: data.employeeId,
        template_id: data.templateId ?? null,
        title,
        category,
        body_blocks: bodyBlocks,
        custom_storage_path: data.customStoragePath ?? null,
        custom_content_type: data.customContentType ?? null,
        required_signer_roles: signerRoles,
        assigned_by: userId,
        due_date: data.dueDate ?? null,
        field_values: initialFieldValues,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "assign_hr_document",
      entity: "hr_document_assignment",
      entity_id: inserted.id,
      payload: { employee_id: data.employeeId, template_id: data.templateId ?? null, title },
    });

    // trailer_id is deliberately left unset — the location-based email
    // fan-out (alert-email-dispatch.ts) always includes the whole trailer
    // crew when trailer_id is set, which would broadcast a private HR
    // document. assigned_user_id alone targets just this employee (plus
    // owners, who are always CC'd on alerts in this app).
    await supabase.from("alerts").insert({
      type: "hr_document",
      title: `New document to review — ${title}`,
      description: data.dueDate ? `Due ${data.dueDate}` : "View and sign in HR Documents",
      source_module: "hr_documents",
      source_id: inserted.id,
      created_by: userId,
      assigned_user_id: data.employeeId,
      assigned_role: "manager",
      priority: "normal",
      status: "pending",
      payload: { title, due_date: data.dueDate ?? null, assignment_id: inserted.id },
    } as any);

    return { ok: true, id: inserted.id as string };
  });

const EMPLOYEE_LABEL_RE = /employee/i;
const DIRECTOR_LABEL_RE = /director of operations/i;

// Eligibility is inferred from the signer-role label text rather than a
// separate enum, since the 53 source documents already name their signers
// in plain language ("Employee Signature", "Director of Operations",
// "Manager Issuing Warning", "Trainer Sign-Off", ...).
export const signHrDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assignmentId: z.string().uuid(),
        signerRoleLabel: z.string().min(1).max(160),
        typedFullName: z.string().min(1).max(120),
        confirmed: z.literal(true),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: assignment, error: aErr } = await (supabase as any)
      .from("hr_document_assignments")
      .select("id, employee_id, status")
      .eq("id", data.assignmentId)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!assignment) throw new Error("Assignment not found");
    if (assignment.status === "voided") throw new Error("This document has been voided");

    if (EMPLOYEE_LABEL_RE.test(data.signerRoleLabel)) {
      if (assignment.employee_id !== userId) throw new Error("Only the assigned employee can sign this row");
    } else if (DIRECTOR_LABEL_RE.test(data.signerRoleLabel)) {
      await requireOwner(supabase, userId);
    } else {
      await requireManager(supabase, userId);
    }

    const { data: sigRow, error: sErr } = await (supabase as any)
      .from("hr_document_signatures")
      .select("id, signed_at")
      .eq("assignment_id", data.assignmentId)
      .eq("signer_role_label", data.signerRoleLabel)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!sigRow) throw new Error("Signature row not found for this role");
    if (sigRow.signed_at) throw new Error("This signature has already been recorded");

    // Server-captured timestamp — never trust a client-sent one.
    const { error: updErr } = await (supabase as any)
      .from("hr_document_signatures")
      .update({ signer_user_id: userId, typed_full_name: data.typedFullName.trim(), signed_at: new Date().toISOString() })
      .eq("id", sigRow.id);
    if (updErr) throw updErr;

    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "sign_hr_document",
      entity: "hr_document_assignment",
      entity_id: data.assignmentId,
      payload: { signer_role_label: data.signerRoleLabel },
    });

    return { ok: true };
  });

export const markHrDocumentViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: a } = await (supabase as any)
      .from("hr_document_assignments")
      .select("id, employee_id, status, viewed_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!a) throw new Error("Assignment not found");
    // Only the assignment's own employee opening it counts as "viewed" —
    // a manager browsing the team roster shouldn't flip this.
    if (a.employee_id === userId && !a.viewed_at) {
      await (supabase as any)
        .from("hr_document_assignments")
        .update({ viewed_at: new Date().toISOString(), status: a.status === "pending" ? "viewed" : a.status })
        .eq("id", data.id);
    }
    return { ok: true };
  });

export const voidHrAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { error } = await (supabase as any)
      .from("hr_document_assignments")
      .update({ status: "voided", voided_at: new Date().toISOString(), voided_by: userId, void_reason: data.reason ?? null })
      .eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "void_hr_document", entity: "hr_document_assignment", entity_id: data.id,
      payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

// Once a key has a non-empty value it's permanently locked — silently
// ignored here rather than erroring, so a manager and employee with the
// same document open concurrently don't get a confusing failure. This is
// what lets a manager's write-up details stay un-editable by the employee
// once filled, without needing per-field role tagging across 53 different
// document layouts.
export const fillHrDocumentFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assignmentId: z.string().uuid(),
        values: z.record(z.string().min(1).max(60), z.string().max(2000)),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: a, error } = await (supabase as any)
      .from("hr_document_assignments")
      .select("id, field_values, status")
      .eq("id", data.assignmentId)
      .maybeSingle();
    if (error) throw error;
    if (!a) throw new Error("Assignment not found");
    if (a.status === "voided" || a.status === "signed") throw new Error("This document can no longer be edited");

    const existing: Record<string, string> = a.field_values ?? {};
    const merged = { ...existing };
    const filledKeys: string[] = [];
    for (const [key, value] of Object.entries(data.values)) {
      const current = existing[key];
      const isLocked = current !== undefined && current !== null && String(current).trim() !== "";
      if (isLocked) continue;
      if (value.trim() === "") continue;
      merged[key] = value;
      filledKeys.push(key);
    }
    if (filledKeys.length === 0) return { ok: true, updated: false };

    const { error: updErr } = await (supabase as any)
      .from("hr_document_assignments")
      .update({ field_values: merged })
      .eq("id", data.assignmentId);
    if (updErr) throw updErr;

    await supabase.from("audit_log").insert({
      actor_id: userId, action: "fill_hr_document_fields", entity: "hr_document_assignment",
      entity_id: data.assignmentId, payload: { fields: filledKeys },
    });
    return { ok: true, updated: true };
  });

async function withSignatures(supabase: any, assignments: any[]): Promise<HrDocumentAssignment[]> {
  const ids = assignments.map((a) => a.id);
  const { data: sigs } = ids.length
    ? await supabase
        .from("hr_document_signatures")
        .select("assignment_id, id, signer_role_label, signer_user_id, typed_full_name, signed_at")
        .in("assignment_id", ids)
    : { data: [] as any[] };
  return assignments.map((a) => ({
    ...a,
    signatures: (sigs ?? []).filter((s: any) => s.assignment_id === a.id),
  }));
}

const ASSIGNMENT_COLUMNS =
  "id, employee_id, template_id, title, category, required_signer_roles, status, assigned_by, assigned_at, due_date, viewed_at, completed_at, voided_at, void_reason, field_values";

export const getMyHrDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: assignments, error } = await (supabase as any)
      .from("hr_document_assignments")
      .select(ASSIGNMENT_COLUMNS)
      .eq("employee_id", userId)
      .order("assigned_at", { ascending: false });
    if (error) throw error;
    return withSignatures(supabase, assignments ?? []);
  });

export const getEmployeeHrDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ employeeId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { data: assignments, error } = await (supabase as any)
      .from("hr_document_assignments")
      .select(ASSIGNMENT_COLUMNS)
      .eq("employee_id", data.employeeId)
      .order("assigned_at", { ascending: false });
    if (error) throw error;
    return withSignatures(supabase, assignments ?? []);
  });

export type HrCompletionRow = HrDocumentAssignment & { employee_name: string };

// Tracking dashboard data: every assignment across every employee. "Skipped"
// in the dashboard UI maps to status='voided' — reuses the existing
// void/cancel action rather than introducing a separate concept ("this
// employee doesn't need this document" already has a place to live).
// Completion timestamps and who-did-what are already captured by the
// existing audit_log inserts in assignHrDocument/signHrDocument/
// fillHrDocumentFields — this just surfaces assignment-level status, which
// is what the dashboard actually needs to render.
export const getHrCompletionOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);

    const { data: assignments, error } = await (supabase as any)
      .from("hr_document_assignments")
      .select(ASSIGNMENT_COLUMNS)
      .order("assigned_at", { ascending: false });
    if (error) throw error;

    const withSigs = await withSignatures(supabase, assignments ?? []);

    const employeeIds = [...new Set(withSigs.map((a: any) => a.employee_id))];
    const { data: profiles } = employeeIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", employeeIds)
      : { data: [] as any[] };
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));

    return withSigs.map((a: any) => ({ ...a, employee_name: nameMap.get(a.employee_id) ?? "Unknown" })) as HrCompletionRow[];
  });

// RLS on hr_document_assignments already restricts the SELECT to the
// assignment's own employee or a manager/owner, so by the time `a` loads
// successfully here, access is already validated — no second check needed.
export const getHrAssignmentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: a, error } = await (supabase as any)
      .from("hr_document_assignments")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!a) throw new Error("Assignment not found");

    const { data: sigs } = await (supabase as any)
      .from("hr_document_signatures")
      .select("id, signer_role_label, signer_user_id, typed_full_name, signed_at")
      .eq("assignment_id", data.id)
      .order("signer_role_label", { ascending: true });

    // Service-role signed URL — a manager-uploaded file's storage `owner`
    // is the manager, not the employee, so the employee couldn't read it
    // under plain bucket RLS. Mirrors listSopAttachments's signed-URL
    // pattern, just via the admin client to close that specific gap.
    let fileUrl: string | null = null;
    if (a.custom_storage_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("gotham-photos")
        .createSignedUrl(a.custom_storage_path, 60 * 60);
      fileUrl = signed?.signedUrl ?? null;
    }

    return { ...a, signatures: sigs ?? [], fileUrl };
  });
