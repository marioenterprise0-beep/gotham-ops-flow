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
  start_date?: string;
  end_date?: string;
  reason?: string;
  request_id?: string;
}

const Email = ({
  recipient_name,
  employee_name,
  start_date,
  end_date,
  reason,
  request_id,
}: Props) => (
  <BrandLayout preview={`Time off request — ${employee_name ?? ""}`}>
    <StatusBadge variant="info" label="Pending Approval" />
    <Heading style={styles.h1}>Time off request</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ""}
      {employee_name ?? "an employee"} requested time off
      {start_date
        ? ` for ${start_date}${end_date && end_date !== start_date ? ` – ${end_date}` : ""}`
        : ""}
      .
    </Text>
    <DataTable>
      <DataRow label="Employee" value={employee_name ?? "—"} emphasis />
      <DataRow
        label="Dates"
        value={
          end_date && end_date !== start_date ? `${start_date} – ${end_date}` : (start_date ?? "—")
        }
      />
      {reason && <DataRow label="Reason" value={reason} />}
    </DataTable>
    <OpenGothamButton
      path={request_id ? `/time-clock?request=${request_id}` : "/time-clock"}
      label="Review Request"
    />
  </BrandLayout>
);

export const template = {
  component: Email,
  subject: (d: any) => `Time off request — ${d?.employee_name ?? ""}`,
  displayName: "Time Off Request",
  previewData: {
    employee_name: "Sara Ahmed",
    start_date: "Mon Dec 9",
    end_date: "Wed Dec 11",
    reason: "Family event",
  },
} satisfies TemplateEntry;
export default Email;
