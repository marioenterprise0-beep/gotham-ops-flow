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
  title?: string;
  due_date?: string;
  assigned_by?: string;
}
const Email = ({ recipient_name, title, due_date, assigned_by }: Props) => (
  <BrandLayout preview={`New document to review — ${title ?? ""}`}>
    <StatusBadge variant="info" label="Document Assigned" />
    <Heading style={styles.h1}>You have a new document to review</Heading>
    <Text style={styles.text}>
      {recipient_name ? `Hi ${recipient_name}, ` : ""}you've been sent{" "}
      <strong>{title ?? "a document"}</strong>
      {assigned_by ? ` by ${assigned_by}` : ""} to view and sign.
    </Text>
    <DataTable>
      <DataRow label="Document" value={title ?? "—"} emphasis />
      <DataRow label="Due" value={due_date ?? "—"} />
      <DataRow label="Sent by" value={assigned_by ?? "—"} />
    </DataTable>
    <OpenGothamButton path="/hr-documents" label="Review & Sign" />
  </BrandLayout>
);
export const template = {
  component: Email,
  subject: (d: any) => `New document to review — ${d?.title ?? ""}`,
  displayName: "HR Document Assigned",
  previewData: {
    recipient_name: "Sara",
    title: "Tip Pool Acknowledgement",
    due_date: "Fri Dec 13",
    assigned_by: "Aisha",
  },
} satisfies TemplateEntry;
export default Email;
