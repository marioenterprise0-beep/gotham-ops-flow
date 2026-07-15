import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_active_alerts",
  title: "List active alerts",
  description:
    "List unresolved alerts in Dip N Shake OS. Optionally cap the result count (default 50, max 200).",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { supabaseForUser } = await import("../supabase-user-client");
    const sb = supabaseForUser(ctx);
    const cap = limit ?? 50;
    const { data, error } = await sb
      .from("alerts")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(cap);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    // Filter to unresolved: prefer explicit resolved_at when present, else return all non-archived.
    const rows = (data ?? []).filter(
      (r: Record<string, unknown>) => !("resolved_at" in r) || r.resolved_at == null,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, alerts: rows },
    };
  },
});
