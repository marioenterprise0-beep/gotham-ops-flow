// Server-only helpers to resolve recipients for alert emails.
// Honors profiles.active and notification_preferences.

import { createClient } from '@supabase/supabase-js'

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

export type Recipient = {
  user_id: string
  email: string
  display_name: string
  role: 'owner' | 'manager' | 'cashier' | 'cook' | 'crew'
}

export type Category =
  | 'schedule'
  | 'time_clock'
  | 'inventory'
  | 'cash'
  | 'operations'
  | 'training'
  | 'announcements'
  | 'critical'

async function fetchProfilesByRole(role: string): Promise<Recipient[]> {
  const sb = admin()
  const { data: roles, error } = await sb
    .from('user_roles')
    .select('user_id, role')
    .eq('role', role)
  if (error || !roles || roles.length === 0) return []
  const ids = (roles as any[]).map((r) => r.user_id)
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, display_name, email, active')
    .in('id', ids)
  const pmap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]))
  return (roles as any[])
    .map((r) => ({ r, p: pmap.get(r.user_id) as any }))
    .filter(({ p }) => p?.active && p?.email)
    .map(({ r, p }) => ({
      user_id: r.user_id,
      email: p.email as string,
      display_name: p.display_name as string,
      role: r.role as Recipient['role'],
    }))
}

export async function getOwners(): Promise<Recipient[]> {
  return fetchProfilesByRole('owner')
}

export async function getAllManagers(): Promise<Recipient[]> {
  const [owners, managers] = await Promise.all([
    fetchProfilesByRole('owner'),
    fetchProfilesByRole('manager'),
  ])
  // owners always receive manager-tier escalations too
  const seen = new Set<string>()
  return [...owners, ...managers].filter((r) =>
    seen.has(r.user_id) ? false : (seen.add(r.user_id), true),
  )
}

export async function getManagersForTrailer(trailerId: string | null): Promise<Recipient[]> {
  const all = await getAllManagers()
  if (!trailerId) return all
  const sb = admin()
  const { data } = await sb
    .from('profiles')
    .select('id, trailer_id')
    .in('id', all.map((r) => r.user_id))
  const trailerMap = new Map((data ?? []).map((p: any) => [p.id, p.trailer_id]))
  return all.filter((r) => r.role === 'owner' || trailerMap.get(r.user_id) === trailerId)
}

export async function getCrewForTrailer(trailerId: string): Promise<Recipient[]> {
  const sb = admin()
  const { data, error } = await sb
    .from('profiles')
    .select('id, display_name, email, active, trailer_id')
    .eq('trailer_id', trailerId)
    .eq('active', true)
  if (error || !data) return []
  const ids = (data as any[]).map((p) => p.id)
  const { data: roles } = await sb
    .from('user_roles')
    .select('user_id, role')
    .in('user_id', ids)
  const rmap = new Map<string, string>((roles ?? []).map((r: any) => [r.user_id, r.role]))
  return (data as any[])
    .filter((p) => p.email)
    .map((p) => ({
      user_id: p.id,
      email: p.email as string,
      display_name: p.display_name as string,
      role: (rmap.get(p.id) as Recipient['role']) ?? 'crew',
    }))
}

// Location-aware fan-out: returns every active employee at the alert's trailer
// whose role is enabled for `category` in role_email_policies, plus all owners.
// Personal notification_preferences are applied later via filterByPreferences().
export async function getLocationRecipientsForCategory(
  trailerId: string | null,
  category: Category,
): Promise<Recipient[]> {
  const sb = admin()

  // 1) Role policy: which roles are allowed for this category? (default = enabled)
  const { data: policies } = await sb
    .from('role_email_policies')
    .select('role, enabled')
    .eq('category', category)
  const disabledRoles = new Set(
    (policies ?? []).filter((p: any) => p.enabled === false).map((p: any) => p.role),
  )

  // 2) Owners always receive (regardless of trailer)
  const owners = await fetchProfilesByRole('owner')

  // 3) Active employees at the trailer (if any) with role enabled for category
  let local: Recipient[] = []
  if (trailerId) {
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, display_name, email, active')
      .eq('trailer_id', trailerId)
      .eq('active', true)
    const ids = (profiles ?? []).map((p: any) => p.id)
    if (ids.length > 0) {
      const { data: roles } = await sb
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', ids)
      const roleMap = new Map<string, string>((roles ?? []).map((r: any) => [r.user_id, r.role]))
      local = (profiles ?? [])
        .filter((p: any) => p.email)
        .map((p: any) => ({
          user_id: p.id as string,
          email: p.email as string,
          display_name: p.display_name as string,
          role: (roleMap.get(p.id) as Recipient['role']) ?? 'crew',
        }))
        .filter((r) => !disabledRoles.has(r.role as string))
    }
  }

  // 4) Merge + dedupe (owners win on conflict)
  const seen = new Set<string>()
  return [...owners, ...local].filter((r) =>
    seen.has(r.user_id) ? false : (seen.add(r.user_id), true),
  )
}

export async function getEmployee(userId: string): Promise<Recipient | null> {
  const sb = admin()
  const { data } = await sb
    .from('profiles')
    .select('id, display_name, email, active, user_roles(role)')
    .eq('id', userId)
    .maybeSingle()
  if (!data || !(data as any).email || !(data as any).active) return null
  return {
    user_id: (data as any).id,
    email: (data as any).email,
    display_name: (data as any).display_name,
    role: ((data as any).user_roles?.[0]?.role as Recipient['role']) ?? 'crew',
  }
}

// Returns true if the recipient is currently inside their quiet-hours window.
// Quiet hours are user-local. Critical-priority emails always bypass.
function isInQuietHours(p: any, now: Date): boolean {
  const start: string | null = p?.quiet_hours_start ?? null
  const end: string | null = p?.quiet_hours_end ?? null
  const tz: string = p?.quiet_hours_timezone || 'America/New_York'
  if (!start || !end) return false
  let hhmm = ''
  try {
    hhmm = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz,
    }).format(now) // "HH:MM"
  } catch { return false }
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number)
    return h * 60 + (m || 0)
  }
  const cur = toMin(hhmm)
  const s = toMin(start)
  const e = toMin(end)
  return s <= e ? cur >= s && cur < e : cur >= s || cur < e // window wraps midnight
}

// Filter recipients by notification preferences for a given category/priority.
export async function filterByPreferences(
  recipients: Recipient[],
  category: Category,
  priority: 'critical' | 'high' | 'normal' | 'low',
): Promise<Recipient[]> {
  if (recipients.length === 0) return []
  const sb = admin()
  const { data } = await sb
    .from('notification_preferences')
    .select('user_id, email_enabled, frequency, categories, quiet_hours_start, quiet_hours_end, quiet_hours_timezone')
    .in('user_id', recipients.map((r) => r.user_id))
  const prefs = new Map((data ?? []).map((p: any) => [p.user_id, p]))
  const now = new Date()

  return recipients.filter((r) => {
    const p: any = prefs.get(r.user_id)
    if (!p) return true
    if (!p.email_enabled || p.frequency === 'off') return false
    const cats = p.categories ?? {}
    if (cats[category] === false) return false
    if (p.frequency === 'critical_only' && priority !== 'critical') return false
    if (p.frequency === 'daily_digest' && priority !== 'critical') return false
    if (priority !== 'critical' && isInQuietHours(p, now)) return false
    return true
  })
}
