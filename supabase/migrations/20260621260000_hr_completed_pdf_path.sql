-- Storage path of the generated completed-record PDF (one per assignment,
-- generated client-side when the final signature lands — see
-- src/lib/hr-document-pdf.ts and notifyHrDocumentCompletion()). Nullable:
-- only set once an assignment is fully signed.
ALTER TABLE public.hr_document_assignments
  ADD COLUMN IF NOT EXISTS completed_pdf_path text;
