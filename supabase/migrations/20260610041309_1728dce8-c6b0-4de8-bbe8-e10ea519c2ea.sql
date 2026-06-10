ALTER TABLE public.cash_drawer_sessions
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_uploaded_at timestamp with time zone;