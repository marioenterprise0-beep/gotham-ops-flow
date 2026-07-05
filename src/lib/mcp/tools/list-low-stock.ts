import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "list_low_stock",
  title: "List low-stock inventory",
  description:
    "List active inventory items whose current quantity is at or below their low_threshold. Sorted by shortfall.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { supabaseForUser } = await import("../supabase-user-client");
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("inventory_items")
      .select(
        "id, name, category, unit, current_qty, low_threshold, par_level, preferred_order_qty, vendor, storage_location, trailer_id",
      )
      .is("archived_at", null);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? [])
      .filter((i) => i.current_qty <= i.low_threshold)
      .map((i) => ({ ...i, shortfall: (i.par_level ?? 0) - i.current_qty }))
      .sort((a, b) => b.shortfall - a.shortfall);
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, items: rows },
    };
  },
});
