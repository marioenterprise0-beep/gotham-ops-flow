// One-shot sync of process.env.ROLLOVER_DISPATCH_KEY into cron_dispatch_config.
// Owner-only. The env value never leaves the worker.
import { createServerFn } from "@tanstack/react-start";
import { requireActiveOrg } from "@/lib/active-org-middleware";
import { requireOwner } from "@/lib/auth-guards";

export const syncRolloverKey = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .handler(async ({ context }) => {
    await requireOwner(context.supabase, context.userId, context.activeOrgId);
    const key = process.env.ROLLOVER_DISPATCH_KEY;
    if (!key) throw new Error("ROLLOVER_DISPATCH_KEY env var is not set on the server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cron_dispatch_config")
      .update({ rollover_key: key, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true, key_length: key.length };
  });
