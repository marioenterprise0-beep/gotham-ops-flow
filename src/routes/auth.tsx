import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/role";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in · Gotham OS" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useRole();
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <FullScreen>Loading…</FullScreen>;
  if (session) return <Navigate to="/" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!inviteCode.trim()) throw new Error("Invite code required. Ask a manager for one.");
        const redirectTo = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              display_name: name || email.split("@")[0],
              invite_code: inviteCode.trim().toUpperCase(),
            },
          },
        });
        if (error) {
          const msg = /invite_code_required/i.test(error.message)
            ? "Invite code required."
            : /invalid_or_expired/i.test(error.message)
            ? "That invite code is invalid or expired."
            : error.message;
          throw new Error(msg);
        }
        toast.success("Account created. Check email to verify, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/" });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (!result.redirected) nav({ to: "/" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex surface-dark items-center justify-center p-12">
        <div className="max-w-md">
          <div className="text-3xl mb-3">🥙</div>
          <div className="font-display text-5xl text-[var(--color-gold)] leading-none">GOTHAM OS</div>
          <p className="mt-4 text-white/70">Internal operating system for Gotham Halal. Built for the trailer crew — speed, accountability, premium halal hospitality.</p>
          <ul className="mt-8 space-y-2 text-sm text-white/70">
            <li>· Phase-based opening, mid, closing checklists</li>
            <li>· Live inventory, waste, and receiving</li>
            <li>· Manager sign-off and full audit trail</li>
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-6 text-center">
            <div className="font-display text-3xl text-foreground">GOTHAM OS</div>
          </div>
          <div className="label-caps text-muted-foreground">{mode === "signin" ? "Sign in" : "Create account"}</div>
          <h1 className="font-display text-3xl mt-1">{mode === "signin" ? "WELCOME BACK" : "JOIN THE CREW"}</h1>

          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === "signup" && (
              <Field label="Display name">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marcus T."
                  className="w-full h-11 rounded-md border border-border bg-card px-3 text-sm focus:border-[var(--color-gold)] outline-none" />
              </Field>
            )}
            <Field label="Email">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gothamhalal.com"
                className="w-full h-11 rounded-md border border-border bg-card px-3 text-sm focus:border-[var(--color-gold)] outline-none" />
            </Field>
            <Field label="Password">
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full h-11 rounded-md border border-border bg-card px-3 text-sm focus:border-[var(--color-gold)] outline-none" />
            </Field>
            {mode === "signup" && (
              <Field label="Invite code">
                <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="ABCD2345" required
                  className="w-full h-11 rounded-md border border-border bg-card px-3 text-sm tracking-widest font-mono focus:border-[var(--color-gold)] outline-none" />
                <div className="mt-1 text-xs text-muted-foreground">Get a code from your manager. Required to join.</div>
              </Field>
            )}
            <button disabled={busy} type="submit"
              className="w-full h-11 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] font-semibold text-sm disabled:opacity-60">
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>


          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New crew member?" : "Already have an account?"}{" "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-[var(--color-gold)] font-semibold">
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="label-caps text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen grid place-items-center text-muted-foreground">{children}</div>;
}
