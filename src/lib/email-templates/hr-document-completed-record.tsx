import * as React from 'react'
import { BrandLayout, DataRow, DataTable, PrimaryButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Props { employee_name?: string; title?: string; completed_at?: string; pdf_url?: string }
const Email = ({ employee_name, title, completed_at, pdf_url }: Props) => (
  <BrandLayout preview={`Completed record — ${title ?? ''} — ${employee_name ?? ''}`}>
    <StatusBadge variant="success" label="Completed Record" />
    <Heading style={styles.h1}>HR document completed</Heading>
    <Text style={styles.text}>
      <strong>{title ?? 'A document'}</strong> for {employee_name ?? 'an employee'} has every required signature.
      A copy of the completed, filled-in document is attached below for your records.
    </Text>
    <DataTable>
      <DataRow label="Document" value={title ?? '—'} emphasis />
      <DataRow label="Employee" value={employee_name ?? '—'} />
      <DataRow label="Completed" value={completed_at ?? '—'} />
    </DataTable>
    {pdf_url && <PrimaryButton href={pdf_url}>Download Completed PDF</PrimaryButton>}
  </BrandLayout>
)
export const template = {
  component: Email,
  subject: (d: any) => `[Dip N Shake] Completed: ${d?.title ?? 'HR Document'} — ${d?.employee_name ?? ''}`,
  displayName: 'HR Document Completed Record',
  previewData: {
    title: 'Written Warning Form', employee_name: 'Sara Ahmed',
    completed_at: 'Thu Dec 12 4:20 PM', pdf_url: 'https://example.com/sample.pdf',
  },
} satisfies TemplateEntry
export default Email
