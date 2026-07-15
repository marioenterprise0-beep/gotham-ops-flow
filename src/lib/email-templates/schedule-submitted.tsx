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
  manager_name?: string;
  week_range?: string;
  location?: string;
  total_hours?: number | string;
  schedule_id?: string;
}

const Email = ({
  recipient_name,
  manager_name,
  week_range,
  location,
  total_hours,
  schedule_id,
}: Props) => (
  <BrandLayout preview={`Schedule submitted for approval — ${week_range ?? ""}`}>
    <StatusBadge variant="warning" label="Action Required · Owner Review" />
    <Heading style={styles.h1}>Schedule submitted for approval</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ""}
      {manager_name ?? "A manager"} submitted a new schedule that needs your review before it can be
      published.
    </Text>
    <DataTable>
      <DataRow label="Manager" value={manager_name ?? "—"} />
      <DataRow label="Week" value={week_range ?? "—"} emphasis />
      <DataRow label="Location" value={location ?? "—"} />
      <DataRow
        label="Total scheduled hours"
        value={total_hours != null ? `${total_hours} hrs` : "—"}
      />
    </DataTable>
    <OpenGothamButton
      path={schedule_id ? `/schedule/${schedule_id}` : "/schedule"}
      label="Review Schedule"
    />
  </BrandLayout>
);

export const template = {
  component: Email,
  subject: (d: any) => `Schedule submitted for review — ${d?.week_range ?? "this week"}`,
  displayName: "Schedule Submitted (Owner)",
  previewData: {
    recipient_name: "Owner",
    manager_name: "Aisha Khan",
    week_range: "Dec 9 – Dec 15",
    location: "Location 1",
    total_hours: 184,
    schedule_id: "abc",
  },
} satisfies TemplateEntry;
export default Email;
