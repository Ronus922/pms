-- ─────────────────────────────────────────────────────────────
-- 2026-05-16 — Attendance Records (shift-per-row model)
-- ─────────────────────────────────────────────────────────────
-- Safe to re-run (all statements use IF NOT EXISTS / ON CONFLICT,
-- check-constraint adds are guarded by information_schema lookups,
-- the legacy-table rename is guarded so it skips silently if already
-- archived or absent).
--
-- Supersedes the legacy `attendance_punches` table (one row per
-- punch event) with `attendance_records` (one row per shift, with
-- clock_in + clock_out on the same row and manager-edit audit fields).
-- The old table is renamed to `_archive_attendance_punches` for
-- historical reference and is no longer referenced by application code.
-- ─────────────────────────────────────────────────────────────

-- 1. Archive the legacy table (skip silently if already archived or absent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'attendance_punches'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_archive_attendance_punches'
  ) THEN
    ALTER TABLE attendance_punches RENAME TO _archive_attendance_punches;
  END IF;
END $$;

-- 2. attendance_records — one row per shift
CREATE TABLE IF NOT EXISTS attendance_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clock_in    TIMESTAMPTZ NOT NULL,
  clock_out   TIMESTAMPTZ NULL,
  work_date   DATE NOT NULL,
  notes       TEXT NULL,
  source      TEXT NOT NULL DEFAULT 'self',
  edited_by   UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  edited_at   TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- source constraint (worker self-punch / manager-created / manager-edited)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'attendance_records_source_check'
  ) THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT attendance_records_source_check
      CHECK (source IN ('self','manager_manual','manager_edit'));
  END IF;
END $$;

-- clock ordering: closed shifts must end after they start; open shifts (NULL) allowed
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'attendance_records_clock_order_check'
  ) THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT attendance_records_clock_order_check
      CHECK (clock_out IS NULL OR clock_out > clock_in);
  END IF;
END $$;

-- 3. Indexes
-- Per-user, per-day queries (worker timeline, manager drilldown)
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_date
  ON attendance_records (tenant_id, user_id, work_date DESC);

-- Tenant-wide daily roll-ups (manager board)
CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant_date
  ON attendance_records (tenant_id, work_date DESC);

-- Hard guarantee: at most one open shift per user (prevents duplicate clock-in)
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_records_open_shift
  ON attendance_records (tenant_id, user_id)
  WHERE clock_out IS NULL;

-- 4. updated_at trigger (mirrors the set_hk_updated_at pattern)
CREATE OR REPLACE FUNCTION set_attendance_records_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER trg_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION set_attendance_records_updated_at();

-- 5. Backfill `attendance` module permissions for existing roles
-- ON CONFLICT (user_id, module) DO NOTHING keeps any manual customizations intact.
INSERT INTO user_permissions (tenant_id, user_id, module, can_view, can_edit, can_delete)
SELECT
  tenant_id,
  id,
  'attendance',
  true,                                                                       -- can_view
  CASE WHEN role IN ('receptionist','admin','super_admin') THEN true ELSE false END,  -- can_edit
  CASE WHEN role IN ('admin','super_admin') THEN true ELSE false END                  -- can_delete
FROM users
WHERE role IN ('cleaner','receptionist','admin','super_admin')
ON CONFLICT (user_id, module) DO NOTHING;

-- Done.
SELECT 'MIGRATION_OK' AS result;
