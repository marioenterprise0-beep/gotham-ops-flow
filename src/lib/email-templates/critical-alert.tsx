import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Props { recipient_name?: string; alert_title?: string; alert_description?: string; source_module?: string; location?: string; alert_id?: string }
const Email = ({ recipient_name, alert_title, alert_description, source_module, location, alert_id }: Props) => (
  <BrandLayout preview={`CRITICAL — ${alert_title ?? ''}`}>
    <StatusBadge variant="critical" label="Critical Alert" />
    <Heading style={styles.h1}>{alert_title ?? 'Critical alert'}</Heading>
    <Text style={styles.text}>{recipient_name ? `${recipient_name}, ` : ''}a critical issue was raised in Dip N Shake OS and needs your immediate attention.</Text>
    {alert_description && <Text style={styles.text}>{alert_description}</Text>}
    <DataTable>
      <DataRow label="Module" value={source_module ?? '—'} />
      <DataRow label="Location" value={location ?? '—'} />
    </DataTable>
    <OpenGothamButton path={alert_id ? `/alerts/${alert_id}` : '/alerts'} label="Open Alert" />
  </BrandLayout>
)
export const template = { component: Email, subject: (d: any) => `CRITICAL: ${d?.alert_title ?? 'Alert'}`, displayName: 'Critical Alert', previewData: { alert_title: 'Walk-in cooler down', alert_description: 'Temperature sensor reports 51°F sustained for 30 min.', source_module: 'operations', location: 'Location 1' } } satisfies TemplateEntry
export default Email
