-- ══════════════════════════════════════════════════════════════
-- Migration: Bulk Room Update + Pricing Plans Foundation
-- Date: 2026-04-14
-- Description:
--   1. room_daily_pricing — per-room, per-date pricing/availability
--   2. bulk_room_update_logs + items — audit trail for bulk operations
--   3. pricing_plans + pricing_plan_rooms — foundation for future
--      seasonal/holiday/weekend pricing (NOT wired to engine yet)
-- Safe to re-run (IF NOT EXISTS everywhere).
-- ══════════════════════════════════════════════════════════════

-- ── 1. Per-day pricing / availability ─────────────────────────

CREATE TABLE IF NOT EXISTS room_daily_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ILS',
  price NUMERIC(12,2),
  min_nights INT,
  max_nights INT,
  min_nights_on_arrival INT,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  closed_on_arrival BOOLEAN NOT NULL DEFAULT false,
  closed_on_departure BOOLEAN NOT NULL DEFAULT false,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id UUID,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, date)
);

CREATE INDEX IF NOT EXISTS idx_room_daily_pricing_tenant_date
  ON room_daily_pricing(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_room_daily_pricing_room_date
  ON room_daily_pricing(room_id, date);

COMMENT ON TABLE room_daily_pricing IS
  'Single source of truth for per-room, per-date pricing and availability overrides. Updated by bulk operations or pricing plans.';

-- ── 2. Bulk update audit log ──────────────────────────────────

CREATE TABLE IF NOT EXISTS bulk_room_update_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  selected_weekdays INT[] NOT NULL DEFAULT ARRAY[]::INT[],
  selected_room_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  changed_fields_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  affected_records INT NOT NULL DEFAULT 0,
  skipped_records INT NOT NULL DEFAULT 0,
  warnings_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  execution_time_ms INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_bulk_room_update_logs_tenant
  ON bulk_room_update_logs(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bulk_room_update_log_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_update_log_id UUID NOT NULL REFERENCES bulk_room_update_logs(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  previous_values_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  new_values_json JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_bulk_room_update_log_items_log
  ON bulk_room_update_log_items(bulk_update_log_id);
CREATE INDEX IF NOT EXISTS idx_bulk_room_update_log_items_room_date
  ON bulk_room_update_log_items(room_id, date);

COMMENT ON TABLE bulk_room_update_logs IS
  'Append-only audit trail for bulk room update operations. Each row describes one user-initiated bulk action.';
COMMENT ON TABLE bulk_room_update_log_items IS
  'Per-room-per-date before/after values for every cell touched by a bulk update. Enables reverse-engineering and rollback.';

-- ── 3. Pricing plans (foundation only) ────────────────────────

CREATE TABLE IF NOT EXISTS pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'manual',
  description TEXT,
  priority INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  valid_from DATE,
  valid_to DATE,
  weekdays INT[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::INT[],
  currency TEXT NOT NULL DEFAULT 'ILS',
  default_price NUMERIC(12,2),
  min_nights INT,
  max_nights INT,
  min_nights_on_arrival INT,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  closed_on_arrival BOOLEAN NOT NULL DEFAULT false,
  closed_on_departure BOOLEAN NOT NULL DEFAULT false,
  applies_to_all_rooms BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_plans_tenant_active
  ON pricing_plans(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_valid_range
  ON pricing_plans(tenant_id, valid_from, valid_to);

CREATE TABLE IF NOT EXISTS pricing_plan_rooms (
  pricing_plan_id UUID NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  PRIMARY KEY (pricing_plan_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_pricing_plan_rooms_room
  ON pricing_plan_rooms(room_id);

COMMENT ON TABLE pricing_plans IS
  'Foundation table for seasons/holidays/weekends/promotions. Engine NOT wired yet (2026-04-14). Used for future priority-resolved pricing overrides.';

-- Done.
SELECT 'MIGRATION_OK' AS result;
