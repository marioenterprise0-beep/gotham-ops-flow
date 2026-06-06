
-- Drawers (named cash drawers per trailer)
CREATE TABLE public.cash_drawers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trailer_id uuid NOT NULL,
  name text NOT NULL,
  starting_float numeric NOT NULL DEFAULT 150,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trailer_id, name)
);
GRANT SELECT, INSERT, UPDATE ON public.cash_drawers TO authenticated;
GRANT ALL ON public.cash_drawers TO service_role;
ALTER TABLE public.cash_drawers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_drawers read scoped" ON public.cash_drawers FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer());
CREATE POLICY "cash_drawers write" ON public.cash_drawers FOR INSERT TO authenticated
  WITH CHECK (is_manager(auth.uid()) OR trailer_id = current_user_trailer());
CREATE POLICY "cash_drawers update" ON public.cash_drawers FOR UPDATE TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer())
  WITH CHECK (is_manager(auth.uid()) OR trailer_id = current_user_trailer());

-- Sessions (drawer open/close cycles)
CREATE TYPE public.cash_session_status AS ENUM ('open','pending','closed');
CREATE TYPE public.cash_verification AS ENUM ('self','requested','verified');
CREATE TYPE public.cash_owner_review AS ENUM ('pending','approved','correction','flagged');

CREATE TABLE public.cash_drawer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawer_id uuid NOT NULL REFERENCES public.cash_drawers(id) ON DELETE CASCADE,
  trailer_id uuid NOT NULL,
  status public.cash_session_status NOT NULL DEFAULT 'open',
  starting_float numeric NOT NULL DEFAULT 0,
  total_cash_sales numeric,
  counted_amount numeric,
  expected_amount numeric,
  variance numeric,
  variance_reason text,
  verification public.cash_verification NOT NULL DEFAULT 'self',
  owner_review public.cash_owner_review NOT NULL DEFAULT 'pending',
  owner_note text,
  owner_reviewed_by uuid,
  owner_reviewed_at timestamptz,
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cash_drawer_sessions TO authenticated;
GRANT ALL ON public.cash_drawer_sessions TO service_role;
ALTER TABLE public.cash_drawer_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_sessions read scoped" ON public.cash_drawer_sessions FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer());
CREATE POLICY "cash_sessions insert" ON public.cash_drawer_sessions FOR INSERT TO authenticated
  WITH CHECK (opened_by = auth.uid() AND (is_manager(auth.uid()) OR trailer_id = current_user_trailer()));
CREATE POLICY "cash_sessions update" ON public.cash_drawer_sessions FOR UPDATE TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer())
  WITH CHECK (is_manager(auth.uid()) OR trailer_id = current_user_trailer());

-- Drops
CREATE TABLE public.cash_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cash_drawer_sessions(id) ON DELETE CASCADE,
  drawer_id uuid NOT NULL,
  trailer_id uuid NOT NULL,
  drop_code text NOT NULL UNIQUE,
  amount numeric NOT NULL CHECK (amount > 0),
  reason text,
  notes text,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cash_drops TO authenticated;
GRANT ALL ON public.cash_drops TO service_role;
ALTER TABLE public.cash_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_drops read scoped" ON public.cash_drops FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR trailer_id = current_user_trailer());
CREATE POLICY "cash_drops insert" ON public.cash_drops FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND (is_manager(auth.uid()) OR trailer_id = current_user_trailer()));
CREATE POLICY "cash_drops update mgr" ON public.cash_drops FOR UPDATE TO authenticated
  USING (is_manager(auth.uid()))
  WITH CHECK (is_manager(auth.uid()));

-- touch updated_at triggers
CREATE TRIGGER trg_cash_drawers_touch BEFORE UPDATE ON public.cash_drawers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_cash_sessions_touch BEFORE UPDATE ON public.cash_drawer_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_cash_sessions_drawer ON public.cash_drawer_sessions(drawer_id, status);
CREATE INDEX idx_cash_sessions_trailer ON public.cash_drawer_sessions(trailer_id, opened_at DESC);
CREATE INDEX idx_cash_drops_session ON public.cash_drops(session_id);
