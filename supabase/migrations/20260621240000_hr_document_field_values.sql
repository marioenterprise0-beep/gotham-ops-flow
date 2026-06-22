-- Fill-in-the-blanks support: a key->value map of answers for a document's
-- blank table cells / underscore lines, separate from the immutable
-- body_blocks snapshot (so "what was asked" and "what was answered" stay
-- distinct). Keys are stable positional addresses computed client-side from
-- the assignment's own body_blocks array (e.g. "b3" for a fillable
-- paragraph at index 3, "b7_r2_c1" for a table cell) — see
-- fillHrDocumentFields() and StructuredBlocks.tsx.
--
-- Lock semantics: once a key has a non-empty value, it is permanently
-- locked (enforced in fillHrDocumentFields(), not here) — this is what lets
-- a manager fill in a write-up's details before sending without the
-- employee being able to later edit what the manager wrote.

ALTER TABLE public.hr_document_assignments
  ADD COLUMN IF NOT EXISTS field_values jsonb NOT NULL DEFAULT '{}'::jsonb;
