-- Snapshot the template's category onto the assignment (same immutability
-- rationale as title/body_blocks) so the client can decide whether blanks
-- should be fillable at all: "training" documents are reference/instructional
-- material (e.g. a Cash Handling Guide's example denomination table) and
-- should stay read-only — only "hr"/"onboarding" documents are genuinely
-- meant to capture real per-instance data through this flow.
ALTER TABLE public.hr_document_assignments
  ADD COLUMN IF NOT EXISTS category public.hr_doc_category;
