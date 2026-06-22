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

// A spot is "fillable" if it's a blank cell/line or a known blank-line
// convention from the source PDFs (a run of underscores, or a bare
// "Yes/No" / "Y/N" choice placeholder). Anything more complex (multi-option
// checkbox rows like "☐ None ☐ Yes") is left as plain text — converting
// those into real controls reliably would need per-document field tagging,
// which is out of scope here.
function isFillablePlaceholder(text: string): boolean {
  const t = text.trim();
  if (t === "") return true;
  if (/^_{3,}$/.test(t)) return true;
  if (/^(yes\/no|y\/n)$/i.test(t)) return true;
  return false;
}

// "☐ Label" (one or more, e.g. "☐ Yes  ☐ No" or a list of violation
// checkboxes) — splits right before each checkbox glyph, keeping it with
// the label that follows. Source forms never pre-check a box, but ☑/☒ are
// honored too in case that ever changes.
const CHECKBOX_CHAR_RE = /[☐☑☒]/;
function splitCheckboxSegments(text: string): { checked: boolean; label: string }[] | null {
  if (!CHECKBOX_CHAR_RE.test(text)) return null;
  const parts = text
    .split(/(?=[☐☑☒])/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.map((p) => ({ checked: p[0] === "☑" || p[0] === "☒", label: p.slice(1).trim() }));
}

export type FieldValues = Record<string, string>;

export type FillContext = {
  /** Permanently-saved answers — rendered as locked, read-only text. */
  fieldValues?: FieldValues;
  /** Not-yet-saved, in-progress answers — controlled by the caller. */
  draftValues?: FieldValues;
  onDraftChange?: (key: string, value: string) => void;
  /** When false, unfilled blanks render as plain placeholder text (e.g. a signed/voided document, or the read-only Handbook). */
  editable?: boolean;
};

function FillSlot({ fieldKey, placeholder, fill, className }: { fieldKey: string; placeholder: string; fill?: FillContext; className?: string }) {
  const saved = fill?.fieldValues?.[fieldKey];
  if (saved !== undefined && saved !== null && saved !== "") {
    return <span className={cn("font-medium text-[var(--color-gold)]", className)}>{saved}</span>;
  }
  if (!fill?.editable) {
    return <span className={cn("text-muted-foreground", className)}>{placeholder}</span>;
  }
  return (
    <input
      value={fill.draftValues?.[fieldKey] ?? ""}
      onChange={(e) => fill.onDraftChange?.(fieldKey, e.target.value)}
      placeholder={placeholder.trim() === "" ? "Type your answer…" : placeholder}
      className={cn(
        "w-full min-w-[6rem] bg-secondary border border-[var(--color-gold)]/40 rounded px-1.5 py-0.5 text-sm outline-none focus:border-[var(--color-gold)]",
        className,
      )}
    />
  );
}

// One or more "☐ Label" toggles sharing a base key — each segment locks
// independently the moment it's saved checked; unchecked boxes are simply
// never saved (blank/unchecked is already the natural default, no need to
// lock a negative).
function CheckboxRow({ baseKey, segments, fill }: { baseKey: string; segments: { checked: boolean; label: string }[]; fill?: FillContext }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {segments.map((seg, i) => {
        const key = `${baseKey}_cb${i}`;
        const saved = fill?.fieldValues?.[key];
        const isLocked = saved === "true";
        const checked = isLocked ? true : fill?.editable ? fill.draftValues?.[key] === "true" : seg.checked;
        return (
          <label
            key={i}
            className={cn(
              "inline-flex items-center gap-1.5 text-sm",
              isLocked && "text-[var(--color-gold)] font-medium",
              !isLocked && !fill?.editable && "text-muted-foreground",
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={isLocked || !fill?.editable}
              onChange={(e) => fill?.onDraftChange?.(key, e.target.checked ? "true" : "")}
            />
            {seg.label}
          </label>
        );
      })}
    </div>
  );
}

export function StructuredBlock({
  block, blockIndex, fill,
}: {
  block: HandbookBlock;
  blockIndex?: number;
  fill?: FillContext;
}) {
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
      if (blockIndex !== undefined && isFillablePlaceholder(block.text)) {
        return (
          <div className="mb-2">
            <FillSlot fieldKey={`b${blockIndex}`} placeholder={block.text} fill={fill} />
          </div>
        );
      }
      return <p className="text-sm leading-relaxed text-foreground/90 mb-2">{renderInline(block.text)}</p>;
    case "bullet": {
      const cbSegments = blockIndex !== undefined ? splitCheckboxSegments(block.text) : null;
      if (cbSegments) {
        return (
          <li className="list-none -ml-4 mb-1">
            <CheckboxRow baseKey={`b${blockIndex}`} segments={cbSegments} fill={fill} />
          </li>
        );
      }
      return (
        <li className="text-sm leading-relaxed text-foreground/90 ml-4 list-disc mb-1">
          {renderInline(block.text)}
        </li>
      );
    }
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
                  {row.map((cell, ci) => {
                    const cbSegments = ri > 0 && blockIndex !== undefined ? splitCheckboxSegments(cell) : null;
                    return (
                      <td key={ci} className="px-2.5 py-1.5 border-b border-border align-top min-w-[7rem]">
                        {cbSegments ? (
                          <CheckboxRow baseKey={`b${blockIndex}_r${ri}_c${ci}`} segments={cbSegments} fill={fill} />
                        ) : ri > 0 && blockIndex !== undefined && isFillablePlaceholder(cell) ? (
                          <FillSlot fieldKey={`b${blockIndex}_r${ri}_c${ci}`} placeholder={cell} fill={fill} />
                        ) : (
                          cell
                        )}
                      </td>
                    );
                  })}
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
// renders inline in order. Shared by the Handbook page (no `fill`, behaves
// exactly as before) and the HR document detail/send views (pass `fill` to
// turn blanks into inputs or locked saved-answer text).
export function renderStructuredBlocks(blocks: HandbookBlock[], fill?: FillContext): ReactNode[] {
  const bullets: { block: HandbookBlock; index: number }[] = [];
  const out: ReactNode[] = [];
  let key = 0;

  function flushBullets() {
    if (bullets.length === 0) return;
    out.push(
      <ul key={`bul-${key++}`} className="my-1">
        {bullets.map(({ block, index }, i) => (
          <StructuredBlock key={i} block={block} blockIndex={index} fill={fill} />
        ))}
      </ul>,
    );
    bullets.length = 0;
  }

  blocks.forEach((block, blockIndex) => {
    if (block.type === "other") return;
    if (block.type === "bullet") {
      bullets.push({ block, index: blockIndex });
      return;
    }
    flushBullets();
    out.push(<StructuredBlock key={`b-${key++}`} block={block} blockIndex={blockIndex} fill={fill} />);
  });
  flushBullets();
  return out;
}
