-- Configurable VAT rate per tenant. Previously hardcoded to 17% in the
-- reservation form store (TAX_RATE constant). Tenants may have different
-- obligations (Eilat exempt, non-IL businesses, etc.) — expose as a setting.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 17.00;

COMMENT ON COLUMN tenants.vat_rate IS
  'VAT / tax percentage applied to reservation pricing (e.g. 17.00 = 17%). Set to 0 to disable.';
