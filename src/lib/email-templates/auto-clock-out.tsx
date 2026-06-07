import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Props {
  recipient_name?: string
  employee_name?: string
  shift_date?: string
  clock_in?: string
  auto_clock_out?: string
  total_hours?: string | number
  punch_id?: string
}

const Email = ({ recipient_name, employee_name, shift_date, clock_in, auto_clock_out, total_hours, punch_id }: Props) => (
  <BrandLayout preview={`Auto clock-out for ${employee_name ?? ''}`}>
    <StatusBadge variant="warning" label="Auto Closed" />
    <Heading style={styles.h1}>Auto clock-out at rollover</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ''}{employee_name ?? 'an employee'}'s open punch was automatically closed during the 3:00 AM rollover.
    </Text>
    <DataTable>
      <DataRow label="Employee" value={employee_name ?? '—'} emphasis />
      <DataRow label="Shift date" value={shift_date ?? '—'} />
      <DataRow label="Clock in" value={clock_in ?? '—'} />
      <DataRow label="Auto clock out" value={auto_clock_out ?? '—'} />
      <DataRow label="Recorded total" value={total_hours != null ? `${total_hours} hrs` : '—'} emphasis />
    </DataTable>
    <OpenGothamButton path={punch_id ? `/time/punches/${punch_id}` : '/time'} label="Review Time Record" />
  </BrandLayout>
)

export const template = {
  component: Email,
  subject: (d: any) => `Auto clock-out — ${d?.employee_name ?? ''}`,
  displayName: 'Auto Clock Out',
  previewData: { employee_name: 'Sara Ahmed', shift_date: 'Mon Dec 9', clock_in: '10:02 AM', auto_clock_out: '3:00 AM', total_hours: 8 },
} satisfies TemplateEntry
export default Email
