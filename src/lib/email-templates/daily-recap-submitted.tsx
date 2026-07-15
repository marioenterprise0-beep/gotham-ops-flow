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
  recap_date?: string;
  location?: string;
  shift_score?: number | string;
  highlights?: string;
  recap_id?: string;
}
const Email = ({
  recipient_name,
  manager_name,
  recap_date,
  location,
  shift_score,
  highlights,
  recap_id,
}: Props) => (
  <BrandLayout preview={`Daily recap — ${recap_date ?? ""}`}>
    <StatusBadge variant="info" label="Daily Recap" />
    <Heading style={styles.h1}>Daily recap submitted</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ""}
      {manager_name ?? "A manager"} submitted the daily recap for {recap_date ?? "today"}.
    </Text>
    <DataTable>
      <DataRow label="Date" value={recap_date ?? "—"} emphasis />
      <DataRow label="Location" value={location ?? "—"} />
      <DataRow label="Manager" value={manager_name ?? "—"} />
      <DataRow
        label="Shift score"
        value={shift_score != null ? `${shift_score} / 10` : "—"}
        emphasis
      />
    </DataTable>
    {highlights && <Text style={styles.muted}>{highlights}</Text>}
    <OpenGothamButton path={recap_id ? `/recaps/${recap_id}` : "/recaps"} label="Read Recap" />
  </BrandLayout>
);
export const template = {
  component: Email,
  subject: (d: any) => `Daily recap — ${d?.recap_date ?? ""}`,
  displayName: "Daily Recap Submitted",
  previewData: {
    manager_name: "Aisha",
    recap_date: "Dec 9",
    location: "Location 1",
    shift_score: 8,
  },
} satisfies TemplateEntry;
export default Email;
