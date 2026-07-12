import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "⌘K", label: "Open command palette" },
  { keys: "?", label: "Show keyboard shortcuts" },
  { keys: "g then d", label: "Go to Dashboard" },
  { keys: "g then a", label: "Go to Alerts" },
  { keys: "g then t", label: "Go to My Tasks" },
  { keys: "g then c", label: "Go to Time Clock" },
  { keys: "g then s", label: "Go to Schedule" },
  { keys: "g then i", label: "Go to Inventory" },
  { keys: "g then o", label: "Go to Operations" },
  { keys: "g then ,", label: "Go to Settings" },
  { keys: "r", label: "Refresh current view" },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  // Avoid hijacking keys when a dialog/command palette has focus
  if (el.closest("[role='dialog']") || el.closest("[cmdk-root]")) return true;
  return false;
}

export function KeyboardShortcuts() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [pendingG, setPendingG] = useState(false);

  useEffect(() => {
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      // "?" cheatsheet (shift+/)
      if (e.key === "?" ) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      if (pendingG) {
        const map: Record<string, string> = {
          d: "/", a: "/alerts", t: "/my-tasks", c: "/time-clock",
          s: "/schedule", i: "/inventory", o: "/operations", ",": "/settings",
        };
        const dest = map[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          nav({ to: dest });
        }
        setPendingG(false);
        if (gTimer) clearTimeout(gTimer);
        return;
      }

      if (e.key.toLowerCase() === "g") {
        e.preventDefault();
        setPendingG(true);
        gTimer = setTimeout(() => setPendingG(false), 1200);
        return;
      }

      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        window.dispatchEvent(new Event("gotham:refresh"));
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [nav, pendingG]);

  return (
    <>
      {pendingG && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-md bg-[#0A0A0A] text-white px-3 py-1.5 text-xs font-mono shadow-lg border border-[#2A2A2A]">
          g … <span className="text-[var(--color-gold)]">waiting for key</span>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Navigate without touching the mouse.</DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex items-center justify-between py-2 text-sm">
                <span className="text-foreground/80">{s.label}</span>
                <kbd className="px-2 py-1 rounded bg-secondary border border-border text-[11px] font-mono text-foreground">
                  {s.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
