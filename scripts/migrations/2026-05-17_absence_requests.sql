-- ─────────────────────────────────────────────────────────────
-- 2026-05-17 — Absence Requests
-- ─────────────────────────────────────────────────────────────
-- Adds the absence-request workflow (vacation / sick / reserve duty /
-- personal / unpaid / other) with optional attachments (e.g. sick
-- notes, reserve-duty orders). When a request is approved, the server
-- materializes one attendance_records row per day in the range
-- (skipping Saturday) so it shows up on the manager calendar.
--
-- Also drops the dormant `users.report_absence_in_app` flag that the
-- prior schema reserved for this feature — replaced by per-row
-- permission checks (any active user may create requests for
-- themselves; managers approve via attendance.edit).
-- ─────────────────────────────────────────────────────────────

-- 1. Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE absence_request_type AS ENUM (
    'vacation','sick','reserve_duty','personal','unpaid','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE absence_request_status AS ENUM (
    'pending','approved','rejected','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Requests table
CREATE TABLE IF NOT EXISTS absence_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type  absence_request_type NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  total_days    INT GENERATED ALWAYS AS ((end_date - start_date) + 1) STORED,
  reason        TEXT,
  status        absence_request_status NOT NULL DEFAULT 'pending',
  reviewed_by   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_absence_dates CHECK (end_date >= start_date)
);

-- 3. Attachments — metadata only; binary lives in Supabase Storage
CREATE TABLE IF NOT EXISTS absence_request_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   UUID NOT NULL REFERENCES absence_requests(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  name         TEXT NOT NULL,
  mime         TEXT,
  size         INT,
  uploaded_by  UUID REFERENCES users(id),
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_absence_tenant_status
  ON absence_requests (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_absence_employee
  ON absence_requests (tenant_id, employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_absence_attachments_request
  ON absence_request_attachments (request_id);

-- 5. Drop the dormant flag — replaced by per-row authorization
ALTER TABLE users DROP COLUMN IF EXISTS report_absence_in_app;

-- 6. updated_at trigger
CREATE OR REPLACE FUNCTION set_absence_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_absence_updated_at ON absence_requests;
CREATE TRIGGER trg_absence_updated_at
  BEFORE UPDATE ON absence_requests
  FOR EACH ROW EXECUTE FUNCTION set_absence_updated_at();

SELECT 'MIGRATION_OK' AS result;
