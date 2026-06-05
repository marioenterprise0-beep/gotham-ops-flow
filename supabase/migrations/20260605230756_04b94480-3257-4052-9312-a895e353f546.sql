
-- Trailers
CREATE TABLE public.trailers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trailers TO authenticated;
GRANT ALL ON public.trailers TO service_role;
ALTER TABLE public.trailers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trailers read" ON public.trailers FOR SELECT TO authenticated USING (true);
CREATE POLICY "trailers manage" ON public.trailers FOR ALL TO authenticated USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));

INSERT INTO public.trailers (name, location) VALUES ('Main Trailer', 'Primary location');

-- Access log
CREATE TABLE public.access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event text NOT NULL,
  ip text,
  user_agent text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.access_log TO authenticated;
GRANT ALL ON public.access_log TO service_role;
ALTER TABLE public.access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "access_log managers read" ON public.access_log FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "access_log self read" ON public.access_log FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "access_log self insert" ON public.access_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Extend invite_codes
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS trailer_id uuid REFERENCES public.trailers(id),
  ADD COLUMN IF NOT EXISTS expires_hours integer,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

-- Allow managers to delete invites
DROP POLICY IF EXISTS "invite_codes managers delete" ON public.invite_codes;
CREATE POLICY "invite_codes managers delete" ON public.invite_codes FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));

-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trailer_id uuid REFERENCES public.trailers(id),
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS sop_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS training_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Default new profiles to main trailer
UPDATE public.profiles SET trailer_id = (SELECT id FROM public.trailers ORDER BY created_at LIMIT 1) WHERE trailer_id IS NULL;

-- Update handle_new_user to assign default trailer and record access log
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_default_store uuid;
  v_default_trailer uuid;
  v_code text;
  v_invite_id uuid;
  v_role app_role;
  v_trailer uuid;
begin
  v_code := upper(coalesce(new.raw_user_meta_data->>'invite_code', ''));

  if v_code = '' then
    raise exception 'invite_code_required';
  end if;

  select id, role, trailer_id into v_invite_id, v_role, v_trailer
    from public.invite_codes
    where upper(code) = v_code
      and used_by is null
      and disabled_at is null
      and expires_at > now()
    for update;

  if v_invite_id is null then
    raise exception 'invalid_or_expired_invite_code';
  end if;

  select id into v_default_store from public.stores order by created_at asc limit 1;
  select id into v_default_trailer from public.trailers order by created_at asc limit 1;

  insert into public.profiles (id, display_name, store_id, trailer_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    v_default_store,
    coalesce(v_trailer, v_default_trailer)
  );

  insert into public.user_roles (user_id, role) values (new.id, v_role);

  update public.invite_codes
    set used_by = new.id, used_at = now()
    where id = v_invite_id;

  insert into public.access_log (user_id, event, payload)
  values (new.id, 'invite_used', jsonb_build_object('invite_id', v_invite_id, 'role', v_role));

  return new;
end;
$function$;
