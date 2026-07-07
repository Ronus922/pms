-- Reservation email notifications (2026-07-07)
--
-- Audit result: tenants already has name, brand_name, address, phone, website,
-- email, logo_url, default_checkin_time, default_checkout_time. Only three
-- fields are missing for the reservation-notifications feature.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reservation_notify_emails text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS guest_email_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS terms_text text;

-- Seed internal recipients from the legacy single notification_email so existing
-- tenants keep receiving mail without re-configuring. Empty stays empty (an empty
-- reservation_notify_emails means "do not send the internal email").
UPDATE tenants
   SET reservation_notify_emails = notification_email
 WHERE reservation_notify_emails IS NULL
   AND notification_email IS NOT NULL
   AND notification_email <> '';
