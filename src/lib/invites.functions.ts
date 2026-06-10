import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOwner } from "@/lib/auth-guards";
import { z } from "zod";
import { randomInt } from "crypto";

const ROLE_VALUES = ["owner", "manager", "shift_lead", "grill", "prep", "cashier"] as const;

function randomCode() {
  // 8-char A-Z/0-9, no ambiguous chars; cryptographically secure
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId);
    const { data, error } = await supabase
      .from("invite_codes")
      .select("id, code, role, note, created_at, expires_at, used_by, used_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    role: z.enum(ROLE_VALUES),
    note: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId);
    if (data.role === "owner" || data.role === "manager") {
      const { isOwner } = await import("./auth-guards");
      if (!(await isOwner(supabase, userId))) throw new Error("Only owners can issue owner or manager invites");
    }
    const code = randomCode();
    const { data: row, error } = await supabase
      .from("invite_codes")
      .insert({ code, role: data.role, note: data.note ?? null, created_by: userId })
      .select("id, code, role, expires_at, note")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOwner(supabase, userId);
    const { error } = await supabase
      .from("invite_codes")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
