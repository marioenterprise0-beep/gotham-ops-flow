import { useEffect, useState } from "react";
import { Boxes, Check, MapPin, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/gotham/primitives";
import { Input } from "@/components/ui/input";
import { SignedImage } from "@/components/gotham/SignedImage";
import { cn } from "@/lib/utils";

type Status = "CRITICAL" | "LOW" | "OK" | "OVER";

function statusOf(it: any): Status {
  const par = Number(it.par_level) || 0;
  const qty = Number(it.current_qty) || 0;
  const low = Number(it.low_threshold) || 0;
  if (qty <= low) return "CRITICAL";
  const r = par === 0 ? 1 : qty / par;
  if (r < 0.5) return "LOW";
  if (r > 1.1) return "OVER";
  return "OK";
}

const STATUS_STYLE: Record<Status, { bg: string; fg: string; bar: string; label: string }> = {
  CRITICAL: {
    bg: "bg-[var(--color-danger-bg)]",
    fg: "text-[var(--color-danger)]",
    bar: "bg-[var(--color-danger)]",
    label: "Critical",
  },
  LOW: {
    bg: "bg-[var(--color-warning-bg)]",
    fg: "text-[var(--color-warning)]",
    bar: "bg-[var(--color-warning)]",
    label: "Low",
  },
  OK: {
    bg: "bg-[var(--color-success-bg)]",
    fg: "text-[var(--color-success)]",
    bar: "bg-[var(--color-success)]",
    label: "On par",
  },
  OVER: {
    bg: "bg-secondary",
    fg: "text-muted-foreground",
    bar: "bg-muted-foreground/60",
    label: "Overstocked",
  },
};

export { statusOf };

export function InventoryItemCard({
  item,
  isOwner,
  isManager,
  onEdit,
  onDelete,
  onCount,
  counting,
  deleting,
}: {
  item: any;
  isOwner: boolean;
  isManager: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCount: (qty: number) => void;
  counting: boolean;
  deleting: boolean;
}) {
  const status = statusOf(item);
  const style = STATUS_STYLE[status];
  const par = Math.max(1, Number(item.par_level) || 0);
  const qty = Number(item.current_qty) || 0;
  const pct = Math.min(150, Math.round((qty / par) * 100));
  const [countOpen, setCountOpen] = useState(false);
  const [draft, setDraft] = useState<string>(String(qty));

  useEffect(() => {
    setDraft(String(qty));
  }, [qty, countOpen]);

  const submit = () => {
    const n = Number(draft);
    if (Number.isNaN(n) || n < 0) {
      toast.error("Enter a valid count");
      return;
    }
    onCount(n);
    setCountOpen(false);
  };

  return (
    <Card className="flex flex-col gap-3 h-full">
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 rounded-md bg-secondary overflow-hidden grid place-items-center border border-border">
          {item.image_url ? (
            <SignedImage
              path={item.image_url}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Boxes className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-[15px] leading-tight line-clamp-2">
                {item.name}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                <span>
                  PAR{" "}
                  <span className="text-foreground font-medium">
                    {Number(item.par_level)} {item.unit}
                  </span>
                </span>
                <span>
                  {"Low ≤ "}
                  <span className="text-foreground font-medium">{Number(item.low_threshold)}</span>
                </span>
              </div>
            </div>
            <span
              className={cn(
                "label-caps shrink-0 rounded-full px-2 py-0.5 text-[10px]",
                style.bg,
                style.fg,
              )}
            >
              {style.label}
            </span>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>On hand</span>
              <span className="tabular-nums">
                <span className="text-foreground font-semibold">{qty}</span>
                <span className="opacity-70">
                  {" "}
                  / {Number(item.par_level)} {item.unit}
                </span>
                <span className="ml-1 opacity-70">· {pct}%</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn("h-full transition-all", style.bar)}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {item.storage_location && (
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-[var(--color-gold)]" />
          <span className="truncate">{item.storage_location}</span>
        </div>
      )}

      {item.count_instructions && (
        <div className="rounded-md border border-border bg-secondary/40 p-2.5">
          <div className="label-caps text-muted-foreground text-[10px] mb-1">How to count</div>
          <div className="text-xs whitespace-pre-wrap leading-relaxed text-foreground/85">
            {item.count_instructions}
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        {isManager ? (
          countOpen ? (
            <div className="flex items-center gap-1.5 flex-1">
              <Input
                type="number"
                min={0}
                step="any"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") setCountOpen(false);
                }}
                autoFocus
                className="h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">{item.unit}</span>
              <button
                onClick={submit}
                disabled={counting}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] disabled:opacity-60"
                title="Save count"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCountOpen(false)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-muted-foreground"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCountOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
            >
              <Check className="h-3.5 w-3.5" /> Quick count
            </button>
          )
        ) : (
          <span />
        )}

        {isOwner && !countOpen && (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={deleting}
              onClick={onDelete}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive disabled:opacity-40"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
