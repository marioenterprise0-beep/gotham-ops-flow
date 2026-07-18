import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveOrg } from "@/lib/active-org-middleware";

// Example createServerFn. Authenticated greet; returns no server config to
// avoid leaking environment info to anonymous callers.
export const getGreeting = createServerFn({ method: "POST" })
  .middleware([requireActiveOrg])
  .inputValidator(z.object({ name: z.string().min(1) }))
  .handler(async ({ data }) => {
    return { greeting: `Hello, ${data.name}!` };
  });
