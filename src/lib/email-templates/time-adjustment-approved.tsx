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
  shift_date?: string;
  approved_value?: string;
  approver_name?: string;
  punch_id?: string;
}

const Email = ({ recipient_name, shift_date, approved_value, approver_name, punch_id }: Props) => (
  <BrandLayout preview="Time adjustment approved">
    <StatusBadge variant="success" label="Approved" />
    <Heading style={styles.h1}>Your time adjustment was approved</Heading>
    <Text style={styles.text}>
      {recipient_name ? `Hi ${recipient_name}, your` : "Your"} correction for{" "}
      {shift_date ?? "the requested shift"} has been approved
      {approver_name ? ` by ${approver_name}` : ""}. Your weekly hours have been updated.
    </Text>
    <DataTable>
      <DataRow label="Shift date" value={shift_date ?? "—"} />
      <DataRow label="Approved value" value={approved_value ?? "—"} emphasis />
      <DataRow label="Approved by" value={approver_name ?? "—"} />
    </DataTable>
    <OpenGothamButton
      path={punch_id ? `/time/punches/${punch_id}` : "/time"}
      label="View Time Record"
    />
  </BrandLayout>
);

export const template = {
  component: Email,
  subject: "Time adjustment approved",
  displayName: "Time Adjustment Approved",
  previewData: {
    recipient_name: "Sara",
    shift_date: "Mon Dec 9",
    approved_value: "10:00 AM – 6:15 PM",
    approver_name: "Omar",
  },
} satisfies TemplateEntry;
export default Email;
