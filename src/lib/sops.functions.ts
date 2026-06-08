import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireTabAccess } from "./auth-guards";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => r.role === "owner");
  if (!ok) throw new Error("Owner role required to modify SOPs");
  await requireTabAccess(supabase, userId, "sops", "edit");
}

const ROLE_VALUES = ["owner", "manager", "shift_lead", "grill", "prep", "cashier"] as const;

export const listSops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sops")
      .select("id, title, category, role, body, pass_standard, version, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const upsertSop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    category: z.string().min(1).max(60),
    role: z.enum(ROLE_VALUES).optional(),
    body: z.string().min(1).max(8000),
    passStandard: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);

    const now = new Date().toISOString();

    if (data.id) {
      // Snapshot prior version before update
      const { data: prev } = await supabase.from("sops").select("id, title, body, category, role, pass_standard, version").eq("id", data.id).maybeSingle();
      if (prev) {
        await supabase.from("sop_versions").insert({
          sop_id: prev.id, version: prev.version, title: prev.title, body: prev.body,
          category: prev.category, role: prev.role, pass_standard: prev.pass_standard,
          edited_by: userId,
        });
      }
      const { error } = await supabase.from("sops").update({
        title: data.title, category: data.category, role: data.role ?? null,
        body: data.body, pass_standard: data.passStandard ?? null,
        version: ((prev?.version as number) ?? 1) + 1,
        updated_at: now,
      }).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("sops").insert({
        title: data.title, category: data.category, role: data.role ?? null,
        body: data.body, pass_standard: data.passStandard ?? null,
        updated_at: now,
      });
      if (error) throw error;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId, action: data.id ? "update_sop" : "create_sop", entity: "sop",
      entity_id: data.id ?? null, payload: { title: data.title, category: data.category },
    });
    return { ok: true };
  });

export const deleteSop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error } = await supabase.from("sops").delete().eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "delete_sop", entity: "sop", entity_id: data.id, payload: {},
    });
    return { ok: true };
  });

export const listSopVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sopId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("sop_versions")
      .select("id, version, title, body, category, role, pass_standard, edited_by, edited_at")
      .eq("sop_id", data.sopId)
      .order("version", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const listSopAttachments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sopId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("sop_attachments")
      .select("id, storage_path, label, content_type, created_at")
      .eq("sop_id", data.sopId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    // Sign URLs (gotham-photos is private)
    const out: any[] = [];
    for (const r of rows ?? []) {
      const { data: signed } = await context.supabase.storage
        .from("gotham-photos").createSignedUrl(r.storage_path, 60 * 60);
      out.push({ ...r, url: signed?.signedUrl ?? null });
    }
    return out;
  });

export const addSopAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    sopId: z.string().uuid(),
    storagePath: z.string().min(1).max(500),
    label: z.string().max(120).optional(),
    contentType: z.string().max(120).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { error } = await supabase.from("sop_attachments").insert({
      sop_id: data.sopId, storage_path: data.storagePath,
      label: data.label ?? null, content_type: data.contentType ?? null,
      uploaded_by: userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteSopAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId);
    const { data: row } = await supabase.from("sop_attachments").select("storage_path").eq("id", data.id).maybeSingle();
    if (row?.storage_path) {
      await supabase.storage.from("gotham-photos").remove([row.storage_path]);
    }
    const { error } = await supabase.from("sop_attachments").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
