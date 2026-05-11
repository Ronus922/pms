-- ─────────────────────────────────────────────────────────────
-- 2026-04-10 — Room Availability Function + Email + Card Fields
-- ─────────────────────────────────────────────────────────────
-- Safe to re-run (all statements use IF NOT EXISTS / OR REPLACE).
-- ─────────────────────────────────────────────────────────────

-- 1. check_room_availability — single source of truth
--    Returns TRUE if room is bookable for the given date range.
--    Excludes overlapping confirmed/checked_in reservations.
--    Optional p_exclude_reservation_id to allow editing existing reservation.
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
BEGIN
  -- Check room manual status
  SELECT status INTO v_room_status
  FROM rooms
  WHERE id = p_room_id AND tenant_id = p_tenant_id AND is_active = true;

  IF v_room_status IS NULL THEN
    RETURN FALSE; -- room not found or inactive
  END IF;

  IF v_room_status IN ('blocked', 'maintenance', 'unavailable') THEN
    RETURN FALSE;
  END IF;

  -- Check date overlap with existing reservations
  -- Overlap condition: rr.check_in < p_check_out AND rr.check_out > p_check_in
  SELECT COUNT(*) INTO v_conflict_count
  FROM reservation_rooms rr
  JOIN reservations res ON res.id = rr.reservation_id
  WHERE rr.room_id = p_room_id
    AND res.tenant_id = p_tenant_id
    AND res.status IN ('confirmed', 'checked_in')
    AND rr.check_in < p_check_out
    AND rr.check_out > p_check_in
    AND (p_exclude_reservation_id IS NULL OR res.id != p_exclude_reservation_id);

  RETURN v_conflict_count = 0;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. notification_email on tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS notification_email TEXT;

-- 3. card_holder_id on reservations
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS card_holder_id TEXT;

-- Done.
SELECT 'MIGRATION_OK' AS result;
