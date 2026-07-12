// Central helper to render + enqueue a branded alert email through the
// transactional_emails pgmq queue. Mirrors the payload shape produced by
// /lovable/email/transactional/send so the queue processor can dispatch it.

import * as React from 'react'
import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { TEMPLATES } from '@/lib/email-templates/registry'
import { filterByPreferences, type Category, type Recipient } from './recipients.server'
import { applyBrandOverrides } from '@/lib/email-templates/_brand'
import { getEmailBranding } from './branding.server'

const SITE_NAME = 'dipnshake'
const SENDER_DOMAIN = 'notify.dipnshake.com'
const FROM_DOMAIN = 'notify.dipnshake.com'

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

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function getOrCreateUnsubscribeToken(sb: any, email: string): Promise<string | null> {
  const normalized = email.toLowerCase()
  const { data: existing } = await sb
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalized)
    .maybeSingle()
  if (existing && !existing.used_at) return existing.token
  if (existing && existing.used_at) return null // suppressed
  const token = generateToken()
  await sb
    .from('email_unsubscribe_tokens')
    .upsert({ token, email: normalized }, { onConflict: 'email', ignoreDuplicates: true })
  const { data: stored } = await sb
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', normalized)
    .maybeSingle()
  return stored?.token ?? token
}

export interface EnqueueAlertEmailInput {
  alertId: string | null
  templateName: string
  templateData: Record<string, unknown>
  /** Optional per-recipient template data merged on top of templateData. */
  templateDataFor?: (recipient: Recipient) => Promise<Record<string, unknown>> | Record<string, unknown>
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

  // Apply saved store branding to outgoing emails.
  try {
    applyBrandOverrides(await getEmailBranding())
  } catch {}

  const template = TEMPLATES[input.templateName]
  if (!template) {
    if (input.alertId) {
      await sb
        .from('alerts')
        .update({ email_status: 'failed', email_error: `template_not_found:${input.templateName}` })
        .eq('id', input.alertId)
    }
    return { enqueued: 0, skipped: input.recipients.length }
  }

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

  // Suppression check
  const { data: suppressed } = await sb
    .from('suppressed_emails')
    .select('email')
    .in('email', eligible.map((r) => r.email.toLowerCase()))
  const blocked = new Set((suppressed ?? []).map((s: any) => (s.email as string).toLowerCase()))
  const sendable = eligible.filter((r) => !blocked.has(r.email.toLowerCase()))

  let enqueued = 0
  for (const recipient of sendable) {
    // Idempotency: skip only if there is an active/successful send already.
    // Older broken rows can exist without a message_id; those should not block requeueing.
    if (input.alertId) {
      const { data: existing } = await sb
        .from('email_send_log')
        .select('status, message_id, created_at')
        .eq('alert_id', input.alertId)
        .eq('recipient_email', recipient.email)
        .eq('template_name', input.templateName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const shouldSkip =
        existing?.status === 'sent' ||
        existing?.status === 'suppressed' ||
        (existing?.status === 'pending' && Boolean(existing?.message_id))

      if (shouldSkip) continue
    }

    const messageId = crypto.randomUUID()
    const idempotencyKey = input.alertId
      ? `${input.alertId}:${input.templateName}:${recipient.email}`
      : `${input.templateName}:${recipient.email}:${messageId}`

    const unsubscribeToken = await getOrCreateUnsubscribeToken(sb, recipient.email)
    if (!unsubscribeToken) {
      // Address has unsubscribed
      await sb.from('email_send_log').insert({
        message_id: messageId,
        alert_id: input.alertId,
        template_name: input.templateName,
        recipient_email: recipient.email,
        subject: input.subject,
        source_module: input.sourceModule,
        source_id: input.sourceId,
        status: 'suppressed',
      })
      continue
    }

    // Render template
    const perRecipient = input.templateDataFor ? await input.templateDataFor(recipient) : {}
    const templateData = {
      ...input.templateData,
      ...perRecipient,
      recipient_name: recipient.display_name,
      recipient_email: recipient.email,
    }
    let html: string
    let text: string
    try {
      const element = React.createElement(template.component, templateData)
      html = await render(element)
      text = await render(element, { plainText: true })
    } catch (err: any) {
      await sb.from('email_send_log').insert({
        message_id: messageId,
        alert_id: input.alertId,
        template_name: input.templateName,
        recipient_email: recipient.email,
        subject: input.subject,
        source_module: input.sourceModule,
        source_id: input.sourceId,
        status: 'failed',
        error_message: `render_failed: ${err?.message ?? String(err)}`.slice(0, 1000),
      })
      continue
    }

    const payload = {
      message_id: messageId,
      to: recipient.email,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: input.subject,
      html,
      text,
      purpose: 'transactional',
      label: input.templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    }

    // Log pending BEFORE enqueue
    await sb.from('email_send_log').insert({
      message_id: messageId,
      alert_id: input.alertId,
      template_name: input.templateName,
      recipient_email: recipient.email,
      subject: input.subject,
      source_module: input.sourceModule,
      source_id: input.sourceId,
      status: 'pending',
    })

    const { error } = await sb.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload,
    })
    if (error) {
      await sb.from('email_send_log').insert({
        message_id: messageId,
        alert_id: input.alertId,
        template_name: input.templateName,
        recipient_email: recipient.email,
        subject: input.subject,
        source_module: input.sourceModule,
        source_id: input.sourceId,
        status: 'failed',
        error_message: error.message?.slice(0, 1000),
      })
      continue
    }
    enqueued++
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
