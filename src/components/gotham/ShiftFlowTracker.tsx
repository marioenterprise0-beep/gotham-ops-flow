import { Link } from "@tanstack/react-router";
import { Card } from "@/components/gotham/primitives";
import { cn } from "@/lib/utils";
import {
  LogIn,
  ClipboardList,
  ClipboardCheck,
  Boxes,
  Bell,
  LogOut,
  FileText,
  Check,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ShiftSignals = {
  clockedIn: boolean;
  hasClockedInToday: boolean;
  tasksTotal: number;
  tasksDone: number;
  opsRunPct: number; // 0–100 — operations checklist progress
  inventoryCountedToday: boolean;
  criticalAlertsOpen: number;
  recapSubmittedToday: boolean;
  isManagerView: boolean; // if false, hide Recap step
};

type Step = {
  key: string;
  label: string;
  icon: LucideIcon;
  to: string;
  done: boolean;
  cta: string;
};

function buildSteps(s: ShiftSignals): Step[] {
  const steps: Step[] = [
    {
      key: "clock-in",
      label: "Clock In",
      icon: LogIn,
      to: "/time-clock",
      done: s.clockedIn || (!s.clockedIn && s.hasClockedInToday),
      cta: "Clock in to start your shift",
    },
    {
      key: "tasks",
      label: "View Tasks",
      icon: ClipboardList,
      to: "/my-tasks",
      done: s.tasksTotal === 0 ? s.clockedIn : s.tasksDone > 0,
      cta: "Open your task list",
    },
    {
      key: "ops",
      label: "Execute Ops",
      icon: ClipboardCheck,
      to: "/operations",
      done: s.opsRunPct >= 100,
      cta: "Run the operations checklist",
    },
    {
      key: "inventory",
      label: "Count Inventory",
      icon: Boxes,
      to: "/inventory",
      done: s.inventoryCountedToday,
      cta: "Submit today's inventory count",
    },
    {
      key: "alerts",
      label: "Handle Alerts",
      icon: Bell,
      to: "/alerts",
      done: s.criticalAlertsOpen === 0,
      cta: "Clear critical alerts",
    },
    {
      key: "clock-out",
      label: "Clock Out",
      icon: LogOut,
      to: "/time-clock",
      done: !s.clockedIn && s.hasClockedInToday,
      cta: "Clock out when your shift ends",
    },
  ];
  if (s.isManagerView) {
    steps.push({
      key: "recap",
      label: "Submit Recap",
      icon: FileText,
      to: "/recaps",
      done: s.recapSubmittedToday,
      cta: "Write today's shift recap",
    });
  }
  return steps;
}

export function ShiftFlowTracker(props: ShiftSignals) {
  const steps = buildSteps(props);
  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;
  const currentIdx = steps.findIndex((s) => !s.done);
  const current = currentIdx === -1 ? null : steps[currentIdx];
  const pct = Math.round((doneCount / total) * 100);

  return (
    <Card goldAccent className="!p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="label-caps text-muted-foreground">Shift flow</div>
          <div className="font-display text-base leading-tight">
            {current ? (
              <>
                Next: <span className="text-[var(--color-gold)]">{current.label}</span>
              </>
            ) : (
              <span className="text-[var(--color-success)]">All steps complete</span>
            )}
          </div>
        </div>
        {current && (
          <Link
            to={current.to}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[1.2px] hover:brightness-105"
          >
            {current.cta} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* Progress rail */}
      <div className="relative">
        <div className="absolute left-3 right-3 top-3 h-0.5 bg-border" />
        <div
          className="absolute left-3 top-3 h-0.5 bg-[var(--color-gold)] transition-all"
          style={{ width: `calc((100% - 1.5rem) * ${pct / 100})` }}
        />
        <ol
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0,1fr))` }}
        >
          {steps.map((s, i) => {
            const isCurrent = i === currentIdx;
            const Icon = s.icon;
            return (
              <li key={s.key} className="flex flex-col items-center text-center">
                <Link
                  to={s.to}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "h-6 w-6 rounded-full grid place-items-center border-2 transition-colors",
                    s.done
                      ? "bg-[var(--color-gold)] border-[var(--color-gold)] text-[#0A0A0A]"
                      : isCurrent
                        ? "bg-card border-[var(--color-gold)] text-[var(--color-gold)] ring-2 ring-[var(--color-gold)]/30"
                        : "bg-card border-border text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  {s.done ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                </Link>
                <span
                  className={cn(
                    "mt-1 text-[9px] uppercase tracking-wide leading-tight max-w-[68px]",
                    isCurrent ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          Step {Math.min(currentIdx === -1 ? total : currentIdx + 1, total)} of {total}
        </span>
        <span className="font-semibold text-foreground">{pct}%</span>
      </div>
    </Card>
  );
}
