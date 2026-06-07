import * as React from 'react'
import { BrandLayout, DataRow, DataTable, OpenGothamButton, StatusBadge, styles, Heading, Text } from './_brand'
import type { TemplateEntry } from './registry'

interface Item { name?: string; current?: number | string; par?: number | string }
interface Props { recipient_name?: string; location?: string; items?: Item[] }
const Email = ({ recipient_name, location, items = [] }: Props) => (
  <BrandLayout preview={`Low stock — ${location ?? ''}`}>
    <StatusBadge variant="warning" label="Low Stock" />
    <Heading style={styles.h1}>Low stock alert</Heading>
    <Text style={styles.text}>{recipient_name ? `${recipient_name}, ` : ''}the following items at {location ?? 'your location'} are at or below their low-stock threshold.</Text>
    <DataTable>
      {items.length === 0 ? <DataRow label="Items" value="—" /> :
        items.map((it, i) => <DataRow key={i} label={it.name ?? `Item ${i+1}`} value={`${it.current ?? '—'} / par ${it.par ?? '—'}`} />)}
    </DataTable>
    <OpenGothamButton path="/inventory" label="Open Inventory" />
  </BrandLayout>
)
export const template = { component: Email, subject: (d: any) => `Low stock — ${d?.location ?? ''}`, displayName: 'Low Stock Alert', previewData: { location: 'Trailer 1', items: [{ name: 'Chicken thighs', current: 4, par: 20 }, { name: 'Pita bread', current: 12, par: 80 }] } } satisfies TemplateEntry
export default Email
