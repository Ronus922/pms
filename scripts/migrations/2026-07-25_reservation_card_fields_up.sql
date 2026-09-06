-- ============================================================================
-- Reservation card fields — items 8 + 9
-- 2026-07-25
--
-- Today the create form collects six card fields, ships them to the server
-- action, and they are DROPPED before the INSERT: no card column exists except
-- the orphaned `card_holder_id`, which is itself never written or read. The
-- edit panel has no card inputs at all and renders a hardcoded masked literal.
-- These columns close that chain.
--
-- PCI: there is deliberately NO column for the full PAN and NO column for the
-- CVV/CVC. Only the last four digits are stored. Do not add either later without
-- a tokenisation/vault design — an encrypted PAN column is still a PAN column.
--
-- Safe to re-run. Rollback: 2026-07-25_reservation_card_fields_down.sql
-- ============================================================================

BEGIN;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS card_holder_name     TEXT,
  ADD COLUMN IF NOT EXISTS card_last4           TEXT,
  ADD COLUMN IF NOT EXISTS card_expiry_month    TEXT,
  ADD COLUMN IF NOT EXISTS card_expiry_year     TEXT,
  ADD COLUMN IF NOT EXISTS card_approval_code   TEXT,
  ADD COLUMN IF NOT EXISTS card_transaction_ref TEXT,
  ADD COLUMN IF NOT EXISTS card_installments    INTEGER DEFAULT 1;

-- Enforce the PCI boundary at the database level: anything longer than four
-- digits is a full card number and must be rejected, not merely discouraged.
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_card_last4_check;
ALTER TABLE reservations ADD  CONSTRAINT reservations_card_last4_check
  CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$');

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_card_expiry_month_check;
ALTER TABLE reservations ADD  CONSTRAINT reservations_card_expiry_month_check
  CHECK (card_expiry_month IS NULL OR card_expiry_month ~ '^(0[1-9]|1[0-2])$');

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_card_expiry_year_check;
ALTER TABLE reservations ADD  CONSTRAINT reservations_card_expiry_year_check
  CHECK (card_expiry_year IS NULL OR card_expiry_year ~ '^[0-9]{4}$');

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_card_installments_check;
ALTER TABLE reservations ADD  CONSTRAINT reservations_card_installments_check
  CHECK (card_installments IS NULL OR (card_installments >= 1 AND card_installments <= 36));

COMMENT ON COLUMN reservations.card_last4 IS
  'Last four digits ONLY. Storing a full PAN here is a PCI violation and is blocked by reservations_card_last4_check.';

-- No backfill: there is no card data anywhere to migrate. Confirmed by the
-- absence of any card column other than card_holder_id, which is empty.
DO $$
DECLARE existing INTEGER;
BEGIN
  SELECT count(*) INTO existing FROM reservations WHERE card_holder_id IS NOT NULL;
  RAISE NOTICE 'card_holder_id populated on % reservations (expected 0 — nothing to migrate)', existing;
END $$;

COMMIT;
