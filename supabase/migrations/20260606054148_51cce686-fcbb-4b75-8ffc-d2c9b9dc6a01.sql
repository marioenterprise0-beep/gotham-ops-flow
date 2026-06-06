
-- Enums
CREATE TYPE public.inventory_order_status AS ENUM ('draft','submitted','pending_owner_review','approved','declined','changes_requested','ordered','received','cancelled');
CREATE TYPE public.inventory_order_urgency AS ENUM ('normal','needed_soon','critical','emergency');
CREATE TYPE public.alert_type AS ENUM ('missed_clock_out','missed_clock_in','time_adjustment','time_off','inventory_order','low_stock','critical_stock','checklist_failure','manager_note','schedule_approval','maintenance');
CREATE TYPE public.alert_priority AS ENUM ('critical','high','normal','low');
CREATE TYPE public.alert_status AS ENUM ('open','pending','approved','declined','resolved');
CREATE TYPE public.alert_assigned_role AS ENUM ('manager','owner');
CREATE TYPE public.alert_action_kind AS ENUM ('comment','approve','decline','request_changes','mark_ordered','mark_received','escalate','resolve','review');

-- Inventory orders
CREATE TABLE public.inventory_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trailer_id uuid,
  created_by uuid NOT NULL,
  status public.inventory_order_status NOT NULL DEFAULT 'draft',
  notes text,
  submitted_at timestamptz,
  decided_by uuid,
  decided_at timestamptz,
  owner_comment text,
  ordered_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_orders TO authenticated;
GRANT ALL ON public.inventory_orders TO service_role;
ALTER TABLE public.inventory_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders read scoped" ON public.inventory_orders FOR SELECT TO authenticated
  USING (is_manager(auth.uid()) OR created_by = auth.uid() OR trailer_id = current_user_trailer());
CREATE POLICY "orders insert self" ON public.inventory_orders FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "orders update" ON public.inventory_orders FOR UPDATE TO authenticated
  USING (
    (created_by = auth.uid() AND status IN ('draft','submitted'))
    OR (is_manager(auth.uid()) AND created_by <> auth.uid())
    OR has_role(auth.uid(),'owner'::app_role)
  )
  WITH CHECK (
    (created_by = auth.uid() AND status IN ('draft','submitted','cancelled'))
    OR (is_manager(auth.uid()) AND created_by <> auth.uid())
    OR has_role(auth.uid(),'owner'::app_role)
  );
CREATE TRIGGER trg_inv_orders_updated BEFORE UPDATE ON public.inventory_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Inventory order items
CREATE TABLE public.inventory_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.inventory_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id),
  item_name text NOT NULL,
  category text,
  unit text,
  current_qty numeric NOT NULL DEFAULT 0,
  par_qty numeric NOT NULL DEFAULT 0,
  requested_qty numeric NOT NULL,
  urgency public.inventory_order_urgency NOT NULL DEFAULT 'normal',
  reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_order_items TO authenticated;
GRANT ALL ON public.inventory_order_items TO service_role;
ALTER TABLE public.inventory_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order items read via order" ON public.inventory_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventory_orders o WHERE o.id = order_id
    AND (is_manager(auth.uid()) OR o.created_by = auth.uid() OR o.trailer_id = current_user_trailer())));
CREATE POLICY "order items write via order" ON public.inventory_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventory_orders o WHERE o.id = order_id
    AND (o.created_by = auth.uid() OR is_manager(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.inventory_orders o WHERE o.id = order_id
    AND (o.created_by = auth.uid() OR is_manager(auth.uid()))));

-- Alerts
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.alert_type NOT NULL,
  title text NOT NULL,
  description text,
  source_module text NOT NULL,
  source_id uuid,
  trailer_id uuid,
  created_by uuid,
  assigned_role public.alert_assigned_role NOT NULL DEFAULT 'manager',
  priority public.alert_priority NOT NULL DEFAULT 'normal',
  status public.alert_status NOT NULL DEFAULT 'open',
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts read scoped" ON public.alerts FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'owner'::app_role)
    OR (is_manager(auth.uid()) AND assigned_role = 'manager')
    OR (assigned_role = 'manager' AND trailer_id = current_user_trailer())
    OR created_by = auth.uid()
  );
CREATE POLICY "alerts insert any auth" ON public.alerts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "alerts update mgr/owner" ON public.alerts FOR UPDATE TO authenticated
  USING (is_manager(auth.uid())) WITH CHECK (is_manager(auth.uid()));
CREATE TRIGGER trg_alerts_updated BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Alert actions (audit trail)
CREATE TABLE public.alert_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  action public.alert_action_kind NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.alert_actions TO authenticated;
GRANT ALL ON public.alert_actions TO service_role;
ALTER TABLE public.alert_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert actions read via alert" ON public.alert_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = alert_id));
CREATE POLICY "alert actions insert self" ON public.alert_actions FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- Trigger: when inventory_order is submitted, create an owner alert
CREATE OR REPLACE FUNCTION public.emit_inventory_order_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int;
  v_critical int;
  v_trailer_name text;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS DISTINCT FROM 'submitted') THEN
    SELECT count(*), count(*) FILTER (WHERE urgency IN ('critical','emergency'))
      INTO v_count, v_critical FROM public.inventory_order_items WHERE order_id = NEW.id;
    SELECT name INTO v_trailer_name FROM public.trailers WHERE id = NEW.trailer_id;
    INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id, created_by, assigned_role, priority, status, payload)
    VALUES (
      'inventory_order',
      'Inventory Order Submitted — ' || COALESCE(v_trailer_name,'Trailer'),
      v_count || ' items (' || v_critical || ' critical)',
      'inventory', NEW.id, NEW.trailer_id, NEW.created_by, 'owner',
      CASE WHEN v_critical > 0 THEN 'critical'::alert_priority ELSE 'high'::alert_priority END,
      'pending',
      jsonb_build_object('order_id', NEW.id, 'item_count', v_count, 'critical_count', v_critical)
    );
    NEW.submitted_at := now();
    NEW.status := 'pending_owner_review';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_emit_inventory_order_alert
  BEFORE UPDATE ON public.inventory_orders
  FOR EACH ROW EXECUTE FUNCTION public.emit_inventory_order_alert();

-- Same for insert (manager creates already-submitted order in one shot)
CREATE OR REPLACE FUNCTION public.emit_inventory_order_alert_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trailer_name text;
BEGIN
  IF NEW.status = 'submitted' THEN
    NEW.status := 'pending_owner_review';
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_inv_order_insert_normalize
  BEFORE INSERT ON public.inventory_orders
  FOR EACH ROW EXECUTE FUNCTION public.emit_inventory_order_alert_insert();

-- After items inserted, emit alert if order is pending_owner_review and no alert yet
CREATE OR REPLACE FUNCTION public.emit_inventory_order_alert_after_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.inventory_orders%ROWTYPE;
  v_count int; v_critical int; v_trailer_name text;
  v_existing int;
BEGIN
  SELECT * INTO v_order FROM public.inventory_orders WHERE id = NEW.order_id;
  IF v_order.status <> 'pending_owner_review' THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_existing FROM public.alerts WHERE source_id = v_order.id AND type = 'inventory_order';
  IF v_existing > 0 THEN RETURN NEW; END IF;
  SELECT count(*), count(*) FILTER (WHERE urgency IN ('critical','emergency'))
    INTO v_count, v_critical FROM public.inventory_order_items WHERE order_id = v_order.id;
  SELECT name INTO v_trailer_name FROM public.trailers WHERE id = v_order.trailer_id;
  INSERT INTO public.alerts (type, title, description, source_module, source_id, trailer_id, created_by, assigned_role, priority, status, payload)
  VALUES (
    'inventory_order',
    'Inventory Order Submitted — ' || COALESCE(v_trailer_name,'Trailer'),
    v_count || ' items (' || v_critical || ' critical)',
    'inventory', v_order.id, v_order.trailer_id, v_order.created_by, 'owner',
    CASE WHEN v_critical > 0 THEN 'critical'::alert_priority ELSE 'high'::alert_priority END,
    'pending',
    jsonb_build_object('order_id', v_order.id, 'item_count', v_count, 'critical_count', v_critical)
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_emit_inv_alert_after_items
  AFTER INSERT ON public.inventory_order_items
  FOR EACH ROW EXECUTE FUNCTION public.emit_inventory_order_alert_after_items();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_orders;

CREATE INDEX idx_alerts_status ON public.alerts(status);
CREATE INDEX idx_alerts_assigned ON public.alerts(assigned_role, status);
CREATE INDEX idx_inv_order_status ON public.inventory_orders(status);
CREATE INDEX idx_inv_order_items_order ON public.inventory_order_items(order_id);
