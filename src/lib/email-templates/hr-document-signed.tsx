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
  employee_name?: string;
  completed_at?: string;
}
const Email = ({ recipient_name, title, employee_name, completed_at }: Props) => (
  <BrandLayout preview={`Document fully signed — ${title ?? ""}`}>
    <StatusBadge variant="success" label="Fully Signed" />
    <Heading style={styles.h1}>Document fully signed</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ""}
      <strong>{title ?? "A document"}</strong> for {employee_name ?? "an employee"} now has every
      required signature.
    </Text>
    <DataTable>
      <DataRow label="Document" value={title ?? "—"} emphasis />
      <DataRow label="Employee" value={employee_name ?? "—"} />
      <DataRow label="Completed" value={completed_at ?? "—"} />
    </DataTable>
    <OpenGothamButton path="/hr-documents" label="View Record" />
  </BrandLayout>
);
export const template = {
  component: Email,
  subject: (d: any) => `Document fully signed — ${d?.title ?? ""}`,
  displayName: "HR Document Signed",
  previewData: {
    title: "Written Warning Form",
    employee_name: "Sara Ahmed",
    completed_at: "Thu Dec 12 4:20 PM",
  },
} satisfies TemplateEntry;
export default Email;
