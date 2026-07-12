import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Item { item_name?: string; requested_qty?: number | string; unit?: string; urgency?: string; current_qty?: number | string; par_qty?: number | string }
interface Props { recipient_name?: string; submitted_by?: string; location?: string; trailer_name?: string; item_count?: number; critical_count?: number; order_id?: string; cta_url?: string; items?: Item[] }
const Email = ({ recipient_name, submitted_by, location, trailer_name, item_count, critical_count, order_id, items = [] }: Props) => {
  const loc = location ?? trailer_name
  return (
  <BrandLayout preview={`Inventory order submitted — ${loc ?? ''}`}>
    <StatusBadge variant={critical_count && critical_count > 0 ? 'critical' : 'warning'} label={critical_count && critical_count > 0 ? 'Critical · Owner Review' : 'Pending Owner Review'} />
    <Heading style={styles.h1}>Inventory order submitted</Heading>
    <Text style={styles.text}>{recipient_name ? `${recipient_name}, ` : ''}{submitted_by ?? 'A manager'} submitted an inventory order for your review.</Text>
    <DataTable>
      <DataRow label="Submitted by" value={submitted_by ?? '—'} />
      <DataRow label="Location" value={loc ?? '—'} />
      <DataRow label="Items requested" value={item_count ?? items.length} emphasis />
      <DataRow label="Critical items" value={critical_count ?? 0} />
    </DataTable>
    <Heading style={styles.h1}>Items requested</Heading>
    <DataTable>
      {items.length === 0 ? <DataRow label="Items" value="—" /> :
        items.map((it, i) => (
          <DataRow
            key={i}
            label={`${it.item_name ?? `Item ${i+1}`}${it.urgency && ['critical','emergency'].includes(it.urgency) ? ' · ⚠' : ''}`}
            value={`${it.requested_qty ?? '—'}${it.unit ? ` ${it.unit}` : ''}${it.current_qty != null || it.par_qty != null ? ` (on hand ${it.current_qty ?? '—'} / par ${it.par_qty ?? '—'})` : ''}`}
          />
        ))}
    </DataTable>
    <OpenGothamButton path={order_id ? `/inventory/orders/${order_id}` : '/inventory/orders'} label="Open Inventory Order" />
  </BrandLayout>
  )
}
export const template = { component: Email, subject: (d: any) => `Inventory order submitted — ${d?.location ?? d?.trailer_name ?? ''}`, displayName: 'Inventory Order Submitted', previewData: { submitted_by: 'Aisha', location: 'Location 1', item_count: 3, critical_count: 1, order_id: 'abc', items: [{ item_name: 'Chicken thighs', requested_qty: 40, unit: 'lb', urgency: 'critical', current_qty: 4, par_qty: 20 }, { item_name: 'Pita bread', requested_qty: 80, unit: 'ea', current_qty: 12, par_qty: 80 }, { item_name: 'Tahini', requested_qty: 6, unit: 'jar' }] } } satisfies TemplateEntry
export default Email
