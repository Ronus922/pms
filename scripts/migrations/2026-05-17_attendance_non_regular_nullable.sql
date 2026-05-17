-- ─────────────────────────────────────────────────────────────
-- 2026-05-17 — Non-regular attendance rows allow NULL clock times
-- ─────────────────────────────────────────────────────────────
-- Background
--   The previous schema stored a midnight sentinel in `clock_in`
--   for non-regular entries (vacation / sick / holiday / absence)
--   because the column was NOT NULL. This caused two visible bugs:
--     1) UI code that computed hours = clock_out - clock_in would
--        produce nonsense (e.g. 385.75 hours when someone later
--        wrote a real clock_out into a vacation row by mistake).
--     2) Open-shift uniqueness (clock_out IS NULL) was indistinguish-
--        able from "this is a non-regular row", so a vacation row
--        without clock_out conflicted with the worker's open shift.
--
-- This migration:
--   1. Drops NOT NULL on attendance_records.clock_in.
--   2. Adds a typed check: regular rows MUST have clock_in.
--   3. Re-scopes the open-shift unique index to regular rows only.
--   4. Cleans up existing non-regular rows: NULL out clock_in /
--      clock_out so they read consistently.
--
-- Order matters: drop the old unique index BEFORE the UPDATE so the
-- second-vacation-row case doesn't trip the index during cleanup,
-- then recreate it scoped to regular rows.
-- ─────────────────────────────────────────────────────────────

-- 1. Allow clock_in to be NULL
ALTER TABLE attendance_records
  ALTER COLUMN clock_in DROP NOT NULL;

-- 2. New CHECK: regular rows still require clock_in; non-regular don't
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'attendance_records_regular_requires_clock_in'
  ) THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT attendance_records_regular_requires_clock_in
      CHECK (
        entry_type <> 'regular'
        OR clock_in IS NOT NULL
      );
  END IF;
END $$;

-- 3. Drop the over-broad open-shift unique index. Recreated below
-- scoped to regular rows only, so a vacation row (clock_out NULL by
-- design) doesn't collide with the worker's actual open shift.
DROP INDEX IF EXISTS uq_attendance_records_open_shift;

-- 4. Normalize existing data — any non-regular row with sentinel
-- timestamps gets cleaned to NULL/NULL.
UPDATE attendance_records
  SET clock_in = NULL,
      clock_out = NULL
WHERE entry_type <> 'regular';

-- 5. Recreate the open-shift uniqueness index, scoped
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_records_open_shift
  ON attendance_records (tenant_id, user_id)
  WHERE clock_out IS NULL
    AND entry_type = 'regular';

SELECT 'MIGRATION_OK' AS result;
