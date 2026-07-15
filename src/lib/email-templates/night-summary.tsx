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
  trailer_name?: string;
  shift_date?: string;
  shift_score?: number | string | null;
  total_hours?: string;
  cash_variance?: string;
  critical_alerts?: number | string;
  crew_count?: number | string;
  highlights?: string;
}

const Email = ({
  recipient_name,
  trailer_name,
  shift_date,
  shift_score,
  total_hours,
  cash_variance,
  critical_alerts,
  crew_count,
  highlights,
}: Props) => (
  <BrandLayout preview={`Night summary — ${shift_date ?? "today"}`} eyebrow="End-of-Night Report">
    <StatusBadge variant="info" label="Night Summary" />
    <Heading style={styles.h1}>End-of-night report</Heading>
    <Text style={styles.text}>
      {recipient_name ? `${recipient_name}, ` : ""}here's the summary for{" "}
      {trailer_name ?? "this location"} on {shift_date ?? "today"}.
    </Text>
    <DataTable>
      <DataRow label="Date" value={shift_date ?? "—"} emphasis />
      <DataRow label="Location" value={trailer_name ?? "—"} />
      <DataRow
        label="Shift Score"
        value={shift_score != null ? `${shift_score} / 10` : "—"}
        emphasis
      />
      <DataRow label="Hours Worked" value={total_hours ?? "—"} />
      <DataRow label="Cash Variance" value={cash_variance ?? "$0.00"} emphasis />
      <DataRow label="Critical Alerts" value={String(critical_alerts ?? 0)} />
      <DataRow label="Crew on Shift" value={String(crew_count ?? "—")} />
    </DataTable>
    {highlights && <Text style={styles.muted}>{highlights}</Text>}
    <OpenGothamButton path="/recaps" label="View Full Recap" />
  </BrandLayout>
);

export const template = {
  component: Email,
  subject: (d: any) => `Night summary — ${d?.shift_date ?? ""}`,
  displayName: "Night Summary",
  previewData: {
    trailer_name: "Location 1",
    shift_date: "2026-06-13",
    shift_score: 8,
    total_hours: "32.5h",
    cash_variance: "+$2.00",
    critical_alerts: 0,
    crew_count: 4,
  },
} satisfies TemplateEntry;

export default Email;
