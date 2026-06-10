import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireManager } from "@/lib/auth-guards";
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
  const { data } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
  return data?.trailer_id ?? null;
}

// ---------------- Drawers ----------------

export const listCashDrawers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    trailerId: z.string().uuid(),
    name: z.string().min(1).max(40).regex(/^[a-zA-Z0-9 _-]+$/),
    startingFloat: z.number().min(0).max(100000),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ drawerId: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireManager(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("cash_drawers").update({ enabled: data.enabled }).eq("id", data.drawerId);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- Sessions ----------------

export const openDrawerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ drawerId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: drawer, error: de } = await supabase
      .from("cash_drawers").select("*").eq("id", data.drawerId).single();
    if (de) throw de;
    if (!drawer.enabled) throw new Error("Drawer is disabled");

    // No double-open
    const { data: existing } = await supabase
      .from("cash_drawer_sessions").select("id").eq("drawer_id", data.drawerId).eq("status", "open").is("archived_at", null).maybeSingle();
    if (existing) throw new Error("Drawer is already open");

    const { data: session, error } = await supabase.from("cash_drawer_sessions").insert({
      drawer_id: data.drawerId,
      trailer_id: drawer.trailer_id,
      starting_float: drawer.starting_float,
      opened_by: userId,
    }).select("*").single();
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CloseSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: session, error: se } = await supabase
      .from("cash_drawer_sessions").select("*").eq("id", data.sessionId).single();
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
      throw new Error("Counted cash is below the starting float — owner review is required. Select Request Verification.");
    }
    if (variance !== 0 && !data.varianceReason?.trim()) {
      throw new Error("Variance reason is required when variance is not $0.");
    }

    const needsReview =
      data.verification === "requested" || Number(data.countedAmount) < starting;
    const status = needsReview ? "pending" : "closed";

    const reasonCombined =
      [data.varianceReason, data.varianceNotes].filter((x) => x && String(x).trim()).join(" — ") || null;

    const { error } = await supabase.from("cash_drawer_sessions").update({
      status,
      total_cash_sales: data.totalCashSales,
      counted_amount: data.countedAmount,
      expected_amount: expected,
      variance,
      variance_reason: reasonCombined,
      verification: data.verification,
      closed_by: userId,
      closed_at: new Date().toISOString(),
    }).eq("id", data.sessionId);
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
        payload: { session_id: data.sessionId, variance, expected, counted: data.countedAmount, drop_amount: dropAmount },
      } as any);
    }

    return { ok: true, expected, variance, dropAmount, remainingFloat: starting };
  });

export const getDrawerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: session, error } = await supabase
      .from("cash_drawer_sessions").select("*").eq("id", data.sessionId).single();
    if (error) throw error;
    const { data: drawer } = await supabase
      .from("cash_drawers").select("name, trailer_id").eq("id", session.drawer_id).maybeSingle();
    const { data: trailer } = await supabase
      .from("trailers").select("name, location").eq("id", session.trailer_id).maybeSingle();
    const { data: drops } = await supabase
      .from("cash_drops").select("*").is("archived_at", null).eq("session_id", data.sessionId).order("submitted_at");

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
        .from("profiles").select("id, display_name").in("id", [...ids]);
      names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name]));
    }

    return { session, drawer, trailer, drops: drops ?? [], names };
  });

export const listDrawerSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    trailerId: z.string().uuid().optional(),
    status: z.enum(["open","pending","closed"]).optional(),
    limit: z.number().min(1).max(200).default(50),
  }).optional().parse(d ?? {}))
  .handler(async ({ context, data }) => {
    let q = context.supabase.from("cash_drawer_sessions").select("*").is("archived_at", null)
      .order("opened_at", { ascending: false }).limit(data?.limit ?? 50);
    if (data?.trailerId) q = q.eq("trailer_id", data.trailerId);
    if (data?.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

// ---------------- Drops ----------------

export const submitCashDrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    sessionId: z.string().uuid(),
    amount: z.number().positive().max(100000),
    reason: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: session, error: se } = await supabase
      .from("cash_drawer_sessions").select("*").eq("id", data.sessionId).single();
    if (se) throw se;
    if (session.status !== "open") throw new Error("Drawer is not open");

    const { data: drop, error } = await supabase.from("cash_drops").insert({
      session_id: session.id,
      drawer_id: session.drawer_id,
      trailer_id: session.trailer_id,
      drop_code: dropCode(),
      amount: data.amount,
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      submitted_by: userId,
    }).select("*").single();
    if (error) throw error;
    return drop;
  });

export const verifyCashDrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dropId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireManager(context.supabase, context.userId);
    const { error } = await context.supabase.from("cash_drops").update({
      verified_by: context.userId,
      verified_at: new Date().toISOString(),
    }).eq("id", data.dropId);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- Owner review ----------------

// Variance threshold above which owner approval is mandatory.
const OWNER_APPROVAL_THRESHOLD = 50;

export const reviewDrawerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    sessionId: z.string().uuid(),
    decision: z.enum(["approved","correction","flagged"]),
    note: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Any manager+ may review; final $-variance approval is owner-only.
    await requireManager(supabase, userId);
    const { data: sess, error: se } = await supabase
      .from("cash_drawer_sessions").select("variance").eq("id", data.sessionId).single();
    if (se) throw se;
    const absVar = Math.abs(Number(sess?.variance ?? 0));
    if (data.decision === "approved" && absVar > OWNER_APPROVAL_THRESHOLD) {
      const { data: isOwner } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
      if (!isOwner) throw new Error(`Variance over $${OWNER_APPROVAL_THRESHOLD} requires owner approval.`);
    }
    const { error } = await supabase.from("cash_drawer_sessions").update({
      owner_review: data.decision,
      owner_note: data.note ?? null,
      owner_reviewed_by: userId,
      owner_reviewed_at: new Date().toISOString(),
    }).eq("id", data.sessionId);
    if (error) throw error;
    return { ok: true };
  });


// ---------------------------------------------------------------------------
// Phase 6 — canonical archive/restore + dependency scan for cash domain
// ---------------------------------------------------------------------------

async function _assertManager(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_manager", { _user_id: userId });
  if (!data) throw new Error("Manager access required");
}
async function _assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Owner access required");
}

export const scanDrawerDependencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [sessions, openSession] = await Promise.all([
      supabase.from("cash_drawer_sessions").select("id").eq("drawer_id", data.id),
      supabase.from("cash_drawer_sessions").select("id").eq("drawer_id", data.id).eq("status", "open").is("archived_at", null).maybeSingle(),
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await _assertManager(supabase, userId);
    const { data: openS } = await supabase
      .from("cash_drawer_sessions").select("id")
      .eq("drawer_id", data.id).eq("status", "open").is("archived_at", null).maybeSingle();
    if (openS) {
      const err: any = new Error("HAS_OPEN_SESSION");
      err.code = "HAS_OPEN_SESSION";
      throw err;
    }
    const { error } = await supabase.from("cash_drawers").update({
      archived_at: new Date().toISOString(), archived_by: userId, archive_reason: data.reason ?? null,
      enabled: false,
    } as any).eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "drawer_archived", entity: "cash_drawer", entity_id: data.id, payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreDrawer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await _assertOwner(supabase, userId);
    const { error } = await supabase.from("cash_drawers").update({
      archived_at: null, archived_by: null, archive_reason: null, enabled: true,
    } as any).eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "drawer_restored", entity: "cash_drawer", entity_id: data.id, payload: {},
    });
    return { ok: true };
  });

export const archiveDrawerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await _assertManager(supabase, userId);
    const { data: sess } = await supabase.from("cash_drawer_sessions").select("status").eq("id", data.id).maybeSingle();
    if (sess?.status === "open") {
      const err: any = new Error("SESSION_OPEN");
      err.code = "SESSION_OPEN";
      throw err;
    }
    const { error } = await supabase.from("cash_drawer_sessions").update({
      archived_at: new Date().toISOString(), archived_by: userId, archive_reason: data.reason ?? null,
    } as any).eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "drawer_session_archived", entity: "cash_drawer_session", entity_id: data.id, payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreDrawerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await _assertOwner(supabase, userId);
    const { error } = await supabase.from("cash_drawer_sessions").update({
      archived_at: null, archived_by: null, archive_reason: null,
    } as any).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const archiveCashDrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await _assertManager(supabase, userId);
    const { error } = await supabase.from("cash_drops").update({
      archived_at: new Date().toISOString(), archived_by: userId, archive_reason: data.reason ?? null,
    } as any).eq("id", data.id);
    if (error) throw error;
    await supabase.from("audit_log").insert({
      actor_id: userId, action: "cash_drop_archived", entity: "cash_drop", entity_id: data.id, payload: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const restoreCashDrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await _assertOwner(supabase, userId);
    const { error } = await supabase.from("cash_drops").update({
      archived_at: null, archived_by: null, archive_reason: null,
    } as any).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- Drawer-close PDF attachment ----------------

export const attachDrawerClosePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    sessionId: z.string().uuid(),
    path: z.string().min(1).max(500),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("cash_drawer_sessions").update({
      pdf_path: data.path,
      pdf_uploaded_at: new Date().toISOString(),
    } as any).eq("id", data.sessionId);
    if (error) throw error;

    // Fold the PDF path into any open alerts pointing at this session so
    // manager/owner alert views (and downstream email payloads) can link to it.
    const { data: alerts } = await supabase
      .from("alerts")
      .select("id, payload")
      .eq("source_module", "cash")
      .eq("source_id", data.sessionId);
    for (const a of alerts ?? []) {
      const prev = (a.payload && typeof a.payload === "object" && !Array.isArray(a.payload)) ? a.payload as Record<string, unknown> : {};
      const payload = { ...prev, pdf_path: data.path };
      await supabase.from("alerts").update({ payload } as any).eq("id", a.id);
    }

    return { ok: true };
  });

export const getDrawerClosePdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: sess, error } = await supabase
      .from("cash_drawer_sessions").select("pdf_path").eq("id", data.sessionId).single();
    if (error) throw error;
    if (!sess?.pdf_path) return { url: null as string | null };
    const { data: signed, error: se } = await supabase.storage
      .from("gotham-photos")
      .createSignedUrl(sess.pdf_path, 60 * 60 * 24 * 7); // 7 days
    if (se) throw se;
    return { url: signed?.signedUrl ?? null };
  });

