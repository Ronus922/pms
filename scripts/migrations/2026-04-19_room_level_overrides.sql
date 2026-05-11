-- Per-room overrides for occupancy, bed counts, and guest mix.
--
-- Before this migration, Room Management UI (RoomFormDialog) tried to save
-- max_occupancy / max_adults / max_children / max_infants / *_beds / cribs
-- to the rooms table but the columns did not exist. Every save silently
-- returned an error, and the UI showed hardcoded fallback defaults on load,
-- so the per-room occupancy config the user thought they were setting never
-- reached the database. The reservation form meanwhile read straight from
-- room_types — the two screens disagreed because they were reading
-- different entities.
--
-- Fix: add the columns (nullable). NULL = inherit from room_types. Read
-- paths use COALESCE(rooms.X, room_types.X) so rooms without explicit
-- overrides continue to behave exactly as before.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS max_occupancy INTEGER,
  ADD COLUMN IF NOT EXISTS max_adults    INTEGER,
  ADD COLUMN IF NOT EXISTS max_children  INTEGER,
  ADD COLUMN IF NOT EXISTS max_infants   INTEGER,
  ADD COLUMN IF NOT EXISTS single_beds   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS double_beds   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS queen_beds    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sofa_beds     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cribs         INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN rooms.max_occupancy IS 'Per-room override for room_types.max_occupancy. NULL = inherit from room_types.';
COMMENT ON COLUMN rooms.max_adults    IS 'Per-room override for room_types.max_adults. NULL = inherit from room_types.';
COMMENT ON COLUMN rooms.max_children  IS 'Per-room override for room_types.max_children. NULL = inherit from room_types.';
COMMENT ON COLUMN rooms.max_infants   IS 'Per-room override for room_types.max_infants. NULL = inherit from room_types.';
