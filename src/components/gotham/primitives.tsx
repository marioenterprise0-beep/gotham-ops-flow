import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-2 mt-4 first:mt-0 gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="label-caps text-muted-foreground mb-0.5">{eyebrow}</div>}
        <h2 className="font-display text-xl text-foreground truncate">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className,
  dark,
  graphite,
  goldAccent,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
  graphite?: boolean;
  goldAccent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-[13px] card-shadow transition-colors",
        dark && "surface-dark border-[#1C1C1C] text-white",
        graphite && "surface-graphite border-[#2A2A2A] text-white",
        !dark && !graphite && "bg-card border-border",
        goldAccent && "border-l-4 border-l-[var(--color-gold)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "gold" | "info";

export function StatusPill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const map: Record<Tone, string> = {
    neutral: "bg-secondary text-foreground border border-border",
    success:
      "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/30",
    warning:
      "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]/40",
    danger:
      "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger)]/40",
    gold: "bg-[var(--color-gold)] text-[var(--color-gold-foreground)]",
    info: "bg-[#E8F0FE] text-[#2D6CDF] border border-[#2D6CDF]/30",
  };
  const dotMap: Record<Tone, string> = {
    neutral: "bg-muted-foreground",
    success: "bg-[var(--color-success)]",
    warning: "bg-[var(--color-warning)]",
    danger: "bg-[var(--color-danger)]",
    gold: "bg-[#0A0A0A]",
    info: "bg-[#2D6CDF]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 label-caps",
        map[tone],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotMap[tone])} />
      {children}
    </span>
  );
}

export function MetricStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "gold" | "default" | "success" | "danger";
}) {
  return (
    <div>
      <div className="label-caps text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-3xl font-semibold tracking-tight mt-1 text-foreground",
          tone === "gold" && "text-[var(--color-gold)]",
          tone === "success" && "text-[var(--color-success)]",
          tone === "danger" && "text-[var(--color-danger)]",
        )}
      >
        {value}
      </div>

      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "gold",
}: {
  value: number;
  tone?: "gold" | "success" | "danger";
}) {
  const color =
    tone === "gold"
      ? "bg-[var(--color-gold)]"
      : tone === "success"
        ? "bg-[var(--color-success)]"
        : "bg-[var(--color-danger)]";
  return (
    <div className="h-2 w-full rounded-full bg-[#EAEAE5] overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function CircularProgress({
  value,
  size = 72,
  stroke = 6,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#C9973A"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <div className="text-xl font-semibold">{Math.round(value)}%</div>
          {label && <div className="label-caps text-white/60 mt-1">{label}</div>}
        </div>
      </div>
    </div>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const colorMap: Record<string, string> = {
    "Grill Master": "#8B4513",
    Prep: "#2D6CDF",
    Cashier: "#7B3FA0",
    Front: "#7B3FA0",
    "Cashier / Front": "#7B3FA0",
    "Shift Lead": "#C9973A",
    Manager: "#C0392B",
    Owner: "#0A0A0A",
  };
  const c = colorMap[role] ?? "#6B6B6B";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1.2px]"
      style={{ background: `${c}14`, color: c, border: `1px solid ${c}33` }}
    >
      {role}
    </span>
  );
}
