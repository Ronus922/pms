-- Replace the per-day room_blocks model with a real date-range operational
-- blocking system. Per-day rows were inefficient (N rows for an N-day window,
-- no end_date concept, no type/notes, no updated_by audit trail) AND the UI
-- could never express a continuous block to the user. This migration adds the
-- missing columns, backfills existing per-day rows into one range per run
-- (optional — we have 0 rows today so it's a no-op), and updates the
-- availability function to use the new columns.
--
-- Target shape:
--   id, tenant_id, room_id,
--   start_date, end_date,                         -- date range [start, end)
--   block_type,                                   -- maintenance / manual_block / owner_use / deep_cleaning / temporary_out_of_order / other
--   reason, notes,
--   is_active,                                    -- cancel without deleting (audit retention)
--   created_by, created_at,
--   updated_by, updated_at

-- 1. Add new columns. Keep legacy `block_date` column for now to honour
--    existing rows; backfill into start/end before we flip the SQL function.
ALTER TABLE room_blocks
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date   DATE,
  ADD COLUMN IF NOT EXISTS block_type TEXT NOT NULL DEFAULT 'manual_block',
  ADD COLUMN IF NOT EXISTS notes      TEXT,
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Backfill any existing per-day rows into single-day ranges so the new
--    availability query still respects them. Unique-constraint on (room_id,
--    block_date) ensures we don't double-backfill. Safe because 0 rows
--    exist today; kept in case this migration is re-run against seeded data.
UPDATE room_blocks
   SET start_date = block_date,
       end_date   = block_date + INTERVAL '1 day'
 WHERE block_date IS NOT NULL
   AND (start_date IS NULL OR end_date IS NULL);

-- 3. Enforce the new invariants now that data is populated.
ALTER TABLE room_blocks
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date   SET NOT NULL;

-- 4. Type constraint — keep writer side honest. Schema-level CHECK so we
--    never accept a freeform string from a buggy action.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'room_blocks_block_type_check'
  ) THEN
    ALTER TABLE room_blocks
      ADD CONSTRAINT room_blocks_block_type_check CHECK (
        block_type IN (
          'maintenance', 'manual_block', 'owner_use',
          'deep_cleaning', 'temporary_out_of_order', 'other'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'room_blocks_date_range_check'
  ) THEN
    ALTER TABLE room_blocks
      ADD CONSTRAINT room_blocks_date_range_check CHECK (end_date > start_date);
  END IF;
END $$;

-- 5. The old UNIQUE (room_id, block_date) constraint no longer makes sense
--    for ranges. Drop it; overlap prevention is enforced in the server
--    action (it's allowed to have two non-overlapping blocks per room).
ALTER TABLE room_blocks
  DROP CONSTRAINT IF EXISTS room_blocks_room_id_block_date_key;

-- 6. Lookup index for availability joins.
CREATE INDEX IF NOT EXISTS idx_room_blocks_room_range
  ON room_blocks (tenant_id, room_id, start_date, end_date)
  WHERE is_active = TRUE;

-- 7. Rewrite check_room_availability to use the date-range model.
--    Order of checks (per the module spec):
--       1. rooms.status:
--          - inactive / out_of_order / blocked / maintenance / unavailable → reject
--       2. Date overlap with confirmed/checked_in reservations → reject
--       3. Active room_blocks overlapping the range → reject
--       4. Daily pricing closures (closed / closed_on_arrival / closed_on_departure)
CREATE OR REPLACE FUNCTION check_room_availability(
  p_tenant_id UUID,
  p_room_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_exclude_reservation_id UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_room_status TEXT;
  v_conflict_count INT;
  v_block_count INT;
  v_closed_count INT;
  v_arrival_closed INT;
  v_departure_closed INT;
BEGIN
  -- 1. Manual room status. `blocked` / `maintenance` / `unavailable` are
  --    legacy values still seen in production; `inactive` / `out_of_order`
  --    are the new permanent-state values. Any of them blocks availability.
  SELECT status INTO v_room_status
  FROM rooms
  WHERE id = p_room_id AND tenant_id = p_tenant_id AND is_active = true;

  IF v_room_status IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_room_status IN ('blocked', 'maintenance', 'unavailable', 'inactive', 'out_of_order') THEN
    RETURN FALSE;
  END IF;

  -- 2. Date overlap with confirmed/checked_in reservations
  SELECT COUNT(*) INTO v_conflict_count
  FROM reservation_rooms rr
  JOIN reservations res ON res.id = rr.reservation_id
  WHERE rr.room_id = p_room_id
    AND res.tenant_id = p_tenant_id
    AND res.status IN ('confirmed', 'checked_in')
    AND rr.check_in < p_check_out
    AND rr.check_out > p_check_in
    AND (p_exclude_reservation_id IS NULL OR res.id != p_exclude_reservation_id);

  IF v_conflict_count > 0 THEN
    RETURN FALSE;
  END IF;

  -- 3. Active room_blocks overlap (the date-range model). Only active
  --    blocks count — cancelled blocks stay in the table for audit.
  SELECT COUNT(*) INTO v_block_count
  FROM room_blocks
  WHERE room_id = p_room_id
    AND tenant_id = p_tenant_id
    AND is_active = TRUE
    AND start_date < p_check_out
    AND end_date > p_check_in;

  IF v_block_count > 0 THEN
    RETURN FALSE;
  END IF;

  -- 4. Daily-pricing closures
  SELECT COUNT(*) INTO v_closed_count
  FROM room_daily_pricing
  WHERE room_id = p_room_id
    AND tenant_id = p_tenant_id
    AND is_closed = true
    AND date >= p_check_in
    AND date < p_check_out;

  IF v_closed_count > 0 THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO v_arrival_closed
  FROM room_daily_pricing
  WHERE room_id = p_room_id
    AND tenant_id = p_tenant_id
    AND closed_on_arrival = true
    AND date = p_check_in;

  IF v_arrival_closed > 0 THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO v_departure_closed
  FROM room_daily_pricing
  WHERE room_id = p_room_id
    AND tenant_id = p_tenant_id
    AND closed_on_departure = true
    AND date = p_check_out;

  IF v_departure_closed > 0 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;
