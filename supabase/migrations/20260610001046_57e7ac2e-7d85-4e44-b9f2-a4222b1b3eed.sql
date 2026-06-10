ALTER TABLE public.inventory_orders
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_inventory_orders_archived_at ON public.inventory_orders(archived_at);

ALTER TABLE public.inventory_order_items
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_inventory_order_items_archived_at ON public.inventory_order_items(archived_at);

ALTER TABLE public.inventory_receipts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_inventory_receipts_archived_at ON public.inventory_receipts(archived_at);

ALTER TABLE public.inventory_change_requests
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason text;
CREATE INDEX IF NOT EXISTS idx_inventory_change_requests_archived_at ON public.inventory_change_requests(archived_at);