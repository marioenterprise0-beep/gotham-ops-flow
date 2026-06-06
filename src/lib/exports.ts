// Lightweight, dependency-free CSV + printable-PDF helpers.
// "PDF" uses the browser's print dialog → Save as PDF. Zero install cost.

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const head = headers.map(csvEscape).join(",");
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const csv = toCSV(headers, rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PRINT_CSS = `
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0A0A0A; margin: 0; padding: 0; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 0.5px; }
  h2 { font-size: 14px; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 1.2px; color: #555; }
  .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e5e5; }
  th { background: #0A0A0A; color: #E0B868; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  tr:nth-child(even) td { background: #fafafa; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0 16px; }
  .kpi { border: 1px solid #e5e5e5; border-radius: 6px; padding: 8px; }
  .kpi .l { font-size: 9px; text-transform: uppercase; color: #777; letter-spacing: 1px; }
  .kpi .v { font-size: 18px; font-weight: 700; margin-top: 2px; }
  .warn { color: #b45309; }
  .danger { color: #b91c1c; }
  .ok { color: #15803d; }
  footer { margin-top: 24px; font-size: 10px; color: #888; border-top: 1px solid #e5e5e5; padding-top: 8px; }
`;

export function openPrintablePDF(title: string, bodyHTML: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Pop-up blocked. Allow pop-ups to export PDF.");
    return;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>${bodyHTML}<footer>Generated ${new Date().toLocaleString()} · Gotham OS</footer><script>window.onload = () => { setTimeout(() => window.print(), 250); };</script></body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function htmlTable(headers: string[], rows: (string | number)[][]): string {
  const h = headers.map((x) => `<th>${escapeHTML(String(x))}</th>`).join("");
  const b = rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHTML(String(c ?? ""))}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${h}</tr></thead><tbody>${b}</tbody></table>`;
}

export function escapeHTML(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function kpiBlock(items: { label: string; value: string | number; tone?: "ok" | "warn" | "danger" }[]): string {
  return `<div class="kpis">${items.map((k) => `<div class="kpi"><div class="l">${escapeHTML(k.label)}</div><div class="v ${k.tone ?? ""}">${escapeHTML(String(k.value))}</div></div>`).join("")}</div>`;
}
