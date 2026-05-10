-- ============================================================
-- MIGRATION: Areas Module + Housekeeping Target Extension
-- Date: 2026-04-11
-- Description:
--   1. Create `areas` table for non-room operational spaces
--   2. Extend housekeeping_tasks with target_type support
--   3. Seed area_type lookup items
-- ============================================================

-- ------------------------------------------------------------
-- 1. AREAS TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS areas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  property_id           UUID NOT NULL,
  name                  TEXT NOT NULL,
  code                  TEXT NOT NULL DEFAULT '',
  area_type             TEXT NOT NULL,
  building_id           UUID REFERENCES buildings(id),
  floor_id              UUID REFERENCES floors(id),
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  cleaning_relevant     BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_relevant  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INT NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_areas_tenant ON areas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_areas_building ON areas(building_id);
CREATE INDEX IF NOT EXISTS idx_areas_floor ON areas(floor_id);
CREATE INDEX IF NOT EXISTS idx_areas_type ON areas(tenant_id, area_type);

-- ------------------------------------------------------------
-- 2. HOUSEKEEPING TARGET TYPE EXTENSION
-- ------------------------------------------------------------
ALTER TABLE housekeeping_tasks
  ADD COLUMN IF NOT EXISTS target_type  TEXT NOT NULL DEFAULT 'room',
  ADD COLUMN IF NOT EXISTS target_id    UUID,
  ADD COLUMN IF NOT EXISTS target_label TEXT;

-- Allow NULL room_id for area-based tasks
ALTER TABLE housekeeping_tasks ALTER COLUMN room_id DROP NOT NULL;

-- Backfill existing rows: target_id = room_id, target_label from rooms table
UPDATE housekeeping_tasks hk
SET target_id    = hk.room_id,
    target_label = r.room_number
FROM rooms r
WHERE r.id = hk.room_id
  AND hk.target_type = 'room'
  AND hk.target_id IS NULL;

-- ------------------------------------------------------------
-- 3. SEED AREA TYPE LOOKUP ITEMS
-- Per-tenant seed: for each existing tenant, insert area_type values.
-- Uses ON CONFLICT to be idempotent.
-- ------------------------------------------------------------
INSERT INTO lookup_categories (id, label, sort_order)
VALUES ('area_type', 'סוגי אזורים', 20)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lookup_items (tenant_id, category, value, label, icon, sort_order, is_active)
SELECT t.id, 'area_type', v.value, v.label, v.icon, v.sort_order, true
FROM tenants t
CROSS JOIN (VALUES
  ('lobby',          'לובי',           'door_front',    0),
  ('elevator',       'מעלית',          'elevator',      1),
  ('entrance',       'מבואה',          'meeting_room',  2),
  ('corridor',       'מסדרון',         'hallway',       3),
  ('stairwell',      'חדר מדרגות',     'stairs',        4),
  ('parking',        'חניה',           'local_parking', 5),
  ('storage',        'מחסן',           'warehouse',     6),
  ('roof',           'גג',             'roofing',       7),
  ('garden',         'גינה',           'yard',          8),
  ('office',         'משרד',           'work',          9),
  ('technical_room', 'חדר טכני',       'construction', 10),
  ('other',          'אחר',            'more_horiz',   11)
) AS v(value, label, icon, sort_order)
ON CONFLICT (tenant_id, category, value) DO NOTHING;
