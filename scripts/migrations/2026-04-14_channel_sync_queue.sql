-- ══════════════════════════════════════════════════════════════
-- Migration: Channel Sync Queue (scaffolding only)
-- Date: 2026-04-14
-- Description:
--   Every change to room_daily_pricing enqueues a sync event so a
--   future channel-manager worker can push deltas to connected OTAs
--   (Booking, Expedia, Airbnb, etc.). No worker exists yet — rows
--   stay in `pending` status until someone implements the dispatcher.
--
--   This migration is safe: it only adds tables + a trigger and
--   does NOT touch any existing data or behaviour.
-- Safe to re-run (IF NOT EXISTS everywhere).
-- ══════════════════════════════════════════════════════════════

-- ── 1. Queue table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL,           -- 'room_daily_pricing'
  entity_id UUID,                       -- room_daily_pricing.id (nullable on DELETE)
  room_id UUID NOT NULL,
  date DATE NOT NULL,
  operation TEXT NOT NULL,              -- 'insert' | 'update' | 'delete'
  payload JSONB,                        -- snapshot of NEW row (or OLD on delete)
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'dispatched' | 'failed'
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_channel_sync_queue_tenant_status
  ON channel_sync_queue (tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_channel_sync_queue_room_date
  ON channel_sync_queue (room_id, date);

COMMENT ON TABLE channel_sync_queue IS
  'Outbox queue for channel manager sync. Populated automatically by trigger on room_daily_pricing. Dispatcher not implemented yet — rows stay pending.';

-- ── 2. Trigger function ────────────────────────────────────────
CREATE OR REPLACE FUNCTION enqueue_channel_sync_on_pricing()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_entity_id UUID;
  v_room_id UUID;
  v_date DATE;
  v_payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
    v_entity_id := OLD.id;
    v_room_id := OLD.room_id;
    v_date := OLD.date;
    v_payload := to_jsonb(OLD);
  ELSE
    v_tenant_id := NEW.tenant_id;
    v_entity_id := NEW.id;
    v_room_id := NEW.room_id;
    v_date := NEW.date;
    v_payload := to_jsonb(NEW);
  END IF;

  INSERT INTO channel_sync_queue (
    tenant_id, entity_type, entity_id, room_id, date, operation, payload
  ) VALUES (
    v_tenant_id,
    'room_daily_pricing',
    v_entity_id,
    v_room_id,
    v_date,
    LOWER(TG_OP),
    v_payload
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Attach trigger ──────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_room_daily_pricing_channel_sync ON room_daily_pricing;
CREATE TRIGGER trg_room_daily_pricing_channel_sync
AFTER INSERT OR UPDATE OR DELETE ON room_daily_pricing
FOR EACH ROW EXECUTE FUNCTION enqueue_channel_sync_on_pricing();

-- Done.
SELECT 'MIGRATION_OK' AS result;
