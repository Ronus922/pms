-- ─────────────────────────────────────────────────────────────
-- 2026-04-09 — Cleaning Tasks + Derived Room Status
-- ─────────────────────────────────────────────────────────────
-- Safe to re-run (all statements use IF NOT EXISTS / ON CONFLICT).
-- Extends the existing housekeeping_tasks table with columns needed
-- for the cleaning board, and adds rooms.cleaning_state.
-- ─────────────────────────────────────────────────────────────

-- 1. rooms.cleaning_state — separate from rooms.status
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS cleaning_state TEXT NOT NULL DEFAULT 'clean';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'rooms_cleaning_state_check'
  ) THEN
    ALTER TABLE rooms
      ADD CONSTRAINT rooms_cleaning_state_check
      CHECK (cleaning_state IN ('clean','dirty','in_progress'));
  END IF;
END $$;

-- Backfill: anything previously 'waiting_for_cleaning' → dirty + flip status to available
UPDATE rooms
SET cleaning_state = 'dirty', status = 'available'
WHERE status = 'waiting_for_cleaning';

-- Anything previously 'being_cleaned' → in_progress + available
UPDATE rooms
SET cleaning_state = 'in_progress', status = 'available'
WHERE status = 'being_cleaned';

-- 2. housekeeping_tasks — add missing columns
ALTER TABLE housekeeping_tasks
  ADD COLUMN IF NOT EXISTS reservation_room_id UUID REFERENCES reservation_rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkin_date DATE,
  ADD COLUMN IF NOT EXISTS checkout_date DATE,
  ADD COLUMN IF NOT EXISTS checkout_time TIME,
  ADD COLUMN IF NOT EXISTS order_index INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_trigger TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- source_trigger constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'housekeeping_tasks_source_trigger_check'
  ) THEN
    ALTER TABLE housekeeping_tasks
      ADD CONSTRAINT housekeeping_tasks_source_trigger_check
      CHECK (source_trigger IS NULL OR source_trigger IN ('manual_checkout','scheduled_checkout_day','manager_manual'));
  END IF;
END $$;

-- status constraint (pending / in_progress / done / skipped)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'housekeeping_tasks_status_check'
  ) THEN
    ALTER TABLE housekeeping_tasks
      ADD CONSTRAINT housekeeping_tasks_status_check
      CHECK (status IN ('pending','in_progress','done','skipped'));
  END IF;
END $$;

-- Duplicate prevention: one auto task per (reservation_room_id, checkout_date)
-- Only constrains auto sources; manager_manual entries are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hk_tasks_auto
  ON housekeeping_tasks (reservation_room_id, checkout_date)
  WHERE source_trigger IN ('manual_checkout','scheduled_checkout_day');

-- Index for cleaner queue reads
CREATE INDEX IF NOT EXISTS idx_hk_cleaner_queue
  ON housekeeping_tasks (tenant_id, assigned_to, order_index)
  WHERE status IN ('pending','in_progress');

-- Index for manager board reads by date
CREATE INDEX IF NOT EXISTS idx_hk_checkout_date
  ON housekeeping_tasks (tenant_id, checkout_date);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_hk_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hk_updated_at ON housekeeping_tasks;
CREATE TRIGGER trg_hk_updated_at
  BEFORE UPDATE ON housekeeping_tasks
  FOR EACH ROW EXECUTE FUNCTION set_hk_updated_at();

-- Done.
SELECT 'MIGRATION_OK' AS result;
