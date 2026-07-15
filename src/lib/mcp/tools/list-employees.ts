import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_employees",
  title: "List employees",
  description:
    "List crew members with their display name, email, active status, and assigned roles.",
  inputSchema: {
    includeInactive: z
      .boolean()
      .optional()
      .describe("If true, include archived/inactive profiles. Defaults to false."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ includeInactive }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { supabaseForUser } = await import("../supabase-user-client");
    const sb = supabaseForUser(ctx);
    let q = sb.from("profiles").select("id, display_name, email, active").order("display_name");
    if (!includeInactive) q = q.eq("active", true);
    const { data: profiles, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const { data: rolesRows } = await sb.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string[]>();
    for (const r of rolesRows ?? []) {
      const list = roleMap.get(r.user_id) ?? [];
      list.push(r.role);
      roleMap.set(r.user_id, list);
    }
    const rows = (profiles ?? []).map((p) => ({
      id: p.id,
      display_name: p.display_name,
      email: p.email,
      active: p.active,
      roles: roleMap.get(p.id) ?? [],
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, employees: rows },
    };
  },
});
