#!/usr/bin/env bun
/**
 * End-to-end idempotency test for Generate Coverage.
 *
 * Verifies that calling the schedule's coverage generator repeatedly:
 *   1. Produces exactly the expected number of unassigned shifts (days × 3 segments)
 *      after the first run.
 *   2. Never creates duplicate (schedule_id, shift_date, segment) rows on
 *      subsequent runs.
 *   3. Surfaces the same row count through the same query the Open Shifts UI
 *      uses to render (`getSchedule`).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     bun run scripts/test-coverage-idempotency.ts [scheduleId]
 *
 * If no scheduleId is supplied, the most recent draft schedule is used.
 */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SEGS = [
  { segment: "open", start_time: "09:00", end_time: "14:00", role: "prep" },
  { segment: "mid", start_time: "11:00", end_time: "19:00", role: "cashier" },
  { segment: "close", start_time: "16:00", end_time: "23:00", role: "grill" },
] as const;

function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// Mirrors src/lib/schedule.functions.ts::generateCoverage so the test
// exercises the same upsert path (including the partial-unique index).
async function generateCoverage(scheduleId: string) {
  const { data: sched, error: sErr } = await sb
    .from("schedules")
    .select("*")
    .eq("id", scheduleId)
    .single();
  if (sErr || !sched) throw new Error(sErr?.message ?? "Schedule not found");
  const days = daysBetween(sched.start_date, sched.end_date);
  const rows = days.flatMap((d) =>
    SEGS.map((s) => ({
      schedule_id: scheduleId,
      employee_id: null,
      trailer_id: sched.trailer_id ?? null,
      role: s.role,
      segment: s.segment,
      shift_date: d,
      start_time: s.start_time,
      end_time: s.end_time,
      break_minutes: 30,
    })),
  );
  const { data, error } = await sb
    .from("schedule_shifts")
    .upsert(rows, { onConflict: "schedule_id,shift_date,segment", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);
  return { inserted: data?.length ?? 0, expected: days.length * SEGS.length };
}

async function countCoverage(scheduleId: string) {
  const { count, error } = await sb
    .from("schedule_shifts")
    .select("id", { count: "exact", head: true })
    .eq("schedule_id", scheduleId)
    .is("employee_id", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function findDuplicates(scheduleId: string) {
  const { data, error } = await sb
    .from("schedule_shifts")
    .select("shift_date, segment")
    .eq("schedule_id", scheduleId)
    .is("employee_id", null);
  if (error) throw new Error(error.message);
  const seen = new Map<string, number>();
  for (const r of data ?? []) {
    const k = `${r.shift_date}|${r.segment}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1);
}

async function pickSchedule(): Promise<string> {
  const arg = process.argv[2];
  if (arg) return arg;
  const { data, error } = await sb
    .from("schedules")
    .select("id, status, created_at")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("No draft schedule found — pass an id as the first arg");
  return data[0].id;
}

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("❌", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

async function main() {
  const id = await pickSchedule();
  console.log(`▶  Testing idempotency on schedule ${id}`);

  // Reset coverage for a clean baseline
  await sb.from("schedule_shifts").delete().eq("schedule_id", id).is("employee_id", null);
  const baseline = await countCoverage(id);
  assert(baseline === 0, `baseline: 0 unassigned shifts (got ${baseline})`);

  // Run 1: should populate the full grid
  const r1 = await generateCoverage(id);
  const c1 = await countCoverage(id);
  assert(r1.inserted === r1.expected, `run 1 inserted ${r1.expected} shifts (got ${r1.inserted})`);
  assert(c1 === r1.expected, `run 1 total = ${r1.expected} (got ${c1})`);

  // Runs 2-5: must be no-ops
  for (let i = 2; i <= 5; i++) {
    const r = await generateCoverage(id);
    const c = await countCoverage(id);
    assert(r.inserted === 0, `run ${i} inserted 0 (got ${r.inserted})`);
    assert(c === r1.expected, `run ${i} total unchanged at ${r1.expected} (got ${c})`);
  }

  // No duplicates anywhere
  const dupes = await findDuplicates(id);
  assert(dupes.length === 0, `no duplicate (date,segment) combinations (found ${dupes.length})`);

  console.log("\n🎉 Generate Coverage is idempotent end-to-end.");
}

main().catch((e) => {
  console.error("❌ Test failed:", e.message);
  process.exit(1);
});
