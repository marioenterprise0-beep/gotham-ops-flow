// Client-side completed-HR-document PDF generator (jsPDF) — mirrors
// cash-pdf.ts's pattern. Runs in the browser (not a server function):
// this app deploys to Cloudflare Workers, and real PDF libraries don't
// reliably run in that edge runtime, so generation happens wherever the
// final signature was just submitted, then the resulting PDF is uploaded
// to storage from there.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { HandbookBlock } from "@/lib/handbook.functions";
import { isFillablePlaceholder, splitCheckboxSegments } from "@/components/gotham/StructuredBlocks";

const GOLD: [number, number, number] = [224, 184, 104];
const DARK: [number, number, number] = [10, 10, 10];
const PAGE_MARGIN = 40;
const CONTENT_WIDTH = 515;

type SignatureRow = {
  signer_role_label: string;
  typed_full_name: string | null;
  signed_at: string | null;
};

export type HrDocumentPdfInput = {
  title: string;
  body_blocks: HandbookBlock[] | null;
  field_values: Record<string, string>;
};

function resolveBlank(
  key: string,
  fieldValues: Record<string, string>,
  placeholder: string,
): string {
  const saved = fieldValues[key];
  if (saved !== undefined && saved !== null && String(saved).trim() !== "") return String(saved);
  return placeholder.trim() === "" ? "(left blank)" : placeholder;
}

// Mirrors renderInline's tag+blank tokenizing, but produces plain text —
// PDF body text here doesn't need the <b>/<font> styling, just the
// content, so tags are stripped rather than re-rendered as rich text.
function resolveInlineText(
  text: string,
  blockIndex: number,
  fieldValues: Record<string, string>,
): string {
  let blankIdx = 0;
  return text.replace(/<\/?b>|<font[^>]*>|<\/font>/gi, "").replace(/_{3,}/g, () => {
    const key = `b${blockIndex}_u${blankIdx++}`;
    const saved = fieldValues[key];
    return saved && String(saved).trim() !== "" ? `[${saved}]` : "________";
  });
}

function checkboxLine(
  segments: { label: string }[],
  baseKey: string,
  fieldValues: Record<string, string>,
): string {
  return segments
    .map((seg, i) => {
      const checked = fieldValues[`${baseKey}_cb${i}`] === "true";
      return `[${checked ? "X" : " "}] ${seg.label}`;
    })
    .join("    ");
}

export function buildHrDocumentPdf(
  assignment: HrDocumentPdfInput,
  signatures: SignatureRow[],
): { blob: Blob; filename: string } {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const fv = assignment.field_values ?? {};
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 90;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(assignment.title, PAGE_MARGIN, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `Dip N Shake · Completed record · Generated ${new Date().toLocaleString()}`,
    PAGE_MARGIN,
    66,
  );
  doc.setTextColor(0);

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - 60) {
      doc.addPage();
      y = 50;
    }
  }

  function writeText(text: string, opts: { bold?: boolean; size?: number } = {}) {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[];
    ensureSpace(lines.length * 13 + 6);
    doc.text(lines, PAGE_MARGIN, y);
    y += lines.length * 13 + 6;
  }

  for (const [blockIndex, block] of (assignment.body_blocks ?? []).entries()) {
    if (block.type === "other") continue;

    if (block.type === "heading") {
      ensureSpace(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(block.level === "h1" ? 13 : 11);
      doc.setTextColor(...GOLD);
      doc.text(block.text, PAGE_MARGIN, y);
      doc.setTextColor(0);
      y += 18;
      continue;
    }

    if (block.type === "paragraph") {
      if (isFillablePlaceholder(block.text)) {
        writeText(resolveBlank(`b${blockIndex}`, fv, block.text));
      } else {
        writeText(resolveInlineText(block.text, blockIndex, fv));
      }
      continue;
    }

    if (block.type === "bullet") {
      const cb = splitCheckboxSegments(block.text);
      writeText(
        cb
          ? checkboxLine(cb, `b${blockIndex}`, fv)
          : `•  ${resolveInlineText(block.text, blockIndex, fv)}`,
      );
      continue;
    }

    if (block.type === "note") {
      writeText(`⚠ ${block.text}`, { bold: true });
      continue;
    }

    if (block.type === "table") {
      ensureSpace(30);
      const bodyRows = block.rows.slice(1).map((row, ri0) => {
        const ri = ri0 + 1;
        return row.map((cell, ci) => {
          const cb = splitCheckboxSegments(cell);
          if (cb) return checkboxLine(cb, `b${blockIndex}_r${ri}_c${ci}`, fv);
          if (isFillablePlaceholder(cell))
            return resolveBlank(`b${blockIndex}_r${ri}_c${ci}`, fv, cell);
          return cell;
        });
      });
      autoTable(doc, {
        startY: y,
        head: [block.rows[0] ?? []],
        body: bodyRows,
        theme: "grid",
        headStyles: { fillColor: DARK, textColor: GOLD },
        styles: { fontSize: 8 },
        margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      });
      y = (doc as any).lastAutoTable.finalY + 14;
      continue;
    }
  }

  ensureSpace(50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Signatures", PAGE_MARGIN, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [["Role", "Signed By", "Date"]],
    body: signatures.map((s) => [
      s.signer_role_label,
      s.typed_full_name ?? "—",
      s.signed_at ? new Date(s.signed_at).toLocaleString() : "—",
    ]),
    theme: "striped",
    headStyles: { fillColor: DARK, textColor: GOLD },
    styles: { fontSize: 9 },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  });

  const blob = doc.output("blob");
  const filename = `${assignment.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
  return { blob, filename };
}

export async function uploadHrDocumentPdf(
  supabase: any,
  assignmentId: string,
  blob: Blob,
): Promise<string> {
  const path = `hr-docs/completed/${assignmentId}.pdf`;
  const { error } = await supabase.storage
    .from("gotham-photos")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  return path;
}
