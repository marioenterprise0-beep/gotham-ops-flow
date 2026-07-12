import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Props {
  recipient_name?: string
  approver_name?: string
  week_range?: string
  location?: string
  total_hours?: number | string
  schedule_id?: string
}

const Email = ({ recipient_name, approver_name, week_range, location, total_hours, schedule_id }: Props) => (
  <BrandLayout preview={`Schedule approved — ${week_range ?? ''}`}>
    <StatusBadge variant="success" label="Approved" />
    <Heading style={styles.h1}>Schedule approved</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ''}the schedule for {week_range ?? 'the upcoming week'} has been approved{approver_name ? ` by ${approver_name}` : ''} and is ready to publish to the crew.
    </Text>
    <DataTable>
      <DataRow label="Week" value={week_range ?? '—'} emphasis />
      <DataRow label="Location" value={location ?? '—'} />
      <DataRow label="Total hours" value={total_hours != null ? `${total_hours} hrs` : '—'} />
      <DataRow label="Approved by" value={approver_name ?? '—'} />
    </DataTable>
    <OpenGothamButton path={schedule_id ? `/schedule/${schedule_id}` : '/schedule'} label="Open Schedule" />
  </BrandLayout>
)

export const template = {
  component: Email,
  subject: (d: any) => `Schedule approved — ${d?.week_range ?? ''}`,
  displayName: 'Schedule Approved',
  previewData: { recipient_name: 'Aisha', approver_name: 'Omar (Owner)', week_range: 'Dec 9 – Dec 15', location: 'Location 1', total_hours: 184, schedule_id: 'abc' },
} satisfies TemplateEntry
export default Email
