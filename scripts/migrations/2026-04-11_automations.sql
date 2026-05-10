/* ══════════════════════════════════════════════════════════
   AUTOMATION & MESSAGE CENTER — Full Schema
   ══════════════════════════════════════════════════════════ */

/* ── 1. Automation Templates ─────────────────────────────── */

CREATE TABLE IF NOT EXISTS automation_templates (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  key                     TEXT NOT NULL,
  name                    TEXT NOT NULL,
  category                TEXT NOT NULL DEFAULT 'system',
  description             TEXT NOT NULL DEFAULT '',
  channel_type            TEXT NOT NULL DEFAULT 'email',
  subject                 TEXT NOT NULL DEFAULT '',
  body                    TEXT NOT NULL DEFAULT '',
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  is_system_locked        BOOLEAN NOT NULL DEFAULT FALSE,
  allow_super_admin_edit  BOOLEAN NOT NULL DEFAULT TRUE,
  default_trigger         TEXT,
  default_delay_minutes   INT DEFAULT 0,
  available_variables     JSONB NOT NULL DEFAULT '[]',
  notes_internal          TEXT NOT NULL DEFAULT '',
  created_by              UUID,
  updated_by              UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_at_tenant_key
  ON automation_templates (tenant_id, key);
CREATE INDEX IF NOT EXISTS idx_at_tenant_category
  ON automation_templates (tenant_id, category) WHERE is_active = TRUE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'at_channel_check') THEN
    ALTER TABLE automation_templates ADD CONSTRAINT at_channel_check
      CHECK (channel_type IN ('email','whatsapp','sms','in_app','push_notification'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'at_category_check') THEN
    ALTER TABLE automation_templates ADD CONSTRAINT at_category_check
      CHECK (category IN ('registration','reservations','tasks','cleaning','maintenance','attendance','suppliers','system'));
  END IF;
END $$;

/* ── 2. Automation Rules ─────────────────────────────────── */

CREATE TABLE IF NOT EXISTS automation_rules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  key                     TEXT NOT NULL,
  name                    TEXT NOT NULL,
  description             TEXT NOT NULL DEFAULT '',
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type            TEXT NOT NULL DEFAULT 'event',
  trigger_entity          TEXT NOT NULL DEFAULT '',
  trigger_condition       JSONB NOT NULL DEFAULT '{}',
  delay_minutes           INT NOT NULL DEFAULT 0,
  send_time               TIME,
  send_days_before        INT,
  send_days_after         INT,
  repeat_every            INT,
  repeat_unit             TEXT,
  stop_when_condition_met BOOLEAN NOT NULL DEFAULT FALSE,
  priority                INT NOT NULL DEFAULT 50,
  execution_order         INT NOT NULL DEFAULT 0,
  channel_priority        JSONB NOT NULL DEFAULT '["email"]',
  template_id             UUID REFERENCES automation_templates(id) ON DELETE SET NULL,
  fallback_template_id    UUID REFERENCES automation_templates(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ar_tenant_key
  ON automation_rules (tenant_id, key);
CREATE INDEX IF NOT EXISTS idx_ar_tenant_active
  ON automation_rules (tenant_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ar_trigger
  ON automation_rules (tenant_id, trigger_type, trigger_entity);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'ar_trigger_type_check') THEN
    ALTER TABLE automation_rules ADD CONSTRAINT ar_trigger_type_check
      CHECK (trigger_type IN ('event','relative_date','exact_time','conditional'));
  END IF;
END $$;

/* ── 3. Message Queue ────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS message_queue (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  automation_rule_id      UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  template_id             UUID REFERENCES automation_templates(id) ON DELETE SET NULL,
  target_entity_type      TEXT NOT NULL DEFAULT '',
  target_entity_id        UUID,
  recipient_name          TEXT NOT NULL DEFAULT '',
  recipient_email         TEXT NOT NULL DEFAULT '',
  recipient_phone         TEXT NOT NULL DEFAULT '',
  channel_type            TEXT NOT NULL DEFAULT 'email',
  scheduled_for           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at                 TIMESTAMPTZ,
  delivery_status         TEXT NOT NULL DEFAULT 'pending',
  error_message           TEXT,
  retry_count             INT NOT NULL DEFAULT 0,
  payload_snapshot        JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mq_pending
  ON message_queue (tenant_id, delivery_status, scheduled_for)
  WHERE delivery_status IN ('pending','scheduled','retry');
CREATE INDEX IF NOT EXISTS idx_mq_tenant_status
  ON message_queue (tenant_id, delivery_status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'mq_status_check') THEN
    ALTER TABLE message_queue ADD CONSTRAINT mq_status_check
      CHECK (delivery_status IN ('pending','scheduled','sending','sent','failed','cancelled','retry'));
  END IF;
END $$;

/* ── 4. Message Log ──────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS message_log (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  queue_id                UUID REFERENCES message_queue(id) ON DELETE SET NULL,
  template_id             UUID REFERENCES automation_templates(id) ON DELETE SET NULL,
  channel_type            TEXT NOT NULL DEFAULT 'email',
  recipient               TEXT NOT NULL DEFAULT '',
  subject                 TEXT NOT NULL DEFAULT '',
  body_snapshot           TEXT NOT NULL DEFAULT '',
  delivery_status         TEXT NOT NULL DEFAULT 'sent',
  provider_response       TEXT,
  sent_at                 TIMESTAMPTZ,
  opened_at               TIMESTAMPTZ,
  clicked_at              TIMESTAMPTZ,
  failed_at               TIMESTAMPTZ,
  error_message           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_tenant_date
  ON message_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_tenant_status
  ON message_log (tenant_id, delivery_status);
CREATE INDEX IF NOT EXISTS idx_ml_template
  ON message_log (template_id);

/* ── 5. Dynamic Variables ────────────────────────────────── */

CREATE TABLE IF NOT EXISTS automation_variables (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  entity_type             TEXT NOT NULL,
  variable_key            TEXT NOT NULL,
  variable_label          TEXT NOT NULL,
  example_value           TEXT NOT NULL DEFAULT '',
  description             TEXT NOT NULL DEFAULT '',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_av_tenant_key
  ON automation_variables (tenant_id, entity_type, variable_key);

/* ── Triggers ────────────────────────────────────────────── */

CREATE TRIGGER set_automation_templates_updated_at
  BEFORE UPDATE ON automation_templates
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
