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
  const { data, error } = await sb
    .from('user_roles')
    .select('user_id, role, profiles!inner(id, display_name, email, active)')
    .eq('role', role)
  if (error || !data) return []
  return (data as any[])
    .filter((r) => r.profiles?.active && r.profiles?.email)
    .map((r) => ({
      user_id: r.user_id,
      email: r.profiles.email as string,
      display_name: r.profiles.display_name as string,
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
    .select('id, display_name, email, active, trailer_id, user_roles!inner(role)')
    .eq('trailer_id', trailerId)
    .eq('active', true)
  if (error || !data) return []
  return (data as any[])
    .filter((p) => p.email)
    .map((p) => ({
      user_id: p.id,
      email: p.email as string,
      display_name: p.display_name as string,
      role: (p.user_roles?.[0]?.role as Recipient['role']) ?? 'crew',
    }))
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
    .select('user_id, email_enabled, frequency, categories')
    .in('user_id', recipients.map((r) => r.user_id))
  const prefs = new Map((data ?? []).map((p: any) => [p.user_id, p]))

  return recipients.filter((r) => {
    const p: any = prefs.get(r.user_id)
    // Default: opt-in for all categories, immediate
    if (!p) return true
    if (!p.email_enabled || p.frequency === 'off') return false
    const cats = p.categories ?? {}
    if (cats[category] === false) return false
    if (p.frequency === 'critical_only' && priority !== 'critical') return false
    if (p.frequency === 'daily_digest' && priority !== 'critical') return false
    return true
  })
}
