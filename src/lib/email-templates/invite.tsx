import * as React from 'react'
import { Button, Heading, Link, Text } from '@react-email/components'
import { BrandLayout, styles } from './_brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <BrandLayout preview={`You've been invited to join ${siteName}`}>
    <Heading style={styles.h1}>You're invited</Heading>
    <Text style={styles.text}>
      You've been invited to join{' '}
      <Link href={siteUrl} style={styles.link}>
        <strong>{siteName}</strong>
      </Link>
      . Accept the invitation below to set up your account and get started.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Accept Invitation
    </Button>
    <Text style={{ ...styles.muted, marginTop: '28px' }}>
      If you weren't expecting this invitation, you can safely ignore this email.
    </Text>
  </BrandLayout>
)

export default InviteEmail
