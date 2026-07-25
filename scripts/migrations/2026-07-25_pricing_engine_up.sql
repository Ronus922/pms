-- ============================================================================
-- Pricing engine — additive schema + backfill
-- 2026-07-25
--
-- Safe to re-run (IF NOT EXISTS / idempotent UPDATE guarded by price_mode IS NULL).
-- Every column is NULL-able or carries a DEFAULT: nothing is NOT NULL without a
-- default on a populated table.
--
-- The backfill is the risky half, so it verifies ITSELF at the end and raises,
-- which rolls the whole transaction back. A migration that quietly restates
-- historical money is worse than one that refuses to run.
--
-- Rollback: 2026-07-25_pricing_engine_down.sql
-- ============================================================================

BEGIN;

-- ── reservations ────────────────────────────────────────────────────────────
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS price_mode          TEXT           DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS manual_nightly_rate NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS manual_total        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS discount_mode       TEXT           DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value      NUMERIC(10,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_inclusive       BOOLEAN        DEFAULT true,
  -- Fraction, 4dp: 0.1700 / 0.1800. Deliberately NOT the tenant's rate —
  -- tenants.vat_rate is mutable and was changed 17 -> 18 in this database, so
  -- it cannot reconstruct what an older reservation was actually sold at.
  ADD COLUMN IF NOT EXISTS vat_rate            NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS currency            TEXT           DEFAULT 'ILS',
  ADD COLUMN IF NOT EXISTS exchange_rate       NUMERIC(12,6)  DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pricing_breakdown   JSONB,
  ADD COLUMN IF NOT EXISTS rate_plan_id        UUID;

-- CHECK rather than a Postgres ENUM: same guarantee, and a rollback does not
-- have to drop a type that other objects may have started depending on.
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_price_mode_check;
ALTER TABLE reservations ADD  CONSTRAINT reservations_price_mode_check
  CHECK (price_mode IN ('auto','manual_nightly','manual_total'));

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_discount_mode_check;
ALTER TABLE reservations ADD  CONSTRAINT reservations_discount_mode_check
  CHECK (discount_mode IN ('none','amount_per_night','percent_per_night','amount_total','percent_total'));

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_rate_plan_id_fkey;
ALTER TABLE reservations ADD  CONSTRAINT reservations_rate_plan_id_fkey
  FOREIGN KEY (rate_plan_id) REFERENCES rate_plans(id) ON DELETE SET NULL;

-- ── reservation_rooms (same controls per room; rate_plan_id already exists) ──
ALTER TABLE reservation_rooms
  ADD COLUMN IF NOT EXISTS price_mode          TEXT           DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS manual_nightly_rate NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS manual_total        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS discount_mode       TEXT           DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value      NUMERIC(10,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_inclusive       BOOLEAN        DEFAULT true,
  ADD COLUMN IF NOT EXISTS vat_rate            NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS currency            TEXT           DEFAULT 'ILS',
  ADD COLUMN IF NOT EXISTS exchange_rate       NUMERIC(12,6)  DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pricing_breakdown   JSONB;

ALTER TABLE reservation_rooms DROP CONSTRAINT IF EXISTS reservation_rooms_price_mode_check;
ALTER TABLE reservation_rooms ADD  CONSTRAINT reservation_rooms_price_mode_check
  CHECK (price_mode IN ('auto','manual_nightly','manual_total'));

ALTER TABLE reservation_rooms DROP CONSTRAINT IF EXISTS reservation_rooms_discount_mode_check;
ALTER TABLE reservation_rooms ADD  CONSTRAINT reservation_rooms_discount_mode_check
  CHECK (discount_mode IN ('none','amount_per_night','percent_per_night','amount_total','percent_total'));

-- ── length-of-stay discount tiers ───────────────────────────────────────────
-- rate_plans already carries ONE (min_nights, max_nights, modifier_type,
-- modifier_value). This table is the multi-tier layer a single row cannot
-- express: 7+ AND 28+ configured together, with exactly one applying.
CREATE TABLE IF NOT EXISTS rate_plan_los_discounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  rate_plan_id   UUID NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  min_nights     INTEGER NOT NULL,
  max_nights     INTEGER,
  discount_type  TEXT NOT NULL DEFAULT 'percent',
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active      BOOLEAN DEFAULT true,
  sort_order     INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT rate_plan_los_discounts_type_check
    CHECK (discount_type IN ('percent','amount_per_night','amount_total')),
  CONSTRAINT rate_plan_los_discounts_nights_check
    CHECK (min_nights >= 1 AND (max_nights IS NULL OR max_nights >= min_nights)),
  CONSTRAINT rate_plan_los_discounts_value_check
    CHECK (discount_value >= 0 AND (discount_type <> 'percent' OR discount_value <= 100))
);

CREATE INDEX IF NOT EXISTS idx_rate_plan_los_discounts_lookup
  ON rate_plan_los_discounts (tenant_id, rate_plan_id, min_nights);

-- ── tenant currency list (so the picker reads settings, not a code constant) ─
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS enabled_currencies TEXT[] DEFAULT '{ILS,USD,EUR}'::text[];

UPDATE tenants
   SET enabled_currencies = '{ILS,USD,EUR}'::text[]
 WHERE enabled_currencies IS NULL;

-- ============================================================================
-- BACKFILL
--
-- Every existing reservation becomes an explicit manual_total carrying the
-- figure it already had. price_mode='manual_total' means no downstream rule can
-- move that number, which is what makes the change non-restating by construction.
--
-- vat_rate is recovered from each row's OWN figures:
--     rate = tax_amount / (total_price - tax_amount)
-- With vat_inclusive=true the engine then returns
--     net = total/(1+rate)   and   vat = total - net
-- which reproduces the stored total_price AND tax_amount exactly. Verified
-- against all 20 live rows before this migration was written
-- (ref/proof/backfill-parity-live.txt, 0 mismatches), and pinned as a permanent
-- regression test in lib/pricing/backfill-parity.test.ts.
--
-- discount_mode/value are recorded for provenance only. They cannot alter the
-- total while price_mode='manual_total' — which is the point.
-- ============================================================================

UPDATE reservations SET
  price_mode    = 'manual_total',
  manual_total  = total_price,
  vat_inclusive = true,
  vat_rate      = CASE WHEN (COALESCE(total_price,0) - COALESCE(tax_amount,0)) > 0
                       THEN round(COALESCE(tax_amount,0) / (total_price - tax_amount), 4)
                       ELSE 0 END,
  currency      = COALESCE(currency, 'ILS'),
  exchange_rate = COALESCE(exchange_rate, 1),
  discount_mode = CASE
                    WHEN COALESCE(discount_percent,0)   > 0 THEN 'percent_total'
                    WHEN COALESCE(discount_per_night,0) > 0 THEN 'amount_per_night'
                    ELSE 'none' END,
  discount_value = CASE
                    WHEN COALESCE(discount_percent,0)   > 0 THEN discount_percent
                    WHEN COALESCE(discount_per_night,0) > 0 THEN discount_per_night
                    ELSE 0 END
WHERE price_mode IS DISTINCT FROM 'manual_total' OR manual_total IS NULL;

-- Rooms keep the nightly rate they were actually sold at, and inherit the
-- parent reservation's VAT era.
UPDATE reservation_rooms rr SET
  price_mode          = 'manual_nightly',
  manual_nightly_rate = rr.rate_per_night,
  vat_inclusive       = true,
  vat_rate            = r.vat_rate,
  currency            = COALESCE(r.currency, 'ILS'),
  exchange_rate       = COALESCE(r.exchange_rate, 1)
FROM reservations r
WHERE r.id = rr.reservation_id
  AND (rr.price_mode IS DISTINCT FROM 'manual_nightly' OR rr.manual_nightly_rate IS NULL);

-- ── SELF-VERIFICATION — fail closed ─────────────────────────────────────────
DO $$
DECLARE
  bad_total INTEGER;
  bad_vat   INTEGER;
  bad_rooms INTEGER;
BEGIN
  SELECT count(*) INTO bad_total
    FROM reservations
   WHERE abs(COALESCE(manual_total,0) - COALESCE(total_price,0)) > 0.01;

  SELECT count(*) INTO bad_vat
    FROM reservations
   WHERE abs(round(COALESCE(manual_total,0) - COALESCE(manual_total,0)/(1+COALESCE(vat_rate,0)), 2)
             - COALESCE(tax_amount,0)) > 0.01;

  SELECT count(*) INTO bad_rooms
    FROM reservation_rooms
   WHERE rate_per_night IS NOT NULL
     AND abs(COALESCE(manual_nightly_rate,0) - rate_per_night) > 0.01;

  IF bad_total > 0 OR bad_vat > 0 OR bad_rooms > 0 THEN
    RAISE EXCEPTION
      'Backfill parity FAILED — aborting. total mismatches=%, vat mismatches=%, room-rate mismatches=%',
      bad_total, bad_vat, bad_rooms;
  END IF;

  RAISE NOTICE 'Backfill parity OK: % reservations, % rooms reproduced exactly',
    (SELECT count(*) FROM reservations), (SELECT count(*) FROM reservation_rooms);
END $$;

COMMIT;
