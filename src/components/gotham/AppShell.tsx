import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Home, ClipboardCheck, Boxes, BookOpen, BarChart3 } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/operations", label: "Ops", icon: ClipboardCheck },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/sops", label: "SOPs", icon: BookOpen },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />
      <main className="flex-1 pb-24 pt-3">
        <div className="mx-auto w-full max-w-3xl px-4">
          {children ?? <Outlet />}
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 surface-dark border-t border-sidebar-border">
        <div className="mx-auto max-w-3xl grid grid-cols-5">
          {tabs.map((t) => {
            const active = t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="relative flex flex-col items-center justify-center gap-1 py-3 text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/60 transition-colors data-[active=true]:text-gold"
                data-active={active}
              >
                {active && <span className="absolute top-0 inset-x-6 h-[2px] shimmer-gold rounded-full" />}
                <Icon className="h-5 w-5" strokeWidth={1.75} />
                <span className="font-display">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 surface-dark border-b border-sidebar-border">
      <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md shimmer-gold grid place-items-center font-display font-bold text-sm">G</div>
          <div className="leading-tight">
            <div className="font-display font-semibold text-sidebar-foreground tracking-tight">GOTHAM <span className="text-gold">OS</span></div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50">Trailer · 01</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50">Shift Lead</span>
            <span className="text-sm font-medium text-sidebar-foreground">Yusuf A.</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-sidebar-accent text-sidebar-foreground grid place-items-center font-display text-sm border border-sidebar-border">YA</div>
        </div>
      </div>
    </header>
  );
}
