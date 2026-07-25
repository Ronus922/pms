"use server"

import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"
import type { ReservationEditData } from "@/lib/stores/reservation-edit-store"
import {
  computePricing,
  deriveHistoricalVatRate,
  enumerateNights,
  validatePricingInput,
  type NightRate,
  type PricingInput,
} from "@/lib/pricing/engine"
import { validateRoomCapacity } from "@/lib/utils/room-capacity"
import { isPlausibleStay, logImplausibleDatePayload } from "@/lib/utils/date-validation"
import { createCleaningTasksForCheckout, syncTaskTimesForReservation } from "@/lib/services/cleaning-tasks"

/**
 * Replace a room in an existing reservation.
 * Validates availability of the new room for the reservation dates.
 */
export async function replaceReservationRoom(
  _tenantId: string,
  reservationRoomId: string,
  reservationId: string,
  newRoomId: string,
  checkIn: string,
  checkOut: string,
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  try {
    // Plausibility gate — defence in depth for this legacy path. Even though
    // no UI calls replaceReservationRoom today, any external caller (script,
    // channel import, future feature) hitting this function with corrupted
    // dates is rejected with a clear Hebrew message, not a generic
    // "unavailable" error further down.
    {
      const plausible = isPlausibleStay(checkIn, checkOut)
      if (!plausible.ok) {
        logImplausibleDatePayload("replaceReservationRoom", {
          checkIn,
          checkOut,
          raw: { reservationId, reservationRoomId, newRoomId },
        })
        return { success: false, error: plausible.reason || "תאריך ההזמנה אינו תקין" }
      }
    }

    // Validate new room availability (exclude current reservation)
    const [available] = await db`
      SELECT check_room_availability(
        ${tenantId}::uuid, ${newRoomId}::uuid,
        ${checkIn}::date, ${checkOut}::date,
        ${reservationId}::uuid
      ) as ok
    `
    if (!available?.ok) {
      return { success: false, error: "החדר לא זמין בתאריכים שנבחרו" }
    }

    // Get new room info for rate + capacity limits.
    const [newRoom] = await db<
      {
        id: string
        base_price: number | string
        max_occupancy: number | null
        max_adults: number | null
        max_children: number | null
        max_infants: number | null
      }[]
    >`
      SELECT r.id, rt.base_price,
             COALESCE(r.max_occupancy, rt.max_occupancy) AS max_occupancy,
             COALESCE(r.max_adults,    rt.max_adults)    AS max_adults,
             COALESCE(r.max_children,  rt.max_children)  AS max_children,
             COALESCE(r.max_infants,   rt.max_infants)   AS max_infants
      FROM rooms r
      LEFT JOIN room_types rt ON rt.id = r.room_type_id
      WHERE r.id = ${newRoomId} AND r.tenant_id = ${tenantId}
    `

    // CORE RULE — target room capacity. See project_room_capacity_pricing_core.md §C.
    if (newRoom?.max_occupancy != null) {
      const [res] = await db<{ adults: number; children: number; infants: number }[]>`
        SELECT adults, children, infants FROM reservations
        WHERE id = ${reservationId} AND tenant_id = ${tenantId}
      `
      if (res) {
        const check = validateRoomCapacity(
          {
            max_occupancy: newRoom.max_occupancy,
            max_adults: newRoom.max_adults,
            max_children: newRoom.max_children,
            max_infants: newRoom.max_infants,
          },
          res,
        )
        if (!check.ok) return { success: false, error: check.reason }
      }
    }

    // Update reservation_rooms record
    await db`
      UPDATE reservation_rooms SET
        room_id = ${newRoomId},
        rate_per_night = COALESCE(${Number(newRoom?.base_price) || null}::numeric, rate_per_night),
        updated_at = NOW()
      WHERE id = ${reservationRoomId} AND tenant_id = ${tenantId}
    `

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "שגיאה בהחלפת חדר" }
  }
}

interface UpdateResult {
  success: boolean
  error?: string
}

/** postgres.js hands DATE columns back as Date objects; the engine works in
 *  ISO strings. `String(date).slice(0,10)` would produce "Mon Apr 13". */
function toIsoDate(v: unknown): string {
  if (v == null || v === "") return ""
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10)
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10)
}

export async function updateReservation(
  reservationId: string,
  _tenantId: string,
  guestId: string,
  data: ReservationEditData
): Promise<UpdateResult> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
  try {
    // CORE RULE — capacity against current room(s) before persisting updated
    // guest counts. See project_room_capacity_pricing_core.md §C.
    const resRooms = await db<
      {
        max_occupancy: number
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
      FROM reservation_rooms rr
      JOIN rooms r ON r.id = rr.room_id
      LEFT JOIN room_types rt ON rt.id = r.room_type_id
      WHERE rr.reservation_id = ${reservationId} AND rr.tenant_id = ${tenantId}
    `
    for (const rt of resRooms) {
      if (rt.max_occupancy == null) continue
      const check = validateRoomCapacity(rt, {
        adults: data.adults,
        children: data.children,
        infants: data.infants,
      })
      if (!check.ok) return { success: false, error: check.reason }
    }

    // ── Pricing — recomputed HERE, before anything is written ──
    //
    // The client's totals are a preview, never the figure that gets stored.
    // The engine is fed from reservation_rooms (already written by
    // updateReservationRooms earlier in the save flow) plus the operator's
    // pricing controls, and its output is what lands in the row.
    const priceRooms = await db<
      { check_in: Date | string; check_out: Date | string; rate_per_night: string | number | null }[]
    >`
      SELECT check_in, check_out, rate_per_night
      FROM reservation_rooms
      WHERE reservation_id = ${reservationId} AND tenant_id = ${tenantId}
      ORDER BY check_in
    `

    // The VAT rate comes from the reservation's OWN row, never from
    // tenants.vat_rate — that one is mutable (it went 17 -> 18) and would
    // restate every stay sold under the old rate. A row that predates the
    // pricing migration carries its rate implicitly in its own figures.
    const [priceRow] = await db<
      { vat_rate: string | null; total_price: string | null; tax_amount: string | null }[]
    >`
      SELECT vat_rate, total_price, tax_amount
      FROM reservations
      WHERE id = ${reservationId} AND tenant_id = ${tenantId}
    `
    if (!priceRow) return { success: false, error: "לא נמצאה הזמנה" }

    const storedVatRate = priceRow.vat_rate == null ? null : Number(priceRow.vat_rate)
    const resolvedVatRate =
      storedVatRate !== null && Number.isFinite(storedVatRate)
        ? storedVatRate
        : deriveHistoricalVatRate(Number(priceRow.total_price) || 0, Number(priceRow.tax_amount) || 0)

    const ratePlanId = data.ratePlanId || null
    const pricingNights: NightRate[] = priceRooms.flatMap((room) => {
      const rate = Number(room.rate_per_night) || 0
      return enumerateNights(
        toIsoDate(room.check_in) || data.checkIn,
        toIsoDate(room.check_out) || data.checkOut,
      ).map((date) => ({
        date,
        baseRate: rate,
        appliedRate: rate,
        source: "room_type_base" as const,
        ratePlanId,
        losRuleApplied: null,
      }))
    })

    const pricingInput: PricingInput = {
      nights: pricingNights,
      priceMode: data.priceMode,
      manualNightlyRate: data.manualNightlyRate,
      manualTotal: data.manualTotal,
      discountMode: data.discountMode,
      discountValue: data.discountValue,
      extraCharges: Math.max(0, Number(data.extraCharges) || 0),
      vatInclusive: data.vatInclusive,
      vatRate: resolvedVatRate,
      vatExempt: data.taxExempt,
      // A deposit is a payment, not a second deduction.
      payments: (Number(data.totalPaid) || 0) + (Number(data.deposit) || 0),
      currency: data.currency || "ILS",
      exchangeRate: Number(data.exchangeRate) || 1,
    }

    const pricingErrors = validatePricingInput(pricingInput)
    if (pricingErrors.length > 0) {
      return { success: false, error: pricingErrors[0].message }
    }

    // `resolvedVatRate` is stored as-is even when the stay is VAT exempt.
    // Zeroing it would destroy the rate the reservation belongs to, and
    // un-ticking "פטור ממע״מ" later would then silently price it at 0%.
    // Exemption is carried by tax_exempt, which is what the engine reads.
    const pricing = computePricing(pricingInput)
    const nightsCount = Math.max(pricing.nightsCount, 1)
    // Legacy mirrors, derived from the engine so there is one source of truth.
    // discount_percent is what ReservationPrintView re-derives its discount line
    // from (subtotal x discount_percent / 100), so it must match discountTotal.
    const discountPercent =
      data.discountMode === "percent_total" || data.discountMode === "percent_per_night"
        ? data.discountValue
        : 0

    // ── Update guest record ──
    // NOTE: `guests.full_name` is a GENERATED column (`first_name || ' ' || last_name`).
    // Writing to it throws "column can only be updated to DEFAULT"; the DB
    // recomputes it automatically when first_name/last_name change.
    await db`
      UPDATE guests SET
        first_name = ${data.firstName},
        last_name = ${data.lastName},
        phone = ${data.phone},
        email = ${data.email || null},
        id_number = ${data.idNumber || null},
        preferred_language = ${data.language},
        country = ${data.country},
        company = ${data.company || null},
        is_vip = ${data.isVip}
      WHERE id = ${guestId} AND tenant_id = ${tenantId}
    `

    // ── Update reservation record ──
    //
    // IMPORTANT: check_in / check_out / adults / children / infants are NOT
    // written here — reservation_rooms is the source of truth for those.
    // updateReservationRooms (called before this in the save flow) handles
    // both the per-row writes AND the denormalized aggregates on reservations.
    //
    // NOTE: reservations.balance_due is a GENERATED column
    //   (total_price - total_paid). Writing to it throws
    //   "column balance_due can only be updated to DEFAULT".
    //   The DB recomputes it whenever total_price or total_paid change.
    //
    // NOTE: `subtotal` is the GROSS before discount and before extras — that is
    //   what it has always held and what ReservationPrintView re-derives its
    //   discount line from. It is NOT the net-of-VAT figure.
    await db`
      UPDATE reservations SET
        status = ${data.status},
        payment_status = ${data.paymentStatus},
        payment_method = ${data.paymentMethod || null},
        source = ${data.source},
        agent = ${data.agent || null},
        ad_source = ${data.adSource || null},
        is_vip = ${data.isVip},
        is_early_checkin = ${data.earlyCheckIn},
        is_late_checkout = ${data.lateCheckOut},
        accessibility = ${data.accessible},
        special_requests = ${data.specialRequests || null},
        general_notes = ${data.generalNotes || null},
        internal_notes = ${data.internalNotes || null},
        reception_notes = ${data.receptionNotes || null},
        meal_plan = ${data.mealPlan || "none"},
        total_price = ${pricing.grandTotal},
        total_paid = ${data.totalPaid},
        deposit = ${data.deposit},
        subtotal = ${pricing.grossBeforeDiscount},
        tax_amount = ${pricing.vatAmount},
        tax_exempt = ${data.taxExempt},
        discount_percent = ${discountPercent},
        discount_per_night = ${pricing.discountTotal / nightsCount},
        price_mode = ${data.priceMode},
        manual_nightly_rate = ${data.manualNightlyRate},
        manual_total = ${data.manualTotal},
        discount_mode = ${data.discountMode},
        discount_value = ${data.discountValue},
        vat_inclusive = ${data.vatInclusive},
        vat_rate = ${resolvedVatRate},
        currency = ${data.currency || "ILS"},
        exchange_rate = ${pricingInput.exchangeRate},
        pricing_breakdown = ${JSON.stringify(pricing.breakdown)}::jsonb,
        rate_plan_id = ${ratePlanId}::uuid,
        card_holder_name = ${data.cardHolderName || null},
        card_last4 = ${data.cardLast4 || null},
        card_holder_id = ${data.cardHolderId || null},
        card_expiry_month = ${data.cardExpiryMonth || null},
        card_expiry_year = ${data.cardExpiryYear || null},
        card_approval_code = ${data.cardApprovalCode || null},
        card_transaction_ref = ${data.cardTransactionRef || null},
        card_installments = ${data.cardInstallments || 1},
        external_id = ${data.externalId || null},
        cancellation_policy = ${data.cancellationPolicy || null},
        updated_at = NOW()
      WHERE id = ${reservationId} AND tenant_id = ${tenantId}
    `

    // Room occupancy is DERIVED — do NOT write rooms.status for occupancy here.
    // On check-out: auto-create cleaning tasks + flip cleaning_state to dirty
    if (data.status === "checked_out") {
      await createCleaningTasksForCheckout(tenantId, reservationId, "manual_checkout")
    } else {
      // Reservation edit may have changed departure time — sync pending tasks
      await syncTaskTimesForReservation(tenantId, reservationId)
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "שגיאה בשמירת ההזמנה"
    return { success: false, error: message }
  }
}
