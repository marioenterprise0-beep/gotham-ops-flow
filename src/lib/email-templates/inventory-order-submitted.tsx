import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Props { recipient_name?: string; submitted_by?: string; location?: string; item_count?: number; critical_count?: number; order_id?: string }
const Email = ({ recipient_name, submitted_by, location, item_count, critical_count, order_id }: Props) => (
  <BrandLayout preview={`Inventory order submitted — ${location ?? ''}`}>
    <StatusBadge variant={critical_count && critical_count > 0 ? 'critical' : 'warning'} label={critical_count && critical_count > 0 ? 'Critical · Owner Review' : 'Pending Owner Review'} />
    <Heading style={styles.h1}>Inventory order submitted</Heading>
    <Text style={styles.text}>{recipient_name ? `${recipient_name}, ` : ''}{submitted_by ?? 'A manager'} submitted an inventory order for your review.</Text>
    <DataTable>
      <DataRow label="Submitted by" value={submitted_by ?? '—'} />
      <DataRow label="Location" value={location ?? '—'} />
      <DataRow label="Items requested" value={item_count ?? 0} emphasis />
      <DataRow label="Critical items" value={critical_count ?? 0} />
    </DataTable>
    <OpenGothamButton path={order_id ? `/inventory/orders/${order_id}` : '/inventory/orders'} label="Open Inventory Order" />
  </BrandLayout>
)
export const template = { component: Email, subject: (d: any) => `Inventory order submitted — ${d?.location ?? ''}`, displayName: 'Inventory Order Submitted', previewData: { submitted_by: 'Aisha', location: 'Trailer 1', item_count: 14, critical_count: 3, order_id: 'abc' } } satisfies TemplateEntry
export default Email
