-- 2026-05-17 — Extra fields on cleaning tasks
-- guest_count: how many guests the room is being prepared for
-- image_url: optional manager-attached photo
-- created_by: user who created the manual task (so the cleaner card can show
--   "הוקצא ע"י: <name>" when there is no linked reservation/guest)

ALTER TABLE housekeeping_tasks
  ADD COLUMN IF NOT EXISTS guest_count INT,
  ADD COLUMN IF NOT EXISTS image_url   TEXT,
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES users(id) ON DELETE SET NULL;
