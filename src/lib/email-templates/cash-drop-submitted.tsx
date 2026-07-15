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
  drop_code?: string;
  amount?: string | number;
  reason?: string;
  submitted_by?: string;
  drawer_name?: string;
  drop_id?: string;
}
const Email = ({
  recipient_name,
  drop_code,
  amount,
  reason,
  submitted_by,
  drawer_name,
  drop_id,
}: Props) => (
  <BrandLayout preview={`Cash drop ${drop_code ?? ""}`}>
    <StatusBadge variant="info" label="Cash Drop" />
    <Heading style={styles.h1}>Cash drop submitted</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ""}
      {submitted_by ?? "A manager"} submitted a mid-shift cash drop.
    </Text>
    <DataTable>
      <DataRow label="Drop code" value={drop_code ?? "—"} emphasis />
      <DataRow label="Drawer" value={drawer_name ?? "—"} />
      <DataRow label="Amount" value={`$${amount ?? "—"}`} emphasis />
      <DataRow label="Submitted by" value={submitted_by ?? "—"} />
      {reason && <DataRow label="Reason" value={reason} />}
    </DataTable>
    <OpenGothamButton
      path={drop_id ? `/cash/drops/${drop_id}` : "/cash"}
      label="Open Cash Record"
    />
  </BrandLayout>
);
export const template = {
  component: Email,
  subject: (d: any) => `Cash drop ${d?.drop_code ?? ""}`,
  displayName: "Cash Drop Submitted",
  previewData: {
    drop_code: "D-1042",
    drawer_name: "Drawer A",
    amount: "500.00",
    submitted_by: "Aisha",
  },
} satisfies TemplateEntry;
export default Email;
