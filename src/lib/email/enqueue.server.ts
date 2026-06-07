// Central helper to enqueue a branded alert email through the existing
// transactional_emails pgmq queue, updating alert + send-log rows.

import { createClient } from '@supabase/supabase-js'
import { filterByPreferences, type Category, type Recipient } from './recipients.server'

let _admin: any = null
function admin(): any {
  if (_admin) return _admin
  _admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  return _admin
}

export interface EnqueueAlertEmailInput {
  alertId: string | null
  templateName: string
  templateData: Record<string, unknown>
  recipients: Recipient[]
  category: Category
  priority?: 'critical' | 'high' | 'normal' | 'low'
  subject: string
  sourceModule?: string
  sourceId?: string | null
}

export async function enqueueAlertEmail(input: EnqueueAlertEmailInput): Promise<{
  enqueued: number
  skipped: number
}> {
  const sb = admin()
  const eligible = await filterByPreferences(
    input.recipients,
    input.category,
    input.priority ?? 'normal',
  )

  if (eligible.length === 0) {
    if (input.alertId) {
      await sb
        .from('alerts')
        .update({ email_status: 'skipped', email_template: input.templateName })
        .eq('id', input.alertId)
    }
    return { enqueued: 0, skipped: input.recipients.length }
  }

  // Check suppression list
  const { data: suppressed } = await sb
    .from('suppressed_emails')
    .select('email')
    .in('email', eligible.map((r) => r.email))
  const blocked = new Set((suppressed ?? []).map((s: any) => s.email))
  const sendable = eligible.filter((r) => !blocked.has(r.email))

  let enqueued = 0
  for (const recipient of sendable) {
    // Idempotency: skip if already logged for this alert+recipient+template
    if (input.alertId) {
      const { data: existing } = await sb
        .from('email_send_log')
        .select('id')
        .eq('alert_id', input.alertId)
        .eq('recipient_email', recipient.email)
        .eq('template_name', input.templateName)
        .maybeSingle()
      if (existing) continue
    }

    const payload = {
      template_name: input.templateName,
      recipient_email: recipient.email,
      subject: input.subject,
      template_data: {
        ...input.templateData,
        recipient_name: recipient.display_name,
        recipient_email: recipient.email,
      },
      idempotency_key: input.alertId
        ? `${input.alertId}:${input.templateName}:${recipient.email}`
        : `${input.templateName}:${recipient.email}:${Date.now()}`,
      metadata: {
        alert_id: input.alertId,
        source_module: input.sourceModule,
        source_id: input.sourceId,
        category: input.category,
        priority: input.priority ?? 'normal',
      },
    }

    const { error } = await sb.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload,
    })
    if (error) {
      await sb.from('email_send_log').insert({
        alert_id: input.alertId,
        template_name: input.templateName,
        recipient_email: recipient.email,
        subject: input.subject,
        source_module: input.sourceModule,
        source_id: input.sourceId,
        status: 'failed',
        error_message: error.message,
      })
      continue
    }
    enqueued++
    await sb.from('email_send_log').insert({
      alert_id: input.alertId,
      template_name: input.templateName,
      recipient_email: recipient.email,
      subject: input.subject,
      source_module: input.sourceModule,
      source_id: input.sourceId,
      status: 'pending',
    })
  }

  if (input.alertId) {
    await sb
      .from('alerts')
      .update({
        email_status: enqueued > 0 ? 'queued' : 'skipped',
        email_template: input.templateName,
      })
      .eq('id', input.alertId)
  }

  return { enqueued, skipped: input.recipients.length - enqueued }
}
