"use server"

import { db } from "@/lib/db"
import type { ReservationFormData } from "@/lib/stores/reservation-form-store"

export async function getFormOptions(tenantId: string) {
  const rooms = await db`
    SELECT r.id, r.room_number, r.status, r.room_type_id,
      rt.name as room_type_name, rt.max_occupancy, rt.base_price
    FROM rooms r
    LEFT JOIN room_types rt ON rt.id = r.room_type_id
    WHERE r.tenant_id = ${tenantId} AND r.is_active = true
    ORDER BY r.room_number
  `

  const roomTypes = await db`
    SELECT id, name, max_occupancy, base_price
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

  return { rooms, roomTypes, ratePlans }
}

export async function searchGuests(tenantId: string, query: string) {
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
  tenantId: string,
  propertyId: string,
  form: Partial<ReservationFormData> & Pick<ReservationFormData, "firstName" | "lastName" | "phone" | "checkIn" | "checkOut" | "source">
): Promise<CreateResult> {
  // Apply defaults for optional new fields
  const rooms = form.rooms || []
  const pricePerNight = form.pricePerNight || 0
  const roomId = form.roomId || ""
  const roomTypeId = form.roomTypeId || ""
  const discountPercent = form.discountPercent || 0
  const discountAmount = form.discountAmount || 0
  const extraCharges = form.extraCharges || 0
  const taxExempt = form.taxExempt ?? false
  const deposit = form.deposit || 0
  const amountPaid = form.amountPaid || 0
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
  const hasRooms = rooms.length > 0
  if (!hasRooms && !roomId && !roomTypeId) return { success: false, error: "חובה לבחור חדר או סוג חדר" }
  if (!hasRooms && pricePerNight <= 0) return { success: false, error: "מחיר ללילה חייב להיות גדול מ-0" }

  // Check room availability if specific room selected
  if (roomId) {
    const [available] = await db`
      SELECT check_room_availability(
        ${tenantId}::uuid, ${roomId}::uuid,
        ${form.checkIn}::date, ${form.checkOut}::date
      ) as ok
    `
    if (!available?.ok) {
      return { success: false, error: "החדר לא זמין בתאריכים שנבחרו" }
    }

    // Check room status
    const [room] = await db`SELECT status, room_type_id FROM rooms WHERE id = ${roomId}`
    if (room?.status === "blocked") return { success: false, error: "החדר חסום" }
    if (room?.status === "maintenance") return { success: false, error: "החדר בתחזוקה" }

    // Check capacity
    if (room?.room_type_id) {
      const [rt] = await db`SELECT max_occupancy FROM room_types WHERE id = ${room.room_type_id}`
      if (rt && (adults + children) > rt.max_occupancy) {
        return { success: false, error: "מספר האורחים חורג מקיבולת החדר" }
      }
    }
  }

  // Calculate totals
  const nights = Math.round((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86400000)
  const totalNightlyRate = hasRooms
    ? rooms.reduce((sum, r) => sum + (r.ratePerNight || 0), 0)
    : pricePerNight
  const baseAmount = totalNightlyRate * nights
  let discountTotal = discountPercent > 0 ? baseAmount * (discountPercent / 100) : discountAmount
  const afterDiscount = Math.max(0, baseAmount - discountTotal) + extraCharges
  const taxAmount = taxExempt ? 0 : afterDiscount * 0.17
  const grandTotal = afterDiscount + taxAmount
  const balanceDue = Math.max(0, grandTotal - amountPaid - deposit)

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
        subtotal, tax_amount, total_price, total_paid, company, agent
      ) VALUES (
        ${tenantId}, '', ${guestId}, ${propertyId}, ${status},
        ${form.checkIn}::date, ${form.checkOut}::date,
        ${adults}, ${children}, ${infants},
        ${form.source}, ${form.source}, ${isVip},
        ${earlyCheckIn}, ${lateCheckOut},
        ${boardType}, ${form.specialRequests || null},
        ${form.generalNotes || null}, ${form.internalNotes || null},
        ${form.paymentStatus || "unpaid"}, ${form.paymentMethod || null}, ${deposit},
        ${discountPercent}, ${discountAmount / Math.max(nights, 1)},
        ${taxExempt},
        ${baseAmount}, ${taxAmount}, ${grandTotal}, ${amountPaid},
        ${form.company || null}, ${form.company || null}
      )
      RETURNING id, reservation_number
    `

    // 3. Create reservation_rooms (multi-room or single)
    if (hasRooms) {
      for (const room of rooms) {
        if (!room.roomId) continue
        await db`
          INSERT INTO reservation_rooms (tenant_id, reservation_id, room_id, check_in, check_out, rate_per_night)
          VALUES (${tenantId}, ${reservation.id}, ${room.roomId},
            ${form.checkIn}::date, ${form.checkOut}::date, ${room.ratePerNight})
        `
      }
    } else if (roomId) {
      await db`
        INSERT INTO reservation_rooms (tenant_id, reservation_id, room_id, check_in, check_out, rate_per_night)
        VALUES (${tenantId}, ${reservation.id}, ${roomId},
          ${form.checkIn}::date, ${form.checkOut}::date, ${pricePerNight})
      `
    }

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
