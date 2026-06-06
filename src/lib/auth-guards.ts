// Shared role gates for server functions. Use after `requireSupabaseAuth`
// middleware so `context.supabase` is the authenticated client and
// `context.userId` is the verified bearer subject. RLS still enforces
// access at the database layer — these helpers exist to fail fast with a
// clear error message before issuing queries.

export async function requireManager(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_manager", { _user_id: userId });
  if (error) throw new Error("Permission check failed");
  if (!data) throw new Error("Manager access required");
}

export async function requireOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (error) throw new Error("Permission check failed");
  if (!data) throw new Error("Owner access required");
}

export async function isOwner(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  return !!data;
}
