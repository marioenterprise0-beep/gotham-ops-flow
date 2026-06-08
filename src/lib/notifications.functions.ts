import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const NOTIFICATION_CATEGORIES = [
  "schedule",
  "time_clock",
  "inventory",
  "cash",
  "operations",
  "training",
  "announcements",
  "critical",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationPreferences = {
  user_id: string;
  email_enabled: boolean;
  frequency: "immediate" | "daily_digest" | "critical_only";
  categories: Record<NotificationCategory, boolean>;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string;
  updated_at: string;
};

const DEFAULT_CATEGORIES: Record<NotificationCategory, boolean> = {
  schedule: true,
  time_clock: true,
  inventory: true,
  cash: true,
  operations: true,
  training: true,
  announcements: true,
  critical: true,
};

export const getMyNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as unknown as NotificationPreferences;
    return {
      user_id: userId,
      email_enabled: true,
      frequency: "immediate" as const,
      categories: DEFAULT_CATEGORIES,
      quiet_hours_start: null,
      quiet_hours_end: null,
      quiet_hours_timezone: "America/New_York",
      updated_at: new Date().toISOString(),
    };
  });

export const updateMyNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        emailEnabled: z.boolean().optional(),
        frequency: z.enum(["immediate", "daily_digest", "critical_only"]).optional(),
        categories: z.record(z.string(), z.boolean()).optional(),
        quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable().optional(),
        quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable().optional(),
        quietHoursTimezone: z.string().min(1).max(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const next: any = {
      user_id: userId,
      email_enabled:
        data.emailEnabled ?? (existing?.email_enabled ?? true),
      frequency:
        data.frequency ?? (existing?.frequency ?? "immediate"),
      categories: {
        ...DEFAULT_CATEGORIES,
        ...((existing?.categories as any) ?? {}),
        ...(data.categories ?? {}),
      },
    };
    if (data.quietHoursStart !== undefined) next.quiet_hours_start = data.quietHoursStart;
    if (data.quietHoursEnd !== undefined) next.quiet_hours_end = data.quietHoursEnd;
    if (data.quietHoursTimezone !== undefined) next.quiet_hours_timezone = data.quietHoursTimezone;

    if (existing) {
      const { data: row, error } = await supabase
        .from("notification_preferences")
        .update(next as any)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return row as unknown as NotificationPreferences;
    }
    const { data: row, error } = await supabase
      .from("notification_preferences")
      .insert(next as any)
      .select()
      .single();
    if (error) throw error;
    return row as unknown as NotificationPreferences;
  });

export type EmailLogRow = {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  subject: string | null;
  status: string;
  error_message: string | null;
  source_module: string | null;
  source_id: string | null;
  alert_id: string | null;
  created_at: string;
};

export const listEmailDeliveryLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).default(100),
        template: z.string().optional(),
        status: z.string().optional(),
        sinceHours: z.number().int().min(1).max(24 * 90).default(24 * 7),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Owner-only
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isOwner = (roles ?? []).some((r: any) => r.role === "owner");
    if (!isOwner) throw new Error("forbidden");

    const since = new Date(Date.now() - data.sinceHours * 3600 * 1000).toISOString();
    let q = supabase
      .from("email_send_log")
      .select(
        "id, message_id, template_name, recipient_email, subject, status, error_message, source_module, source_id, alert_id, created_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.template) q = q.eq("template_name", data.template);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;

    // Deduplicate by message_id (latest row wins; rows are already DESC)
    const seen = new Set<string>();
    const deduped: EmailLogRow[] = [];
    for (const r of (rows ?? []) as EmailLogRow[]) {
      const key = r.message_id ?? r.id;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }
    return deduped;
  });

export const emailDeliveryStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ sinceHours: z.number().int().min(1).max(24 * 90).default(24 * 7) }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isOwner = (roles ?? []).some((r: any) => r.role === "owner");
    if (!isOwner) throw new Error("forbidden");

    const since = new Date(Date.now() - data.sinceHours * 3600 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("email_send_log")
      .select("message_id, id, status, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw error;

    const seen = new Set<string>();
    const counts = { total: 0, sent: 0, queued: 0, failed: 0, suppressed: 0, dlq: 0 } as Record<string, number>;
    for (const r of (rows ?? []) as any[]) {
      const key = r.message_id ?? r.id;
      if (seen.has(key)) continue;
      seen.add(key);
      counts.total += 1;
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    return counts;
  });

const SITE_URL =
  "https://project--75d61e5b-6b41-4f7e-a315-ad4632c539dd.lovable.app";

function adminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const resendEmailFromLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ logId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isOwner = (roles ?? []).some((r: any) => r.role === "owner");
    if (!isOwner) throw new Error("forbidden");

    const sb = adminClient();
    const { data: row, error } = await sb
      .from("email_send_log")
      .select("id, alert_id, template_name, recipient_email, subject, metadata, status")
      .eq("id", data.logId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("log_row_not_found");

    // Path 1: alert-driven → reset email_status and re-invoke dispatcher
    if (row.alert_id) {
      // Drop the prior failed log row so the dispatcher's idempotency check passes
      await sb.from("email_send_log").delete().eq("id", row.id);
      await sb
        .from("alerts")
        .update({ email_status: "none" })
        .eq("id", row.alert_id);

      const { data: dispatchCfg, error: dispatchCfgError } = await sb
        .from("email_dispatch_config")
        .select("dispatch_key")
        .eq("id", 1)
        .maybeSingle();
      if (dispatchCfgError) throw dispatchCfgError;
      if (!dispatchCfg?.dispatch_key) throw new Error("dispatch_key_missing");

      const res = await fetch(`${SITE_URL}/api/public/hooks/alert-email-dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dispatch-key": dispatchCfg.dispatch_key,
        },
        body: JSON.stringify({ alert_id: row.alert_id }),
      });
      if (!res.ok) throw new Error(`dispatch_failed_${res.status}`);
      return { ok: true, mode: "alert" };
    }

    // Path 2: raw enqueue using whatever template_data we stored in metadata
    const meta = (row.metadata ?? {}) as any;
    const payload = {
      template_name: row.template_name,
      recipient_email: row.recipient_email,
      subject: row.subject ?? row.template_name,
      template_data: meta.template_data ?? {
        recipient_email: row.recipient_email,
      },
      idempotency_key: `resend:${row.id}:${Date.now()}`,
      metadata: { ...meta, resent_from: row.id, resent_by: userId },
    };
    const { error: enqErr } = await sb.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload,
    });
    if (enqErr) throw enqErr;
    await sb.from("email_send_log").insert({
      template_name: row.template_name,
      recipient_email: row.recipient_email,
      subject: row.subject,
      source_module: (row as any).source_module ?? null,
      source_id: (row as any).source_id ?? null,
      status: "pending",
      metadata: { resent_from: row.id, resent_by: userId },
    });
    return { ok: true, mode: "raw" };
  });

export const getEmailQueueDepths = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isOwner = (roles ?? []).some((r: any) => r.role === "owner");
    if (!isOwner) throw new Error("forbidden");
    const sb = adminClient();
    const { data, error } = await sb.rpc("email_queue_depths");
    if (error) throw error;
    const out: Record<string, number> = {
      transactional_emails: 0,
      auth_emails: 0,
      transactional_emails_dlq: 0,
      auth_emails_dlq: 0,
    };
    for (const r of (data ?? []) as any[]) out[r.queue_name] = Number(r.depth ?? 0);
    return out;
  });
