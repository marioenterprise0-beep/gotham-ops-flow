import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listEmployeesTool from "./tools/list-employees";
import listOpenPunchesTool from "./tools/list-open-punches";
import listLowStockTool from "./tools/list-low-stock";
import listActiveAlertsTool from "./tools/list-active-alerts";

// Use the direct Supabase host for the OAuth issuer (see app-mcp-server-authoring).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gotham-os-mcp",
  title: "Dip N Shake OS",
  version: "0.1.0",
  instructions:
    "Read-only tools for Dip N Shake's internal operating system. Use these to look up crew, current time-clock activity, low-stock inventory, and unresolved alerts. Every call runs as the signed-in user; row-level security applies.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listEmployeesTool,
    listOpenPunchesTool,
    listLowStockTool,
    listActiveAlertsTool,
  ],
});
