import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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

    const next = {
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
