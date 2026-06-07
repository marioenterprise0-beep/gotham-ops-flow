import * as React from 'react'
import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

// Gotham OS brand tokens (email-safe hex)
export const brand = {
  ink: '#0A0A0A',
  cream: '#F5F5F0',
  card: '#FFFFFF',
  gold: '#C9973A',
  goldLight: '#F5E6C8',
  muted: '#6B6B6B',
  border: '#E5E5DF',
}

export const styles = {
  main: {
    backgroundColor: '#ffffff', // body must remain white per guidelines
    margin: 0,
    padding: '32px 0',
    fontFamily:
      '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    color: brand.ink,
  } as const,
  shell: {
    maxWidth: '560px',
    margin: '0 auto',
    backgroundColor: brand.cream,
    border: `1px solid ${brand.border}`,
    borderRadius: '12px',
    overflow: 'hidden',
  } as const,
  header: {
    backgroundColor: brand.ink,
    padding: '28px 32px',
    textAlign: 'left' as const,
  } as const,
  brandMark: {
    fontFamily: '"Black Han Sans", Georgia, "Times New Roman", serif',
    fontSize: '24px',
    fontWeight: 700 as const,
    letterSpacing: '0.04em',
    color: '#FFFFFF',
    margin: 0,
    textTransform: 'uppercase' as const,
  } as const,
  brandSub: {
    fontSize: '11px',
    letterSpacing: '0.25em',
    color: brand.gold,
    margin: '4px 0 0',
    textTransform: 'uppercase' as const,
    fontWeight: 600 as const,
  } as const,
  body: {
    backgroundColor: brand.card,
    padding: '36px 32px',
  } as const,
  h1: {
    fontFamily: '"Black Han Sans", Georgia, serif',
    fontSize: '24px',
    fontWeight: 700 as const,
    color: brand.ink,
    margin: '0 0 16px',
    lineHeight: '1.2',
  } as const,
  text: {
    fontSize: '15px',
    color: brand.ink,
    lineHeight: '1.6',
    margin: '0 0 20px',
  } as const,
  muted: {
    fontSize: '13px',
    color: brand.muted,
    lineHeight: '1.6',
    margin: '0 0 16px',
  } as const,
  link: { color: brand.ink, textDecoration: 'underline' } as const,
  button: {
    display: 'inline-block',
    backgroundColor: brand.ink,
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600 as const,
    letterSpacing: '0.04em',
    borderRadius: '8px',
    padding: '14px 28px',
    textDecoration: 'none',
    textTransform: 'uppercase' as const,
    border: `1px solid ${brand.ink}`,
  } as const,
  codeBox: {
    fontFamily: '"JetBrains Mono", "Courier New", monospace',
    fontSize: '28px',
    fontWeight: 700 as const,
    letterSpacing: '0.3em',
    color: brand.ink,
    backgroundColor: brand.goldLight,
    border: `1px solid ${brand.gold}`,
    borderRadius: '8px',
    padding: '18px 24px',
    textAlign: 'center' as const,
    margin: '0 0 24px',
  } as const,
  divider: {
    border: 'none',
    borderTop: `1px solid ${brand.border}`,
    margin: '28px 0',
  } as const,
  footer: {
    backgroundColor: brand.cream,
    padding: '20px 32px',
    fontSize: '12px',
    color: brand.muted,
    lineHeight: '1.5',
    textAlign: 'center' as const,
  } as const,
  goldRule: {
    height: '3px',
    backgroundColor: brand.gold,
    margin: 0,
    border: 'none',
  } as const,
}

interface LayoutProps {
  preview: string
  siteName: string
  children: React.ReactNode
}

export const BrandLayout = ({ preview, siteName, children }: LayoutProps) => (
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
          <Text style={styles.brandMark}>Gotham OS</Text>
          <Text style={styles.brandSub}>Halal Dash · Operations</Text>
        </Section>
        <Hr style={styles.goldRule} />
        <Section style={styles.body}>{children}</Section>
        <Section style={styles.footer}>
          <Text style={{ margin: 0 }}>
            © {new Date().getFullYear()} {siteName}. All rights reserved.
          </Text>
          <Text style={{ margin: '6px 0 0' }}>
            This is an automated message — please do not reply.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)
