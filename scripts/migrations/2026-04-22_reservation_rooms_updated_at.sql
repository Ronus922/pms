-- reservation_rooms missed the standard updated_at bookkeeping column that
-- other mutable tables (reservations, rooms, lookup_items, …) carry. The
-- edit flow's updateReservationRooms sets `updated_at = NOW()` on each
-- row write so downstream audit tooling / "recently changed" queries can
-- filter correctly.

ALTER TABLE reservation_rooms
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
