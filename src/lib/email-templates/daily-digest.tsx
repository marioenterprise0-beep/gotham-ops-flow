import * as React from 'react'
import {
  BrandLayout,
  DataTable,
  DataRow,
  OpenGothamButton,
  StatusBadge,
  styles,
  Heading,
  Text,
} from './_brand'
import type { TemplateEntry } from './registry'

interface DigestItem {
  type: string
  title: string
  description?: string
  priority?: 'critical' | 'high' | 'normal' | 'low'
  created_at?: string
  trailer_name?: string
}

interface Props {
  recipient_name?: string
  window_label?: string
  total?: number
  critical_count?: number
  by_category?: Record<string, number>
  items?: DigestItem[]
}

const priorityVariant = (p?: string) =>
  p === 'critical' ? 'critical' : p === 'high' ? 'warning' : p === 'low' ? 'neutral' : 'info'

const Email = ({
  recipient_name = 'Team',
  window_label = 'last 24 hours',
  total = 0,
  critical_count = 0,
  by_category = {},
  items = [],
}: Props) => (
  <BrandLayout
    preview={`Dip N Shake OS digest — ${total} update${total === 1 ? '' : 's'} in the ${window_label}`}
    eyebrow="Daily Digest"
  >
    <Text style={styles.eyebrow}>Daily Digest</Text>
    <Heading style={styles.h1}>Your Dip N Shake OS recap</Heading>
    <Text style={styles.text}>
      {recipient_name}, here's everything from the {window_label}.
    </Text>

    <DataTable>
      <DataRow label="Total Events" value={String(total)} emphasis />
      <DataRow
        label="Critical"
        value={
          critical_count > 0 ? (
            <StatusBadge variant="critical" label={`${critical_count} critical`} />
          ) : (
            '0'
          )
        }
      />
      {Object.entries(by_category).map(([cat, count]) => (
        <DataRow key={cat} label={cat.replace(/_/g, ' ')} value={String(count)} />
      ))}
    </DataTable>

    {items.length > 0 && (
      <>
        <Text style={{ ...styles.eyebrow, marginTop: '10px' }}>Highlights</Text>
        <DataTable>
          {items.slice(0, 12).map((it, i) => (
            <DataRow
              key={i}
              label={it.trailer_name || it.type.replace(/_/g, ' ')}
              value={
                <span>
                  <StatusBadge variant={priorityVariant(it.priority)} label={it.priority || 'normal'} />
                  <br />
                  <strong>{it.title}</strong>
                  {it.description ? (
                    <>
                      <br />
                      <span style={{ color: '#7A7A7A', fontSize: '12px' }}>{it.description}</span>
                    </>
                  ) : null}
                </span>
              }
            />
          ))}
        </DataTable>
      </>
    )}

    <OpenGothamButton path="/alerts" label="Open Alert Center" />
  </BrandLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Dip N Shake OS daily digest — ${d.total ?? 0} update${d.total === 1 ? '' : 's'}`,
  displayName: 'Daily Digest',
  previewData: {
    recipient_name: 'Bruce',
    window_label: 'last 24 hours',
    total: 7,
    critical_count: 1,
    by_category: { schedule: 2, cash: 1, inventory: 3, operations: 1 },
    items: [
      {
        type: 'cash',
        title: 'Cash variance −$24.10',
        description: 'Trailer 03 · closed 11:42 PM',
        priority: 'critical',
        trailer_name: 'Trailer 03',
      },
      {
        type: 'inventory_order',
        title: 'Inventory order ready for review',
        description: '14 items (2 critical)',
        priority: 'high',
        trailer_name: 'Trailer 01',
      },
    ],
  },
} satisfies TemplateEntry
