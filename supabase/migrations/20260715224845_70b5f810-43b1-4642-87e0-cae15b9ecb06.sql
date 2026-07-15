CREATE TYPE public.org_billing_status AS ENUM (
  'trialing',
  'trial_expired',
  'active',
  'past_due_locked',
  'suspended',
  'cancelled'
);

ALTER TABLE public.organizations
  ADD COLUMN status public.org_billing_status NOT NULL DEFAULT 'trialing',
  ADD COLUMN trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days');

UPDATE public.organizations
   SET status = 'trialing',
       trial_ends_at = now() + interval '14 days'
 WHERE trial_ends_at < now();