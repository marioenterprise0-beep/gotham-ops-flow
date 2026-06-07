import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, PrimaryButton, StatusBadge, styles, Heading, Text, appUrl } from './_brand'
import type { TemplateEntry } from './registry'

interface Props { recipient_name?: string; drawer_name?: string; expected?: string | number; counted?: string | number; variance?: string | number; submitted_by?: string; pdf_url?: string; session_id?: string }
const Email = ({ recipient_name, drawer_name, expected, counted, variance, submitted_by, pdf_url, session_id }: Props) => {
  const v = typeof variance === 'number' ? variance : Number(variance ?? 0)
  const isVar = v !== 0
  return (
    <BrandLayout preview={`Cash drawer submitted — ${drawer_name ?? ''}`}>
      <StatusBadge variant={isVar ? 'warning' : 'success'} label={isVar ? 'Variance Detected' : 'Balanced'} />
      <Heading style={styles.h1}>Cash drawer submitted</Heading>
      <Text style={styles.text}>{recipient_name ? `${recipient_name}, ` : ''}{submitted_by ?? 'A manager'} closed the cash drawer and submitted the count.</Text>
      <DataTable>
        <DataRow label="Drawer" value={drawer_name ?? '—'} emphasis />
        <DataRow label="Expected" value={`$${expected ?? '—'}`} />
        <DataRow label="Counted" value={`$${counted ?? '—'}`} />
        <DataRow label="Variance" value={`$${variance ?? 0}`} emphasis />
        <DataRow label="Submitted by" value={submitted_by ?? '—'} />
      </DataTable>
      <OpenGothamButton path={session_id ? `/cash/sessions/${session_id}` : '/cash'} label="Open Cash Record" />
      {pdf_url && <PrimaryButton href={pdf_url}>Download PDF Report</PrimaryButton>}
    </BrandLayout>
  )
}
export const template = { component: Email, subject: (d: any) => `Cash drawer submitted — ${d?.drawer_name ?? ''}`, displayName: 'Cash Drawer Submitted', previewData: { drawer_name: 'Drawer A', expected: '420.00', counted: '418.50', variance: '-1.50', submitted_by: 'Aisha', pdf_url: 'https://example.com/r.pdf' } } satisfies TemplateEntry
export default Email
