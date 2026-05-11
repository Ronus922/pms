-- Per-room composition + guest contact on reservation_rooms.
-- check_in / check_out columns already exist on this table (see 2026-04-10
-- availability migration); they were not being written with per-room values
-- before. From this migration on, every reservation_rooms row carries its own
-- dates, composition and guest contact — allowing a single reservation to mix
-- different date spans and guest groups across rooms.

ALTER TABLE reservation_rooms
  ADD COLUMN IF NOT EXISTS adults           INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS children         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS infants          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guest_first_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_last_name  TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone      TEXT,
  ADD COLUMN IF NOT EXISTS guest_email      TEXT,
  ADD COLUMN IF NOT EXISTS guest_id_number  TEXT;

-- Backfill existing rows from the parent reservation + its guest so downstream
-- reads (edit flow, reports) see consistent per-row values rather than defaults.
UPDATE reservation_rooms rr
SET adults           = COALESCE(r.adults, 1),
    children         = COALESCE(r.children, 0),
    infants          = COALESCE(r.infants, 0),
    guest_first_name = COALESCE(rr.guest_first_name, g.first_name),
    guest_last_name  = COALESCE(rr.guest_last_name,  g.last_name),
    guest_phone      = COALESCE(rr.guest_phone,      g.phone),
    guest_email      = COALESCE(rr.guest_email,      g.email),
    guest_id_number  = COALESCE(rr.guest_id_number,  g.id_number)
FROM reservations r
LEFT JOIN guests g ON g.id = r.guest_id
WHERE rr.reservation_id = r.id;
