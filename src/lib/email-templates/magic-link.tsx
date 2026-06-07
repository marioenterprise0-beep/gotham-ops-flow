import * as React from 'react'
import { Button, Heading, Text } from '@react-email/components'
import { BrandLayout, styles } from './_brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <BrandLayout preview={`Your login link for ${siteName}`} siteName={siteName}>
    <Heading style={styles.h1}>Your login link</Heading>
    <Text style={styles.text}>
      Click the button below to sign in to {siteName}. This link will expire shortly for your security.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Sign In
    </Button>
    <Text style={{ ...styles.muted, marginTop: '28px' }}>
      If you didn't request this link, you can safely ignore this email.
    </Text>
  </BrandLayout>
)

export default MagicLinkEmail
