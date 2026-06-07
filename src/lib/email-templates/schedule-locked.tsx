import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Props {
  recipient_name?: string
  week_range?: string
  location?: string
  lock_reason?: string
  locked_by?: string
  schedule_id?: string
}

const Email = ({ recipient_name, week_range, location, lock_reason, locked_by, schedule_id }: Props) => (
  <BrandLayout preview={`Schedule locked — ${week_range ?? ''}`}>
    <StatusBadge variant="neutral" label="Locked" />
    <Heading style={styles.h1}>Schedule locked</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ''}the schedule for {week_range ?? 'the upcoming week'} has been locked{locked_by ? ` by ${locked_by}` : ''} and is no longer editable.
    </Text>
    <DataTable>
      <DataRow label="Week" value={week_range ?? '—'} emphasis />
      <DataRow label="Location" value={location ?? '—'} />
      <DataRow label="Locked by" value={locked_by ?? '—'} />
      {lock_reason && <DataRow label="Reason" value={lock_reason} />}
    </DataTable>
    <OpenGothamButton path={schedule_id ? `/schedule/${schedule_id}` : '/schedule'} label="View Schedule" />
  </BrandLayout>
)

export const template = {
  component: Email,
  subject: (d: any) => `Schedule locked — ${d?.week_range ?? ''}`,
  displayName: 'Schedule Locked',
  previewData: { week_range: 'Dec 9 – Dec 15', location: 'Trailer 1', locked_by: 'Omar (Owner)', lock_reason: 'Approved for publish' },
} satisfies TemplateEntry
export default Email
