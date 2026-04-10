"use server"

import { db } from "@/lib/db"
import type { ReservationEditData } from "@/lib/stores/reservation-edit-store"
import { createCleaningTasksForCheckout, syncTaskTimesForReservation } from "@/lib/actions/cleaning"

interface UpdateResult {
  success: boolean
  error?: string
}

export async function updateReservation(
  reservationId: string,
  tenantId: string,
  guestId: string,
  data: ReservationEditData
): Promise<UpdateResult> {
  try {
    // ── Update guest record ──
    await db`
      UPDATE guests SET
        first_name = ${data.firstName},
        last_name = ${data.lastName},
        full_name = ${`${data.firstName} ${data.lastName}`.trim()},
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
    await db`
      UPDATE reservations SET
        status = ${data.status},
        payment_status = ${data.paymentStatus},
        payment_method = ${data.paymentMethod || null},
        source = ${data.source},
        agent = ${data.agent || null},
        ad_source = ${data.adSource || null},
        check_in = ${data.checkIn}::date,
        check_out = ${data.checkOut}::date,
        adults = ${data.adults},
        children = ${data.children},
        infants = ${data.infants},
        is_vip = ${data.isVip},
        is_early_checkin = ${data.earlyCheckIn},
        is_late_checkout = ${data.lateCheckOut},
        accessibility = ${data.accessible},
        special_requests = ${data.specialRequests || null},
        general_notes = ${data.generalNotes || null},
        internal_notes = ${data.internalNotes || null},
        reception_notes = ${data.receptionNotes || null},
        meal_plan = ${data.mealPlan || "none"},
        total_price = ${data.totalPrice},
        total_paid = ${data.totalPaid},
        balance_due = ${data.balanceDue},
        deposit = ${data.deposit},
        discount_percent = ${data.discountPercent},
        tax_exempt = ${data.taxExempt},
        tax_amount = ${data.taxAmount},
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
