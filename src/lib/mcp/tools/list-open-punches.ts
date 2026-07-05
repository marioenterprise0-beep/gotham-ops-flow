import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "list_open_punches",
  title: "List open time punches",
  description:
    "List employees who are currently clocked in (no clock-out yet). Includes their clock-in time and elapsed minutes.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { supabaseForUser } = await import("../supabase-user-client");
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("time_punches")
      .select("id, employee_id, clock_in_at, break_minutes, trailer_id, status")
      .is("clock_out_at", null)
      .is("archived_at", null)
      .order("clock_in_at");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const ids = Array.from(new Set((data ?? []).map((p) => p.employee_id)));
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      for (const p of profs ?? []) names.set(p.id, p.display_name);
    }
    const now = Date.now();
    const rows = (data ?? []).map((p) => ({
      punch_id: p.id,
      employee_id: p.employee_id,
      employee_name: names.get(p.employee_id) ?? null,
      clock_in_at: p.clock_in_at,
      break_minutes: p.break_minutes,
      elapsed_minutes: Math.max(
        0,
        Math.floor((now - new Date(p.clock_in_at).getTime()) / 60000) - (p.break_minutes ?? 0),
      ),
      trailer_id: p.trailer_id,
      status: p.status,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, open_punches: rows },
    };
  },
});
