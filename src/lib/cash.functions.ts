import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { requireManager, requireOwner } from "@/lib/auth-guards";
import { z } from "zod";
import crypto from "crypto";

function dropCode() {
  // GH-XXXXXX  (6 alphanumeric, crypto-strong)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[crypto.randomInt(0, alphabet.length)];
  return `CD-${s}`;
}

async function userTrailerId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("trailer_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.trailer_id ?? null;
}

// ---------------- Drawers ----------------

export const listCashDrawers = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ trailerId: z.string().uuid().optional() }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let trailerId = data?.trailerId ?? null;
    if (!trailerId) trailerId = await userTrailerId(supabase, userId);

    let q = supabase.from("cash_drawers").select("*").is("archived_at", null).order("name");
    if (trailerId) q = q.eq("trailer_id", trailerId);
    const { data: drawers, error } = await q;
    if (error) throw error;

    // Attach the currently open session for each drawer (if any)
    const ids = (drawers ?? []).map((d: any) => d.id);
    let sessions: any[] = [];
    if (ids.length) {
      const { data: ss } = await supabase
        .from("cash_drawer_sessions")
        .select("*")
        .in("drawer_id", ids)
        .eq("status", "open")
        .is("archived_at", null);
      sessions = ss ?? [];
    }
    const withOpen = (drawers ?? []).map((d: any) => {
      const open = sessions.find((s) => s.drawer_id === d.id) ?? null;
      return { ...d, open_session: open };
    });
    return withOpen;
  });

export const addCashDrawer = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        trailerId: z.string().uuid(),
        name: z
          .string()
          .min(1)
          .max(40)
          .regex(/^[a-zA-Z0-9 _-]+$/),
        startingFloat: z.number().min(0).max(100000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId, context.activeOrgId);
    const { error } = await supabase.from("cash_drawers").insert({
      trailer_id: data.trailerId,
      name: data.name,
      starting_float: data.startingFloat,
      created_by: userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const toggleCashDrawer = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ drawerId: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireManager(context.supabase, context.userId, context.activeOrgId);
    const { error } = await context.supabase
      .from("cash_drawers")
      .update({ enabled: data.enabled })
      .eq("id", data.drawerId);
    if (error) throw error;
    return { ok: true };
  });

export const renameCashDrawer = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        drawerId: z.string().uuid(),
        name: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .regex(/^[a-zA-Z0-9 _-]+$/, "Only letters, numbers, spaces, _ and -"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId, context.activeOrgId);
    const { error } = await supabase
      .from("cash_drawers")
      .update({ name: data.name })
      .eq("id", data.drawerId);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- Sessions ----------------

export const openDrawerSession = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ drawerId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: drawer, error: de } = await supabase
      .from("cash_drawers")
      .select("*")
      .eq("id", data.drawerId)
      .single();
    if (de) throw de;
    if (!drawer.enabled) throw new Error("Drawer is disabled");

    // No double-open
    const { data: existing } = await supabase
      .from("cash_drawer_sessions")
      .select("id")
      .eq("drawer_id", data.drawerId)
      .eq("status", "open")
      .is("archived_at", null)
      .maybeSingle();
    if (existing) throw new Error("Drawer is already open");

    const { data: session, error } = await supabase
      .from("cash_drawer_sessions")
      .insert({
        drawer_id: data.drawerId,
        trailer_id: drawer.trailer_id,
        starting_float: drawer.starting_float,
        opened_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return session;
  });

const CloseSchema = z.object({
  sessionId: z.string().uuid(),
  totalCashSales: z.number().min(0).max(1_000_000),
  countedAmount: z.number().min(0).max(1_000_000),
  varianceReason: z.string().max(500).optional(),
  varianceNotes: z.string().max(2000).optional(),
  verification: z.enum(["self", "requested", "verified"]).default("self"),
});

export const closeDrawerSession = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => CloseSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: session, error: se } = await supabase
      .from("cash_drawer_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (se) throw se;
    if (session.status === "closed") throw new Error("Session already closed");

    const starting = Number(session.starting_float);
    // CORRECT MODEL: the float stays in the drawer and is counted with the cash.
    //   Expected Drawer Total = Starting Float + Total Cash Sales
    //   Variance              = Actual Cash Counted - Expected Drawer Total
    //   Drop Amount           = Actual Cash Counted - Starting Float
    //   Remaining Float       = Starting Float (the float is left in the drawer)
    const expected = starting + Number(data.totalCashSales);
    const variance = Number(data.countedAmount) - expected;
    const dropAmount = Number(data.countedAmount) - starting;

    // Block: counted below float => critical, force owner review path
    if (Number(data.countedAmount) < starting && data.verification !== "requested") {
      throw new Error(
        "Counted cash is below the starting float — owner review is required. Select Request Verification.",
      );
    }
    if (variance !== 0 && !data.varianceReason?.trim()) {
      throw new Error("Variance reason is required when variance is not $0.");
    }

    const needsReview = data.verification === "requested" || Number(data.countedAmount) < starting;
    const status = needsReview ? "pending" : "closed";

    const reasonCombined =
      [data.varianceReason, data.varianceNotes].filter((x) => x && String(x).trim()).join(" — ") ||
      null;

    const { error } = await supabase
      .from("cash_drawer_sessions")
      .update({
        status,
        total_cash_sales: data.totalCashSales,
        counted_amount: data.countedAmount,
        expected_amount: expected,
        variance,
        variance_reason: reasonCombined,
        verification: data.verification,
        closed_by: userId,
        closed_at: new Date().toISOString(),
      })
      .eq("id", data.sessionId);
    if (error) throw error;

    // Variance alerts: >$20 manager, >$50 owner
    const absVar = Math.abs(variance);
    if (absVar > 20) {
      const assigned = absVar > 50 ? "owner" : "manager";
      const priority = absVar > 50 ? "critical" : "high";
      await supabase.from("alerts").insert({
        type: "manager_note",
        title: `Cash variance ${variance >= 0 ? "+" : ""}$${variance.toFixed(2)} — drawer close`,
        description: `Counted $${Number(data.countedAmount).toFixed(2)} vs expected $${expected.toFixed(2)}. Drop $${dropAmount.toFixed(2)}. Reason: ${data.varianceReason ?? "—"}`,
        source_module: "cash",
        source_id: data.sessionId,
        trailer_id: session.trailer_id,
        created_by: userId,
        assigned_role: assigned,
        priority,
        status: "pending",
        payload: {
          session_id: data.sessionId,
          variance,
          expected,
          counted: data.countedAmount,
          drop_amount: dropAmount,
        },
      } as any);
    }

    return { ok: true, expected, variance, dropAmount, remainingFloat: starting };
  });

export const getDrawerSession = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: session, error } = await supabase
      .from("cash_drawer_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (error) throw error;
    const { data: drawer } = await supabase
      .from("cash_drawers")
      .select("name, trailer_id")
      .eq("id", session.drawer_id)
      .maybeSingle();
    const { data: trailer } = await supabase
      .from("trailers")
      .select("name, location")
      .eq("id", session.trailer_id)
      .maybeSingle();
    const { data: drops } = await supabase
      .from("cash_drops")
      .select("*")
      .is("archived_at", null)
      .eq("session_id", data.sessionId)
      .order("submitted_at");

    // Resolve user display names
    const ids = new Set<string>();
    if (session.opened_by) ids.add(session.opened_by);
    if (session.closed_by) ids.add(session.closed_by);
    if (session.owner_reviewed_by) ids.add(session.owner_reviewed_by);
    (drops ?? []).forEach((d: any) => {
      if (d.submitted_by) ids.add(d.submitted_by);
      if (d.verified_by) ids.add(d.verified_by);
    });
    let names: Record<string, string> = {};
    if (ids.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", [...ids]);
      names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name]));
    }

    return { session, drawer, trailer, drops: drops ?? [], names };
  });

export const listDrawerSessions = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        trailerId: z.string().uuid().optional(),
        status: z.enum(["open", "pending", "closed"]).optional(),
        limit: z.number().min(1).max(200).default(50),
      })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("cash_drawer_sessions")
      .select("*")
      .is("archived_at", null)
      .order("opened_at", { ascending: false })
      .limit(data?.limit ?? 50);
    if (data?.trailerId) q = q.eq("trailer_id", data.trailerId);
    if (data?.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

// ---------------- Drops ----------------

export const submitCashDrop = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        amount: z.number().positive().max(100000),
        reason: z.string().max(200).optional(),
        notes: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: session, error: se } = await supabase
      .from("cash_drawer_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (se) throw se;
    if (session.status !== "open") throw new Error("Drawer is not open");

    const { data: drop, error } = await supabase
      .from("cash_drops")
      .insert({
        session_id: session.id,
        drawer_id: session.drawer_id,
        trailer_id: session.trailer_id,
        drop_code: dropCode(),
        amount: data.amount,
        reason: data.reason ?? null,
        notes: data.notes ?? null,
        submitted_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return drop;
  });

export const verifyCashDrop = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ dropId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireManager(context.supabase, context.userId, context.activeOrgId);
    const { error } = await context.supabase
      .from("cash_drops")
      .update({
        verified_by: context.userId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", data.dropId);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- Owner review ----------------

// Variance threshold above which owner approval is mandatory.
const OWNER_APPROVAL_THRESHOLD = 50;

export const reviewDrawerSession = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        decision: z.enum(["approved", "correction", "flagged"]),
        note: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Any manager+ may review; final $-variance approval is owner-only.
    await requireManager(supabase, userId, context.activeOrgId);
    const { data: sess, error: se } = await supabase
      .from("cash_drawer_sessions")
      .select("variance")
      .eq("id", data.sessionId)
      .single();
    if (se) throw se;
    const absVar = Math.abs(Number(sess?.variance ?? 0));
    if (data.decision === "approved" && absVar > OWNER_APPROVAL_THRESHOLD) {
      const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _org_id: context.activeOrgId, _role: "owner" });
      if (!isOwner)
        throw new Error(`Variance over $${OWNER_APPROVAL_THRESHOLD} requires owner approval.`);
    }
    const { error } = await supabase
      .from("cash_drawer_sessions")
      .update({
        owner_review: data.decision,
        owner_note: data.note ?? null,
        owner_reviewed_by: userId,
        owner_reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.sessionId);
    if (error) throw error;
    return { ok: true };
  });

// Owner-only edit of a submitted (closed/pending) drawer session.
// Recomputes expected and variance from inputs so totals stay consistent.
export const editDrawerSession = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        startingFloat: z.number().min(0).optional(),
        totalCashSales: z.number().min(0).optional(),
        countedAmount: z.number().min(0).optional(),
        varianceReason: z.string().max(2000).nullable().optional(),
        editNote: z.string().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _org_id: context.activeOrgId, _role: "owner" });
    if (!isOwner) throw new Error("Only the owner can edit submitted drawer sessions.");

    const { data: sess, error: se } = await supabase
      .from("cash_drawer_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (se) throw se;
    if (sess.status === "open") throw new Error("Session is still open — close it first.");

    const starting = data.startingFloat ?? Number(sess.starting_float);
    const sales = data.totalCashSales ?? Number(sess.total_cash_sales ?? 0);
    const counted = data.countedAmount ?? Number(sess.counted_amount ?? 0);
    const expected = starting + sales;
    const variance = counted - expected;

    const patch: Record<string, any> = {
      starting_float: starting,
      total_cash_sales: sales,
      counted_amount: counted,
      expected_amount: expected,
      variance,
    };
    if (data.varianceReason !== undefined) patch.variance_reason = data.varianceReason;

    const { error } = await supabase
      .from("cash_drawer_sessions")
      .update(patch as any)
      .eq("id", data.sessionId);
    if (error) throw error;

    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "cash.session.edit",
      entity: "cash_drawer_session",
      entity_id: data.sessionId,
      payload: {
        before: {
          starting_float: sess.starting_float,
          total_cash_sales: sess.total_cash_sales,
          counted_amount: sess.counted_amount,
          expected_amount: sess.expected_amount,
          variance: sess.variance,
          variance_reason: sess.variance_reason,
        },
        after: patch,
        note: data.editNote ?? null,
      },
    });

    return { ok: true, expected, variance };
  });

// ---------------------------------------------------------------------------
// Phase 6 — canonical archive/restore + dependency scan for cash domain
// ---------------------------------------------------------------------------

async function _assertManager(supabase: any, userId: string, orgId: string) {
  const { data } = await supabase.rpc("is_manager", { _user_id: userId, _org_id: orgId });
  if (!data) throw new Error("Manager access required");
}
async function _assertOwner(supabase: any, userId: string, orgId: string) {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _org_id: orgId,
    _role: "owner",
  });
  if (!data) throw new Error("Owner access required");
}

export const scanDrawerDependencies = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [sessions, openSession] = await Promise.all([
      supabase.from("cash_drawer_sessions").select("id").eq("drawer_id", data.id),
      supabase
        .from("cash_drawer_sessions")
        .select("id")
        .eq("drawer_id", data.id)
        .eq("status", "open")
        .is("archived_at", null)
        .maybeSingle(),
    ]);
    const total = sessions.data?.length ?? 0;
    return {
      sessions: total,
      hasOpenSession: !!openSession.data,
      total,
      hasDependencies: total > 0,
    };
  });

export const archiveDrawer = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await _assertManager(supabase, userId, context.activeOrgId);
    const { data: openS } = await supabase
      .from("cash_drawer_sessions")
      .select("id")
      .eq("drawer_id", data.id)
      .eq("status", "open")
      .is("archived_at", null)
      .maybeSingle();
    if (openS) {
      const err: any = new Error("HAS_OPEN_SESSION");
      err.code = "HAS_OPEN_SESSION";
      throw err;
    }
    const { error } = await supabase
      .from("cash_drawers")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId,
        archive_reason: data.reason ?? null,
        enabled: false,
      } as any)
      .eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "drawer_archived",
      entity: "cash_drawer",
      entity_id: data.id,
      payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreDrawer = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await _assertOwner(supabase, userId, context.activeOrgId);
    const { error } = await supabase
      .from("cash_drawers")
      .update({
        archived_at: null,
        archived_by: null,
        archive_reason: null,
        enabled: true,
      } as any)
      .eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "drawer_restored",
      entity: "cash_drawer",
      entity_id: data.id,
      payload: {},
    });
    return { ok: true };
  });

export const archiveDrawerSession = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await _assertManager(supabase, userId, context.activeOrgId);
    const { data: sess } = await supabase
      .from("cash_drawer_sessions")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (sess?.status === "open") {
      const err: any = new Error("SESSION_OPEN");
      err.code = "SESSION_OPEN";
      throw err;
    }
    const { error } = await supabase
      .from("cash_drawer_sessions")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId,
        archive_reason: data.reason ?? null,
      } as any)
      .eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "drawer_session_archived",
      entity: "cash_drawer_session",
      entity_id: data.id,
      payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreDrawerSession = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await _assertOwner(supabase, userId, context.activeOrgId);
    const { error } = await supabase
      .from("cash_drawer_sessions")
      .update({
        archived_at: null,
        archived_by: null,
        archive_reason: null,
      } as any)
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const archiveCashDrop = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await _assertManager(supabase, userId, context.activeOrgId);
    const { error } = await supabase
      .from("cash_drops")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId,
        archive_reason: data.reason ?? null,
      } as any)
      .eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "cash_drop_archived",
      entity: "cash_drop",
      entity_id: data.id,
      payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreCashDrop = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await _assertOwner(supabase, userId, context.activeOrgId);
    const { error } = await supabase
      .from("cash_drops")
      .update({
        archived_at: null,
        archived_by: null,
        archive_reason: null,
      } as any)
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- Drawer-close PDF attachment ----------------

export const attachDrawerClosePdf = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        path: z.string().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("cash_drawer_sessions")
      .update({
        pdf_path: data.path,
        pdf_uploaded_at: new Date().toISOString(),
      } as any)
      .eq("id", data.sessionId);
    if (error) throw error;

    // Fold the PDF path into any open alerts pointing at this session so
    // manager/owner alert views (and downstream email payloads) can link to it.
    const { data: alerts } = await supabase
      .from("alerts")
      .select("id, payload")
      .eq("source_module", "cash")
      .eq("source_id", data.sessionId);
    for (const a of alerts ?? []) {
      const prev =
        a.payload && typeof a.payload === "object" && !Array.isArray(a.payload)
          ? (a.payload as Record<string, unknown>)
          : {};
      const payload = { ...prev, pdf_path: data.path };
      await supabase
        .from("alerts")
        .update({ payload } as any)
        .eq("id", a.id);
    }

    return { ok: true };
  });

export const getDrawerClosePdfUrl = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: sess, error } = await supabase
      .from("cash_drawer_sessions")
      .select("pdf_path")
      .eq("id", data.sessionId)
      .single();
    if (error) throw error;
    if (!sess?.pdf_path) return { url: null as string | null };
    const { data: signed, error: se } = await supabase.storage
      .from("gotham-photos")
      .createSignedUrl(sess.pdf_path, 60 * 60 * 24 * 7); // 7 days
    if (se) throw se;
    return { url: signed?.signedUrl ?? null };
  });

// ---------------- Drawer-close email (Resend, with PDF attachment) ----------------

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend/emails";

function _money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return `$${v.toFixed(2)}`;
}
function _esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

export const sendDrawerCloseAlertEmail = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        extraRecipients: z.array(z.string().email()).max(10).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    if (!lovableKey || !resendKey) {
      throw new Error("Email gateway not configured (missing LOVABLE_API_KEY or RESEND_API_KEY)");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authorization: only owners/managers may trigger cash alert emails.
    // Managers are additionally constrained to sessions for their own trailer.
    const { userId } = context as any;
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (callerRoles ?? []).map((r: any) => r.role as string);
    const isOwner = roles.includes("owner");
    const isManager = roles.includes("manager");
    if (!isOwner && !isManager) {
      throw new Error("Manager role required to send cash drawer alert emails");
    }

    const { data: sess, error: sErr } = await supabaseAdmin
      .from("cash_drawer_sessions")
      .select(
        "id, trailer_id, drawer_id, counted_amount, expected_amount, variance, variance_reason, closed_at, closed_by, pdf_path",
      )
      .eq("id", data.sessionId)
      .single();
    if (sErr || !sess) throw sErr ?? new Error("Session not found");

    if (!isOwner) {
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("trailer_id")
        .eq("id", userId)
        .maybeSingle();
      const callerTrailer = (callerProfile as any)?.trailer_id ?? null;
      if (callerTrailer && callerTrailer !== sess.trailer_id) {
        throw new Error("Cannot send cash alert for a session outside your location");
      }
    }

    const [{ data: drawer }, { data: trailer }, { data: submitter }] = await Promise.all([
      supabaseAdmin.from("cash_drawers").select("name").eq("id", sess.drawer_id).maybeSingle(),
      supabaseAdmin.from("trailers").select("name").eq("id", sess.trailer_id).maybeSingle(),
      sess.closed_by
        ? supabaseAdmin
            .from("profiles")
            .select("display_name, email")
            .eq("id", sess.closed_by)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

    // Recipients = owners + managers with email_enabled + categories.cash on, scoped to trailer (or unassigned).
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["owner", "manager"] as any);
    const uids = (roleRows ?? []).map((r: any) => r.user_id);
    let recipients: string[] = [];
    if (uids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, email, trailer_id")
        .in("id", uids);
      const allowed = (profs ?? []).filter(
        (p: any) => p.email && (p.trailer_id == null || p.trailer_id === sess.trailer_id),
      );
      const allowedIds = allowed.map((p: any) => p.id);
      const emailById = new Map(allowed.map((p: any) => [p.id, p.email]));
      const { data: prefs } = await supabaseAdmin
        .from("notification_preferences")
        .select("user_id, email_enabled, categories")
        .in("user_id", allowedIds);
      for (const id of allowedIds) {
        const pref = (prefs ?? []).find((p: any) => p.user_id === id);
        const enabled = pref ? pref.email_enabled !== false : true;
        const cats = (pref?.categories ?? {}) as Record<string, boolean>;
        const cashOn = cats.cash !== false;
        if (enabled && cashOn) recipients.push(emailById.get(id) as string);
      }
    }
    for (const r of data.extraRecipients ?? []) recipients.push(r);
    recipients = Array.from(new Set(recipients.map((r) => r.toLowerCase())));
    if (recipients.length === 0) {
      return { ok: true, sent: 0, skipped: "no_recipients" as const };
    }

    // Pull PDF bytes from storage and base64-encode for the Resend attachment.
    let attachment: { filename: string; content: string } | null = null;
    if (sess.pdf_path) {
      const { data: file, error: dlErr } = await supabaseAdmin.storage
        .from("gotham-photos")
        .download(sess.pdf_path);
      if (!dlErr && file) {
        const buf = Buffer.from(await file.arrayBuffer());
        const filename = sess.pdf_path.split("/").pop() || "drawer-close.pdf";
        attachment = { filename, content: buf.toString("base64") };
      }
    }

    const variance = Number(sess.variance ?? 0);
    const absVar = Math.abs(variance);
    const severity =
      absVar >= 50 ? "CRITICAL" : absVar >= 20 ? "HIGH" : absVar >= 5 ? "REVIEW" : "OK";
    const trailerName = trailer?.name ?? "Location";
    const drawerName = drawer?.name ?? "Drawer";
    const subject = `[${severity}] Drawer Closed — ${trailerName} · ${drawerName} · Variance ${variance >= 0 ? "+" : ""}${_money(variance)}`;
    const varColor = absVar >= 20 ? "#b91c1c" : absVar >= 5 ? "#b45309" : "#047857";

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#ffffff;color:#0b0d10;padding:24px;">
        <div style="max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <div style="padding:18px 22px;background:#0b0d10;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.7;">Dip N Shake · Cash Activity</div>
            <div style="font-size:18px;font-weight:700;margin-top:4px;">Drawer Closed — ${_esc(trailerName)}</div>
          </div>
          <div style="padding:18px 22px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:6px 0;color:#6b7280;">Drawer</td><td style="text-align:right;font-weight:600;">${_esc(drawerName)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Closed by</td><td style="text-align:right;">${_esc(submitter?.display_name ?? "—")}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Counted</td><td style="text-align:right;">${_money(sess.counted_amount as any)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Expected</td><td style="text-align:right;">${_money(sess.expected_amount as any)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Variance</td><td style="text-align:right;font-weight:700;color:${varColor};">${variance >= 0 ? "+" : ""}${_money(variance)}</td></tr>
              ${sess.variance_reason ? `<tr><td style="padding:6px 0;color:#6b7280;">Reason</td><td style="text-align:right;">${_esc(String(sess.variance_reason))}</td></tr>` : ""}
            </table>
            
            <div style="margin-top:16px;font-size:12px;color:#6b7280;">
              ${attachment ? "Drawer Close PDF attached." : "PDF not yet available — see Cash Activity in the app."}
              ${absVar > 50 ? "<br/><b>Owner approval required</b> (variance &gt; $50)." : ""}
            </div>
          </div>
        </div>
      </div>
    `;

    const FALLBACK_FROM = "Dip N Shake <onboarding@resend.dev>";
    // Resend requires "email@example.com" or "Name <email@example.com>".
    // Validate the env override; fall back if it's malformed so a bad secret doesn't break sends.
    const fromRaw = (process.env.CASH_EMAIL_FROM || "").trim();
    const fromValid =
      /^[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+$/.test(fromRaw) ||
      /^[^<>]+<\s*[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+\s*>$/.test(fromRaw);
    const from = fromValid ? fromRaw : FALLBACK_FROM;
    const body: Record<string, unknown> = { from, to: recipients, subject, html };
    if (attachment) body.attachments = [attachment];

    // Retry on transient failures: network errors, HTTP 429, HTTP 5xx.
    // Backoff: 1s, 3s, 7s (max 4 attempts total).
    const delays = [1000, 3000, 7000];
    const attempts: Array<{ attempt: number; status?: number; error: string }> = [];
    let lastErr: { status?: number; message: string } | null = null;
    let success = false;
    let providerId: string | null = null;

    for (let i = 0; i <= delays.length; i++) {
      try {
        const res = await fetch(RESEND_GATEWAY, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey,
          },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        if (res.ok) {
          try {
            providerId = (JSON.parse(text) as any)?.id ?? null;
          } catch {
            /* ignore */
          }
          success = true;
          break;
        }
        const transient = res.status === 429 || res.status >= 500;
        attempts.push({ attempt: i + 1, status: res.status, error: text.slice(0, 200) });
        lastErr = { status: res.status, message: text.slice(0, 400) };
        if (!transient) break; // 4xx (e.g. 401/403/422) – no point retrying
      } catch (e: any) {
        attempts.push({ attempt: i + 1, error: String(e?.message ?? e).slice(0, 200) });
        lastErr = { message: String(e?.message ?? e).slice(0, 400) };
      }
      if (i < delays.length) await new Promise((r) => setTimeout(r, delays[i]));
    }

    if (success) {
      return {
        ok: true,
        sent: recipients.length,
        attached: !!attachment,
        attempts: attempts.length + 1,
        providerId,
      };
    }

    // All retries exhausted – raise a critical in-app alert to the owner so the
    // failure is visible even though no email got through.
    try {
      await supabaseAdmin.from("alerts").insert({
        type: "manager_note" as any,
        title: `Cash alert email failed — ${trailerName} · ${drawerName}`,
        description:
          `Could not deliver Drawer Close email to ${recipients.length} recipient(s) after ${attempts.length} attempt(s). ` +
          `Last error: ${lastErr?.status ? `HTTP ${lastErr.status} – ` : ""}${lastErr?.message ?? "unknown"}`,
        source_module: "cash",
        source_id: data.sessionId,
        trailer_id: sess.trailer_id,
        created_by: sess.closed_by,
        assigned_role: "owner" as any,
        priority: "critical" as any,
        status: "pending" as any,
        payload: {
          session_id: data.sessionId,
          pdf_path: sess.pdf_path,
          recipients,
          attempts,
          last_error: lastErr,
          variance,
        } as any,
      } as any);
    } catch {
      /* never let alert insert mask the original error */
    }

    throw new Error(
      `Resend failed after ${attempts.length} attempt(s)` +
        (lastErr?.status ? ` (HTTP ${lastErr.status})` : "") +
        `: ${lastErr?.message ?? "unknown"}`,
    );
  });
