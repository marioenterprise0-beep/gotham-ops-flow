import * as React from "react";
import { Heading, Text } from "@react-email/components";
import { BrandLayout, styles } from "./_brand";

interface ReauthenticationEmailProps {
  token: string;
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <BrandLayout preview="Your verification code">
    <Heading style={styles.h1}>Confirm it's you</Heading>
    <Text style={styles.text}>Use the verification code below to confirm your identity:</Text>
    <Text style={styles.codeBox}>{token}</Text>
    <Text style={styles.muted}>
      This code expires shortly. If you didn't request it, you can safely ignore this email.
    </Text>
  </BrandLayout>
);

export default ReauthenticationEmail;
