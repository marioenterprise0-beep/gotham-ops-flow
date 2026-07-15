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
  sop_title?: string;
  due_date?: string;
  assigned_by?: string;
  sop_id?: string;
}
const Email = ({ recipient_name, sop_title, due_date, assigned_by, sop_id }: Props) => (
  <BrandLayout preview={`Training assigned — ${sop_title ?? ""}`}>
    <StatusBadge variant="info" label="Training Assigned" />
    <Heading style={styles.h1}>New training assigned to you</Heading>
    <Text style={styles.text}>
      {recipient_name ? `Hi ${recipient_name}, ` : ""}you've been assigned training for{" "}
      <strong>{sop_title ?? "an SOP"}</strong>
      {assigned_by ? ` by ${assigned_by}` : ""}.
    </Text>
    <DataTable>
      <DataRow label="SOP" value={sop_title ?? "—"} emphasis />
      <DataRow label="Due" value={due_date ?? "—"} />
      <DataRow label="Assigned by" value={assigned_by ?? "—"} />
    </DataTable>
    <OpenGothamButton path={sop_id ? `/training/${sop_id}` : "/training"} label="Start Training" />
  </BrandLayout>
);
export const template = {
  component: Email,
  subject: (d: any) => `Training assigned — ${d?.sop_title ?? ""}`,
  displayName: "Training Assigned",
  previewData: {
    recipient_name: "Sara",
    sop_title: "Drawer Closing SOP",
    due_date: "Fri Dec 13",
    assigned_by: "Aisha",
  },
} satisfies TemplateEntry;
export default Email;
