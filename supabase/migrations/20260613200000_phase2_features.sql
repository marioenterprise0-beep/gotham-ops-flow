-- Phase 2 features: food cost, prep log, shift swaps

-- Feature 3: Food cost per unit on inventory items (column may already exist)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(10,4) DEFAULT 0;

-- Feature 5: Prep & Production Log
CREATE TABLE IF NOT EXISTS prep_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logged_by   UUID NOT NULL REFERENCES profiles(id),
  trailer_id  UUID REFERENCES trailers(id),
  shift_id    UUID REFERENCES shifts(id),
  item_name   TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  quantity    NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit        TEXT NOT NULL DEFAULT 'units',
  notes       TEXT,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_prep_log_trailer_date ON prep_log(trailer_id, logged_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prep_log_logged_by    ON prep_log(logged_by);

-- Feature 8: Shift swap requests
CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id        UUID NOT NULL REFERENCES profiles(id),
  target_employee_id  UUID REFERENCES profiles(id),
  schedule_shift_id   UUID NOT NULL REFERENCES schedule_shifts(id),
  trailer_id          UUID REFERENCES trailers(id),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','accepted','declined','approved','cancelled')),
  reason              TEXT,
  decided_by          UUID REFERENCES profiles(id),
  decided_at          TIMESTAMPTZ,
  decision_note       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_swap_req_requester ON shift_swap_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_swap_req_status    ON shift_swap_requests(status) WHERE archived_at IS NULL;
