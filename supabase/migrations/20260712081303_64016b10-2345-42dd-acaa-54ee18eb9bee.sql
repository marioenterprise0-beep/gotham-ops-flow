ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS bg_color text,
  ADD COLUMN IF NOT EXISTS fg_color text,
  ADD COLUMN IF NOT EXISTS accent_color text;