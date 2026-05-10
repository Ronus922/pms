-- Operational check-in / check-out times for partial-day occupancy rendering.
--
-- Adds optional Sabbath (Shabbat/holiday) overrides. Default times already exist
-- on `tenants` as `default_checkin_time` / `default_checkout_time` (15:00/11:00).
--
-- Priority on the calendar is resolved in app code:
--   1. reservations.actual_checkin_time / actual_checkout_time (if set)
--   2. reservations.estimated_arrival_time / estimated_departure_time (if set)
--   3. tenants.sabbath_checkin_time / sabbath_checkout_time (if set AND day is Fri/Sat)
--   4. tenants.default_checkin_time / default_checkout_time

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS sabbath_checkin_time  TIME,
  ADD COLUMN IF NOT EXISTS sabbath_checkout_time TIME;

COMMENT ON COLUMN tenants.sabbath_checkin_time  IS 'Optional Sabbath/holiday check-in time override. NULL = use default_checkin_time.';
COMMENT ON COLUMN tenants.sabbath_checkout_time IS 'Optional Sabbath/holiday check-out time override. NULL = use default_checkout_time.';
