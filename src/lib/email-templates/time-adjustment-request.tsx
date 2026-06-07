import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Props {
  recipient_name?: string
  employee_name?: string
  shift_date?: string
  original?: string
  requested?: string
  reason?: string
  punch_id?: string
}

const Email = ({ recipient_name, employee_name, shift_date, original, requested, reason, punch_id }: Props) => (
  <BrandLayout preview={`Time adjustment request — ${employee_name ?? ''}`}>
    <StatusBadge variant="info" label="Pending Approval" />
    <Heading style={styles.h1}>Time adjustment request</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ''}{employee_name ?? 'an employee'} submitted a correction request for their punch on {shift_date ?? '—'}.
    </Text>
    <DataTable>
      <DataRow label="Employee" value={employee_name ?? '—'} emphasis />
      <DataRow label="Shift date" value={shift_date ?? '—'} />
      <DataRow label="Original" value={original ?? '—'} />
      <DataRow label="Requested" value={requested ?? '—'} emphasis />
      {reason && <DataRow label="Reason" value={reason} />}
    </DataTable>
    <OpenGothamButton path={punch_id ? `/time/punches/${punch_id}` : '/time'} label="Review Request" />
  </BrandLayout>
)

export const template = {
  component: Email,
  subject: (d: any) => `Time adjustment request — ${d?.employee_name ?? ''}`,
  displayName: 'Time Adjustment Request',
  previewData: { employee_name: 'Sara Ahmed', shift_date: 'Mon Dec 9', original: '10:00 AM – 3:00 AM (auto)', requested: '10:00 AM – 6:15 PM', reason: 'Forgot to clock out' },
} satisfies TemplateEntry
export default Email
