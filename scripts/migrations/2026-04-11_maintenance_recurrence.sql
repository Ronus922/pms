/* ── Maintenance Recurrence Rules ─────────────────────────── */

CREATE TABLE IF NOT EXISTS maintenance_recurrence_rules (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL,

  -- Template fields (mirror maintenance_tasks)
  source_type                 TEXT NOT NULL DEFAULT 'preventive_maintenance',
  target_type                 TEXT NOT NULL DEFAULT 'room',
  target_id                   UUID,
  target_label                TEXT NOT NULL DEFAULT '',
  room_number                 TEXT,
  issue_category              TEXT NOT NULL DEFAULT 'general',
  title                       TEXT NOT NULL,
  description                 TEXT NOT NULL DEFAULT '',
  priority                    TEXT NOT NULL DEFAULT 'medium',
  urgency_level               TEXT NOT NULL DEFAULT 'normal',
  assigned_to                 UUID,
  assigned_to_name            TEXT,
  scheduled_time_from         TIME,
  scheduled_time_to           TIME,
  estimated_duration_minutes  INT,
  requires_guest_coordination BOOLEAN NOT NULL DEFAULT FALSE,
  can_enter_room              BOOLEAN NOT NULL DEFAULT TRUE,
  access_notes                TEXT,

  -- Recurrence definition
  frequency                   TEXT NOT NULL,    -- daily, specific_days, weekly, biweekly, monthly
  days_of_week                INT[] DEFAULT '{}', -- 0=Sun..6=Sat, for specific_days
  start_date                  DATE NOT NULL,
  end_date                    DATE,             -- NULL = no end
  last_generated_date         DATE,             -- tracks up to which date instances exist

  -- Lifecycle
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by                  UUID,
  created_by_name             TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mrr_tenant_active
  ON maintenance_recurrence_rules (tenant_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_mrr_generate
  ON maintenance_recurrence_rules (tenant_id, last_generated_date)
  WHERE is_active = true;

/* ── Add recurrence columns to maintenance_tasks ─────────── */

ALTER TABLE maintenance_tasks
  ADD COLUMN IF NOT EXISTS recurrence_rule_id UUID REFERENCES maintenance_recurrence_rules(id) ON DELETE SET NULL;

ALTER TABLE maintenance_tasks
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_mt_recurrence
  ON maintenance_tasks (recurrence_rule_id)
  WHERE recurrence_rule_id IS NOT NULL;

/* ── Frequency check constraint ──────────────────────────── */

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'mrr_frequency_check'
  ) THEN
    ALTER TABLE maintenance_recurrence_rules
      ADD CONSTRAINT mrr_frequency_check
      CHECK (frequency IN ('daily','specific_days','weekly','biweekly','monthly'));
  END IF;
END $$;
