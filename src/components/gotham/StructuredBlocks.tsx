import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { HandbookBlock } from "@/lib/handbook.functions";

// Source text carries a small, known set of ReportLab-style inline tags —
// <b>...</b> and <font color='#HEX'>...</font>, sometimes nested (a bold,
// colored bullet prefix: <b><font color='#b8960c'>Prefix</font></b> rest).
// Parsed recursively rather than a flat split/regex so nesting renders
// correctly instead of leaking raw tags as text.
const INLINE_TAG_RE = /<(b|font)(?:\s+color=['"]?(#[0-9A-Fa-f]{6})['"]?)?>/i;

function renderInline(text: string, keyPrefix = ""): ReactNode[] {
  const nodes: ReactNode[] = [];
  let pos = 0;
  let key = 0;

  while (pos < text.length) {
    const rest = text.slice(pos);
    const open = rest.match(INLINE_TAG_RE);
    if (!open || open.index === undefined) {
      nodes.push(<span key={`${keyPrefix}t${key++}`}>{rest}</span>);
      break;
    }
    if (open.index > 0) {
      nodes.push(<span key={`${keyPrefix}t${key++}`}>{rest.slice(0, open.index)}</span>);
    }
    const tagName = open[1].toLowerCase();
    const color = open[2];
    const afterOpenTag = rest.slice(open.index + open[0].length);
    const closeRe = new RegExp(`</${tagName}>`, "i");
    const close = afterOpenTag.match(closeRe);
    if (!close || close.index === undefined) {
      // Unclosed tag — bail and render the remainder as plain text rather
      // than silently dropping content.
      nodes.push(<span key={`${keyPrefix}t${key++}`}>{rest.slice(open.index)}</span>);
      break;
    }
    const inner = afterOpenTag.slice(0, close.index);
    const innerNodes = renderInline(inner, `${keyPrefix}${key}-`);
    nodes.push(
      tagName === "b" ? (
        <strong key={`${keyPrefix}t${key++}`}>{innerNodes}</strong>
      ) : (
        <span key={`${keyPrefix}t${key++}`} style={color ? { color } : undefined}>{innerNodes}</span>
      ),
    );
    pos += open.index + open[0].length + close.index + close[0].length;
  }
  return nodes;
}

function isSoleBold(text: string) {
  return /^<b>[\s\S]*<\/b>$/.test(text.trim());
}

export function StructuredBlock({ block }: { block: HandbookBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h3 className={cn("font-display mt-5 mb-2", block.level === "h1" ? "text-lg text-[var(--color-gold)]" : "text-base")}>
          {block.text}
        </h3>
      );
    case "paragraph":
      if (isSoleBold(block.text)) {
        const m = block.text.trim().match(/^<b>([\s\S]*)<\/b>$/);
        return <h4 className="font-semibold text-sm mt-4 mb-1.5">{m ? renderInline(m[1]) : block.text}</h4>;
      }
      return <p className="text-sm leading-relaxed text-foreground/90 mb-2">{renderInline(block.text)}</p>;
    case "bullet":
      return (
        <li className="text-sm leading-relaxed text-foreground/90 ml-4 list-disc mb-1">
          {renderInline(block.text)}
        </li>
      );
    case "note":
      return (
        <div className="flex gap-2 items-start rounded-md border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 px-3 py-2 my-3 text-sm font-medium text-[var(--color-gold)]">
          <span aria-hidden>⚠</span>
          <span>{block.text}</span>
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto my-3 rounded-md border border-border">
          <table className="w-full text-xs">
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className={cn(ri === 0 ? "bg-secondary font-semibold" : ri % 2 ? "bg-card" : "bg-secondary/30")}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2.5 py-1.5 border-b border-border align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

// Groups consecutive bullet blocks into a single <ul>; everything else
// renders inline in order. Shared by the Handbook page and the HR document
// detail view — both render the same HandbookBlock[] shape.
export function renderStructuredBlocks(blocks: HandbookBlock[]): ReactNode[] {
  const bullets: HandbookBlock[] = [];
  const out: ReactNode[] = [];
  let key = 0;

  function flushBullets() {
    if (bullets.length === 0) return;
    out.push(
      <ul key={`bul-${key++}`} className="my-1">
        {bullets.map((b, i) => (
          <StructuredBlock key={i} block={b} />
        ))}
      </ul>,
    );
    bullets.length = 0;
  }

  for (const block of blocks) {
    if (block.type === "other") continue;
    if (block.type === "bullet") {
      bullets.push(block);
      continue;
    }
    flushBullets();
    out.push(<StructuredBlock key={`b-${key++}`} block={block} />);
  }
  flushBullets();
  return out;
}
