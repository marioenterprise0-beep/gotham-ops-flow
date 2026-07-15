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
  shift_date?: string;
  decision_reason?: string;
  decided_by?: string;
  punch_id?: string;
}

const Email = ({ recipient_name, shift_date, decision_reason, decided_by, punch_id }: Props) => (
  <BrandLayout preview="Time adjustment declined">
    <StatusBadge variant="critical" label="Declined" />
    <Heading style={styles.h1}>Time adjustment declined</Heading>
    <Text style={styles.text}>
      {recipient_name ? `Hi ${recipient_name}, your` : "Your"} time correction for{" "}
      {shift_date ?? "the requested shift"} was declined{decided_by ? ` by ${decided_by}` : ""}.
      Reach out to your manager if you'd like to discuss it.
    </Text>
    <DataTable>
      <DataRow label="Shift date" value={shift_date ?? "—"} />
      {decision_reason && <DataRow label="Reason" value={decision_reason} />}
      <DataRow label="Decided by" value={decided_by ?? "—"} />
    </DataTable>
    <OpenGothamButton
      path={punch_id ? `/time/punches/${punch_id}` : "/time"}
      label="Open Time Record"
    />
  </BrandLayout>
);

export const template = {
  component: Email,
  subject: "Time adjustment declined",
  displayName: "Time Adjustment Declined",
  previewData: {
    recipient_name: "Sara",
    shift_date: "Mon Dec 9",
    decision_reason: "Mismatch with door camera",
    decided_by: "Omar",
  },
} satisfies TemplateEntry;
export default Email;
