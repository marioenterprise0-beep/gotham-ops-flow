import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

// Use getSession() (reads from local storage) instead of getUser() (network call)
// to avoid redirect loops when the network is flaky — getUser was throwing
// "Load failed" TypeErrors and bouncing authenticated users to /auth.
export async function requireAuthBeforeLoad() {
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    throw redirect({ to: "/auth" });
  }

  return { user: data.session.user };
}
