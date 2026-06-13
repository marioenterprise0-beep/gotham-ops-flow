-- Performance indexes for the most frequently queried columns.
-- user_roles(user_id) is hit on every auth-guarded server function.
-- alerts(trailer_id, created_at) is hit on every listAlerts call.
-- tab_permissions(scope_id, tab_key) is hit on every permission resolution.

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_alerts_trailer_created
  ON alerts(trailer_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tab_permissions_scope_tab
  ON tab_permissions(scope_id, tab_key);
