-- ══════════════════════════════════════════════════════════════
-- Migration: Channex.io Channel Connectivity Module
-- Date: 2026-04-14
-- Description:
--   Replaces the earlier `channel_sync_queue` scaffold with a
--   production-grade job queue + supporting tables for a full
--   Channex.io channel manager integration:
--     - channel_connections         (encrypted API key, webhook secret)
--     - channel_property_links      (our tenant → Channex property)
--     - channel_room_type_links     (our room_types → Channex room type)
--     - channel_rate_plan_links     (our rate plan → Channex rate plan)
--     - channel_sync_jobs           (outbound work queue)
--     - channel_sync_logs           (immutable audit of every API call)
--     - channel_webhook_events      (raw incoming webhooks)
--     - channel_booking_revisions   (pulled booking revisions, dedup)
--     - channel_mapping_issues      (unmapped room/rate, manual resolution)
--     - channel_delivery_errors     (permanent failures after max retries)
--     - channel_rate_windows        (token bucket for rate limits)
--
--   Uses pgcrypto for symmetric encryption of the API key. The
--   encryption key lives in env var CHANNEX_ENCRYPTION_KEY and is
--   injected at query time via SET LOCAL app.channex_key = ...
--
-- Safe to re-run (IF NOT EXISTS, DROP IF EXISTS).
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Phase 1: Retire the old outbox ─────────────────────────────
DROP TRIGGER IF EXISTS trg_room_daily_pricing_channel_sync ON room_daily_pricing;
DROP FUNCTION IF EXISTS enqueue_channel_sync_on_pricing();
DROP TABLE IF EXISTS channel_sync_queue;

-- ── 1. channel_connections ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'channex',
  environment TEXT NOT NULL DEFAULT 'staging'
    CHECK (environment IN ('staging','production')),
  base_url TEXT NOT NULL,
  api_key_encrypted BYTEA NOT NULL,
  api_key_fingerprint TEXT NOT NULL,          -- last-4 for display
  webhook_id TEXT,                             -- Channex webhook UUID as text
  webhook_secret TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','connected','disabled','error')),
  status_detail TEXT,
  last_test_at TIMESTAMPTZ,
  last_successful_push_at TIMESTAMPTZ,
  last_successful_pull_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_channel_connections_tenant ON channel_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_channel_connections_webhook_secret ON channel_connections(webhook_secret);
COMMENT ON TABLE channel_connections IS 'One per tenant+provider. API key stored pgp_sym_encrypted.';

-- ── 2. channel_property_links ──────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_property_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  channex_property_id UUID NOT NULL,
  channex_title TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),
  initial_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, channex_property_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_property_links_tenant ON channel_property_links(tenant_id);

-- ── 3. channel_room_type_links ─────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_room_type_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  property_link_id UUID NOT NULL REFERENCES channel_property_links(id) ON DELETE CASCADE,
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  channex_room_type_id UUID NOT NULL,
  channex_title TEXT,
  count_of_rooms INTEGER,
  occupancy_adults INTEGER,
  occupancy_children INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, room_type_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_room_type_links_tenant ON channel_room_type_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_channel_room_type_links_channex ON channel_room_type_links(channex_room_type_id);

-- ── 4. channel_rate_plan_links ─────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_rate_plan_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  room_type_link_id UUID NOT NULL REFERENCES channel_room_type_links(id) ON DELETE CASCADE,
  channex_rate_plan_id UUID NOT NULL,
  label TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  currency TEXT NOT NULL DEFAULT 'ILS',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, channex_rate_plan_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_rate_plan_links_tenant ON channel_rate_plan_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_channel_rate_plan_links_channex ON channel_rate_plan_links(channex_rate_plan_id);

-- ── 5. channel_sync_jobs (outbound queue) ──────────────────────
CREATE TABLE IF NOT EXISTS channel_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES channel_connections(id) ON DELETE CASCADE,
  property_link_id UUID REFERENCES channel_property_links(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL
    CHECK (job_type IN (
      'initial_sync',
      'create_property',
      'create_room_type',
      'create_rate_plan',
      'webhook_subscribe',
      'webhook_unsubscribe',
      'ari_push',
      'availability_push',
      'booking_pull',
      'ack_booking',
      'webhook_process'
    )),
  payload JSONB NOT NULL,
  dedup_key TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','done','failed','cancelled','retry')),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_sync_jobs_ready
  ON channel_sync_jobs(tenant_id, status, scheduled_for)
  WHERE status IN ('pending','retry');
CREATE INDEX IF NOT EXISTS idx_channel_sync_jobs_dedup
  ON channel_sync_jobs(dedup_key)
  WHERE status IN ('pending','retry');
CREATE INDEX IF NOT EXISTS idx_channel_sync_jobs_tenant_created
  ON channel_sync_jobs(tenant_id, created_at DESC);
COMMENT ON TABLE channel_sync_jobs IS 'Outbound job queue for Channex API calls. Populated by DB trigger on room_daily_pricing and by application code.';

-- ── 6. channel_sync_logs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES channel_connections(id) ON DELETE SET NULL,
  job_id UUID REFERENCES channel_sync_jobs(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  endpoint TEXT NOT NULL,
  http_method TEXT NOT NULL,
  request_body JSONB,
  response_status INTEGER,
  response_body JSONB,
  response_warnings JSONB,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_sync_logs_tenant_created
  ON channel_sync_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_sync_logs_connection
  ON channel_sync_logs(connection_id, endpoint, created_at DESC);

-- ── 7. channel_webhook_events ──────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES channel_connections(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  channex_property_id UUID,
  source_ip INET,
  headers JSONB,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','processed','failed','ignored')),
  processed_at TIMESTAMPTZ,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_webhook_events_tenant
  ON channel_webhook_events(tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_webhook_events_pending
  ON channel_webhook_events(status, received_at)
  WHERE status = 'received';

-- ── 8. channel_booking_revisions ───────────────────────────────
CREATE TABLE IF NOT EXISTS channel_booking_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  channex_revision_id UUID NOT NULL,
  channex_booking_id UUID NOT NULL,
  channex_property_id UUID NOT NULL,
  unique_id TEXT NOT NULL,
  system_id TEXT NOT NULL,
  ota_name TEXT,
  ota_reservation_code TEXT,
  status TEXT NOT NULL CHECK (status IN ('new','modified','cancelled')),
  arrival_date DATE,
  departure_date DATE,
  payload JSONB NOT NULL,
  processed_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processed_status IN ('pending','imported','skipped','failed','unmapped')),
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  ack_status TEXT NOT NULL DEFAULT 'unacked'
    CHECK (ack_status IN ('unacked','acked','ack_failed')),
  acked_at TIMESTAMPTZ,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, system_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_booking_revisions_tenant
  ON channel_booking_revisions(tenant_id, processed_status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_booking_revisions_unique_id
  ON channel_booking_revisions(unique_id);
CREATE INDEX IF NOT EXISTS idx_channel_booking_revisions_ack
  ON channel_booking_revisions(ack_status)
  WHERE ack_status = 'unacked';

-- ── 9. channel_mapping_issues ──────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_mapping_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES channel_connections(id) ON DELETE CASCADE,
  revision_id UUID REFERENCES channel_booking_revisions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('unmapped_room','unmapped_rate','occupancy_mismatch','duplicate_ota_code')),
  ota_unique_id TEXT,
  snippet JSONB,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved','ignored')),
  resolved_mapping JSONB,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_mapping_issues_tenant_open
  ON channel_mapping_issues(tenant_id, status)
  WHERE status = 'open';

-- ── 10. channel_delivery_errors ────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_delivery_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES channel_connections(id) ON DELETE CASCADE,
  job_id UUID REFERENCES channel_sync_jobs(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  payload_summary JSONB,
  last_response JSONB,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_delivery_errors_pending
  ON channel_delivery_errors(tenant_id)
  WHERE acknowledged_at IS NULL;

-- ── 11. channel_rate_windows (token bucket for rate limits) ────
CREATE TABLE IF NOT EXISTS channel_rate_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  property_link_id UUID NOT NULL REFERENCES channel_property_links(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL CHECK (bucket IN ('restrictions','availability','ari_total')),
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (connection_id, property_link_id, bucket, window_start)
);
CREATE INDEX IF NOT EXISTS idx_channel_rate_windows_cleanup
  ON channel_rate_windows(window_start);

-- ── 12. Replacement trigger on room_daily_pricing ──────────────
CREATE OR REPLACE FUNCTION enqueue_channex_job_on_pricing()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_room_id UUID;
  v_date DATE;
  v_connection_id UUID;
  v_dedup_key TEXT;
  v_existing_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
    v_room_id := OLD.room_id;
    v_date := OLD.date;
  ELSE
    v_tenant_id := NEW.tenant_id;
    v_room_id := NEW.room_id;
    v_date := NEW.date;
  END IF;

  -- Only queue if tenant has a connected Channex account.
  SELECT id INTO v_connection_id
  FROM channel_connections
  WHERE tenant_id = v_tenant_id AND status = 'connected'
  LIMIT 1;

  IF v_connection_id IS NULL THEN
    -- No connection → nothing to queue. Silent no-op.
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_dedup_key := 'ari_push:' || v_room_id::text || ':' || v_date::text;

  -- Debounce: if a pending job with the same dedup_key exists, bump its schedule.
  UPDATE channel_sync_jobs
  SET scheduled_for = GREATEST(scheduled_for, now() + interval '30 seconds'),
      updated_at = now()
  WHERE dedup_key = v_dedup_key
    AND status IN ('pending','retry')
  RETURNING id INTO v_existing_id;

  IF v_existing_id IS NULL THEN
    INSERT INTO channel_sync_jobs (
      tenant_id, connection_id, job_type, payload, dedup_key,
      priority, status, scheduled_for
    ) VALUES (
      v_tenant_id,
      v_connection_id,
      'ari_push',
      jsonb_build_object('room_id', v_room_id, 'date', v_date, 'op', LOWER(TG_OP)),
      v_dedup_key,
      100,
      'pending',
      now() + interval '30 seconds'
    );
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_room_daily_pricing_channex ON room_daily_pricing;
CREATE TRIGGER trg_room_daily_pricing_channex
AFTER INSERT OR UPDATE OR DELETE ON room_daily_pricing
FOR EACH ROW EXECUTE FUNCTION enqueue_channex_job_on_pricing();

-- Done.
SELECT 'MIGRATION_OK' AS result;
