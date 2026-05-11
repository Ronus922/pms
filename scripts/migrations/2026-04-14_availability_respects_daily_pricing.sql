-- ══════════════════════════════════════════════════════════════
-- Migration: check_room_availability() honors room_daily_pricing
-- Date: 2026-04-14
-- Description:
--   Extends the single-source-of-truth availability function to
--   also respect per-day overrides from room_daily_pricing:
--     - is_closed = true             → block the cell
--     - closed_on_arrival = true     → block only if cell is check-in day
--     - closed_on_departure = true   → block only if cell is check-out day
--
--   Backward compatible: all new columns default to FALSE so
--   untouched rooms/dates behave identically to today. This is the
--   ONLY change needed to make the LOCKED reservation flow respect
--   bulk-update closures — no TS changes required.
-- Safe to re-run.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_room_availability(
  p_tenant_id UUID,
  p_room_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_exclude_reservation_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_room_status TEXT;
  v_conflict_count INT;
  v_block_count INT;
  v_closed_count INT;
  v_arrival_closed INT;
  v_departure_closed INT;
BEGIN
  -- 1. Manual room status
  SELECT status INTO v_room_status
  FROM rooms
  WHERE id = p_room_id AND tenant_id = p_tenant_id AND is_active = true;

  IF v_room_status IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_room_status IN ('blocked', 'maintenance', 'unavailable') THEN
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

  -- 3. Date-scoped room blocks (legacy path — unchanged)
  SELECT COUNT(*) INTO v_block_count
  FROM room_blocks
  WHERE room_id = p_room_id
    AND tenant_id = p_tenant_id
    AND block_date >= p_check_in
    AND block_date < p_check_out;

  IF v_block_count > 0 THEN
    RETURN FALSE;
  END IF;

  -- 4. NEW — room_daily_pricing closures
  --    is_closed → blocks any night the stay touches.
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

  --    closed_on_arrival → blocks only if the check-in day has the flag
  SELECT COUNT(*) INTO v_arrival_closed
  FROM room_daily_pricing
  WHERE room_id = p_room_id
    AND tenant_id = p_tenant_id
    AND closed_on_arrival = true
    AND date = p_check_in;

  IF v_arrival_closed > 0 THEN
    RETURN FALSE;
  END IF;

  --    closed_on_departure → blocks only if the check-out day has the flag
  --    (check_out is exclusive, i.e. the last night is check_out - 1 and
  --    the actual departure happens on check_out)
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
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_room_availability IS
  'Single source of truth for room availability. Respects rooms.status, reservation overlap, room_blocks, and room_daily_pricing closure flags.';

SELECT 'MIGRATION_OK' AS result;
