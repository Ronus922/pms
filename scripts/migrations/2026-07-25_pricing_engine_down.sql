-- ============================================================================
-- Rollback for 2026-07-25_pricing_engine_up.sql
--
-- The up migration is purely ADDITIVE: it never drops, renames or overwrites a
-- pre-existing column. total_price, tax_amount, subtotal, total_paid, deposit,
-- discount_percent and discount_per_night are read but never written. So this
-- rollback simply removes what was added, and the money columns are byte-for-byte
-- what they were before — nothing has to be restored from a dump.
--
-- The existing migration convention in this repo is forward-only; a paired down
-- file is a deliberate exception here because the up migration touches money.
-- ============================================================================

BEGIN;

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_price_mode_check;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_discount_mode_check;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_rate_plan_id_fkey;

ALTER TABLE reservations
  DROP COLUMN IF EXISTS price_mode,
  DROP COLUMN IF EXISTS manual_nightly_rate,
  DROP COLUMN IF EXISTS manual_total,
  DROP COLUMN IF EXISTS discount_mode,
  DROP COLUMN IF EXISTS discount_value,
  DROP COLUMN IF EXISTS vat_inclusive,
  DROP COLUMN IF EXISTS vat_rate,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS exchange_rate,
  DROP COLUMN IF EXISTS pricing_breakdown,
  DROP COLUMN IF EXISTS rate_plan_id;

ALTER TABLE reservation_rooms DROP CONSTRAINT IF EXISTS reservation_rooms_price_mode_check;
ALTER TABLE reservation_rooms DROP CONSTRAINT IF EXISTS reservation_rooms_discount_mode_check;

-- NOTE: reservation_rooms.rate_plan_id is NOT dropped — it pre-dates this
-- migration and is not ours to remove.
ALTER TABLE reservation_rooms
  DROP COLUMN IF EXISTS price_mode,
  DROP COLUMN IF EXISTS manual_nightly_rate,
  DROP COLUMN IF EXISTS manual_total,
  DROP COLUMN IF EXISTS discount_mode,
  DROP COLUMN IF EXISTS discount_value,
  DROP COLUMN IF EXISTS vat_inclusive,
  DROP COLUMN IF EXISTS vat_rate,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS exchange_rate,
  DROP COLUMN IF EXISTS pricing_breakdown;

DROP INDEX IF EXISTS idx_rate_plan_los_discounts_lookup;
DROP TABLE IF EXISTS rate_plan_los_discounts;

ALTER TABLE tenants DROP COLUMN IF EXISTS enabled_currencies;

COMMIT;
