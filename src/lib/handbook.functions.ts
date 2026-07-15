import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOwner } from "@/lib/auth-guards";
import { z } from "zod";

export type HandbookBlock =
  | { type: "heading"; level: "h1" | "h2"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string }
  | { type: "note"; text: string }
  | { type: "table"; rows: string[][] }
  | { type: "other"; role?: string; text: string };

export type HandbookSection = {
  id: string;
  part_number: number;
  part_title: string;
  section_number: number;
  section_title: string;
  body_blocks: HandbookBlock[];
  is_policy: boolean;
  display_order: number;
  version: number;
  updated_at: string;
};

// Every role gets full handbook access — intentionally not gated by
// requireManager/requireOwner. RLS on handbook_sections also allows SELECT
// to any authenticated user, so this is defense-in-depth, not the lock.
export const getHandbook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Cast: `handbook_sections` is not yet in the generated Supabase types —
    // regenerate types.ts after the migration lands (same precedent as
    // scanSopDependencies's table loop in sops.functions.ts).
    const { data, error } = await (context.supabase as any)
      .from("handbook_sections")
      .select(
        "id, part_number, part_title, section_number, section_title, body_blocks, is_policy, display_order, version, updated_at",
      )
      .order("display_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as HandbookSection[];
  });

async function getCurrentHandbookVersion(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("handbook_sections")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.version ?? 1;
}

export const acknowledgeHandbook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ fullNameTyped: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const version = await getCurrentHandbookVersion(supabase);
    const { error } = await (supabase as any)
      .from("handbook_acknowledgements")
      .upsert(
        { user_id: userId, handbook_version: version, full_name_typed: data.fullNameTyped.trim() },
        { onConflict: "user_id,handbook_version" },
      );
    if (error) throw error;
    // Milestone column — mirrors sop_accepted_at / training_completed_at.
    // Only the FIRST-ever ack flips this null->non-null and fires the
    // manager alert (see emit_profile_milestone_alert); re-acks on a later
    // version still update the timestamp but don't re-fire that alert.
    await (supabase as any)
      .from("profiles")
      .update({ handbook_acknowledged_at: new Date().toISOString() })
      .eq("id", userId);
    return { ok: true, version };
  });

export const getMyHandbookAck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const version = await getCurrentHandbookVersion(supabase);
    const { data } = await (supabase as any)
      .from("handbook_acknowledgements")
      .select("handbook_version, full_name_typed, acknowledged_at")
      .eq("user_id", userId)
      .order("handbook_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      currentVersion: version,
      ack: data ?? null,
      isCurrent: !!data && data.handbook_version >= version,
    };
  });

export const getHandbookAckRollup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId);

    const version = await getCurrentHandbookVersion(supabase);
    const [{ data: profiles }, { data: acks }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, active")
        .eq("active", true)
        .is("archived_at", null),
      (supabase as any)
        .from("handbook_acknowledgements")
        .select("user_id, handbook_version, acknowledged_at"),
    ]);

    const latestAck = new Map<string, { version: number; at: string }>();
    for (const a of (acks ?? []) as any[]) {
      const prev = latestAck.get(a.user_id);
      if (!prev || prev.at < a.acknowledged_at) {
        latestAck.set(a.user_id, { version: a.handbook_version, at: a.acknowledged_at });
      }
    }

    const current: { id: string; name: string; version: number; at: string }[] = [];
    const stale: { id: string; name: string }[] = [];
    const pending: { id: string; name: string }[] = [];
    for (const p of (profiles ?? []) as any[]) {
      const ack = latestAck.get(p.id);
      if (!ack) {
        pending.push({ id: p.id, name: p.display_name });
      } else if (ack.version >= version) {
        current.push({ id: p.id, name: p.display_name, version: ack.version, at: ack.at });
      } else {
        stale.push({ id: p.id, name: p.display_name });
      }
    }
    return {
      currentVersion: version,
      totalUsers: (profiles ?? []).length,
      current,
      stale,
      pending,
    };
  });
