import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Change { field?: string; from?: string; to?: string }
interface Props {
  recipient_name?: string
  changed_by?: string
  week_range?: string
  location?: string
  changes?: Change[]
  schedule_id?: string
}

const Email = ({ recipient_name, changed_by, week_range, location, changes = [], schedule_id }: Props) => (
  <BrandLayout preview={`Schedule updated — ${week_range ?? ''}`}>
    <StatusBadge variant="warning" label="Updated" />
    <Heading style={styles.h1}>Schedule was changed</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ''}{changed_by ?? 'A manager'} updated the schedule for {week_range ?? 'this period'}. Please review the changes below.
    </Text>
    <DataTable>
      <DataRow label="Week" value={week_range ?? '—'} emphasis />
      <DataRow label="Location" value={location ?? '—'} />
      <DataRow label="Changed by" value={changed_by ?? '—'} />
    </DataTable>
    {changes.length > 0 && (
      <DataTable>
        {changes.map((c, i) => (
          <DataRow key={i} label={c.field ?? `Change ${i + 1}`} value={`${c.from ?? '—'} → ${c.to ?? '—'}`} />
        ))}
      </DataTable>
    )}
    <OpenGothamButton path={schedule_id ? `/schedule/${schedule_id}` : '/schedule'} label="View Changes" />
  </BrandLayout>
)

export const template = {
  component: Email,
  subject: (d: any) => `Schedule updated — ${d?.week_range ?? ''}`,
  displayName: 'Schedule Changed',
  previewData: { changed_by: 'Aisha Khan', week_range: 'Dec 9 – Dec 15', location: 'Location 1', changes: [{ field: 'Tue Dec 10', from: '10–6', to: '12–8' }] },
} satisfies TemplateEntry
export default Email
