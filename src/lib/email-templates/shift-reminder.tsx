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
  segment: string;
}

interface Props {
  recipient_name?: string;
  location?: string;
  shifts?: ShiftRow[];
  reminder_for?: string;
}

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

const Email = ({ recipient_name, location, shifts = [], reminder_for = "tomorrow" }: Props) => {
  const isToday = reminder_for === "today";
  const preview = isToday
    ? `You're scheduled today at ${location ?? "Dip N Shake"}`
    : `You're scheduled tomorrow at ${location ?? "Dip N Shake"}`;

  return (
    <BrandLayout preview={preview}>
      <StatusBadge variant="neutral" label={isToday ? "Shift Today" : "Shift Tomorrow"} />
      <Heading style={styles.h1}>{isToday ? "You're on today" : "See you tomorrow"}</Heading>
      <Text style={styles.text}>
        Hey {recipient_name ?? "there"}, here are your{" "}
        {isToday ? "shifts today" : "shifts tomorrow"} at{" "}
        <strong>{location ?? "Dip N Shake"}</strong>.
      </Text>

      {shifts.length > 0 && (
        <DataTable>
          {shifts.map((s, i) => (
            <DataRow
              key={i}
              label={`${s.day}, ${s.date}`}
              value={`${fmt12(s.start)} – ${fmt12(s.end)}  ·  ${s.role}`}
            />
          ))}
        </DataTable>
      )}

      <Text style={{ ...styles.text, marginTop: 16 }}>
        You can clock in up to <strong>15 minutes before</strong> your shift starts from the Dip N Shake OS app.
      </Text>

      <OpenGothamButton path="/time-clock" label="Open Time Clock" />
    </BrandLayout>
  );
};

export const template: TemplateEntry = {
  component: Email,
  subject: (data) =>
    data.reminder_for === "today"
      ? `You're on today — ${data.location ?? "Dip N Shake"}`
      : `Shift tomorrow — ${data.location ?? "Dip N Shake"}`,
  displayName: "Shift Reminder",
  previewData: {
    recipient_name: "Alex",
    location: "Henrietta",
    reminder_for: "tomorrow",
    shifts: [
      { date: "Jun 29", day: "Sun", start: "11:00", end: "17:00", role: "cashier", segment: "open" },
    ],
  },
};
