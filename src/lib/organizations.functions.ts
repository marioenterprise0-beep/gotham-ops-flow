// Organization membership + creation.
//
// `listMyOrganizations` returns every org the caller belongs to via RLS on
// `organizations` (is_org_member policy). Safe to read from the client.
//
// `createOrganization` is the only path that bootstraps a new tenant. It
// verifies the caller is authenticated, inserts the org + owner membership
// under service role (organizations INSERT is not exposed to `authenticated`),
// and — only if the caller has no active org yet — flips their profile
// pointer so the next request lands scoped to the new tenant. Existing
// active org is preserved so a switch is always an explicit action.
//
// Slug is derived from the name, sanitized, and de-duplicated with a short
// suffix on collision. We keep this on the server so the client never sees
// a slug it later can't insert.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48) || "org";
}

export const listMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // RLS on organizations restricts SELECT to is_org_member(auth.uid(), id),
    // so a plain select returns only orgs this user belongs to.
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .order("name");
    if (error) throw error;

    const { data: profile } = await supabase
      .from("profiles")
      .select("active_organization_id")
      .eq("id", userId)
      .maybeSingle();

    return {
      organizations: data ?? [],
      activeOrganizationId: profile?.active_organization_id ?? null,
    };
  });

export const setActiveOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Confirm membership via the org-scoped helper (SECURITY DEFINER, no
    // reliance on RLS visibility) before flipping the profile pointer.
    const { data: member, error: mErr } = await supabase.rpc("is_org_member", {
      _user_id: userId,
      _org_id: data.organizationId,
    });
    if (mErr) throw mErr;
    if (member !== true) throw new Error("Not a member of that organization");

    const { error } = await supabase
      .from("profiles")
      .update({ active_organization_id: data.organizationId })
      .eq("id", userId);
    if (error) throw error;
    return { ok: true, organizationId: data.organizationId };
  });

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
      slug: z
        .string()
        .trim()
        .min(2)
        .max(48)
        .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens")
        .optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId, supabase } = context;

    // Service role is required for the org + membership inserts:
    // organizations INSERT is not granted to `authenticated`, and the caller
    // is not yet a member so is_org_admin would reject the direct insert path.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const baseSlug = slugify(data.slug ?? data.name);
    let slug = baseSlug;
    // Collision loop: 5 attempts with a short random suffix before giving up.
    // Race-safe because we insert with a UNIQUE constraint and retry on 23505.
    let orgId: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate =
        attempt === 0
          ? baseSlug
          : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: inserted, error } = await supabaseAdmin
        .from("organizations")
        .insert({ name: data.name, slug: candidate })
        .select("id, slug")
        .single();
      if (!error && inserted) {
        orgId = inserted.id;
        slug = inserted.slug ?? candidate;
        break;
      }
      // 23505 = unique_violation. Anything else, bail immediately.
      if (error && (error as any).code !== "23505") throw error;
    }
    if (!orgId) throw new Error("Could not allocate a unique slug — try a different name");

    // Caller becomes org_owner. Any failure here would orphan the org, so
    // we clean up before rethrowing.
    const { error: memErr } = await supabaseAdmin
      .from("organization_members")
      .insert({ organization_id: orgId, user_id: userId, org_role: "org_owner" });
    if (memErr) {
      await supabaseAdmin.from("organizations").delete().eq("id", orgId);
      throw memErr;
    }

    // Only flip the active-org pointer when the caller has none yet — a
    // deliberate no-op for existing tenants who happen to spin up a second org.
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.active_organization_id) {
      await supabaseAdmin
        .from("profiles")
        .update({ active_organization_id: orgId })
        .eq("id", userId);
    }

    return { id: orgId, slug, name: data.name };
  });