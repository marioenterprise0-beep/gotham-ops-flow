import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ROLES, useRole, type RoleId } from "@/lib/role";
import { Crown, Shield, Star, Flame, Salad, Coffee, Lock, X } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/role")({
  head: () => ({ meta: [{ title: "Select Role · Gotham OS" }] }),
  component: RoleSelect,
});

const icons: Record<RoleId, typeof Crown> = {
  owner: Crown, manager: Shield, shift_lead: Star, grill: Flame, prep: Salad, cashier: Coffee,
};

// Restricted roles require a passcode. Demo PINs — replace with real auth when backend is added.
const PINS: Partial<Record<RoleId, string>> = {
  owner: "2580",
  manager: "1234",
};

function RoleSelect() {
  const { setRoleId } = useRole();
  const nav = useNavigate();
  const [pending, setPending] = useState<RoleId | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const choose = (r: RoleId) => {
    if (PINS[r]) {
      setPending(r); setPin(""); setErr(null);
    } else {
      setRoleId(r); nav({ to: "/" });
    }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pending) return;
    if (pin === PINS[pending]) {
      setRoleId(pending); setPending(null); nav({ to: "/" });
    } else {
      setErr("Incorrect passcode");
    }
  };

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
            const locked = !!PINS[r.id];
            return (
              <button
                key={r.id}
                onClick={() => choose(r.id)}
                className="group relative text-left bg-card border border-border card-shadow rounded-xl p-5 hover:border-[var(--color-gold)] hover:-translate-y-0.5 transition-all"
              >
                {locked && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 label-caps text-[var(--color-gold)] bg-[#0A0A0A] px-2 py-1 rounded">
                    <Lock className="h-3 w-3" /> Restricted
                  </span>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 rounded-lg grid place-items-center"
                       style={{ background: `${r.color}14`, color: r.color }}>
                    <Icon className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  {!locked && <span className="label-caps text-muted-foreground">{r.short}</span>}
                </div>
                <div className="font-display text-2xl text-foreground">{r.name.toUpperCase()}</div>
                <div className="text-sm text-muted-foreground mt-1">{r.blurb}</div>
                <div className="mt-4 label-caps text-[var(--color-gold)] opacity-0 group-hover:opacity-100 transition">
                  {locked ? "Enter passcode →" : "Continue →"}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {pending && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={() => setPending(null)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-xl w-full max-w-sm p-5 card-shadow"
          >
            <div className="flex items-start justify-between mb-1">
              <div className="label-caps text-muted-foreground">Restricted Access</div>
              <button type="button" onClick={() => setPending(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="font-display text-2xl">{ROLES[pending].name.toUpperCase()} PASSCODE</h3>
            <p className="text-sm text-muted-foreground mt-1">Enter the 4-digit passcode to continue.</p>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => { setPin(e.target.value); setErr(null); }}
              placeholder="••••"
              className="mt-4 w-full h-12 rounded-md border border-border bg-card px-4 text-center text-xl tracking-[0.5em] font-semibold"
            />
            {err && <div className="mt-2 text-sm text-[var(--color-danger)]">{err}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPending(null)} className="rounded-md px-3 py-2 text-sm border border-border">Cancel</button>
              <button type="submit" className="rounded-md px-4 py-2 text-sm font-semibold bg-[var(--color-gold)] text-[#0A0A0A]">Unlock</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
