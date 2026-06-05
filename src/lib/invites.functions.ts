import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RoleId = "owner" | "manager" | "shift_lead" | "grill" | "prep" | "cashier";

function randomCode() {
  // 8-char A-Z/0-9, no ambiguous chars
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
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
  .inputValidator((d: { role: RoleId; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("invite_codes")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
