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
  sop_title?: string;
  completed_at?: string;
  score?: string | number;
  sop_id?: string;
}
const Email = ({
  recipient_name,
  employee_name,
  sop_title,
  completed_at,
  score,
  sop_id,
}: Props) => (
  <BrandLayout preview={`Training completed — ${sop_title ?? ""}`}>
    <StatusBadge variant="success" label="Completed" />
    <Heading style={styles.h1}>Training completed</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ""}
      {employee_name ?? "An employee"} completed training for{" "}
      <strong>{sop_title ?? "an SOP"}</strong>.
    </Text>
    <DataTable>
      <DataRow label="Employee" value={employee_name ?? "—"} emphasis />
      <DataRow label="SOP" value={sop_title ?? "—"} />
      <DataRow label="Completed" value={completed_at ?? "—"} />
      {score != null && <DataRow label="Score" value={score} />}
    </DataTable>
    <OpenGothamButton path={sop_id ? `/training/${sop_id}` : "/training"} label="View Record" />
  </BrandLayout>
);
export const template = {
  component: Email,
  subject: (d: any) => `Training completed — ${d?.employee_name ?? ""}`,
  displayName: "Training Completed",
  previewData: {
    employee_name: "Sara Ahmed",
    sop_title: "Drawer Closing SOP",
    completed_at: "Thu Dec 12 4:20 PM",
  },
} satisfies TemplateEntry;
export default Email;
