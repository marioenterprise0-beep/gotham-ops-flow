import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { z } from "zod";
import { requireTabAccess } from "./auth-guards";

async function assertOwner(supabase: any, userId: string, orgId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId);
  const ok = (data ?? []).some((r: any) => r.role === "owner");
  if (!ok) throw new Error("Owner role required to modify SOPs");
  await requireTabAccess(supabase, userId, orgId, "sops", "edit");
}

const ROLE_VALUES = ["owner", "manager", "shift_lead", "grill", "prep", "cashier"] as const;

export const listSops = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({ includeArchived: z.boolean().optional() })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const includeArchived = !!data?.includeArchived;
    let q = context.supabase
      .from("sops")
      .select(
        "id, title, category, role, body, pass_standard, version, archived_at, archive_reason, updated_at",
      )
      .order("updated_at", { ascending: false });
    if (!includeArchived) q = q.is("archived_at", null);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const upsertSop = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(200),
        category: z.string().min(1).max(60),
        role: z.enum(ROLE_VALUES).optional(),
        body: z.string().min(1).max(8000),
        passStandard: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, context.activeOrgId);

    const now = new Date().toISOString();

    if (data.id) {
      // Snapshot prior version before update
      const { data: prev } = await supabase
        .from("sops")
        .select("id, title, body, category, role, pass_standard, version")
        .eq("id", data.id)
        .maybeSingle();
      if (prev) {
        await supabase.from("sop_versions").insert({
          sop_id: prev.id,
          version: prev.version,
          title: prev.title,
          body: prev.body,
          category: prev.category,
          role: prev.role,
          pass_standard: prev.pass_standard,
          edited_by: userId,
        });
      }
      const { error } = await supabase
        .from("sops")
        .update({
          title: data.title,
          category: data.category,
          role: data.role ?? null,
          body: data.body,
          pass_standard: data.passStandard ?? null,
          version: ((prev?.version as number) ?? 1) + 1,
          updated_at: now,
        })
        .eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("sops").insert({
        title: data.title,
        category: data.category,
        role: data.role ?? null,
        body: data.body,
        pass_standard: data.passStandard ?? null,
        updated_at: now,
      });
      if (error) throw error;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: data.id ? "update_sop" : "create_sop",
      entity: "sop",
      entity_id: data.id ?? null,
      payload: { title: data.title, category: data.category },
    });
    return { ok: true };
  });

export const scanSopDependencies = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, context.activeOrgId);
    const targets: Array<{ key: string; label: string; table: string; column: string }> = [
      { key: "acks", label: "Acknowledgements", table: "sop_acknowledgements", column: "sop_id" },
      { key: "views", label: "View records", table: "sop_views", column: "sop_id" },
      { key: "versions", label: "Prior versions", table: "sop_versions", column: "sop_id" },
      { key: "attachments", label: "Attachments", table: "sop_attachments", column: "sop_id" },
    ];
    const counts: Record<string, { label: string; count: number }> = {};
    let total = 0;
    for (const t of targets) {
      const { count } = await (supabase as any)
        .from(t.table)
        .select("id", { count: "exact", head: true })
        .eq(t.column, data.id);
      const c = count ?? 0;
      if (c > 0) {
        counts[t.key] = { label: t.label, count: c };
        total += c;
      }
    }
    return { counts, totalRefs: total };
  });

export const archiveSop = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, context.activeOrgId);
    const { error } = await supabase
      .from("sops")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId,
        archive_reason: data.reason ?? null,
      })
      .eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "archive_sop",
      entity: "sop",
      entity_id: data.id,
      payload: { reason: data.reason ?? null },
    });
    return { ok: true, archived: true };
  });

export const restoreSop = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, context.activeOrgId);
    const { error } = await supabase
      .from("sops")
      .update({
        archived_at: null,
        archived_by: null,
        archive_reason: null,
      })
      .eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "restore_sop",
      entity: "sop",
      entity_id: data.id,
      payload: {},
    });
    return { ok: true, restored: true };
  });

export const deleteSop = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, context.activeOrgId);
    const tables: Array<[string, string]> = [
      ["sop_acknowledgements", "sop_id"],
      ["sop_views", "sop_id"],
      ["sop_versions", "sop_id"],
      ["sop_attachments", "sop_id"],
    ];
    let total = 0;
    for (const [tbl, col] of tables) {
      const { count } = await (supabase as any)
        .from(tbl)
        .select("id", { count: "exact", head: true })
        .eq(col, data.id);
      total += count ?? 0;
    }
    if (total > 0 && !data.force) {
      const err: any = new Error(
        `SOP has ${total} historical reference(s). Archive instead, or pass force=true.`,
      );
      err.code = "HAS_DEPENDENCIES";
      err.totalRefs = total;
      throw err;
    }
    const { error } = await supabase.from("sops").delete().eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "delete_sop",
      entity: "sop",
      entity_id: data.id,
      payload: { force: !!data.force },
    });
    return { ok: true, deleted: true };
  });

export const listSopVersions = createServerFn({ method: "GET" })
  .middleware([requireActiveOrg])
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
  .middleware([requireActiveOrg])
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
        .from("gotham-photos")
        .createSignedUrl(r.storage_path, 60 * 60);
      out.push({ ...r, url: signed?.signedUrl ?? null });
    }
    return out;
  });

export const addSopAttachment = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        sopId: z.string().uuid(),
        storagePath: z.string().min(1).max(500),
        label: z.string().max(120).optional(),
        contentType: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, context.activeOrgId);
    const { error } = await supabase.from("sop_attachments").insert({
      sop_id: data.sopId,
      storage_path: data.storagePath,
      label: data.label ?? null,
      content_type: data.contentType ?? null,
      uploaded_by: userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteSopAttachment = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, context.activeOrgId);
    const { data: row } = await supabase
      .from("sop_attachments")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.storage_path) {
      await supabase.storage.from("gotham-photos").remove([row.storage_path]);
    }
    const { error } = await supabase.from("sop_attachments").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ───── View + acknowledgement tracking ─────

export const recordSopView = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ sopId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase.from("sop_views").insert({ sop_id: data.sopId, user_id: userId });
    return { ok: true };
  });

export const acknowledgeSop = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z.object({ sopId: z.string().uuid(), version: z.number().int().min(1) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("sop_acknowledgements")
      .upsert(
        { sop_id: data.sopId, user_id: userId, version: data.version },
        { onConflict: "sop_id,user_id,version" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const getMySopAcks = createServerFn({ method: "GET" })
  .middleware([requireActiveOrg])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("sop_acknowledgements")
      .select("sop_id, version, acknowledged_at")
      .eq("user_id", userId);
    if (error) throw error;
    return data ?? [];
  });

export const getSopAckRollup = createServerFn({ method: "GET" })
  .middleware([requireActiveOrg])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, context.activeOrgId);

    const [{ data: sops }, { data: profiles }, { data: acks }, { data: views }] = await Promise.all(
      [
        supabase
          .from("sops")
          .select("id, title, category, version, updated_at")
          .is("archived_at", null),
        supabase
          .from("profiles")
          .select("id, display_name, active")
          .eq("active", true)
          .is("archived_at", null),
        supabase.from("sop_acknowledgements").select("sop_id, user_id, version, acknowledged_at"),
        supabase.from("sop_views").select("sop_id, user_id, viewed_at"),
      ],
    );

    const profileList = (profiles ?? []) as any[];
    const totalUsers = profileList.length;

    const latestView = new Map<string, string>();
    for (const v of (views ?? []) as any[]) {
      const k = `${v.sop_id}|${v.user_id}`;
      const prev = latestView.get(k);
      if (!prev || prev < v.viewed_at) latestView.set(k, v.viewed_at);
    }
    const latestAck = new Map<string, { version: number; at: string }>();
    for (const a of (acks ?? []) as any[]) {
      const k = `${a.sop_id}|${a.user_id}`;
      const prev = latestAck.get(k);
      if (!prev || prev.at < a.acknowledged_at)
        latestAck.set(k, { version: a.version, at: a.acknowledged_at });
    }

    return ((sops ?? []) as any[]).map((s) => {
      let viewedCount = 0;
      let ackCurrent = 0;
      let ackStale = 0;
      const pending: { id: string; name: string }[] = [];
      const acknowledged: { id: string; name: string; version: number; at: string }[] = [];
      for (const p of profileList) {
        if (latestView.get(`${s.id}|${p.id}`)) viewedCount++;
        const ak = latestAck.get(`${s.id}|${p.id}`);
        if (ak) {
          if (ak.version >= s.version) {
            ackCurrent++;
            acknowledged.push({ id: p.id, name: p.display_name, version: ak.version, at: ak.at });
          } else {
            ackStale++;
            pending.push({ id: p.id, name: p.display_name });
          }
        } else {
          pending.push({ id: p.id, name: p.display_name });
        }
      }
      return {
        sop_id: s.id,
        title: s.title,
        category: s.category,
        version: s.version,
        updated_at: s.updated_at,
        total_users: totalUsers,
        viewed_count: viewedCount,
        ack_current: ackCurrent,
        ack_stale: ackStale,
        pending,
        acknowledged,
      };
    });
  });
