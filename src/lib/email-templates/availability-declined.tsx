import * as React from "react";
import {
  BrandLayout,
  DataRow,
  DataTable,
  OpenGothamButton,
  StatusBadge,
  styles,
  Heading,
  Text,
} from "./_brand";
import type { TemplateEntry } from "./registry";

interface Props {
  recipient_name?: string;
  block_date?: string;
  decided_by?: string;
  decision_reason?: string;
}

const Email = ({ recipient_name, block_date, decided_by, decision_reason }: Props) => (
  <BrandLayout preview="Unavailability declined">
    <StatusBadge variant="critical" label="Declined" />
    <Heading style={styles.h1}>Unavailability request declined</Heading>
    <Text style={styles.text}>
      {recipient_name ? `Hi ${recipient_name}, your` : "Your"} request to be marked unavailable
      {block_date ? ` on ${block_date}` : ""} was declined{decided_by ? ` by ${decided_by}` : ""}.
      Please plan to work your scheduled shift, or reach out to your manager if this is an
      emergency.
    </Text>
    <DataTable>
      <DataRow label="Date" value={block_date ?? "—"} emphasis />
      <DataRow label="Declined by" value={decided_by ?? "—"} />
      {decision_reason && <DataRow label="Reason" value={decision_reason} />}
    </DataTable>
    <OpenGothamButton path="/schedule" label="View Schedule" />
  </BrandLayout>
);

export const template = {
  component: Email,
  subject: "Unavailability declined",
  displayName: "Availability Declined",
  previewData: {
    recipient_name: "Sara",
    block_date: "Sat Dec 14",
    decided_by: "Mario",
    decision_reason: "Too short notice",
  },
} satisfies TemplateEntry;
export default Email;
