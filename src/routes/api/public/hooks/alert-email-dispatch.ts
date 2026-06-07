import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { enqueueAlertEmail } from '@/lib/email/enqueue.server'
import {
  getOwners,
  getAllManagers,
  getManagersForTrailer,
  getEmployee,
  getCrewForTrailer,
  type Recipient,
  type Category,
} from '@/lib/email/recipients.server'

// ---------------------------------------------------------------------------
// Alert → Email dispatcher
// Called by the notify_alert_email DB trigger via pg_net AFTER INSERT on alerts.
// Body: { alert_id: string }
//
// Responsibilities:
//  - Look up the alert + module-specific payload
//  - Choose the right branded template
//  - Resolve the right recipients (owners / managers / specific employee / crew)
//  - Build template_data and enqueue via enqueueAlertEmail (idempotent)
// ---------------------------------------------------------------------------

const SITE_URL =
  'https://project--75d61e5b-6b41-4f7e-a315-ad4632c539dd.lovable.app'

type Mapping = {
  template: string
  category: Category
  subject: (alert: any, ctx: any) => string
  recipients: (alert: any, sb: any) => Promise<Recipient[]>
  buildData: (alert: any, ctx: any) => Promise<Record<string, unknown>>
}

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function loadTrailer(sb: any, trailerId: string | null) {
  if (!trailerId) return { name: 'Trailer' }
  const { data } = await sb.from('trailers').select('name, timezone').eq('id', trailerId).maybeSingle()
  return data ?? { name: 'Trailer' }
}

async function loadProfile(sb: any, userId: string | null) {
  if (!userId) return null
  const { data } = await sb.from('profiles').select('display_name, email').eq('id', userId).maybeSingle()
  return data
}

// ---- Per-alert-type mappings ----------------------------------------------

const MAPPINGS: Record<string, Mapping> = {
  inventory_order: {
    template: 'inventory-order-submitted',
    category: 'inventory',
    subject: (_a, ctx) => `Inventory order ready for review — ${ctx.trailer.name}`,
    recipients: async () => getOwners(),
    buildData: async (alert, ctx) => {
      const sb = admin()
      const { data: items } = await sb
        .from('inventory_order_items')
        .select('item_name, requested_qty, unit, urgency, current_qty, par_qty')
        .eq('order_id', alert.source_id)
      return {
        trailer_name: ctx.trailer.name,
        submitted_by: ctx.creator?.display_name ?? 'Manager',
        item_count: items?.length ?? 0,
        critical_count: (items ?? []).filter((i: any) =>
          ['critical', 'emergency'].includes(i.urgency),
        ).length,
        items: items ?? [],
        cta_url: `${SITE_URL}/inventory/orders/${alert.source_id}`,
      }
    },
  },

  low_stock: {
    template: 'low-stock-alert',
    category: 'inventory',
    subject: (_a, ctx) => `Low stock alert — ${ctx.trailer.name}`,
    recipients: async (alert) => getManagersForTrailer(alert.trailer_id),
    buildData: async (alert, ctx) => ({
      trailer_name: ctx.trailer.name,
      items: alert.payload?.items ?? [],
      cta_url: `${SITE_URL}/inventory`,
    }),
  },

  critical_stock: {
    template: 'low-stock-alert',
    category: 'inventory',
    subject: (_a, ctx) => `Critical stock — ${ctx.trailer.name}`,
    recipients: async () => getAllManagers(),
    buildData: async (alert, ctx) => ({
      trailer_name: ctx.trailer.name,
      items: alert.payload?.items ?? [],
      critical: true,
      cta_url: `${SITE_URL}/inventory`,
    }),
  },

  manager_recap: {
    template: 'daily-recap-submitted',
    category: 'operations',
    subject: (alert, ctx) =>
      `Daily recap — ${ctx.trailer.name} · ${alert.title?.split('·')?.[1]?.trim() ?? ''}`,
    recipients: async () => getOwners(),
    buildData: async (alert, ctx) => {
      const sb = admin()
      const { data: recap } = await sb
        .from('daily_recaps')
        .select('*')
        .eq('id', alert.source_id)
        .maybeSingle()
      return {
        trailer_name: ctx.trailer.name,
        manager_name: ctx.creator?.display_name ?? 'Manager',
        recap_date: recap?.recap_date,
        shift_score: recap?.shift_score,
        ops_went_well: recap?.ops_went_well,
        ops_attention: recap?.ops_attention,
        labor_attendance: recap?.labor_attendance,
        inv_concerns: recap?.inv_concerns,
        hosp_complaints: recap?.hosp_complaints,
        cta_url: `${SITE_URL}/recaps/${alert.source_id}`,
      }
    },
  },

  missed_clock_out: {
    template: 'missed-clock-out',
    category: 'time_clock',
    subject: (_a, ctx) => `Missed clock-out — ${ctx.creator?.display_name ?? 'Employee'}`,
    recipients: async (alert) => getManagersForTrailer(alert.trailer_id),
    buildData: async (alert, ctx) => ({
      trailer_name: ctx.trailer.name,
      employee_name: ctx.creator?.display_name ?? 'Employee',
      punch_id: alert.source_id,
      cta_url: `${SITE_URL}/time/punches/${alert.source_id}`,
    }),
  },

  missed_clock_in: {
    template: 'missed-clock-out',
    category: 'time_clock',
    subject: (_a, ctx) => `Missed clock-in — ${ctx.creator?.display_name ?? 'Employee'}`,
    recipients: async (alert) => getManagersForTrailer(alert.trailer_id),
    buildData: async (alert, ctx) => ({
      trailer_name: ctx.trailer.name,
      employee_name: ctx.creator?.display_name ?? 'Employee',
      cta_url: `${SITE_URL}/schedule`,
    }),
  },

  time_adjustment: {
    template: 'time-adjustment-request',
    category: 'time_clock',
    subject: (_a, ctx) => `Time adjustment request — ${ctx.creator?.display_name ?? 'Employee'}`,
    recipients: async (alert) => getManagersForTrailer(alert.trailer_id),
    buildData: async (alert, ctx) => ({
      trailer_name: ctx.trailer.name,
      employee_name: ctx.creator?.display_name ?? 'Employee',
      reason: alert.payload?.reason,
      original: alert.payload?.original,
      requested: alert.payload?.requested,
      cta_url: `${SITE_URL}/time/corrections/${alert.source_id}`,
    }),
  },

  schedule_approval: {
    template: 'schedule-submitted',
    category: 'schedule',
    subject: (_a, ctx) => `Schedule submitted — ${ctx.trailer.name}`,
    recipients: async () => getOwners(),
    buildData: async (alert, ctx) => {
      const sb = admin()
      const { data: sched } = await sb
        .from('schedules')
        .select('name, start_date, end_date')
        .eq('id', alert.source_id)
        .maybeSingle()
      return {
        trailer_name: ctx.trailer.name,
        submitted_by: ctx.creator?.display_name ?? 'Manager',
        schedule_name: sched?.name,
        start_date: sched?.start_date,
        end_date: sched?.end_date,
        cta_url: `${SITE_URL}/schedule?id=${alert.source_id}`,
      }
    },
  },

  announcement: {
    template: 'announcement-published',
    category: 'announcements',
    subject: (alert) => alert.title || 'New announcement from Gotham OS',
    recipients: async (alert) => {
      if (alert.trailer_id) return getCrewForTrailer(alert.trailer_id)
      const owners = await getOwners()
      const mgrs = await getAllManagers()
      const seen = new Set<string>()
      return [...owners, ...mgrs].filter((r) =>
        seen.has(r.user_id) ? false : (seen.add(r.user_id), true),
      )
    },
    buildData: async (alert, ctx) => ({
      trailer_name: ctx.trailer.name,
      title: alert.title,
      body: alert.description,
      posted_by: ctx.creator?.display_name ?? 'Gotham OS',
      cta_url: `${SITE_URL}/announcements`,
    }),
  },

  checklist_failure: {
    template: 'critical-alert',
    category: 'critical',
    subject: (alert, ctx) => `${alert.title} — ${ctx.trailer.name}`,
    recipients: async (alert) => getManagersForTrailer(alert.trailer_id),
    buildData: async (alert, ctx) => ({
      trailer_name: ctx.trailer.name,
      title: alert.title,
      description: alert.description,
      cta_url: `${SITE_URL}/alerts`,
    }),
  },

  maintenance: {
    template: 'critical-alert',
    category: 'critical',
    subject: (alert) => alert.title,
    recipients: async () => getAllManagers(),
    buildData: async (alert, ctx) => ({
      trailer_name: ctx.trailer.name,
      title: alert.title,
      description: alert.description,
      cta_url: `${SITE_URL}/alerts`,
    }),
  },

  manager_note: {
    template: 'critical-alert',
    category: 'operations',
    subject: (alert) => alert.title,
    recipients: async (alert) => getManagersForTrailer(alert.trailer_id),
    buildData: async (alert, ctx) => ({
      trailer_name: ctx.trailer.name,
      title: alert.title,
      description: alert.description,
      cta_url: `${SITE_URL}/alerts`,
    }),
  },
}

// ---- Module-specific dispatch helpers --------------------------------------
// For alerts that need bespoke templates beyond a 1:1 type→template map
// (e.g. cash drawer close → cash-drawer-submitted OR cash-variance-alert),
// these helpers override the default mapping.
async function resolveCashDrawerMapping(alert: any): Promise<Mapping | null> {
  if (alert.source_module !== 'cash') return null
  const sb = admin()
  const { data: session } = await sb
    .from('cash_drawer_sessions')
    .select('variance, counted_amount, expected_amount, total_cash_sales, closed_by')
    .eq('id', alert.source_id)
    .maybeSingle()
  if (!session) return null
  const variance = Number(session.variance ?? 0)
  const isVariance = Math.abs(variance) >= 5
  return {
    template: isVariance ? 'cash-variance-alert' : 'cash-drawer-submitted',
    category: 'cash',
    subject: (_a, ctx) =>
      isVariance
        ? `Cash variance ${variance >= 0 ? '+' : ''}${variance.toFixed(2)} — ${ctx.trailer.name}`
        : `Drawer closed — ${ctx.trailer.name}`,
    recipients: async () => getOwners(),
    buildData: async (_a, ctx) => ({
      trailer_name: ctx.trailer.name,
      closed_by: ctx.creator?.display_name ?? 'Manager',
      counted: session.counted_amount,
      expected: session.expected_amount,
      sales: session.total_cash_sales,
      variance,
      cta_url: `${SITE_URL}/cash`,
    }),
  }
}

// ---------------------------------------------------------------------------

export const Route = createFileRoute('/api/public/hooks/alert-email-dispatch')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'invalid_json' }, { status: 400 })
        }

        const alertId: string | undefined = body?.alert_id
        if (!alertId || typeof alertId !== 'string') {
          return Response.json({ error: 'missing_alert_id' }, { status: 400 })
        }

        const sb = admin()
        const { data: alert, error } = await sb
          .from('alerts')
          .select('*')
          .eq('id', alertId)
          .maybeSingle()
        if (error || !alert) {
          return Response.json({ error: 'alert_not_found' }, { status: 404 })
        }

        // Idempotency: short-circuit if already processed
        if (alert.email_status && alert.email_status !== 'none') {
          return Response.json({ ok: true, skipped: 'already_processed' })
        }

        // Pick mapping (per-module override first, then per-type default)
        let mapping: Mapping | null = await resolveCashDrawerMapping(alert)
        if (!mapping) mapping = MAPPINGS[alert.type] ?? null

        if (!mapping) {
          await sb
            .from('alerts')
            .update({ email_status: 'skipped', email_error: `no_mapping:${alert.type}` })
            .eq('id', alertId)
          return Response.json({ ok: true, skipped: 'no_mapping', type: alert.type })
        }

        const [trailer, creator] = await Promise.all([
          loadTrailer(sb, alert.trailer_id),
          loadProfile(sb, alert.created_by),
        ])
        const ctx = { trailer, creator }

        try {
          const recipients = await mapping.recipients(alert, sb)
          if (recipients.length === 0) {
            await sb
              .from('alerts')
              .update({ email_status: 'skipped', email_template: mapping.template })
              .eq('id', alertId)
            return Response.json({ ok: true, skipped: 'no_recipients' })
          }

          const result = await enqueueAlertEmail({
            alertId,
            templateName: mapping.template,
            templateData: await mapping.buildData(alert, ctx),
            recipients,
            category: mapping.category,
            priority: alert.priority,
            subject: mapping.subject(alert, ctx),
            sourceModule: alert.source_module,
            sourceId: alert.source_id,
          })

          return Response.json({ ok: true, ...result, template: mapping.template })
        } catch (err: any) {
          await sb
            .from('alerts')
            .update({ email_status: 'failed', email_error: err?.message?.slice(0, 500) })
            .eq('id', alertId)
          return Response.json({ ok: false, error: err?.message }, { status: 500 })
        }
      },
    },
  },
})
