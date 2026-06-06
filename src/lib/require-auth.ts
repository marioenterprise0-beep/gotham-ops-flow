import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

// Reads from local storage (fast, no network) and falls back to a refresh
// attempt before giving up — this avoids redirect loops on flaky networks
// while still ensuring downstream serverFn calls have a valid bearer token.
export async function requireAuthBeforeLoad() {
  const { data } = await supabase.auth.getSession();
  let session = data.session;

  if (!session) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session ?? null;
  }

  if (!session) {
    throw redirect({ to: "/auth" });
  }

  return { user: session.user };
}
