import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { HandbookBlock } from "@/lib/handbook.functions";

export type HrDocCategory = "onboarding" | "training" | "hr" | "operations";

export type HrDocumentTemplate = {
  id: string;
  doc_code: string;
  category: HrDocCategory;
  title: string;
  body_blocks: HandbookBlock[];
  signer_roles: string[];
  owner_only: boolean;
  version: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

// RLS on hr_document_templates already hides owner_only (Operations
// category) rows from non-owners — this function just queries; the
// category split is enforced at the database layer, not here.
export const listHrTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ category: z.enum(["onboarding", "training", "hr", "operations"]).optional() }).optional().parse(d ?? {}))
  .handler(async ({ context, data }) => {
    let q = (context.supabase as any)
      .from("hr_document_templates")
      .select("id, doc_code, category, title, body_blocks, signer_roles, owner_only, version, archived_at, created_at, updated_at")
      .is("archived_at", null)
      .order("category", { ascending: true })
      .order("doc_code", { ascending: true });
    if (data?.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as HrDocumentTemplate[];
  });
