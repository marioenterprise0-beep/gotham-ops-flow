import { ReactNode } from "react";
import { Card } from "@/components/gotham/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  hint,
  actionLabel,
  onAction,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn("p-8 text-center", className)}>
      <div className="mx-auto flex flex-col items-center gap-3 max-w-sm">
        {Icon && (
          <div className="h-12 w-12 grid place-items-center rounded-full bg-secondary text-[var(--color-gold)]">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="font-display text-lg leading-tight">{title}</div>
        {hint && <div className="text-sm text-muted-foreground">{hint}</div>}
        {actionLabel && onAction && (
          <Button size="sm" className="mt-1" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}
