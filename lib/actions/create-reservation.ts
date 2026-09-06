"use server"

import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"
import type { ReservationFormData } from "@/lib/stores/reservation-form-store"
import { validateRoomCapacity } from "@/lib/utils/room-capacity"
import { isPlausibleStay, logImplausibleDatePayload } from "@/lib/utils/date-validation"
import { sendReservationNotifications } from "@/lib/services/reservation-emails"
import {
  computePricing,
  enumerateNights,
  validatePricingInput,
  type DiscountMode,
  type NightRate,
  type PricingInput,
} from "@/lib/pricing/engine"

/** Map internal block_type enum → Hebrew label so conflict error messages
 *  read naturally in the admin UI (never show raw enum strings). */
const BLOCK_TYPE_LABEL_HE: Record<string, string> = {
  maintenance: "תחזוקה",
  manual_block: "חסימה ידנית",
  owner_use: "שימוש בעלים",
  deep_cleaning: "ניקיון יסודי",
  temporary_out_of_order: "לא תקין זמנית",
  other: "אחר",
}

export async function getFormOptions(_tenantId: string) {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  const roomTypes = await db`
    SELECT id, name, max_occupancy, default_occupancy, base_price, extra_person_price,
           max_adults, max_children, max_infants
    FROM room_types
    WHERE tenant_id = ${tenantId} AND is_active = true
    ORDER BY sort_order, name
  `

  const ratePlans = await db`
    SELECT id, name, type, modifier_type, modifier_value
    FROM rate_plans
    WHERE tenant_id = ${tenantId} AND is_active = true
    ORDER BY name
  `

  return { roomTypes, ratePlans }
}

/**
 * Single source of truth for room availability.
 * Returns only rooms that are ACTUALLY free for the given date range.
 * Excludes: blocked, maintenance, unavailable rooms + rooms with overlapping reservations.
 */
export async function getAvailableRooms(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  checkIn: string,
  checkOut: string,
  excludeReservationId?: string
) {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  if (!checkIn || !checkOut || checkOut <= checkIn) return []

  // Merge per-room overrides with room_types defaults.
  // Column names match what Room Management writes (rooms.max_occupancy,
  // rooms.default_guests, rooms.max_adults/children/infants) with
  // room_types as the inheritance fallback when the per-room field is NULL.
  const rooms = excludeReservationId
    ? await db`
        SELECT r.id, r.room_number, r.status, r.room_type_id,
          rt.name AS room_type_name,
          COALESCE(r.max_occupancy, rt.max_occupancy)      AS max_occupancy,
          COALESCE(r.default_guests, rt.default_occupancy) AS default_occupancy,
          COALESCE(r.max_adults,    rt.max_adults)         AS max_adults,
          COALESCE(r.max_children,  rt.max_children)       AS max_children,
          COALESCE(r.max_infants,   rt.max_infants)        AS max_infants,
          rt.base_price, rt.extra_person_price
        FROM rooms r
        LEFT JOIN room_types rt ON rt.id = r.room_type_id
        WHERE r.tenant_id = ${tenantId}
          AND r.is_active = true
          AND r.status NOT IN ('blocked', 'maintenance', 'unavailable', 'inactive', 'out_of_order')
          AND NOT EXISTS (
            SELECT 1 FROM reservation_rooms rr
            JOIN reservations res ON res.id = rr.reservation_id
            WHERE rr.room_id = r.id
              AND res.status IN ('confirmed', 'checked_in')
              AND rr.check_in < ${checkOut}::date
              AND rr.check_out > ${checkIn}::date
              AND res.id != ${excludeReservationId}::uuid
          )
          AND NOT EXISTS (
            SELECT 1 FROM room_blocks rb
            WHERE rb.room_id = r.id
              AND rb.is_active = TRUE
              AND rb.start_date < ${checkOut}::date
              AND rb.end_date   > ${checkIn}::date
          )
        ORDER BY r.room_number
      `
    : await db`
        SELECT r.id, r.room_number, r.status, r.room_type_id,
          rt.name AS room_type_name,
          COALESCE(r.max_occupancy, rt.max_occupancy)      AS max_occupancy,
          COALESCE(r.default_guests, rt.default_occupancy) AS default_occupancy,
          COALESCE(r.max_adults,    rt.max_adults)         AS max_adults,
          COALESCE(r.max_children,  rt.max_children)       AS max_children,
          COALESCE(r.max_infants,   rt.max_infants)        AS max_infants,
          rt.base_price, rt.extra_person_price
        FROM rooms r
        LEFT JOIN room_types rt ON rt.id = r.room_type_id
        WHERE r.tenant_id = ${tenantId}
          AND r.is_active = true
          AND r.status NOT IN ('blocked', 'maintenance', 'unavailable', 'inactive', 'out_of_order')
          AND NOT EXISTS (
            SELECT 1 FROM reservation_rooms rr
            JOIN reservations res ON res.id = rr.reservation_id
            WHERE rr.room_id = r.id
              AND res.status IN ('confirmed', 'checked_in')
              AND rr.check_in < ${checkOut}::date
              AND rr.check_out > ${checkIn}::date
          )
          AND NOT EXISTS (
            SELECT 1 FROM room_blocks rb
            WHERE rb.room_id = r.id
              AND rb.is_active = TRUE
              AND rb.start_date < ${checkOut}::date
              AND rb.end_date   > ${checkIn}::date
          )
        ORDER BY r.room_number
      `

  return rooms
}

export async function searchGuests(_tenantId: string, query: string) {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  if (!query || query.length < 2) return []

  const results = await db`
    SELECT id, first_name, last_name, full_name, phone, email, is_vip, country
    FROM guests
    WHERE tenant_id = ${tenantId}
      AND (
        full_name ILIKE ${"%" + query + "%"}
        OR phone ILIKE ${"%" + query + "%"}
        OR email ILIKE ${"%" + query + "%"}
      )
    ORDER BY full_name
    LIMIT 10
  `

  return results
}

interface CreateResult {
  success: boolean
  error?: string
  reservationId?: string
  reservationNumber?: string
}

export async function createReservation(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  propertyId: string,
  form: Partial<ReservationFormData> & Pick<ReservationFormData, "firstName" | "lastName" | "phone" | "checkIn" | "checkOut" | "source">
): Promise<CreateResult> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  // Apply defaults for optional new fields
  const rooms = form.rooms || []
  const pricePerNight = form.pricePerNight || 0
  const roomId = form.roomId || ""
  const roomTypeId = form.roomTypeId || ""
  const discountPercent = form.discountPercent || 0
  const discountAmount = form.discountAmount || 0
  const extraChargesArr = Array.isArray(form.extraCharges) ? form.extraCharges : []
  const extraChargesTotal = extraChargesArr.reduce((s, c) => s + (c.amount || 0), 0)
  const taxExempt = form.taxExempt ?? false
  const deposit = form.deposit || 0
  const amountPaid = form.amountPaid || 0
  const priceMode = form.priceMode || "auto"
  const manualNightlyRate = form.manualNightlyRate ?? null
  const manualTotal = form.manualTotal ?? null
  const discountMode: DiscountMode =
    form.discountMode ||
    (discountPercent > 0 ? "percent_total" : discountAmount > 0 ? "amount_total" : "none")
  const discountValue =
    form.discountValue ?? (discountPercent > 0 ? discountPercent : discountAmount)
  const vatInclusive = form.vatInclusive ?? true
  const currency = form.currency || "ILS"
  const ratePlanId = form.ratePlanId || null
  const adults = form.adults ?? 1
  const children = form.children ?? 0
  const infants = form.infants ?? 0
  const isVip = form.isVip ?? false
  const earlyCheckIn = form.earlyCheckIn ?? false
  const lateCheckOut = form.lateCheckOut ?? false
  const accessible = form.accessible ?? false
  const status = form.status || "confirmed"
  const boardType = form.boardType || "room_only"
  const language = form.language || "he"
  const country = form.country || "IL"

  // Server-side validation
  if (!form.firstName) return { success: false, error: "חובה להזין שם פרטי" }
  if (!form.lastName) return { success: false, error: "חובה להזין שם משפחה" }
  if (!form.phone) return { success: false, error: "חובה להזין טלפון" }
  if (!form.source) return { success: false, error: "חובה לבחור מקור הזמנה" }
  if (!form.checkIn) return { success: false, error: "חובה להזין תאריך הגעה" }
  if (!form.checkOut) return { success: false, error: "חובה להזין תאריך עזיבה" }
  if (form.checkOut <= form.checkIn) return { success: false, error: "תאריך עזיבה חייב להיות אחרי הגעה" }
  const today = new Date().toISOString().slice(0, 10)
  if (form.checkIn < today) return { success: false, error: "לא ניתן ליצור הזמנה בתאריך שעבר" }

  // Plausibility floor + sliding window — rejects any year < 2020 and any
  // date further than 1y past / 3y future. Prevents the "year-2001" class
  // of corruption from reaching the INSERT regardless of which entry point
  // sent it (form, calendar drag, channel import).
  {
    const overall = isPlausibleStay(form.checkIn, form.checkOut)
    if (!overall.ok) {
      logImplausibleDatePayload("createReservation/overall", {
        checkIn: form.checkIn,
        checkOut: form.checkOut,
      })
      return { success: false, error: overall.reason || "תאריך ההזמנה אינו תקין. אנא בדוק את תאריכי הכניסה והיציאה." }
    }
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i]
      if (!r.roomId) continue
      const perRoom = isPlausibleStay(r.checkIn || form.checkIn, r.checkOut || form.checkOut)
      if (!perRoom.ok) {
        logImplausibleDatePayload(`createReservation/room[${i}]`, {
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          raw: { roomId: r.roomId },
        })
        return { success: false, error: `חדר ${i + 1}: ${perRoom.reason}` }
      }
    }
  }
  const hasRooms = rooms.length > 0
  if (!hasRooms && !roomId && !roomTypeId) return { success: false, error: "חובה לבחור חדר או סוג חדר" }
  if (!hasRooms && pricePerNight <= 0) return { success: false, error: "מחיר ללילה חייב להיות גדול מ-0" }

  // Validate room availability + capacity for ALL rooms. Each row must be
  // checked against its OWN check-in/out — NOT the reservation's outer span.
  // Rooms in a multi-room reservation can have different date ranges; using
  // the aggregate span would flag a shorter-stay room as unavailable whenever
  // *any* overlapping booking touches the outer range (even though the actual
  // requested dates are fine).
  const roomsToCheck: { roomId: string; checkIn: string; checkOut: string; adults: number; children: number; infants: number }[] =
    hasRooms
      ? rooms.filter((r) => r.roomId).map((r) => ({
          roomId: r.roomId,
          checkIn: r.checkIn || form.checkIn,
          checkOut: r.checkOut || form.checkOut,
          adults: r.adults ?? 1,
          children: r.children ?? 0,
          infants: r.infants ?? 0,
        }))
      : roomId
        ? [{ roomId, checkIn: form.checkIn, checkOut: form.checkOut, adults, children, infants }]
        : []

  for (const rc of roomsToCheck) {
    // Look up room status + metadata ONCE. Order of checks below is
    // deliberate: reject on room-level status (blocked / maintenance /
    // inactive) FIRST with a clear reason, so admins don't see a generic
    // "not available in selected dates" message when the real cause is a
    // blocked room. Only if the room is eligible do we probe date conflicts.
    const [room] = await db<
      { room_number: string; status: string; room_type_id: string; is_active: boolean }[]
    >`
      SELECT room_number, status, room_type_id, is_active
      FROM rooms
      WHERE id = ${rc.roomId} AND tenant_id = ${tenantId}
    `
    if (!room) return { success: false, error: "חדר שנבחר לא נמצא" }
    const rnum = room.room_number || ""
    if (!room.is_active) return { success: false, error: `חדר ${rnum} לא פעיל — בחר חדר אחר` }
    if (room.status === "blocked") return { success: false, error: `חדר ${rnum} חסום לתפעול — בחר חדר אחר` }
    if (room.status === "maintenance") return { success: false, error: `חדר ${rnum} בתחזוקה — בחר חדר אחר` }
    if (room.status === "unavailable") return { success: false, error: `חדר ${rnum} לא זמין — בחר חדר אחר` }

    const [available] = await db`
      SELECT check_room_availability(
        ${tenantId}::uuid, ${rc.roomId}::uuid,
        ${rc.checkIn}::date, ${rc.checkOut}::date
      ) as ok
    `
    if (!available?.ok) {
      // Dig into the reason. `rooms.status` is 'available' at this point
      // (we already short-circuited on legacy statuses above), so the
      // rejection must come from either a room_block or a reservation
      // overlap. Query both so the admin sees a precise message.
      const [blockHit] = await db<
        { start_date: string; end_date: string; block_type: string }[]
      >`
        SELECT start_date::text AS start_date, end_date::text AS end_date, block_type
        FROM room_blocks
        WHERE tenant_id = ${tenantId}::uuid
          AND room_id = ${rc.roomId}::uuid
          AND is_active = TRUE
          AND start_date < ${rc.checkOut}::date
          AND end_date   > ${rc.checkIn}::date
        LIMIT 1
      `
      if (blockHit) {
        const typeLabel = BLOCK_TYPE_LABEL_HE[blockHit.block_type] || blockHit.block_type
        return {
          success: false,
          error: `חדר ${rnum} חסום (${typeLabel}) בתאריכים ${blockHit.start_date} — ${blockHit.end_date}`,
        }
      }
      const [resHit] = await db<{ check_in: string; check_out: string }[]>`
        SELECT rr.check_in::text AS check_in, rr.check_out::text AS check_out
        FROM reservation_rooms rr
        JOIN reservations res ON res.id = rr.reservation_id
        WHERE rr.room_id = ${rc.roomId}::uuid
          AND res.tenant_id = ${tenantId}::uuid
          AND res.status IN ('confirmed', 'checked_in')
          AND rr.check_in  < ${rc.checkOut}::date
          AND rr.check_out > ${rc.checkIn}::date
        LIMIT 1
      `
      if (resHit) {
        return {
          success: false,
          error: `חדר ${rnum} מוזמן ע״י הזמנה אחרת בתאריכים ${resHit.check_in} — ${resHit.check_out}`,
        }
      }
      return { success: false, error: `חדר ${rnum} לא זמין בתאריכים שנבחרו` }
    }

    // CORE RULE — room capacity. Read merged per-room override + type fallback
    // so validation mirrors the values the reservation form used. Composition
    // is checked per-row (each room's own adults/children/infants), NOT the
    // reservation aggregate — a multi-room booking can split guests across
    // rooms and a blanket aggregate check would reject valid configurations.
    const [effective] = await db<
      {
        max_occupancy: number | null
        max_adults: number | null
        max_children: number | null
        max_infants: number | null
      }[]
    >`
      SELECT
        COALESCE(r.max_occupancy, rt.max_occupancy) AS max_occupancy,
        COALESCE(r.max_adults,    rt.max_adults)    AS max_adults,
        COALESCE(r.max_children,  rt.max_children)  AS max_children,
        COALESCE(r.max_infants,   rt.max_infants)   AS max_infants
      FROM rooms r
      LEFT JOIN room_types rt ON rt.id = r.room_type_id
      WHERE r.id = ${rc.roomId}
    `
    if (effective && effective.max_occupancy != null) {
      const check = validateRoomCapacity(
        { max_occupancy: effective.max_occupancy,
          max_adults: effective.max_adults,
          max_children: effective.max_children,
          max_infants: effective.max_infants },
        { adults: rc.adults, children: rc.children, infants: rc.infants },
      )
      if (!check.ok) return { success: false, error: check.reason }
    }
  }

  // Calculate totals.
  // `nights` here is the reservation's outer span (MAX checkOut − MIN checkIn).
  // Base amount must be computed per-room (rate × own-nights) — rooms can
  // differ in length inside one reservation; a single-span multiplication
  // overcharges the shorter stays. Mirrors computeDerived on the client.
  const nights = Math.round((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86400000)
  const totalNightlyRate = hasRooms
    ? rooms.reduce((sum, r) => sum + (r.ratePerNight || 0), 0)
    : pricePerNight
  const baseAmount = hasRooms
    ? rooms.reduce((sum, r) => {
        const rci = r.checkIn ? new Date(r.checkIn) : null
        const rco = r.checkOut ? new Date(r.checkOut) : null
        const rNights =
          rci && rco ? Math.max(0, Math.round((rco.getTime() - rci.getTime()) / 86400000)) : 0
        return sum + (r.ratePerNight || 0) * rNights
      }, 0)
    : pricePerNight * nights
  // VAT rate from tenant settings (percent → fraction). The server is the source
  // of truth — the client's taxAmount is never trusted for the INSERT. The rate
  // is then STORED on the reservation, because tenants.vat_rate is mutable: it
  // was already changed 17 → 18 here, and without a per-row copy every future
  // recompute would silently restate older reservations.
  const [tenantRow] = await db<{ vat_rate: string | number | null }[]>`
    SELECT vat_rate FROM tenants WHERE id = ${tenantId}
  `
  const tenantVatFraction = Math.max(0, (Number(tenantRow?.vat_rate) || 0) / 100)

  // One NightRate per ROOM-night reproduces the per-room pricing above exactly;
  // everything after that is lib/pricing/engine.ts. There is no second formula.
  const pricingNights: NightRate[] = hasRooms
    ? rooms.flatMap((r) =>
        enumerateNights(r.checkIn || form.checkIn, r.checkOut || form.checkOut).map((date) => ({
          date,
          baseRate: r.ratePerNight || 0,
          appliedRate: r.ratePerNight || 0,
          source: "room_type_base" as const,
          ratePlanId,
          losRuleApplied: null,
        })),
      )
    : enumerateNights(form.checkIn, form.checkOut).map((date) => ({
        date,
        baseRate: pricePerNight,
        appliedRate: pricePerNight,
        source: "room_type_base" as const,
        ratePlanId,
        losRuleApplied: null,
      }))

  const pricingInput: PricingInput = {
    nights: pricingNights,
    priceMode,
    manualNightlyRate,
    manualTotal,
    discountMode,
    discountValue,
    extraCharges: extraChargesTotal,
    vatInclusive,
    vatRate: tenantVatFraction,
    vatExempt: taxExempt,
    // A deposit is a payment, not a second deduction.
    payments: amountPaid + deposit,
    currency,
    exchangeRate: 1,
  }

  const pricingErrors = validatePricingInput(pricingInput)
  if (pricingErrors.length > 0) {
    return { success: false, error: pricingErrors[0].message }
  }

  const pricing = computePricing(pricingInput)
  const taxAmount = pricing.vatAmount
  const grandTotal = pricing.grandTotal
  // Store the rate the reservation BELONGS to, even when it is exempt. Zeroing
  // it here would destroy that fact, so clearing "פטור ממע״מ" on a later edit
  // would silently re-save the stay at 0% VAT. Exemption is carried by
  // tax_exempt, which is what the engine actually reads.
  const storedVatRate = tenantVatFraction

  try {
    // 1. Create or find guest
    let guestId: string

    // Check if guest with same phone exists
    const [existing] = await db`
      SELECT id FROM guests
      WHERE tenant_id = ${tenantId} AND phone = ${form.phone}
      LIMIT 1
    `

    if (existing) {
      guestId = existing.id
      // Update guest info
      await db`
        UPDATE guests SET
          first_name = ${form.firstName},
          last_name = ${form.lastName},
          email = ${form.email || null},
          is_vip = ${isVip},
          country = ${country},
          updated_at = NOW()
        WHERE id = ${guestId}
      `
    } else {
      const [newGuest] = await db`
        INSERT INTO guests (tenant_id, first_name, last_name, phone, email, id_number,
          preferred_language, country, zip_code, is_vip, company, source)
        VALUES (${tenantId}, ${form.firstName}, ${form.lastName}, ${form.phone},
          ${form.email || null}, ${form.idNumber || null}, ${language},
          ${country}, ${form.zipCode || null}, ${isVip},
          ${form.company || null}, ${form.source})
        RETURNING id
      `
      guestId = newGuest.id
    }

    // 2. Create reservation (reservation_number auto-generated by trigger)
    const [reservation] = await db`
      INSERT INTO reservations (
        tenant_id, reservation_number, guest_id, property_id, status,
        check_in, check_out, adults, children, infants,
        source, channel, is_vip, is_early_checkin, is_late_checkout,
        meal_plan, special_requests, general_notes, internal_notes,
        payment_status, payment_method, deposit,
        discount_percent, discount_per_night, tax_exempt,
        subtotal, tax_amount, total_price, total_paid, company, agent,
        price_mode, manual_nightly_rate, manual_total,
        discount_mode, discount_value, vat_inclusive, vat_rate,
        currency, exchange_rate, pricing_breakdown, rate_plan_id,
        card_holder_name, card_last4, card_holder_id,
        card_expiry_month, card_expiry_year,
        card_approval_code, card_transaction_ref, card_installments
      ) VALUES (
        ${tenantId}, '', ${guestId}, ${propertyId}, ${status},
        ${form.checkIn}::date, ${form.checkOut}::date,
        ${adults}, ${children}, ${infants},
        ${form.source}, ${form.source}, ${isVip},
        ${earlyCheckIn}, ${lateCheckOut},
        ${boardType}, ${form.specialRequests || null},
        ${form.generalNotes || null}, ${form.internalNotes || null},
        ${form.paymentStatus || "unpaid"}, ${form.paymentMethod || null}, ${deposit},
        ${discountPercent},
        ${pricing.discountTotal / Math.max(nights, 1)},
        ${taxExempt},
        ${pricing.grossBeforeDiscount}, ${taxAmount}, ${grandTotal}, ${amountPaid},
        ${form.company || null}, ${form.company || null},
        ${priceMode}, ${manualNightlyRate}, ${manualTotal},
        ${discountMode}, ${discountValue}, ${vatInclusive}, ${storedVatRate},
        ${currency}, ${1}, ${JSON.stringify(pricing.breakdown)}::jsonb, ${ratePlanId}::uuid,
        ${form.cardHolderName || null}, ${form.cardLast4 || null}, ${form.cardHolderId || null},
        ${form.cardExpiryMonth || null}, ${form.cardExpiryYear || null},
        ${form.cardApprovalCode || null}, ${form.cardTransactionRef || null},
        ${form.cardInstallments || 1}
      )
      RETURNING id, reservation_number
    `

    // 3. Create reservation_rooms (multi-room or single). Each row now carries
    //    its own dates + composition + guest contact — see migration
    //    2026-04-21_reservation_rooms_per_room_fields.sql.
    if (hasRooms) {
      for (const room of rooms) {
        if (!room.roomId) continue
        const roomCheckIn = room.checkIn || form.checkIn
        const roomCheckOut = room.checkOut || form.checkOut
        await db`
          INSERT INTO reservation_rooms (
            tenant_id, reservation_id, room_id,
            check_in, check_out, rate_per_night,
            adults, children, infants,
            guest_first_name, guest_last_name, guest_phone, guest_email, guest_id_number,
            price_mode, manual_nightly_rate, manual_total,
            discount_mode, discount_value, vat_inclusive, vat_rate,
            currency, exchange_rate, rate_plan_id
          )
          VALUES (
            ${tenantId}, ${reservation.id}, ${room.roomId},
            ${roomCheckIn}::date, ${roomCheckOut}::date, ${room.ratePerNight},
            ${room.adults ?? 1}, ${room.children ?? 0}, ${room.infants ?? 0},
            ${room.guestFirstName || null}, ${room.guestLastName || null},
            ${room.guestPhone || null}, ${room.guestEmail || null}, ${room.guestIdNumber || null},
            ${room.priceMode || "auto"}, ${room.manualNightlyRate ?? null}, ${room.manualTotal ?? null},
            ${room.discountMode || "none"}, ${room.discountValue ?? 0},
            ${room.vatInclusive ?? vatInclusive}, ${storedVatRate},
            ${/* one invoice, one currency — the engine does no FX */ currency}, ${1},
            ${ratePlanId}::uuid
          )
        `
      }
    } else if (roomId) {
      await db`
        INSERT INTO reservation_rooms (
          tenant_id, reservation_id, room_id,
          check_in, check_out, rate_per_night,
          adults, children, infants,
          price_mode, manual_nightly_rate, manual_total,
          discount_mode, discount_value, vat_inclusive, vat_rate,
          currency, exchange_rate, rate_plan_id
        )
        VALUES (
          ${tenantId}, ${reservation.id}, ${roomId},
          ${form.checkIn}::date, ${form.checkOut}::date, ${pricePerNight},
          ${adults}, ${children}, ${infants},
          ${priceMode}, ${manualNightlyRate}, ${manualTotal},
          ${discountMode}, ${discountValue}, ${vatInclusive}, ${storedVatRate},
          ${currency}, ${1}, ${ratePlanId}::uuid
        )
      `
    }

    // Fire-and-forget notifications — don't await, don't block. The shared
    // service re-loads everything by id, decides internal vs guest email
    // server-side, and never throws.
    sendReservationNotifications(tenantId, reservation.id).catch(() => {})

    return {
      success: true,
      reservationId: reservation.id,
      reservationNumber: reservation.reservation_number,
    }
  } catch (err) {
    return {
      success: false,
      error: "שגיאה ביצירת ההזמנה: " + (err instanceof Error ? err.message : "unknown"),
    }
  }
}
