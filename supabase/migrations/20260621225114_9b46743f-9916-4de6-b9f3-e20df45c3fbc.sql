CREATE TABLE public.handbook_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number integer NOT NULL,
  part_title text NOT NULL,
  section_number integer NOT NULL,
  section_title text NOT NULL,
  body_blocks jsonb NOT NULL,
  is_policy boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX handbook_sections_order_idx ON public.handbook_sections(display_order);
CREATE INDEX handbook_sections_policy_idx ON public.handbook_sections(is_policy);

GRANT SELECT ON public.handbook_sections TO authenticated;
GRANT ALL ON public.handbook_sections TO service_role;
ALTER TABLE public.handbook_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "handbook_sections read all" ON public.handbook_sections
  FOR SELECT TO authenticated USING (true);