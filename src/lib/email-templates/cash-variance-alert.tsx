import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Props { recipient_name?: string; drawer_name?: string; expected?: string | number; counted?: string | number; variance?: string | number; reason?: string; submitted_by?: string; session_id?: string }
const Email = ({ recipient_name, drawer_name, expected, counted, variance, reason, submitted_by, session_id }: Props) => (
  <BrandLayout preview={`Cash variance — ${drawer_name ?? ''}`}>
    <StatusBadge variant="critical" label="Urgent · Cash Variance" />
    <Heading style={styles.h1}>Cash variance detected</Heading>
    <Text style={styles.text}>{recipient_name ? `${recipient_name}, ` : ''}a cash variance was reported on {drawer_name ?? 'a drawer'} by {submitted_by ?? 'the closer'}. Please review immediately.</Text>
    <DataTable>
      <DataRow label="Drawer" value={drawer_name ?? '—'} emphasis />
      <DataRow label="Expected" value={`$${expected ?? '—'}`} />
      <DataRow label="Counted" value={`$${counted ?? '—'}`} />
      <DataRow label="Variance" value={`$${variance ?? 0}`} emphasis />
      {reason && <DataRow label="Reason" value={reason} />}
    </DataTable>
    <OpenGothamButton path={session_id ? `/cash/sessions/${session_id}` : '/cash'} label="Review Variance" />
  </BrandLayout>
)
export const template = { component: Email, subject: (d: any) => `URGENT cash variance — ${d?.drawer_name ?? ''}`, displayName: 'Cash Variance Alert', previewData: { drawer_name: 'Drawer A', expected: '420.00', counted: '375.00', variance: '-45.00', reason: 'Refund miscounted', submitted_by: 'Aisha' } } satisfies TemplateEntry
export default Email
