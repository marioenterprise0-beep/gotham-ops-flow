import * as React from "react";
import { Button, Heading, Link, Text } from "@react-email/components";
import { BrandLayout, styles } from "./_brand";

interface EmailChangeEmailProps {
  siteName: string;
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <BrandLayout preview={`Confirm your email change for ${siteName}`}>
    <Heading style={styles.h1}>Confirm your email change</Heading>
    <Text style={styles.text}>
      You requested to change the email on your {siteName} account from{" "}
      <Link href={`mailto:${oldEmail}`} style={styles.link}>
        {oldEmail}
      </Link>{" "}
      to{" "}
      <Link href={`mailto:${newEmail}`} style={styles.link}>
        {newEmail}
      </Link>
      .
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Confirm Email Change
    </Button>
    <Text style={{ ...styles.muted, marginTop: "28px" }}>
      If you didn't request this change, please secure your account immediately.
    </Text>
  </BrandLayout>
);

export default EmailChangeEmail;
