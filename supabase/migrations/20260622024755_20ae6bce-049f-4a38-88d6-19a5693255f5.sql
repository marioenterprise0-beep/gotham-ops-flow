ALTER TABLE public.hr_document_assignments
  ADD COLUMN IF NOT EXISTS completed_pdf_path text;