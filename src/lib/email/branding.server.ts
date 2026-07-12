// Fetches saved store branding colors for server-side email rendering.
// Cached briefly to avoid a db round-trip per email.

import { createClient } from '@supabase/supabase-js'

export interface EmailBranding {
  bgColor: string | null
  fgColor: string | null
  accentColor: string | null
}

const EMPTY: EmailBranding = { bgColor: null, fgColor: null, accentColor: null }

let cached: { at: number; value: EmailBranding } | null = null
const TTL_MS = 60_000

export async function getEmailBranding(): Promise<EmailBranding> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value
  try {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return EMPTY
    const sb = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data } = await sb
      .from('stores')
      .select('bg_color, fg_color, accent_color')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    const value: EmailBranding = {
      bgColor: (data as any)?.bg_color ?? null,
      fgColor: (data as any)?.fg_color ?? null,
      accentColor: (data as any)?.accent_color ?? null,
    }
    cached = { at: Date.now(), value }
    return value
  } catch {
    return EMPTY
  }
}

export function clearEmailBrandingCache() {
  cached = null
}