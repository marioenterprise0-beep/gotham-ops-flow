import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ROLES, useRole, type RoleId } from "@/lib/role";
import { Crown, Shield, Star, Flame, Salad, Coffee } from "lucide-react";

export const Route = createFileRoute("/role")({
  head: () => ({ meta: [{ title: "Select Role · Gotham OS" }] }),
  component: RoleSelect,
});

const icons: Record<RoleId, typeof Crown> = {
  owner: Crown, manager: Shield, shift_lead: Star, grill: Flame, prep: Salad, cashier: Coffee,
};

function RoleSelect() {
  const { setRoleId } = useRole();
  const nav = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="surface-dark border-b border-[#1C1C1C]">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-2">
          <span className="text-xl">🥙</span>
          <span className="font-display text-xl tracking-wider text-[var(--color-gold)]">GOTHAM OS</span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-10">
        <div className="text-center mb-10">
          <div className="label-caps text-muted-foreground mb-2">Trailer · Main · Opening Shift</div>
          <h1 className="font-display text-4xl md:text-5xl text-foreground">SELECT YOUR ROLE</h1>
          <p className="mt-2 text-muted-foreground">Your role determines visible modules and assigned tasks.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.values(ROLES)).map((r) => {
            const Icon = icons[r.id];
            return (
              <button
                key={r.id}
                onClick={() => { setRoleId(r.id); nav({ to: "/" }); }}
                className="group text-left bg-card border border-border card-shadow rounded-xl p-5 hover:border-[var(--color-gold)] hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 rounded-lg grid place-items-center"
                       style={{ background: `${r.color}14`, color: r.color }}>
                    <Icon className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <span className="label-caps text-muted-foreground">{r.short}</span>
                </div>
                <div className="font-display text-2xl text-foreground">{r.name.toUpperCase()}</div>
                <div className="text-sm text-muted-foreground mt-1">{r.blurb}</div>
                <div className="mt-4 label-caps text-[var(--color-gold)] opacity-0 group-hover:opacity-100 transition">
                  Continue →
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
