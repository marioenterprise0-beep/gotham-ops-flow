import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { runIntegritySweep, type IntegrityIssue } from "@/lib/integrity.functions";
import { useRole } from "@/lib/role";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/integrity")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Data Integrity · Dip N Shake OS" }] }),
  component: IntegrityPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
        <div className="text-sm font-medium text-destructive">Could not load Data Integrity</div>
        <div className="text-xs text-muted-foreground mt-1">{String(error?.message ?? error)}</div>
        <button
          onClick={() => reset()}
          className="mt-3 px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-muted/70"
        >
          Retry
        </button>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

const TONE: Record<IntegrityIssue["severity"], "success" | "warning" | "danger" | "info"> = {
  info: "info",
  warning: "warning",
  critical: "danger",
};

function IntegrityPage() {
  const { roleId } = useRole();
  if (roleId !== "owner") return <Navigate to="/" />;

  const sweep = useServerFn(runIntegritySweep);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["integrity-sweep"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) throw new Error("Not signed in");
      return sweep();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="Owner diagnostics"
          title="Data Integrity"
          action={
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-muted hover:bg-muted/70 text-sm"
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
              Run sweep
            </button>
          }
        />
        <p className="text-sm text-muted-foreground -mt-2">
          Continuous cross-model consistency check across schedules, labor, inventory, permissions,
          and users. Auto-refreshes after every mutation.
        </p>

        {isLoading && (
          <Card>
            <div className="p-6 text-muted-foreground">Running sweep…</div>
          </Card>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <div className="p-4">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-2">
                    {data.ok ? (
                      <StatusPill tone="success">All clear</StatusPill>
                    ) : (
                      <StatusPill tone="danger">Issues found</StatusPill>
                    )}
                  </div>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="text-xs text-muted-foreground">Critical</div>
                  <div className="text-2xl font-semibold text-destructive">
                    {data.totals.critical}
                  </div>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="text-xs text-muted-foreground">Warning</div>
                  <div className="text-2xl font-semibold text-amber-500">{data.totals.warning}</div>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <div className="text-xs text-muted-foreground">Last run</div>
                  <div className="text-sm mt-1">
                    {new Date(data.ranAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </div>
                </div>
              </Card>
            </div>

            {data.issues.length === 0 ? (
              <Card>
                <div className="p-8 text-center text-muted-foreground">
                  <ShieldCheck className="size-10 mx-auto mb-3 text-emerald-500" />
                  All cross-model references look consistent.
                </div>
              </Card>
            ) : (
              <Card>
                <div className="divide-y divide-border">
                  {data.issues.map((issue) => (
                    <div key={issue.code} className="p-4 flex items-start gap-4">
                      <AlertTriangle
                        className={`size-5 mt-0.5 ${issue.severity === "critical" ? "text-destructive" : "text-amber-500"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusPill tone={TONE[issue.severity]}>{issue.severity}</StatusPill>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            {issue.category}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <code className="text-xs text-muted-foreground">{issue.code}</code>
                        </div>
                        <div className="mt-1 text-sm">{issue.message}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {issue.count} affected
                          {issue.sampleIds?.length
                            ? ` · sample: ${issue.sampleIds.join(", ")}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
