// Client-side Drawer-Close PDF generator (jsPDF).
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type DrawerClosePdfInput = {
  session: any;
  drawer: any;
  trailer: any;
  drops: any[];
  names: Record<string, string>;
};

const money = (n: number | string | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function buildDrawerClosePdf(p: DrawerClosePdfInput): { blob: Blob; filename: string } {
  const { session: s, drawer, trailer, drops, names } = p;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const starting = Number(s.starting_float ?? 0);
  const counted = Number(s.counted_amount ?? 0);
  const expected = Number(s.expected_amount ?? 0);
  const variance = Number(s.variance ?? 0);
  const dropAmount = Math.max(0, counted - starting);

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Drawer Close Report", 40, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Dip N Shake · ${trailer?.name ?? "—"} · Drawer ${drawer?.name ?? "—"}`, 40, 68);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 82);
  doc.setTextColor(0);

  // KPI table
  autoTable(doc, {
    startY: 100,
    head: [["Starting Float", "POS Cash Sales", "Expected Total", "Counted"]],
    body: [[money(starting), money(s.total_cash_sales), money(expected), money(counted)]],
    theme: "grid",
    headStyles: { fillColor: [10, 10, 10], textColor: [224, 184, 104] },
    styles: { fontSize: 10 },
  });

  autoTable(doc, {
    head: [["Variance", "Drop Amount", "Remaining Float", "Owner Review"]],
    body: [
      [
        `${variance >= 0 ? "+" : ""}${money(variance)}`,
        money(dropAmount),
        money(starting),
        String(s.owner_review ?? "—"),
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [10, 10, 10], textColor: [224, 184, 104] },
    styles: { fontSize: 10 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0 && variance !== 0) {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Session table
  autoTable(doc, {
    head: [["Field", "Value"]],
    body: [
      ["Opened At", new Date(s.opened_at).toLocaleString()],
      ["Opened By", names[s.opened_by] ?? "—"],
      ["Closed At", s.closed_at ? new Date(s.closed_at).toLocaleString() : "—"],
      ["Submitted By (Closed By)", s.closed_by ? (names[s.closed_by] ?? "—") : "—"],
      [
        "Verified By (Owner Reviewer)",
        s.owner_reviewed_by ? (names[s.owner_reviewed_by] ?? "—") : "—",
      ],
      ["Verification", String(s.verification ?? "—")],
      ["Variance Reason / Notes", s.variance_reason ?? "—"],
      ["Owner Note", s.owner_note ?? "—"],
      ["Owner Review Status", String(s.owner_review ?? "—")],
    ],
    theme: "striped",
    headStyles: { fillColor: [10, 10, 10], textColor: [224, 184, 104] },
    styles: { fontSize: 10 },
  });

  // Drops table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const dropsY = (doc as any).lastAutoTable.finalY + 20;
  doc.text(`Mid-shift Cash Drops (${drops.length})`, 40, dropsY);

  if (drops.length) {
    autoTable(doc, {
      startY: dropsY + 8,
      head: [["Drop ID", "Amount", "Time", "Submitted By", "Verified By", "Reason"]],
      body: drops.map((d: any) => [
        d.drop_code,
        money(d.amount),
        new Date(d.submitted_at).toLocaleString(),
        names[d.submitted_by] ?? "—",
        d.verified_by ? (names[d.verified_by] ?? "—") : "—",
        d.reason || "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [10, 10, 10], textColor: [224, 184, 104] },
      styles: { fontSize: 9 },
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text("No mid-shift drops in this session.", 40, dropsY + 18);
    doc.setTextColor(0);
  }

  const blob = doc.output("blob");
  const filename = `drawer-close-${drawer?.name?.replace(/\s+/g, "_") ?? "drawer"}-${s.id}.pdf`;
  return { blob, filename };
}

export async function uploadDrawerClosePdf(
  supabase: any,
  sessionId: string,
  trailerId: string,
  blob: Blob,
): Promise<string> {
  const path = `cash/drawer-close/${trailerId}/${sessionId}.pdf`;
  const { error } = await supabase.storage
    .from("gotham-photos")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  return path;
}
