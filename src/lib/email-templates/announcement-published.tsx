import * as React from "react";
import { BrandLayout, OpenGothamButton, StatusBadge, styles, Heading, Text } from "./_brand";
import type { TemplateEntry } from "./registry";

interface Props {
  recipient_name?: string;
  title?: string;
  body?: string;
  author?: string;
  announcement_id?: string;
}
const Email = ({ recipient_name, title, body, author, announcement_id }: Props) => (
  <BrandLayout preview={title ?? "New announcement"}>
    <StatusBadge variant="info" label="Announcement" />
    <Heading style={styles.h1}>{title ?? "New announcement"}</Heading>
    <Text style={styles.text}>{recipient_name ? `Hi ${recipient_name},` : "Hi team,"}</Text>
    <Text style={styles.text}>{body ?? ""}</Text>
    <Text style={styles.muted}>{author ? `Posted by ${author}` : ""}</Text>
    <OpenGothamButton
      path={announcement_id ? `/announcements/${announcement_id}` : "/announcements"}
      label="Open Announcement"
    />
  </BrandLayout>
);
export const template = {
  component: Email,
  subject: (d: any) => d?.title ?? "New announcement",
  displayName: "Announcement Published",
  previewData: {
    title: "New POS rollout next week",
    body: "Heads up — we will switch to the new POS system on Monday. Training tomorrow at 4 PM.",
    author: "Omar",
  },
} satisfies TemplateEntry;
export default Email;
