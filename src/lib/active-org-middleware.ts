// Project-owned middleware. Chains AFTER the auto-generated
// `requireSupabaseAuth`, and injects `context.activeOrgId` — a selector,
// NOT proof of membership.
//
// Safety property: downstream `has_role(_user_id, _org_id, _role)` and
// `is_manager(_user_id, _org_id)` fail closed against `user_roles`, so a
// tampered / stale active org id cannot grant access. This middleware only
// picks WHICH org the request operates in; the DB decides whether the caller
// is allowed to act in that org.
//
// Never edits `src/integrations/supabase/auth-middleware.ts` (auto-gen).
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requireActiveOrg = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("active_organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(`active-org lookup failed: ${error.message}`);
    const activeOrgId = (data as { active_organization_id: string | null } | null)
      ?.active_organization_id;
    if (!activeOrgId) {
      throw new Error("No active organization on profile. Call setActiveOrganization first.");
    }
    return next({ context: { activeOrgId } });
  });
