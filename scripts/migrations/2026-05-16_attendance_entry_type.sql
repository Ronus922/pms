-- ─────────────────────────────────────────────────────────────
-- 2026-05-16 — Attendance entry_type
-- ─────────────────────────────────────────────────────────────
-- Adds a typed classification to each attendance row so the
-- manager view can distinguish regular shifts from vacation,
-- sick, holiday, and unspecified-absence entries.
--
-- Backwards-compatible: existing rows default to 'regular',
-- which matches the prior implicit behavior (all rows were
-- worked shifts).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'regular';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'attendance_records_entry_type_check'
  ) THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT attendance_records_entry_type_check
      CHECK (entry_type IN ('regular','vacation','sick','holiday','absence'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_records_type
  ON attendance_records (tenant_id, entry_type);

SELECT 'MIGRATION_OK' AS result;
