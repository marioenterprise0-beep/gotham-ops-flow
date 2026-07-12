import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

// Dip N Shake OS brand tokens
export const brand = {
  ink: '#0B0B0B',
  graphite: '#1A1A1A',
  gold: '#C8102E',
  goldSoft: '#FDECEE',
  cream: '#F7F3EA',
  card: '#FFFFFF',
  muted: '#7A7A7A',
  border: '#E5E0D2',
  success: '#1E7B4B',
  successBg: '#E2F3E9',
  warning: '#C8922A',
  warningBg: '#FBF1DC',
  critical: '#B5302A',
  criticalBg: '#FBE3E1',
  info: '#1F3B5A',
  infoBg: '#E3EAF3',
}

// Snapshot of the original brand tokens so overrides can be reverted / reset.
const DEFAULT_BRAND = { ...brand }

function isHex(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function mix(hex: string, withHex: string, amount: number) {
  const a = hexToRgb(hex)
  const b = hexToRgb(withHex)
  const r = Math.round(a.r + (b.r - a.r) * amount)
  const g = Math.round(a.g + (b.g - a.g) * amount)
  const bl = Math.round(a.b + (b.b - a.b) * amount)
  return '#' + [r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('')
}

const PUBLIC_APP_URL = 'https://dipnshake.com'

export const appUrl = (path = '/') =>
  `${PUBLIC_APP_URL}${path.startsWith('/') ? path : `/${path}`}`

export const styles = {
  main: {
    backgroundColor: '#ffffff',
    margin: 0,
    padding: '24px 0',
    fontFamily:
      '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    color: brand.ink,
  } as const,
  shell: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: brand.cream,
    border: `1px solid ${brand.border}`,
    borderRadius: '14px',
    overflow: 'hidden',
  } as const,
  header: {
    backgroundColor: brand.ink,
    padding: '26px 32px 22px',
  } as const,
  brandMark: {
    fontFamily: '"Black Han Sans", Georgia, "Times New Roman", serif',
    fontSize: '22px',
    fontWeight: 700 as const,
    letterSpacing: '0.06em',
    color: '#FFFFFF',
    margin: 0,
    textTransform: 'uppercase' as const,
  } as const,
  brandSub: {
    fontSize: '11px',
    letterSpacing: '0.32em',
    color: brand.gold,
    margin: '6px 0 0',
    textTransform: 'uppercase' as const,
    fontWeight: 600 as const,
  } as const,
  goldRule: {
    height: '3px',
    backgroundColor: brand.gold,
    margin: 0,
    border: 'none',
  } as const,
  contentSection: {
    backgroundColor: brand.cream,
    padding: '28px 24px',
  } as const,
  card: {
    backgroundColor: brand.card,
    border: `1px solid ${brand.border}`,
    borderRadius: '10px',
    padding: '28px 28px',
  } as const,
  h1: {
    fontFamily: '"Black Han Sans", Georgia, serif',
    fontSize: '22px',
    fontWeight: 700 as const,
    color: brand.ink,
    margin: '0 0 6px',
    lineHeight: '1.25',
  } as const,
  eyebrow: {
    fontSize: '11px',
    letterSpacing: '0.22em',
    color: brand.muted,
    textTransform: 'uppercase' as const,
    margin: '0 0 14px',
    fontWeight: 600 as const,
  } as const,
  text: {
    fontSize: '15px',
    color: brand.ink,
    lineHeight: '1.6',
    margin: '0 0 16px',
  } as const,
  muted: {
    fontSize: '13px',
    color: brand.muted,
    lineHeight: '1.55',
    margin: '0',
  } as const,
  link: { color: brand.ink, textDecoration: 'underline' } as const,
  button: {
    display: 'inline-block',
    backgroundColor: brand.ink,
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 700 as const,
    letterSpacing: '0.14em',
    borderRadius: '8px',
    padding: '14px 26px',
    textDecoration: 'none',
    textTransform: 'uppercase' as const,
    border: `1px solid ${brand.ink}`,
  } as const,
  buttonRow: { margin: '8px 0 4px' } as const,
  divider: {
    border: 'none',
    borderTop: `1px solid ${brand.border}`,
    margin: '22px 0',
  } as const,
  footer: {
    backgroundColor: brand.ink,
    padding: '20px 32px',
    fontSize: '11px',
    color: '#9A9A9A',
    lineHeight: '1.55',
    textAlign: 'center' as const,
  } as const,
  footerBrand: {
    color: brand.gold,
    fontWeight: 700 as const,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    margin: '0 0 6px',
    fontSize: '11px',
  } as const,
  codeBox: {
    fontFamily: '"JetBrains Mono","Courier New",monospace',
    fontSize: '28px',
    fontWeight: 700 as const,
    letterSpacing: '0.3em',
    color: brand.ink,
    backgroundColor: brand.goldSoft,
    border: `1px solid ${brand.gold}`,
    borderRadius: '8px',
    padding: '18px 24px',
    textAlign: 'center' as const,
    margin: '0 0 20px',
  } as const,
}

// Overrides are applied by mutating the shared brand + styles objects
// before render() runs. React reads style properties at render time,
// so mutations take effect for the very next render.
export function applyBrandOverrides(input: {
  bgColor?: string | null
  fgColor?: string | null
  accentColor?: string | null
}) {
  // Reset to defaults so consecutive renders with different overrides
  // don't accumulate stale values.
  Object.assign(brand, DEFAULT_BRAND)

  if (isHex(input.bgColor)) {
    brand.ink = input.bgColor
    brand.graphite = mix(input.bgColor, '#ffffff', 0.12)
  }
  if (isHex(input.fgColor)) {
    // Text over cream cards in email — keep readable against light backgrounds.
    // fg only recolors the primary text/link tone, not the dark surfaces.
  }
  if (isHex(input.accentColor)) {
    brand.gold = input.accentColor
    brand.goldSoft = mix(input.accentColor, '#ffffff', 0.9)
  }

  // Rebuild derived style values that were captured at module load.
  ;(styles.header as any).backgroundColor = brand.ink
  ;(styles.brandSub as any).color = brand.gold
  ;(styles.goldRule as any).backgroundColor = brand.gold
  ;(styles.h1 as any).color = brand.ink
  ;(styles.text as any).color = brand.ink
  ;(styles.link as any).color = brand.ink
  ;(styles.button as any).backgroundColor = brand.ink
  ;(styles.button as any).border = `1px solid ${brand.ink}`
  ;(styles.footer as any).backgroundColor = brand.ink
  ;(styles.footerBrand as any).color = brand.gold
  ;(styles.codeBox as any).color = brand.ink
  ;(styles.codeBox as any).backgroundColor = brand.goldSoft
  ;(styles.codeBox as any).border = `1px solid ${brand.gold}`
}

// ---------- Status Badge ----------
export type BadgeVariant = 'success' | 'warning' | 'critical' | 'info' | 'neutral'

const badgePalette: Record<BadgeVariant, { bg: string; fg: string; border: string }> = {
  success: { bg: brand.successBg, fg: brand.success, border: brand.success },
  warning: { bg: brand.warningBg, fg: '#7A5A14', border: brand.warning },
  critical: { bg: brand.criticalBg, fg: brand.critical, border: brand.critical },
  info: { bg: brand.infoBg, fg: brand.info, border: brand.info },
  neutral: { bg: brand.cream, fg: brand.ink, border: brand.border },
}

export const StatusBadge = ({
  variant = 'neutral',
  label,
}: {
  variant?: BadgeVariant
  label: string
}) => {
  const p = badgePalette[variant]
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: p.bg,
        color: p.fg,
        border: `1px solid ${p.border}`,
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        padding: '5px 12px',
        marginBottom: '14px',
      }}
    >
      {label}
    </span>
  )
}

// ---------- Data Row ----------
export const DataRow = ({
  label,
  value,
  emphasis,
}: {
  label: string
  value: React.ReactNode
  emphasis?: boolean
}) => (
  <table
    role="presentation"
    cellPadding={0}
    cellSpacing={0}
    width="100%"
    style={{ borderCollapse: 'collapse' as const, margin: '0 0 4px' }}
  >
    <tbody>
      <tr>
        <td
          style={{
            padding: '10px 0',
            borderBottom: `1px solid ${brand.border}`,
            fontSize: '12px',
            color: brand.muted,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.12em',
            fontWeight: 600,
            width: '42%',
            verticalAlign: 'top' as const,
          }}
        >
          {label}
        </td>
        <td
          style={{
            padding: '10px 0',
            borderBottom: `1px solid ${brand.border}`,
            fontSize: emphasis ? '15px' : '14px',
            color: brand.ink,
            fontWeight: emphasis ? 700 : 500,
            textAlign: 'right' as const,
            verticalAlign: 'top' as const,
          }}
        >
          {value}
        </td>
      </tr>
    </tbody>
  </table>
)

export const DataTable = ({ children }: { children: React.ReactNode }) => (
  <Section style={{ margin: '0 0 22px' }}>{children}</Section>
)

// ---------- Primary Button ----------
export const PrimaryButton = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) => (
  <Section style={styles.buttonRow}>
    <Button style={styles.button} href={href}>
      {children}
    </Button>
  </Section>
)

// ---------- Brand Layout ----------
interface LayoutProps {
  preview: string
  children: React.ReactNode
  eyebrow?: string
}

export const BrandLayout = ({
  preview,
  eyebrow = 'Operational Notification',
  children,
}: LayoutProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <Font
        fontFamily="DM Sans"
        fallbackFontFamily="Helvetica"
        webFont={{
          url: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZOIHTWEBlw.woff2',
          format: 'woff2',
        }}
        fontWeight={400}
        fontStyle="normal"
      />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={styles.main}>
      <Container style={styles.shell}>
        <Section style={styles.header}>
          <Text style={styles.brandMark}>Dip N Shake OS</Text>
          <Text style={styles.brandSub}>{eyebrow}</Text>
        </Section>
        <Hr style={styles.goldRule} />
        <Section style={styles.contentSection}>
          <Section style={styles.card}>{children}</Section>
        </Section>
        <Section style={styles.footer}>
          <Text style={styles.footerBrand}>Generated by Dip N Shake OS</Text>
          <Text style={{ margin: '0', color: '#9A9A9A' }}>
            This notification was sent based on activity inside Dip N Shake OS.
          </Text>
          <Text style={{ margin: '6px 0 0', color: '#5F5F5F' }}>
            <Link href={appUrl('/settings/notifications')} style={{ color: brand.gold }}>
              Manage notifications
            </Link>
            {' · '}
            <Link href={appUrl('/')} style={{ color: brand.gold }}>
              Open Dip N Shake OS
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

// Convenience: rendered "Open Dip N Shake OS" CTA
export const OpenGothamButton = ({ path = '/', label = 'Open Dip N Shake OS' }: { path?: string; label?: string }) => (
  <PrimaryButton href={appUrl(path)}>{label}</PrimaryButton>
)

// Re-export common React Email components
export { Heading, Text } from '@react-email/components'
