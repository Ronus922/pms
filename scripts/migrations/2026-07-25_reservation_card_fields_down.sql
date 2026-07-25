-- ============================================================================
-- Rollback for 2026-07-25_reservation_card_fields_up.sql
--
-- Additive only, no backfill, so this is a clean removal.
-- `card_holder_id` is NOT dropped — it pre-dates this migration.
-- ============================================================================

BEGIN;

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_card_last4_check;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_card_expiry_month_check;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_card_expiry_year_check;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_card_installments_check;

ALTER TABLE reservations
  DROP COLUMN IF EXISTS card_holder_name,
  DROP COLUMN IF EXISTS card_last4,
  DROP COLUMN IF EXISTS card_expiry_month,
  DROP COLUMN IF EXISTS card_expiry_year,
  DROP COLUMN IF EXISTS card_approval_code,
  DROP COLUMN IF EXISTS card_transaction_ref,
  DROP COLUMN IF EXISTS card_installments;

COMMIT;
