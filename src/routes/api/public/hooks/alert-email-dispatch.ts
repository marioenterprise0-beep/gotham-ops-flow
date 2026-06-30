import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { enqueueAlertEmail } from '@/lib/email/enqueue.server'
import {
  getOwners,
  getAllManagers,
  getManagersForTrailer,
  getEmployee,
  getCrewForTrailer,
  getLocationRecipientsForCategory,
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
  (process.env.SITE_URL ?? 'https://project--75d61e5b-6b41-4f7e-a315-ad4632c539dd.lovable.app').replace(/\/$/, '')

type Mapping = {
  template: string
  category: Category
  subject: (alert: any, ctx: any) => string
  recipients: (alert: any, sb: any) => Promise<Recipient[]>
  buildData: (alert: any, ctx: any) => Promise<Record<string, unknown>>
  buildDataFor?: (alert: any, ctx: any, recipient: Recipient) => Promise<Record<string, unknown>>
}

function fmtDateLabel(ymd: string | null | undefined): string {
  if (!ymd) return ''
  // ymd is YYYY-MM-DD from the DB; parse without timezone shift
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function fmtTimeLabel(hms: string | null | undefined): string {
  if (!hms) return ''
  const [hStr, mStr] = hms.split(':')
  const h = Number(hStr); const m = Number(mStr ?? 0)
  if (Number.isNaN(h)) return hms
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function shiftMinutes(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60 // overnight
  return mins
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

  time_off: {
    template: 'time-off-request',
    category: 'time_clock',
    subject: (_a, ctx) => `Time off request — ${ctx.creator?.display_name ?? 'Employee'}`,
    recipients: async (alert) => getManagersForTrailer(alert.trailer_id),
    buildData: async (alert, ctx) => ({
      employee_name: ctx.creator?.display_name ?? 'Employee',
      start_date: alert.payload?.start_date,
      end_date: alert.payload?.end_date,
      reason: alert.payload?.reason,
      request_id: alert.source_id,
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

  // Targeted at the one assigned employee only — trailer_id is left null on
  // these alerts specifically so the generic location-based fan-out (which
  // always includes owners but also the whole trailer crew when trailer_id
  // is set) doesn't broadcast a private HR document to other crew members.
  hr_document: {
    template: 'hr-document-assigned',
    category: 'hr_documents',
    subject: (alert) => `New document to review — ${alert.payload?.title ?? alert.title}`,
    recipients: async (alert) => {
      const emp = await getEmployee(alert.assigned_user_id)
      return emp ? [emp] : []
    },
    buildData: async (alert, ctx) => ({
      title: alert.payload?.title ?? alert.title,
      due_date: alert.payload?.due_date ?? '—',
      assigned_by: ctx.creator?.display_name ?? 'Management',
    }),
  },

  hr_document_signed: {
    template: 'hr-document-signed',
    category: 'hr_documents',
    subject: (alert) => `Document fully signed — ${alert.payload?.title ?? alert.title}`,
    recipients: async (alert) => {
      const emp = await getEmployee(alert.assigned_user_id)
      return emp ? [emp] : []
    },
    buildData: async (alert, ctx) => ({
      title: alert.payload?.title ?? alert.title,
      employee_name: alert.payload?.employee_name ?? '—',
      completed_at: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    }),
  },
}

// ---- Module-specific dispatch helpers --------------------------------------
// For alerts that need bespoke templates beyond a 1:1 type→template map
// (e.g. cash drawer close → cash-drawer-submitted OR cash-variance-alert),
// these helpers override the default mapping.
async function resolveCashDrawerMapping(alert: any): Promise<Mapping | null> {
  if (alert.source_module !== 'cash' || alert.type !== 'manager_note') return null
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

// Large cash drop ($500+) — emitted as manager_note from cash_drops trigger.
async function resolveCashDropMapping(alert: any): Promise<Mapping | null> {
  if (alert.source_module !== 'cash' || alert.type !== 'manager_note') return null
  if (!alert.payload?.drop_code) return null
  const sb = admin()
  const { data: drop } = await sb
    .from('cash_drops')
    .select('amount, drop_code, reason, drawer_id, submitted_by')
    .eq('id', alert.source_id)
    .maybeSingle()
  if (!drop) return null
  const { data: drawer } = drop.drawer_id
    ? await sb.from('cash_drawers').select('name').eq('id', drop.drawer_id).maybeSingle()
    : { data: null }
  return {
    template: 'cash-drop-submitted',
    category: 'cash',
    subject: (_a, ctx) => `Cash drop ${drop.drop_code} — ${ctx.trailer.name}`,
    recipients: async () => getOwners(),
    buildData: async (_a, ctx) => ({
      trailer_name: ctx.trailer.name,
      drop_code: drop.drop_code,
      amount: drop.amount,
      reason: drop.reason,
      drawer_name: (drawer as any)?.name,
      submitted_by: ctx.creator?.display_name ?? 'Cashier',
      drop_id: alert.source_id,
      cta_url: `${SITE_URL}/cash`,
    }),
  }
}

// Schedule published — emitted as manager_note from schedules trigger.
async function resolveSchedulePublishedMapping(alert: any): Promise<Mapping | null> {
  if (alert.source_module !== 'schedule' || alert.type !== 'manager_note') return null
  if (alert.payload?.event !== 'schedule_published') return null
  const sb = admin()
  const { data: sched } = await sb
    .from('schedules')
    .select('name, start_date, end_date')
    .eq('id', alert.source_id)
    .maybeSingle()
  return {
    template: 'schedule-published',
    category: 'schedule',
    subject: (_a, ctx) => `Schedule published — ${ctx.trailer.name}`,
    recipients: async () => getCrewForTrailer(alert.trailer_id),
    buildData: async (_a, ctx) => {
      const { data: shifts } = await sb
        .from('schedule_shifts')
        .select('shift_date, start_time, end_time, role')
        .eq('schedule_id', alert.source_id)
        .order('shift_date', { ascending: true })
        .limit(50)
      return {
        trailer_name: ctx.trailer.name,
        week_range: sched ? `${sched.start_date} → ${sched.end_date}` : '',
        location: ctx.trailer.name,
        shifts: (shifts ?? []).map((s: any) => ({
          date: s.shift_date, start: s.start_time, end: s.end_time, role: s.role,
        })),
        schedule_id: alert.source_id,
        cta_url: `${SITE_URL}/schedule?id=${alert.source_id}`,
      }
    },
  }
}

// SOP accepted / training completed — emitted as manager_note from profiles trigger.
async function resolveTrainingMilestoneMapping(alert: any): Promise<Mapping | null> {
  if (alert.source_module !== 'training' || alert.type !== 'manager_note') return null
  const kind = alert.payload?.kind
  if (kind !== 'training_completed' && kind !== 'sop_accepted') return null
  return {
    template: 'training-completed',
    category: 'training',
    subject: (_a, ctx) =>
      `${kind === 'sop_accepted' ? 'SOP accepted' : 'Training completed'} — ${ctx.creator?.display_name ?? 'Crew'}`,
    recipients: async () => getOwners(),
    buildData: async (_a, ctx) => ({
      trailer_name: ctx.trailer.name,
      employee_name: ctx.creator?.display_name ?? 'Crew',
      sop_title: kind === 'sop_accepted' ? 'Standard Operating Procedures' : 'Training program',
      completed_at: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
      cta_url: `${SITE_URL}/training`,
    }),
  }
}

// time_off_decided / time_adjustment_decided carry payload.decision
// ('approved' | 'declined') and are always targeted at the requesting
// employee directly via assigned_user_id — picks between the matching
// approved/declined template pair.
async function resolveTimeOffDecisionMapping(alert: any): Promise<Mapping | null> {
  if (alert.type !== 'time_off_decided') return null
  const approved = alert.payload?.decision === 'approved'
  return {
    template: approved ? 'time-off-approved' : 'time-off-declined',
    category: 'time_clock',
    subject: () => (approved ? 'Time off approved' : 'Time off request declined'),
    recipients: async (a) => {
      const emp = await getEmployee(a.assigned_user_id)
      return emp ? [emp] : []
    },
    buildData: async (a) => ({
      start_date: a.payload?.start_date,
      end_date: a.payload?.end_date,
      decision_reason: a.payload?.decision_reason,
      decided_by: a.payload?.decided_by_name,
    }),
  }
}

async function resolveTimeAdjustmentDecisionMapping(alert: any): Promise<Mapping | null> {
  if (alert.type !== 'time_adjustment_decided') return null
  const approved = alert.payload?.decision === 'approved'
  return {
    template: approved ? 'time-adjustment-approved' : 'time-adjustment-declined',
    category: 'time_clock',
    subject: () => (approved ? 'Time adjustment approved' : 'Time adjustment declined'),
    recipients: async (a) => {
      const emp = await getEmployee(a.assigned_user_id)
      return emp ? [emp] : []
    },
    buildData: async (a) => ({
      shift_date: a.payload?.shift_date,
      approved_value: a.payload?.approved_value,
      decision_reason: a.payload?.decision_reason,
      decided_by: a.payload?.decided_by_name,
      approver_name: a.payload?.decided_by_name,
      punch_id: a.payload?.punch_id,
    }),
  }
}

// ---------------------------------------------------------------------------

export const Route = createFileRoute('/api/public/hooks/alert-email-dispatch')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Shared-secret guard. The notify_alert_email DB trigger reads the
        // dispatch key from public.email_dispatch_config (service-role-only)
        // and sends it as the x-dispatch-key header. Any external caller
        // without the key is rejected.
        const sbAuth = admin();
        const { data: cfg } = await sbAuth
          .from('email_dispatch_config')
          .select('dispatch_key')
          .eq('id', 1)
          .maybeSingle();
        const expected = (cfg as any)?.dispatch_key as string | undefined;
        const provided = request.headers.get('x-dispatch-key');
        if (!expected || !provided || provided !== expected) {
          return new Response('Unauthorized', { status: 401 });
        }



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
        let mapping: Mapping | null =
          (await resolveCashDropMapping(alert)) ||
          (await resolveCashDrawerMapping(alert)) ||
          (await resolveSchedulePublishedMapping(alert)) ||
          (await resolveTrainingMilestoneMapping(alert)) ||
          (await resolveTimeOffDecisionMapping(alert)) ||
          (await resolveTimeAdjustmentDecisionMapping(alert))
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
          // Default fan-out: every active employee at the alert's trailer whose
          // role is enabled for this category (plus owners). The per-mapping
          // resolver above is still used as a safety floor (e.g. owners-only
          // when there's no trailer attached). We union the two so owners
          // narrowing role policy never *removes* the originally intended audience.
          const [base, location] = await Promise.all([
            mapping.recipients(alert, sb),
            getLocationRecipientsForCategory(alert.trailer_id, mapping.category),
          ])
          const seen = new Set<string>()
          const recipients = [...base, ...location].filter((r) =>
            seen.has(r.user_id) ? false : (seen.add(r.user_id), true),
          )
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
          console.error('alert-email-dispatch failed', { alertId, error: err })
          await sb
            .from('alerts')
            .update({ email_status: 'failed', email_error: err?.message?.slice(0, 500) })
            .eq('id', alertId)
          return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 })
        }
      },
    },
  },
})
