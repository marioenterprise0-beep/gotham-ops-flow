import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauthNs(): OAuthNs {
  // supabase.auth.oauth is beta; TS types may not include it yet.
  return (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthNs().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-8 text-sm text-muted-foreground">
      Could not load this authorization request: {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as any;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const ns = oauthNs();
    const { data, error } = approve
      ? await ns.approveAuthorization(authorization_id)
      : await ns.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an application";

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="label-caps text-muted-foreground">Authorize access</div>
        <h1 className="font-display text-2xl mt-1">Connect {clientName} to Dip N Shake OS</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {clientName} is asking to act on your behalf using Dip N Shake OS's agent tools.
          It will see the same data your account can see (row-level security still applies).
        </p>
        {error && (
          <div role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        )}
        <div className="mt-6 flex gap-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 h-11 rounded-md bg-[var(--color-gold)] text-[#0A0A0A] font-semibold text-sm disabled:opacity-60"
          >
            {busy ? "Working…" : "Approve"}
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 h-11 rounded-md border border-border text-sm font-semibold disabled:opacity-60"
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
