import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3 mt-6 first:mt-0">
      <div>
        {eyebrow && <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1">{eyebrow}</div>}
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className, dark }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-4 transition-colors",
      dark ? "surface-dark border-sidebar-border text-sidebar-foreground" : "bg-card border-border",
      className,
    )}>{children}</div>
  );
}

export function StatusPill({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "gold"; children: ReactNode }) {
  const map: Record<string, string> = {
    neutral: "bg-secondary text-secondary-foreground",
    success: "bg-success/15 text-foreground border border-success/30",
    warning: "bg-warning/15 text-foreground border border-warning/40",
    danger: "bg-destructive/15 text-foreground border border-destructive/40",
    gold: "shimmer-gold",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] font-medium", map[tone])}>
      {children}
    </span>
  );
}

export function MetricStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "gold" | "default" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={cn("font-display text-2xl font-semibold tracking-tight mt-1", tone === "gold" && "text-gold")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = "gold" }: { value: number; tone?: "gold" | "success" }) {
  const color = tone === "gold" ? "shimmer-gold" : "bg-success";
  return (
    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
