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
  shift_date?: string;
  scheduled_end?: string;
  auto_closed?: boolean;
  punch_id?: string;
}

const Email = ({
  recipient_name,
  employee_name,
  shift_date,
  scheduled_end,
  auto_closed,
  punch_id,
}: Props) => (
  <BrandLayout preview={`Missed clock-out — ${employee_name ?? ""}`}>
    <StatusBadge variant="warning" label="Missed Clock Out" />
    <Heading style={styles.h1}>Missed clock-out detected</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ""}
      {employee_name ?? "an employee"} did not clock out at the end of their shift on{" "}
      {shift_date ?? "—"}.
    </Text>
    <DataTable>
      <DataRow label="Employee" value={employee_name ?? "—"} emphasis />
      <DataRow label="Shift date" value={shift_date ?? "—"} />
      <DataRow label="Scheduled end" value={scheduled_end ?? "—"} />
      <DataRow label="Auto-closed" value={auto_closed ? "Yes — closed by rollover" : "No"} />
    </DataTable>
    <OpenGothamButton
      path={punch_id ? `/time/punches/${punch_id}` : "/time"}
      label="Open Time Record"
    />
  </BrandLayout>
);

export const template = {
  component: Email,
  subject: (d: any) => `Missed clock-out — ${d?.employee_name ?? ""}`,
  displayName: "Missed Clock Out",
  previewData: {
    employee_name: "Sara Ahmed",
    shift_date: "Mon Dec 9",
    scheduled_end: "6:00 PM",
    auto_closed: true,
  },
} satisfies TemplateEntry;
export default Email;
