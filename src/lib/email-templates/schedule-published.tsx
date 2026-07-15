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

interface Shift {
  date?: string;
  start?: string;
  end?: string;
  role?: string;
}
interface Props {
  recipient_name?: string;
  week_range?: string;
  location?: string;
  shifts?: Shift[];
  total_hours?: number | string;
  schedule_id?: string;
}

const Email = ({
  recipient_name,
  week_range,
  location,
  shifts = [],
  total_hours,
  schedule_id,
}: Props) => (
  <BrandLayout preview={`Your schedule — ${week_range ?? ""}`}>
    <StatusBadge variant="info" label="Published" />
    <Heading style={styles.h1}>Your schedule is published</Heading>
    <Text style={styles.text}>
      Hi {recipient_name ?? "team"}, your shifts for {week_range ?? "the upcoming week"} at{" "}
      {location ?? "your location"} are now confirmed.
    </Text>
    <DataTable>
      <DataRow label="Week" value={week_range ?? "—"} emphasis />
      <DataRow label="Location" value={location ?? "—"} />
      <DataRow
        label="Total hours"
        value={
          total_hours != null && Number(total_hours) > 0
            ? `${total_hours} hrs`
            : "No shifts assigned"
        }
        emphasis
      />
    </DataTable>
    {shifts.length > 0 ? (
      <DataTable>
        {shifts.map((s, i) => (
          <DataRow
            key={i}
            label={s.date ?? `Shift ${i + 1}`}
            value={`${s.start ?? ""} – ${s.end ?? ""}${s.role ? ` · ${s.role}` : ""}`}
          />
        ))}
      </DataTable>
    ) : (
      <Text style={styles.text}>
        You aren't on the schedule this week. If that's not right, message your manager.
      </Text>
    )}
    <OpenGothamButton path="/schedule" label="Open Schedule" />
  </BrandLayout>
);

export const template = {
  component: Email,
  subject: (d: any) => `Your schedule — ${d?.week_range ?? ""}`,
  displayName: "Schedule Published (Employee)",
  previewData: {
    recipient_name: "Sara",
    week_range: "Dec 9 – Dec 15",
    location: "Location 1",
    total_hours: 32,
    shifts: [
      { date: "Mon Dec 9", start: "10:00 AM", end: "6:00 PM", role: "cashier" },
      { date: "Wed Dec 11", start: "2:00 PM", end: "10:00 PM", role: "cashier" },
      { date: "Fri Dec 13", start: "12:00 PM", end: "8:00 PM", role: "cashier" },
      { date: "Sat Dec 14", start: "12:00 PM", end: "8:00 PM", role: "cashier" },
    ],
  },
} satisfies TemplateEntry;
export default Email;
