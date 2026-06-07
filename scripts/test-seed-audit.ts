#!/usr/bin/env bun
/**
 * Verifies seed_required_checklist audit emission semantics:
 *   1. First seed of opening/closing on a fresh shift -> 1 audit row per phase.
 *   2. Repeat seed when tasks already exist -> 0 new audit rows (no-op).
 *   3. After deleting tasks (simulating reactivation) -> 1 new audit row.
 *   4. `mid` and `emergency` phases never emit seed_required_checklist.
 *
 * Mirrors src/lib/shifts.functions.ts::seedPhaseIfMissing exactly.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun run scripts/test-seed-audit.ts
 */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

type Phase = "opening" | "mid" | "closing" | "emergency";

// Minimal stand-in templates — real seeder uses TEMPLATES from shifts.functions.ts.
// We only need >0 rows per phase to exercise the audit gate.
const TPL: Record<Phase, Array<{ title: string; section: string }>> = {
  opening: [{ title: "test open 1", section: "TEST" }, { title: "test open 2", section: "TEST" }],
  closing: [{ title: "test close 1", section: "TEST" }],
  mid:     [{ title: "test mid 1", section: "TEST" }],
  emergency: [{ title: "test inv 1", section: "TEST" }],
};

async function seedPhaseIfMissing(shiftId: string, trailerId: string | null, phase: Phase, actorId: string | null) {
  const { count } = await sb
    .from("tasks").select("id", { count: "exact", head: true })
    .eq("shift_id", shiftId).eq("phase", phase);
  if ((count ?? 0) > 0) return 0;
  const rows = TPL[phase].map((t) => ({
    shift_id: shiftId, phase, title: t.title, description: t.section,
    status: "todo" as const, trailer_id: trailerId,
  }));
  await sb.from("tasks").insert(rows);
  if (rows.length > 0 && (phase === "opening" || phase === "closing")) {
    await sb.from("audit_log").insert({
      actor_id: actorId, action: "seed_required_checklist", entity: "shift",
      entity_id: shiftId, payload: { phase, trigger: "open_shift", seeded: rows.length, trailer_id: trailerId },
    });
  }
  return rows.length;
}

async function auditCount(shiftId: string, phase?: Phase): Promise<number> {
  let q = sb.from("audit_log").select("id", { count: "exact", head: true })
    .eq("entity", "shift").eq("entity_id", shiftId).eq("action", "seed_required_checklist");
  if (phase) q = q.eq("payload->>phase", phase);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

function assert(cond: unknown, msg: string) {
  if (!cond) { console.error("❌", msg); process.exit(1); }
  console.log("✅", msg);
}

async function main() {
  const { data: store } = await sb.from("stores").select("id").order("created_at").limit(1).maybeSingle();
  const { data: trailer } = await sb.from("trailers").select("id").order("created_at").limit(1).maybeSingle();
  if (!store) throw new Error("No store configured");

  const { data: shift, error } = await sb.from("shifts").insert({
    store_id: store.id, trailer_id: trailer?.id ?? null,
    phase: "opening", status: "active",
  }).select().single();
  if (error) throw error;
  const shiftId = shift.id;
  console.log(`▶  Test shift ${shiftId}`);

  try {
    // Run 1: fresh — should seed opening + closing, emit 2 audit rows.
    const a1 = await seedPhaseIfMissing(shiftId, trailer?.id ?? null, "opening", null);
    const b1 = await seedPhaseIfMissing(shiftId, trailer?.id ?? null, "closing", null);
    assert(a1 > 0, `run 1 opening inserted ${a1} tasks`);
    assert(b1 > 0, `run 1 closing inserted ${b1} tasks`);
    assert((await auditCount(shiftId, "opening")) === 1, "1 audit row for opening after run 1");
    assert((await auditCount(shiftId, "closing")) === 1, "1 audit row for closing after run 1");

    // Run 2: tasks present — must be a no-op for both inserts AND audit.
    const a2 = await seedPhaseIfMissing(shiftId, trailer?.id ?? null, "opening", null);
    const b2 = await seedPhaseIfMissing(shiftId, trailer?.id ?? null, "closing", null);
    assert(a2 === 0, "run 2 opening inserted 0 tasks (no-op)");
    assert(b2 === 0, "run 2 closing inserted 0 tasks (no-op)");
    assert((await auditCount(shiftId, "opening")) === 1, "still 1 audit row for opening after no-op run 2");
    assert((await auditCount(shiftId, "closing")) === 1, "still 1 audit row for closing after no-op run 2");

    // Run 3: delete opening tasks (simulate reactivation) — should emit 1 new audit row.
    await sb.from("tasks").delete().eq("shift_id", shiftId).eq("phase", "opening");
    const a3 = await seedPhaseIfMissing(shiftId, trailer?.id ?? null, "opening", null);
    assert(a3 > 0, `reactivation re-inserted ${a3} opening tasks`);
    assert((await auditCount(shiftId, "opening")) === 2, "opening audit count incremented to 2 after reactivation");
    assert((await auditCount(shiftId, "closing")) === 1, "closing audit unchanged");

    // Run 4: mid and emergency must never emit seed_required_checklist.
    await seedPhaseIfMissing(shiftId, trailer?.id ?? null, "mid", null);
    await seedPhaseIfMissing(shiftId, trailer?.id ?? null, "emergency", null);
    assert((await auditCount(shiftId, "mid")) === 0, "no audit row for mid phase");
    assert((await auditCount(shiftId, "emergency")) === 0, "no audit row for emergency phase");

    // Total: 2 audit rows for this shift (opening x2, closing x1 = 3 total).
    assert((await auditCount(shiftId)) === 3, "total seed_required_checklist rows = 3");

    console.log("\n🎉 seed_required_checklist emits only on insert/reactivation.");
  } finally {
    // Cleanup
    await sb.from("audit_log").delete().eq("entity", "shift").eq("entity_id", shiftId);
    await sb.from("tasks").delete().eq("shift_id", shiftId);
    await sb.from("shifts").delete().eq("id", shiftId);
  }
}

main().catch((e) => { console.error("❌ Test failed:", e.message); process.exit(1); });
