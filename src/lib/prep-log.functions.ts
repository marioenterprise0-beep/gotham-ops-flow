import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { z } from "zod";

async function getTrailerId(
  supabase: any,
  userId: string,
  trailerId?: string | null,
): Promise<string | null> {
  if (trailerId) return trailerId;
  const { data } = await supabase
    .from("profiles")
    .select("trailer_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.trailer_id ?? null;
}

export const logPrepEntry = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        itemName: z.string().min(1).max(120),
        category: z.string().min(1).max(40).default("general"),
        quantity: z.number().positive(),
        unit: z.string().min(1).max(20).default("units"),
        notes: z.string().max(1000).optional(),
        shiftId: z.string().uuid().nullable().optional(),
        trailerId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const trailerId = await getTrailerId(supabase, userId, data.trailerId);
    const { data: activeShift } = trailerId
      ? await supabase
          .from("shifts")
          .select("id")
          .eq("trailer_id", trailerId)
          .eq("status", "active")
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
    const { data: row, error } = await supabase
      .from("prep_log")
      .insert({
        logged_by: userId,
        trailer_id: trailerId,
        shift_id: data.shiftId ?? activeShift?.id ?? null,
        item_name: data.itemName,
        category: data.category,
        quantity: data.quantity,
        unit: data.unit,
        notes: data.notes ?? null,
        logged_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "prep_logged",
      entity: "prep_log",
      entity_id: row.id,
      payload: { item: data.itemName, qty: data.quantity, unit: data.unit },
    });
    return row;
  });

export const listPrepLog = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) =>
    z
      .object({
        trailerId: z.string().uuid().nullable().optional(),
        date: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const trailerId = await getTrailerId(supabase, userId, data.trailerId);
    let q = supabase
      .from("prep_log")
      .select("*")
      .is("archived_at", null)
      .order("logged_at", { ascending: false })
      .limit(data.limit);
    if (trailerId) q = q.eq("trailer_id", trailerId);
    if (data.date) {
      q = q.gte("logged_at", `${data.date}T00:00:00`).lt("logged_at", `${data.date}T23:59:59`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.logged_by)));
    let nameMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name ?? "Crew"]));
    }
    return (rows ?? []).map((r: any) => ({ ...r, logged_by_name: nameMap[r.logged_by] ?? "Crew" }));
  });

export const deletePrepEntry = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: entry } = await supabase
      .from("prep_log")
      .select("logged_by")
      .eq("id", data.id)
      .maybeSingle();
    if (!entry) throw new Error("Entry not found");
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isManager = (roles ?? []).some((r: any) => r.role === "owner" || r.role === "manager");
    if (!isManager && (entry as any).logged_by !== userId)
      throw new Error("You can only delete your own entries");
    const { error } = await supabase
      .from("prep_log")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
