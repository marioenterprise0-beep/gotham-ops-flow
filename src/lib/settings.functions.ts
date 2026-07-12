import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireManager, requireTabAccess } from "./auth-guards";
import { supabase as publicClient } from "@/integrations/supabase/client";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }, { data: store }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, store_id, created_at").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("stores").select("id, name, short_name, tagline, support_email, location, bg_color, fg_color, accent_color").order("created_at").limit(1).maybeSingle(),
    ]);
    return { profile, roles: (roles ?? []).map((r) => r.role), store };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ displayName: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update({ display_name: data.displayName }).eq("id", userId);
    if (error) throw error;
    // Bust the server-side email branding cache so the next email render
    // reflects the new colors immediately.
    try {
      const { clearEmailBrandingCache } = await import("./email/branding.server");
      clearEmailBrandingCache();
    } catch {}
    return { ok: true };
  });

export const updateStoreInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    storeId: z.string().uuid(),
    name: z.string().min(1).max(120),
    shortName: z.string().max(40).optional().nullable(),
    tagline: z.string().max(200).optional().nullable(),
    supportEmail: z.string().email().max(200).optional().nullable().or(z.literal("")),
    location: z.string().max(200).optional(),
    bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    fgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);
    await requireTabAccess(supabase, userId, "settings", "edit");
    const { error } = await supabase.from("stores").update({
      name: data.name,
      short_name: data.shortName?.trim() || null,
      tagline: data.tagline?.trim() || null,
      support_email: (data.supportEmail && data.supportEmail.trim()) || null,
      location: data.location ?? null,
      bg_color: data.bgColor ?? null,
      fg_color: data.fgColor ?? null,
      accent_color: data.accentColor ?? null,
    }).eq("id", data.storeId);
    if (error) throw error;
    return { ok: true };
  });

// Public branding fetch — readable by anon so pre-auth surfaces (sign-in page,
// PWA install prompt) can render the org name/tagline.
export async function fetchPublicBranding() {
  const { data } = await publicClient
    .from("stores")
    .select("id, name, short_name, tagline, support_email, bg_color, fg_color, accent_color")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data;
}

// ---------- Test email preview using unsaved colors ----------
// Renders one email template with the caller-supplied theme colors applied
// via the shared applyBrandOverrides helper, then sends it to the current
// user's own email so they can vet the branding before saving.
export const sendBrandingTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    fgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    templateName: z.string().min(1).max(80).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireManager(supabase, userId);

    // Resolve the caller's email from their auth record.
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user?.email) {
      throw new Error("Could not resolve your email address");
    }
    const to = userRes.user.email;

    const [
      { TEMPLATES },
      { applyBrandOverrides },
      { render },
      Rreact,
    ] = await Promise.all([
      import("./email-templates/registry"),
      import("./email-templates/_brand"),
      import("@react-email/components"),
      import("react"),
    ]);

    const templateName = data.templateName && TEMPLATES[data.templateName]
      ? data.templateName
      : "announcement-published";
    const entry = TEMPLATES[templateName];
    if (!entry) throw new Error(`Template not found: ${templateName}`);

    // Apply the pending picker values (falling back to saved values in place).
    applyBrandOverrides({
      bgColor: data.bgColor ?? null,
      fgColor: data.fgColor ?? null,
      accentColor: data.accentColor ?? null,
    });

    const templateData = {
      ...(entry.previewData ?? {}),
      recipient_name: userRes.user.email,
      recipient_email: to,
    };
    const element = Rreact.createElement(entry.component, templateData);
    const html = await (render as any)(element);
    const text = await render(element, { plainText: true } as any);

    const rawSubject = typeof entry.subject === "function"
      ? entry.subject(templateData)
      : entry.subject;
    const subject = `[Preview] ${rawSubject}`;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const result = await sendLovableEmail({
      apiKey,
      senderDomain: "notify.dipnshake.com",
      to,
      from: "dipnshake <noreply@notify.dipnshake.com>",
      subject,
      html,
      text,
      purpose: "transactional",
      label: `branding-test:${templateName}`,
      idempotencyKey: `branding-test:${userId}:${Date.now()}`,
    } as any);

    return { ok: true, to, templateName, result };
  });

