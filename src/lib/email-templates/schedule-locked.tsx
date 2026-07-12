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

interface ShiftRow {
  date: string;
  day: string;
  start: string;
  end: string;
  role: string;
}

interface Props {
  recipient_name?: string;
  week_range?: string;
  location?: string;
  lock_reason?: string;
  locked_by?: string;
  schedule_id?: string;
  shifts?: ShiftRow[];
}

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

const Email = ({
  recipient_name,
  week_range,
  location,
  lock_reason,
  locked_by,
  schedule_id,
  shifts,
}: Props) => (
  <BrandLayout preview={`Your schedule is locked — ${week_range ?? ""}`}>
    <StatusBadge variant="neutral" label="Schedule Locked" />
    <Heading style={styles.h1}>
      {recipient_name ? `${recipient_name}, your` : "Your"} schedule is locked
    </Heading>
    <Text style={styles.text}>
      The schedule for {week_range ?? "the upcoming week"} has been locked
      {locked_by ? ` by ${locked_by}` : ""} and is finalized.
      {shifts && shifts.length > 0 ? " Here are your shifts for this period:" : ""}
    </Text>

    {shifts && shifts.length > 0 && (
      <>
        <Heading style={{ ...styles.h1, fontSize: 16, marginTop: 24 }}>Your Shifts</Heading>
        <DataTable>
          {shifts.map((s, i) => (
            <DataRow
              key={i}
              label={`${s.day}, ${s.date}`}
              value={`${fmt12(s.start)} – ${fmt12(s.end)}  ·  ${s.role}`}
            />
          ))}
        </DataTable>
      </>
    )}

    <DataTable>
      <DataRow label="Week" value={week_range ?? "—"} emphasis />
      <DataRow label="Location" value={location ?? "—"} />
      {locked_by && <DataRow label="Locked by" value={locked_by} />}
      {lock_reason && <DataRow label="Note" value={lock_reason} />}
    </DataTable>

    <OpenGothamButton path={schedule_id ? `/schedule` : "/schedule"} label="View Schedule" />
  </BrandLayout>
);

export const template = {
  component: Email,
  subject: (d: any) => `Your schedule is locked — ${d?.week_range ?? ""}`,
  displayName: "Schedule Locked",
  previewData: {
    recipient_name: "Ahmed",
    week_range: "Jun 30 – Jul 6",
    location: "Downtown Location",
    locked_by: "Mario (Owner)",
    shifts: [
      { day: "Mon", date: "Jun 30", start: "09:00", end: "14:00", role: "cashier" },
      { day: "Wed", date: "Jul 2", start: "16:00", end: "23:00", role: "grill" },
      { day: "Fri", date: "Jul 4", start: "11:00", end: "19:00", role: "prep" },
    ],
  },
} satisfies TemplateEntry;
export default Email;
