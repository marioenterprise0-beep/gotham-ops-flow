import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { requireManager, requireOwner } from "@/lib/auth-guards";
// Note: supabaseAdmin is imported dynamically inside handler bodies below to
// keep the service-role client out of the client bundle / module scope.
import { enqueueAlertEmail } from "@/lib/email/enqueue.server";
import type { Recipient } from "@/lib/email/recipients.server";
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
  archive_reason: string | null;
  created_at: string;
  updated_at: string;
};

// RLS on hr_document_templates already hides owner_only (Operations
// category) rows from non-owners — this function just queries; the
// category split is enforced at the database layer, not here.
export const listHrTemplates = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        category: z.enum(["onboarding", "training", "hr", "operations"]).optional(),
        includeArchived: z.boolean().optional(),
      })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    let q = (context.supabase as any)
      .from("hr_document_templates")
      .select(
        "id, doc_code, category, title, body_blocks, signer_roles, owner_only, version, archived_at, archive_reason, created_at, updated_at",
      )
      .order("category", { ascending: true })
      .order("doc_code", { ascending: true });
    if (!data?.includeArchived) q = q.is("archived_at", null);
    if (data?.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as HrDocumentTemplate[];
  });

export const archiveHrTemplate = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId, context.activeOrgId);
    const { error } = await (supabase as any)
      .from("hr_document_templates")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId,
        archive_reason: data.reason ?? null,
      })
      .eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "archive_hr_template",
      entity: "hr_document_template",
      entity_id: data.id,
      payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreHrTemplate = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId, context.activeOrgId);
    const { error } = await (supabase as any)
      .from("hr_document_templates")
      .update({ archived_at: null, archived_by: null, archive_reason: null })
      .eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "restore_hr_template",
      entity: "hr_document_template",
      entity_id: data.id,
      payload: {},
    });
    return { ok: true };
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
  .middleware([requireActiveOrg])
  .inputValidator((d) => assignInputSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);

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
      signerRoles = data.customSignerRoles?.length
        ? data.customSignerRoles
        : ["Employee Signature"];
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
  .middleware([requireActiveOrg])
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
      if (assignment.employee_id !== userId)
        throw new Error("Only the assigned employee can sign this row");
    } else if (DIRECTOR_LABEL_RE.test(data.signerRoleLabel)) {
      await requireOwner(supabase, userId, context.activeOrgId);
    } else {
      await requireManager(supabase, userId, context.activeOrgId);
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
      .update({
        signer_user_id: userId,
        typed_full_name: data.typedFullName.trim(),
        signed_at: new Date().toISOString(),
      })
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
  .middleware([requireActiveOrg])
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
        .update({
          viewed_at: new Date().toISOString(),
          status: a.status === "pending" ? "viewed" : a.status,
        })
        .eq("id", data.id);
    }
    return { ok: true };
  });

export const voidHrAssignment = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { error } = await (supabase as any)
      .from("hr_document_assignments")
      .update({
        status: "voided",
        voided_at: new Date().toISOString(),
        voided_by: userId,
        void_reason: data.reason ?? null,
      })
      .eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "void_hr_document",
      entity: "hr_document_assignment",
      entity_id: data.id,
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
  .middleware([requireActiveOrg])
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
    if (a.status === "voided" || a.status === "signed")
      throw new Error("This document can no longer be edited");

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
      actor_id: userId,
      action: "fill_hr_document_fields",
      entity: "hr_document_assignment",
      entity_id: data.assignmentId,
      payload: { fields: filledKeys },
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
  .middleware([requireActiveOrg])
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
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ employeeId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
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
  .middleware([requireActiveOrg])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);

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

    return withSigs.map((a: any) => ({
      ...a,
      employee_name: nameMap.get(a.employee_id) ?? "Unknown",
    })) as HrCompletionRow[];
  });

// RLS on hr_document_assignments already restricts the SELECT to the
// assignment's own employee or a manager/owner, so by the time `a` loads
// successfully here, access is already validated — no second check needed.
export const getHrAssignmentDetail = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
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
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage
        .from("gotham-photos")
        .createSignedUrl(a.custom_storage_path, 60 * 60);
      fileUrl = signed?.signedUrl ?? null;
    }

    return { ...a, signatures: sigs ?? [], fileUrl };
  });

// Sends the completed-document PDF (already generated client-side and
// uploaded by the caller — see hr-document-pdf.ts — since this app
// deploys to Cloudflare Workers, where real PDF libraries don't reliably
// run) to the two fixed compliance addresses. Uses synthetic recipient
// ids rather than looking up real accounts: this is a compliance record
// copy, not a personal alert, so it must never be silently suppressed by
// someone's notification_preferences mute toggle.
export const notifyHrDocumentCompletion = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({ assignmentId: z.string().uuid(), pdfStoragePath: z.string().min(1).max(500) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a, error } = await (supabaseAdmin as any)
      .from("hr_document_assignments")
      .select("id, title, employee_id, status, completed_at, custom_storage_path")
      .eq("id", data.assignmentId)
      .maybeSingle();
    if (error) throw error;
    if (!a) throw new Error("Assignment not found");
    if (a.status !== "signed") throw new Error("Document is not fully signed yet");

    // Only the assignment's own employee, or a manager/owner, may trigger
    // the compliance email. Defense-in-depth on top of RLS.
    // Use the user-scoped client (context.supabase) — is_manager() reads
    // current_organization_id() which is only stamped on PostgREST requests
    // authenticated as the user. A supabaseAdmin RPC would run outside the
    // pre_request hook and return false regardless of the caller's role.
    const { data: isMgr } = await context.supabase.rpc("is_manager", {
      _user_id: userId,
      _org_id: context.activeOrgId,
    });
    if (userId !== a.employee_id && !isMgr) {
      throw new Error("Not authorized for this assignment");
    }

    // Reject attacker-supplied storage paths. The only acceptable values are
    // the canonical generated path for this assignment, or a manager-curated
    // custom_storage_path already on the row. This stops a crew member from
    // pointing the compliance email at arbitrary uploaded files.
    const canonicalPath = `hr-docs/completed/${data.assignmentId}.pdf`;
    const allowedPaths = new Set<string>([canonicalPath]);
    if (a.custom_storage_path) allowedPaths.add(a.custom_storage_path);
    if (!allowedPaths.has(data.pdfStoragePath)) {
      throw new Error("Invalid storage path for this assignment");
    }

    await (supabaseAdmin as any)
      .from("hr_document_assignments")
      .update({ completed_pdf_path: data.pdfStoragePath })
      .eq("id", data.assignmentId);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", a.employee_id)
      .maybeSingle();

    const { data: signed } = await supabaseAdmin.storage
      .from("gotham-photos")
      .createSignedUrl(data.pdfStoragePath, 60 * 60 * 24 * 7); // 7 days — long enough to act on

    // Configurable via env so the recipient list can be rotated without a
    // code change; falls back to the original addresses if unset.
    const complianceEmails = (
      process.env.HR_COMPLIANCE_EMAILS ?? "hello@dipnshake.com,mario@dipnshake.com"
    )
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    const recipients: Recipient[] = complianceEmails.map((email) => ({
      user_id: crypto.randomUUID(),
      email,
      display_name: "Dip N Shake",
      role: "owner",
    }));

    const templateData = {
      title: a.title,
      employee_name: profile?.display_name ?? "Employee",
      completed_at: a.completed_at
        ? new Date(a.completed_at).toLocaleString()
        : new Date().toLocaleString(),
      pdf_url: signed?.signedUrl ?? null,
    };

    await enqueueAlertEmail({
      alertId: null,
      templateName: "hr-document-completed-record",
      templateData,
      recipients,
      category: "hr_documents",
      priority: "normal",
      subject: `[Dip N Shake] Completed: ${a.title} — ${templateData.employee_name}`,
      sourceModule: "hr_documents",
      sourceId: a.id,
    });

    return { ok: true };
  });
