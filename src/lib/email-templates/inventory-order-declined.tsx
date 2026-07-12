import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Props { recipient_name?: string; decided_by?: string; location?: string; owner_comment?: string; order_id?: string }
const Email = ({ recipient_name, decided_by, location, owner_comment, order_id }: Props) => (
  <BrandLayout preview="Inventory order declined">
    <StatusBadge variant="critical" label="Declined" />
    <Heading style={styles.h1}>Inventory order declined</Heading>
    <Text style={styles.text}>{recipient_name ? `${recipient_name}, ` : ''}your inventory order was declined{decided_by ? ` by ${decided_by}` : ''}. See notes below and resubmit when ready.</Text>
    <DataTable>
      <DataRow label="Location" value={location ?? '—'} />
      <DataRow label="Decided by" value={decided_by ?? '—'} />
      {owner_comment && <DataRow label="Note" value={owner_comment} />}
    </DataTable>
    <OpenGothamButton path={order_id ? `/inventory/orders/${order_id}` : '/inventory/orders'} label="Review Order" />
  </BrandLayout>
)
export const template = { component: Email, subject: 'Inventory order declined', displayName: 'Inventory Order Declined', previewData: { recipient_name: 'Aisha', decided_by: 'Omar', location: 'Location 1', owner_comment: 'Wait until Friday delivery.' } } satisfies TemplateEntry
export default Email
