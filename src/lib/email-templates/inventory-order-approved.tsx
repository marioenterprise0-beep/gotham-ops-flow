import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Props { recipient_name?: string; approver_name?: string; location?: string; item_count?: number; owner_comment?: string; order_id?: string }
const Email = ({ recipient_name, approver_name, location, item_count, owner_comment, order_id }: Props) => (
  <BrandLayout preview="Inventory order approved">
    <StatusBadge variant="success" label="Approved" />
    <Heading style={styles.h1}>Inventory order approved</Heading>
    <Text style={styles.text}>{recipient_name ? `${recipient_name}, ` : ''}your inventory order has been approved{approver_name ? ` by ${approver_name}` : ''} and is ready to be placed with the vendor.</Text>
    <DataTable>
      <DataRow label="Location" value={location ?? '—'} />
      <DataRow label="Items" value={item_count ?? 0} emphasis />
      <DataRow label="Approved by" value={approver_name ?? '—'} />
      {owner_comment && <DataRow label="Note" value={owner_comment} />}
    </DataTable>
    <OpenGothamButton path={order_id ? `/inventory/orders/${order_id}` : '/inventory/orders'} label="Open Inventory Order" />
  </BrandLayout>
)
export const template = { component: Email, subject: 'Inventory order approved', displayName: 'Inventory Order Approved', previewData: { recipient_name: 'Aisha', approver_name: 'Omar', location: 'Location 1', item_count: 14 } } satisfies TemplateEntry
export default Email
