import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/role";

import { toast } from "sonner";
import logoAsset from "@/assets/gotham-halal-logo.jpeg.asset.json";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : "",
  }),
  head: () => ({ meta: [{ title: "Sign in · Gotham OS" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useRole();
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsVerify, setNeedsVerify] = useState<string | null>(null);

  if (loading) return <FullScreen>Loading…</FullScreen>;
  if (session) {
    if (next) {
      if (typeof window !== "undefined") window.location.replace(next);
      return <FullScreen>Redirecting…</FullScreen>;
    }
    return <Navigate to="/" />;
  }

  const resendVerification = async () => {
    if (!needsVerify) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: needsVerify,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      toast.success(`Verification email re-sent to ${needsVerify}.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not resend email");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNeedsVerify(null);
    try {
      if (mode === "signup") {
        const code = inviteCode.trim().toUpperCase();
        if (!code) throw new Error("Invite code required. Ask a manager for one.");
        if (!/^[A-Z0-9-]{4,16}$/.test(code)) throw new Error("Invite codes are 4–16 letters/numbers.");
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        const redirectTo = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              display_name: name || email.split("@")[0],
              invite_code: code,
            },
          },
        });
        if (error) {
          const m = error.message || "";
          const msg = /invite_code_required/i.test(m)
            ? "Invite code required."
            : /invalid_or_expired/i.test(m)
            ? "That invite code is invalid, already used, or expired. Ask a manager for a new one."
            : /already registered|already exists|user.*exists/i.test(m)
            ? "An account with this email already exists. Try signing in."
            : m;
          throw new Error(msg);
        }
        toast.success("Account created. Check your email to verify, then sign in.");
        setNeedsVerify(email);
        setMode("signin");
        setPassword("");
        setInviteCode("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const m = error.message || "";
          if (/email not confirmed|confirm/i.test(m)) {
            setNeedsVerify(email);
            throw new Error("Email not verified yet. Check your inbox — we can resend the link below.");
          }
          if (/invalid login credentials/i.test(m)) {
            throw new Error("Wrong email or password.");
          }
          throw new Error(m);
        }
        nav({ to: "/" });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex surface-dark items-center justify-center p-12">
        <div className="max-w-md">
          <img src={logoAsset.url} alt="Gotham Halal" className="h-24 w-auto object-contain mb-5" />
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
          <div className="lg:hidden mb-6 flex flex-col items-center gap-2">
            <img src={logoAsset.url} alt="Gotham Halal" className="h-16 w-auto object-contain" />
            <div className="font-display text-2xl text-foreground">GOTHAM OS</div>
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
                <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="GH-XXXX" required
                  className="w-full h-11 rounded-md border border-border bg-card px-3 text-sm tracking-widest font-mono focus:border-[var(--color-gold)] outline-none" />
                <div className="mt-1 text-xs text-muted-foreground">Get a code from your manager. Required to join.</div>
              </Field>
            )}
            <button disabled={busy} type="submit"
              className="w-full h-11 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] font-semibold text-sm disabled:opacity-60">
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
            {needsVerify && (
              <div className="mt-2 rounded-md border border-border bg-card p-3 text-xs">
                <div className="text-foreground font-semibold">Verify your email</div>
                <div className="mt-1 text-muted-foreground">
                  We sent a verification link to <span className="text-foreground">{needsVerify}</span>. Click it, then sign in.
                </div>
                <button type="button" onClick={resendVerification} disabled={busy}
                  className="mt-2 text-[var(--color-gold)] font-semibold disabled:opacity-60">
                  Resend verification email
                </button>
              </div>
            )}
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
