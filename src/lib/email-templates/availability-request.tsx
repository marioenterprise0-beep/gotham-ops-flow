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
  employee_name?: string;
  block_date?: string;
  reason?: string;
  schedule_name?: string;
  schedule_status?: string;
  request_id?: string;
}

const Email = ({
  recipient_name,
  employee_name,
  block_date,
  reason,
  schedule_name,
  schedule_status,
  request_id,
}: Props) => (
  <BrandLayout preview={`Unavailability request — ${employee_name ?? ""}`}>
    <StatusBadge variant="info" label="Pending Approval" />
    <Heading style={styles.h1}>Unavailability request</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ""}
      {employee_name ?? "An employee"} has requested to be marked unavailable
      {block_date ? ` for ${block_date}` : ""}. The schedule for that day is already
      {schedule_status === "locked" ? " locked" : " published"}, so their availability change needs
      your approval.
    </Text>
    <DataTable>
      <DataRow label="Employee" value={employee_name ?? "—"} emphasis />
      <DataRow label="Date" value={block_date ?? "—"} />
      {schedule_name && <DataRow label="Schedule" value={schedule_name} />}
      {schedule_status && <DataRow label="Schedule status" value={schedule_status} />}
      {reason && <DataRow label="Reason" value={reason} />}
    </DataTable>
    <OpenGothamButton
      path={request_id ? `/labor?availability=${request_id}` : "/labor"}
      label="Review Request"
    />
  </BrandLayout>
);

export const template = {
  component: Email,
  subject: (d: any) => `Unavailability request — ${d?.employee_name ?? ""}`,
  displayName: "Availability Request",
  previewData: {
    employee_name: "Sara Ahmed",
    block_date: "Sat Dec 14",
    schedule_name: "Week of Dec 9",
    schedule_status: "published",
    reason: "Family event",
  },
} satisfies TemplateEntry;
export default Email;
