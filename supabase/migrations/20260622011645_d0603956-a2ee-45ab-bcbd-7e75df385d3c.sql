ALTER TABLE public.hr_document_assignments
  ADD COLUMN IF NOT EXISTS category public.hr_doc_category;