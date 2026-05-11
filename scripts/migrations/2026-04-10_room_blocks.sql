-- ══════════════════════════════════════════════════════════════
-- Migration: Room Blocks (date-scoped room closures)
-- Date: 2026-04-10
-- Description: Allows blocking individual rooms on specific dates
--   instead of globally disabling via rooms.status
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS room_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  block_date DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT 'סגור',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, block_date)
);

CREATE INDEX IF NOT EXISTS idx_room_blocks_lookup
  ON room_blocks(tenant_id, room_id, block_date);

-- ── Update check_room_availability to also check room_blocks ──

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
BEGIN
  -- Check room manual status
  SELECT status INTO v_room_status
  FROM rooms
  WHERE id = p_room_id AND tenant_id = p_tenant_id AND is_active = true;

  IF v_room_status IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_room_status IN ('blocked', 'maintenance', 'unavailable') THEN
    RETURN FALSE;
  END IF;

  -- Check date overlap with existing reservations
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

  -- Check date-scoped room blocks
  SELECT COUNT(*) INTO v_block_count
  FROM room_blocks
  WHERE room_id = p_room_id
    AND tenant_id = p_tenant_id
    AND block_date >= p_check_in
    AND block_date < p_check_out;

  IF v_block_count > 0 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE;
