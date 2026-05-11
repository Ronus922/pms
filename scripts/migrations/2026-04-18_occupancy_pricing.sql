-- Min-occupancy pricing rule.
--
-- base_price covers `default_occupancy` guests. Each additional guest above
-- default costs `extra_person_price` per night.
--
-- Existing rows are backfilled so default_occupancy = max_occupancy (status quo
-- "no extras"), extra_person_price = 0. Admins edit these in settings later.

ALTER TABLE room_types
  ADD COLUMN IF NOT EXISTS default_occupancy  INTEGER,
  ADD COLUMN IF NOT EXISTS extra_person_price NUMERIC(10,2);

UPDATE room_types
SET default_occupancy  = COALESCE(default_occupancy, max_occupancy, 2),
    extra_person_price = COALESCE(extra_person_price, 0)
WHERE default_occupancy IS NULL OR extra_person_price IS NULL;

ALTER TABLE room_types
  ALTER COLUMN default_occupancy  SET DEFAULT 2,
  ALTER COLUMN default_occupancy  SET NOT NULL,
  ALTER COLUMN extra_person_price SET DEFAULT 0,
  ALTER COLUMN extra_person_price SET NOT NULL;

COMMENT ON COLUMN room_types.default_occupancy  IS 'Number of guests covered by base_price. Each guest above this costs extra_person_price per night.';
COMMENT ON COLUMN room_types.extra_person_price IS 'Per-person per-night surcharge for guests above default_occupancy.';
