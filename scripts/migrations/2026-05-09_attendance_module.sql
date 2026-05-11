-- ══════════════════════════════════════════════════════════════
-- Migration: Attendance Module (Phase 1 + 1.5)
-- Date: 2026-05-09
-- Description:
--   1. Extend `users` with attendance settings (per-employee policy)
--   2. Create `attendance_areas` table (geofence definitions, 1:N)
--   3. Create `attendance_punches` table (clock-in / clock-out events)
--
-- Decisions baked in (see claude/attendance-decisions-12.9.md):
--   §12.9.4 — area soft delete + users.attendance_area_id ON DELETE SET NULL
--   §12.9.5 — punched_at TIMESTAMPTZ (UTC); display TZ handled in app code
--   §12.9.7 — attendance_punches.deleted_at for soft delete (7y retention)
--
-- Idempotent: re-runnable. All blocks guarded with IF NOT EXISTS / DO $$.
-- ══════════════════════════════════════════════════════════════

-- ------------------------------------------------------------
-- 1. ATTENDANCE_AREAS — geofence pool (1:N to users)
--    Created BEFORE users alter so the FK below resolves.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_areas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  shape_type      TEXT NOT NULL,
  geometry        JSONB NOT NULL,
  address         TEXT,
  color           TEXT NOT NULL DEFAULT '#1e40af',
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_areas_shape_type_check'
  ) THEN
    ALTER TABLE attendance_areas
      ADD CONSTRAINT attendance_areas_shape_type_check
      CHECK (shape_type IN ('rectangle', 'circle', 'polygon', 'address'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_areas_tenant
  ON attendance_areas (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_areas_tenant_active
  ON attendance_areas (tenant_id, is_active) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 2. USERS — extend with attendance settings
-- ------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS attendance_required    TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS attendance_area_id     UUID,
  ADD COLUMN IF NOT EXISTS report_absence_in_app  BOOLEAN NOT NULL DEFAULT FALSE,
  -- Phase 2 columns: present in schema, NOT exposed in Phase 1 UI.
  ADD COLUMN IF NOT EXISTS employee_type          TEXT,
  ADD COLUMN IF NOT EXISTS salary_template        TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_attendance_required_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_attendance_required_check
      CHECK (attendance_required IN (
        'none',
        'required_no_location',
        'required_with_location',
        'required_inside',
        'required_outside'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_employee_type_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_employee_type_check
      CHECK (employee_type IS NULL OR employee_type IN ('monthly', 'daily', 'hourly'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_attendance_area_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_attendance_area_id_fkey
      FOREIGN KEY (attendance_area_id)
      REFERENCES attendance_areas(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. ATTENDANCE_PUNCHES — clock-in / clock-out events
--    deleted_at supports soft-delete + 7-year retention (§12.9.7).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_punches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  punch_type      TEXT NOT NULL,
  punched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Location (NULL when attendance_required = 'required_no_location'):
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  -- Snapshot of the area at punch time (preserved even if area is later edited/deleted):
  area_id         UUID REFERENCES attendance_areas(id) ON DELETE SET NULL,
  area_snapshot   JSONB,
  is_within_area  BOOLEAN,
  -- Audit:
  device_info     JSONB,
  ip_address      INET,
  notes           TEXT,
  -- Phase 2 — absence requests (columns present, not used yet):
  absence_type    TEXT,
  absence_from    DATE,
  absence_to      DATE,
  -- Soft delete (§12.9.7):
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_punches_punch_type_check'
  ) THEN
    ALTER TABLE attendance_punches
      ADD CONSTRAINT attendance_punches_punch_type_check
      CHECK (punch_type IN ('clock_in', 'clock_out', 'absence_request'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_punches_absence_type_check'
  ) THEN
    ALTER TABLE attendance_punches
      ADD CONSTRAINT attendance_punches_absence_type_check
      CHECK (absence_type IS NULL OR absence_type IN ('sick', 'vacation', 'personal', 'other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_punches_user_date
  ON attendance_punches (tenant_id, user_id, punched_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_punches_tenant_date
  ON attendance_punches (tenant_id, punched_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_punches_user_type
  ON attendance_punches (user_id, punch_type, punched_at DESC) WHERE deleted_at IS NULL;
