import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireManager } from "@/lib/auth-guards";
import { z } from "zod";

export type ChangeLogRow = {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  entity: string;
  entity_id: string | null;
  action: string;
  summary: string | null;
  before: any;
  after: any;
  reason: string | null;
  trailer_id: string | null;
};

export const listChangeLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { search?: string; entity?: string; actorId?: string; days?: number } | undefined) =>
      d ?? {},
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    let q = supabase
      .from("change_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    const days = data.days ?? 30;
    if (days > 0) {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      q = q.gte("created_at", since);
    }
    if (data.entity) q = q.eq("entity", data.entity);
    if (data.actorId) q = q.eq("actor_id", data.actorId);
    if (data.search && data.search.trim()) {
      const s = `%${data.search.trim()}%`;
      q = q.or(
        `summary.ilike.${s},reason.ilike.${s},actor_name.ilike.${s},action.ilike.${s},entity.ilike.${s}`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as ChangeLogRow[];
  });

export const recordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        entity: z
          .string()
          .min(1)
          .max(80)
          .regex(/^[a-zA-Z0-9_-]+$/),
        action: z
          .string()
          .min(1)
          .max(80)
          .regex(/^[a-zA-Z0-9_.-]+$/),
        entity_id: z.string().uuid().nullable().optional(),
        summary: z.string().max(2000).nullable().optional(),
        before: z.any().optional(),
        after: z.any().optional(),
        reason: z.string().max(2000).nullable().optional(),
        trailer_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const { error } = await supabase.from("change_log").insert({
      actor_id: userId,
      actor_name: prof?.display_name ?? "Unknown",
      entity: data.entity,
      entity_id: data.entity_id ?? null,
      action: data.action,
      summary: data.summary ?? null,
      before: data.before ?? null,
      after: data.after ?? null,
      reason: data.reason ?? null,
      trailer_id: data.trailer_id ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });
