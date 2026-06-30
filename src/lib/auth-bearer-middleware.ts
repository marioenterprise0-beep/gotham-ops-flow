import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

// Project-specific bearer attacher: like the generated `attachSupabaseAuth`, but
// proactively refreshes the session when it's expired or about to expire so
// server functions don't 401 with "No authorization header provided" after the
// access token rolls over (token lifetime ~1h).
export const attachSupabaseBearer = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      let session = data.session;
      const nowSec = Math.floor(Date.now() / 1000);
      const expiresAt = session?.expires_at ?? 0;
      if (!session || expiresAt - nowSec < 30) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        session = refreshed.session ?? session;
      }
      token = session?.access_token;
    } catch {
      // fall through with no token; server will 401 and route guard will redirect
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
