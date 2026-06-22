import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Props {
  recipient_name?: string
  start_date?: string
  end_date?: string
  decision_reason?: string
  decided_by?: string
}

const Email = ({ recipient_name, start_date, end_date, decision_reason, decided_by }: Props) => (
  <BrandLayout preview="Time off request declined">
    <StatusBadge variant="critical" label="Declined" />
    <Heading style={styles.h1}>Time off request declined</Heading>
    <Text style={styles.text}>
      {recipient_name ? `Hi ${recipient_name}, your` : 'Your'} time off request was declined{decided_by ? ` by ${decided_by}` : ''}. Reach out to your manager if you'd like to discuss it.
    </Text>
    <DataTable>
      <DataRow label="Dates" value={end_date && end_date !== start_date ? `${start_date} – ${end_date}` : (start_date ?? '—')} />
      {decision_reason && <DataRow label="Reason" value={decision_reason} />}
      <DataRow label="Decided by" value={decided_by ?? '—'} />
    </DataTable>
    <OpenGothamButton path="/time-clock" label="Open Time Off" />
  </BrandLayout>
)

export const template = {
  component: Email,
  subject: 'Time off request declined',
  displayName: 'Time Off Declined',
  previewData: { recipient_name: 'Sara', start_date: 'Mon Dec 9', end_date: 'Wed Dec 11', decision_reason: 'Short-staffed that week', decided_by: 'Mario' },
} satisfies TemplateEntry
export default Email
