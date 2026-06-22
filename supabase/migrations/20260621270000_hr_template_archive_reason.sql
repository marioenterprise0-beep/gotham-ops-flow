-- Bring hr_document_templates up to the canonical archive column
-- convention (archived_at, archived_by, archive_reason) so it can join
-- the generic Archive Center / data-integrity sweep, the same way sops
-- already does — not just its own dedicated archive UI.
ALTER TABLE public.hr_document_templates
  ADD COLUMN IF NOT EXISTS archive_reason text;
