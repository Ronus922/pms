-- 2026-05-17 — Maintenance: per-user assign capability
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_assign_maintenance BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET can_assign_maintenance = TRUE
WHERE role IN ('super_admin','admin')
  AND can_assign_maintenance = FALSE;

SELECT 'MIGRATION_OK' AS result;
