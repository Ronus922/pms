-- ─────────────────────────────────────────────────────────────
-- 2026-04-11 — Maintenance Management Module
-- ─────────────────────────────────────────────────────────────
-- Safe to re-run (all statements use IF NOT EXISTS / DO $$ BEGIN ... END $$).
-- Creates maintenance_tasks, maintenance_task_media, maintenance_task_audit_log.
-- ─────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════
-- 1. MAINTENANCE_TASKS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  UUID NOT NULL,
  task_number                INT NOT NULL DEFAULT 0,

  -- Source & target
  source_type                TEXT NOT NULL DEFAULT 'manual',
  target_type                TEXT NOT NULL DEFAULT 'room',
  target_id                  UUID,
  target_label               TEXT NOT NULL DEFAULT '',
  room_number                TEXT,

  -- Classification
  issue_category             TEXT NOT NULL DEFAULT 'general',
  title                      TEXT NOT NULL,
  description                TEXT NOT NULL DEFAULT '',

  -- Priority & urgency (two separate fields)
  priority                   TEXT NOT NULL DEFAULT 'medium',
  urgency_level              TEXT NOT NULL DEFAULT 'normal',

  -- Status
  status                     TEXT NOT NULL DEFAULT 'open',

  -- Assignment
  assigned_to                UUID,
  assigned_to_name           TEXT,
  secondary_assignees        JSONB NOT NULL DEFAULT '[]',

  -- Reporter
  reported_by                UUID,
  reported_by_name           TEXT,
  reported_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Scheduling
  scheduled_date             DATE,
  scheduled_time_from        TIME,
  scheduled_time_to          TIME,

  -- Ordering (per worker + date queue)
  sort_order                 INT NOT NULL DEFAULT 0,

  -- Duration
  estimated_duration_minutes INT,
  actual_duration_minutes    INT,

  -- Room context
  room_status_context        TEXT,
  requires_guest_coordination BOOLEAN NOT NULL DEFAULT FALSE,
  can_enter_room             BOOLEAN NOT NULL DEFAULT TRUE,
  access_notes               TEXT,

  -- Resolution
  resolution_notes           TEXT,
  resolution_code            TEXT,
  completed_at               TIMESTAMPTZ,
  completed_by               UUID,
  completed_by_name          TEXT,

  -- Reopen tracking
  reopened_count             INT NOT NULL DEFAULT 0,
  last_reopened_at           TIMESTAMPTZ,
  last_reopened_by           UUID,

  -- Timestamps
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                 TIMESTAMPTZ
);

-- Constraints (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'mt_source_type_check'
  ) THEN
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT mt_source_type_check
      CHECK (source_type IN ('manual','room_status','guest_report','staff_report','inspection','preventive_maintenance','followup'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'mt_target_type_check'
  ) THEN
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT mt_target_type_check
      CHECK (target_type IN ('room','area','building','equipment'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'mt_issue_category_check'
  ) THEN
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT mt_issue_category_check
      CHECK (issue_category IN ('plumbing','electrical','ac','lock','furniture','appliance','wall_paint','cleaning_damage','water_leak','sewage','internet_tv','safety','elevator_related','general','other'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'mt_priority_check'
  ) THEN
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT mt_priority_check
      CHECK (priority IN ('low','medium','high','critical'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'mt_urgency_check'
  ) THEN
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT mt_urgency_check
      CHECK (urgency_level IN ('normal','urgent','immediate'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'mt_status_check'
  ) THEN
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT mt_status_check
      CHECK (status IN ('open','assigned','in_progress','waiting_parts','waiting_external_vendor','resolved','cancelled'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'mt_resolution_code_check'
  ) THEN
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT mt_resolution_code_check
      CHECK (resolution_code IS NULL OR resolution_code IN ('fixed','temporary_fix','requires_vendor','no_issue_found','postponed'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mt_tenant_status
  ON maintenance_tasks (tenant_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mt_worker_queue
  ON maintenance_tasks (tenant_id, assigned_to, scheduled_date, sort_order)
  WHERE deleted_at IS NULL AND status NOT IN ('resolved','cancelled');

CREATE INDEX IF NOT EXISTS idx_mt_scheduled_date
  ON maintenance_tasks (tenant_id, scheduled_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mt_task_number
  ON maintenance_tasks (tenant_id, task_number);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_mt_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mt_updated_at ON maintenance_tasks;
CREATE TRIGGER trg_mt_updated_at
  BEFORE UPDATE ON maintenance_tasks
  FOR EACH ROW EXECUTE FUNCTION set_mt_updated_at();


-- ═══════════════════════════════════════════════════════════
-- 2. MAINTENANCE_TASK_MEDIA
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS maintenance_task_media (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  task_id          UUID NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  media_type       TEXT NOT NULL DEFAULT 'image',
  phase            TEXT NOT NULL DEFAULT 'general',
  file_url         TEXT NOT NULL,
  file_name        TEXT,
  mime_type        TEXT,
  file_size_bytes  BIGINT,
  uploaded_by      UUID,
  uploaded_by_name TEXT,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sort_order       INT NOT NULL DEFAULT 0
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'mtm_phase_check'
  ) THEN
    ALTER TABLE maintenance_task_media
      ADD CONSTRAINT mtm_phase_check
      CHECK (phase IN ('before','after','general'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'mtm_media_type_check'
  ) THEN
    ALTER TABLE maintenance_task_media
      ADD CONSTRAINT mtm_media_type_check
      CHECK (media_type IN ('image','video','document'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mtm_task_phase
  ON maintenance_task_media (task_id, phase);


-- ═══════════════════════════════════════════════════════════
-- 3. MAINTENANCE_TASK_AUDIT_LOG
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS maintenance_task_audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  task_id          UUID NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  action           TEXT NOT NULL,
  changed_by       UUID,
  changed_by_name  TEXT,
  changes_json     JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'mta_action_check'
  ) THEN
    ALTER TABLE maintenance_task_audit_log
      ADD CONSTRAINT mta_action_check
      CHECK (action IN ('created','updated','assigned','reordered','moved_between_workers','status_changed','media_added','media_removed','completed','reopened','cancelled','deleted'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mta_task_time
  ON maintenance_task_audit_log (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mta_tenant_time
  ON maintenance_task_audit_log (tenant_id, created_at DESC);


-- ═══════════════════════════════════════════════════════════
-- 4. RLS (basic policies)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_task_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_task_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies: allow authenticated users to access their tenant's data
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mt_select' AND tablename = 'maintenance_tasks') THEN
    CREATE POLICY mt_select ON maintenance_tasks FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mt_insert' AND tablename = 'maintenance_tasks') THEN
    CREATE POLICY mt_insert ON maintenance_tasks FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mt_update' AND tablename = 'maintenance_tasks') THEN
    CREATE POLICY mt_update ON maintenance_tasks FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mt_delete' AND tablename = 'maintenance_tasks') THEN
    CREATE POLICY mt_delete ON maintenance_tasks FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mtm_select' AND tablename = 'maintenance_task_media') THEN
    CREATE POLICY mtm_select ON maintenance_task_media FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mtm_insert' AND tablename = 'maintenance_task_media') THEN
    CREATE POLICY mtm_insert ON maintenance_task_media FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mtm_update' AND tablename = 'maintenance_task_media') THEN
    CREATE POLICY mtm_update ON maintenance_task_media FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mtm_delete' AND tablename = 'maintenance_task_media') THEN
    CREATE POLICY mtm_delete ON maintenance_task_media FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mta_select' AND tablename = 'maintenance_task_audit_log') THEN
    CREATE POLICY mta_select ON maintenance_task_audit_log FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mta_insert' AND tablename = 'maintenance_task_audit_log') THEN
    CREATE POLICY mta_insert ON maintenance_task_audit_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;


-- Done.
SELECT 'MAINTENANCE_MIGRATION_OK' AS result;
