/**
 * Per-room pricing — the rules the edit panel and the server both rely on.
 *
 * The two claims worth pinning are the ones a future refactor is most likely to
 * break quietly:
 *   1. A per-room override produces THAT room's subtotal, and
 *   2. the reservation total is the sum of the rooms — except when the
 *      reservation itself is in `manual_total`, where the operator's figure
 *      wins and no per-room edit may move it.
 */
import { describe, it, expect } from "vitest"
import { computePricing, type PricingInput } from "./engine"
import {
  priceRoom,
  priceRooms,
  reservationNightsFromRooms,
  roomPricingControlsFromRow,
  validateRoomPricing,
  type ReservationPricingContext,
  type RoomPricingSource,
} from "./rooms"

const VAT = 0.18

/** Reservation context: VAT-inclusive, 18%, one currency. */
const CTX: ReservationPricingContext = {
  vatRate: VAT,
  vatExempt: false,
  vatInclusive: true,
  currency: "ILS",
  exchangeRate: 1,
  ratePlanId: null,
}

function room(over: Partial<RoomPricingSource> = {}): RoomPricingSource {
  return {
    checkIn: "2026-08-01",
    checkOut: "2026-08-04", // 3 nights
    ratePerNight: 500,
    priceMode: "auto",
    manualNightlyRate: null,
    manualTotal: null,
    discountMode: "none",
    discountValue: 0,
    vatInclusive: true,
    currency: "ILS",
    ...over,
  }
}

/** The reservation priced over whatever its rooms contribute — exactly what
 *  the store and updateReservation do. */
function reservation(
  rooms: RoomPricingSource[],
  ctx: ReservationPricingContext,
  over: Partial<PricingInput> = {},
) {
  return computePricing({
    nights: reservationNightsFromRooms(priceRooms(rooms, ctx)),
    priceMode: "auto",
    manualNightlyRate: null,
    manualTotal: null,
    discountMode: "none",
    discountValue: 0,
    extraCharges: 0,
    vatInclusive: ctx.vatInclusive,
    vatRate: ctx.vatRate,
    vatExempt: ctx.vatExempt,
    payments: 0,
    currency: ctx.currency,
    exchangeRate: ctx.exchangeRate,
    ...over,
  })
}

describe("a per-room override produces that room's subtotal", () => {
  it("auto = the system rate for every night", () => {
    const { result } = priceRoom(room(), CTX)
    expect(result.nightsCount).toBe(3)
    expect(result.grossBeforeDiscount).toBe(1500)
    expect(result.grandTotal).toBe(1500)
    // VAT-inclusive: the 1,500 already contains the tax.
    expect(result.netAmount).toBe(1271.19)
    expect(result.vatAmount).toBe(228.81)
  })

  it("manual_nightly replaces the system rate for THAT room only", () => {
    const overridden = room({ ratePerNight: 400, priceMode: "manual_nightly", manualNightlyRate: 350 })
    const { result } = priceRoom(overridden, CTX)
    expect(result.grandTotal).toBe(1050)
    expect(result.nights.every((n) => n.appliedRate === 350)).toBe(true)
    expect(result.nights.every((n) => n.source === "manual")).toBe(true)
    // The untouched room is unaffected.
    expect(priceRoom(room(), CTX).result.grandTotal).toBe(1500)
  })

  it("manual_total states the room's figure and spreads it across its nights", () => {
    const { result, nights } = priceRoom(room({ priceMode: "manual_total", manualTotal: 999 }), CTX)
    expect(result.grandTotal).toBe(999)
    expect(nights).toHaveLength(3)
    expect(nights.reduce((s, n) => s + n.appliedRate, 0)).toBe(999)
  })

  it("a room-level discount discounts only that room", () => {
    const discounted = room({
      checkOut: "2026-08-05", // 4 nights @ 300
      ratePerNight: 300,
      discountMode: "percent_total",
      discountValue: 25,
    })
    const { result } = priceRoom(discounted, CTX)
    expect(result.grossBeforeDiscount).toBe(1200)
    expect(result.discountTotal).toBe(300)
    expect(result.grandTotal).toBe(900)
  })

  it("a room that is VAT-exclusive contributes the grossed-up figure, not the raw one", () => {
    const exclusive = room({ checkOut: "2026-08-02", ratePerNight: 1000, vatInclusive: false })
    const { result, nights } = priceRoom(exclusive, CTX)
    expect(result.netAmount).toBe(1000)
    expect(result.vatAmount).toBe(180)
    expect(result.grandTotal).toBe(1180)
    // The reservation is VAT-inclusive, so the room hands it 1,180 — adding the
    // bare 1,000 would understate the invoice by exactly the tax.
    expect(nights.reduce((s, n) => s + n.appliedRate, 0)).toBe(1180)
  })
})

describe("the reservation total is the sum of its rooms", () => {
  const rooms = [
    room(),
    room({ ratePerNight: 400, priceMode: "manual_nightly", manualNightlyRate: 350 }),
  ]

  it("gross = every room's subtotal added up", () => {
    const outcomes = priceRooms(rooms, CTX)
    const sumOfRooms = outcomes.reduce((s, o) => s + o.result.grandTotal, 0)
    expect(sumOfRooms).toBe(2550) // 1500 + 1050

    const res = reservation(rooms, CTX)
    expect(res.grossBeforeDiscount).toBe(2550)
    expect(res.grandTotal).toBe(2550)
  })

  it("editing one room moves the reservation by exactly that room's delta", () => {
    const before = reservation(rooms, CTX).grandTotal
    const after = reservation(
      [rooms[0], room({ ratePerNight: 400, priceMode: "manual_nightly", manualNightlyRate: 300 })],
      CTX,
    ).grandTotal
    expect(before - after).toBe(150) // 3 nights x 50
  })

  it("a VAT-exclusive reservation sums its rooms net of VAT", () => {
    const ctx: ReservationPricingContext = { ...CTX, vatInclusive: false }
    const res = reservation([room()], ctx)
    // The room's 500/night is stated VAT-inclusive, so it contributes its net.
    expect(res.netAmount).toBe(1271.19)
    expect(res.grandTotal).toBe(1500)
  })
})

describe("a reservation-level manual total wins over the sum of the rooms", () => {
  const rooms = [
    room(),
    room({ ratePerNight: 400, priceMode: "manual_nightly", manualNightlyRate: 350 }),
  ]

  it("the stated figure lands exactly, and the room sum does not", () => {
    const sumOfRooms = priceRooms(rooms, CTX).reduce((s, o) => s + o.result.grandTotal, 0)
    expect(sumOfRooms).toBe(2550)

    const res = reservation(rooms, CTX, { priceMode: "manual_total", manualTotal: 2000 })
    expect(res.grandTotal).toBe(2000)
    expect(res.grandTotal).not.toBe(sumOfRooms)
  })

  it("no per-room edit can move it", () => {
    const overridden = [rooms[0], room({ priceMode: "manual_total", manualTotal: 99999 })]
    const res = reservation(overridden, CTX, { priceMode: "manual_total", manualTotal: 2000 })
    expect(res.grandTotal).toBe(2000)
  })

  it("and it is the reservation, not the rooms, that carries the override", () => {
    // Same rooms, mode dropped back to auto — the sum takes over again.
    const res = reservation(rooms, CTX)
    expect(res.grandTotal).toBe(2550)
  })
})

describe("reading controls back off a reservation_rooms row", () => {
  it("coerces the driver's strings and defaults a NULL vat_inclusive to true", () => {
    const controls = roomPricingControlsFromRow(
      {
        price_mode: "manual_nightly",
        manual_nightly_rate: "350.00",
        manual_total: null,
        discount_mode: "percent_total",
        discount_value: "12.50",
        vat_inclusive: null,
        currency: null,
      },
      "USD",
    )
    expect(controls).toEqual({
      priceMode: "manual_nightly",
      manualNightlyRate: 350,
      manualTotal: null,
      discountMode: "percent_total",
      discountValue: 12.5,
      vatInclusive: true,
      currency: "USD",
    })
  })

  it("an unknown mode falls back to the neutral one rather than reaching the DB CHECK", () => {
    const controls = roomPricingControlsFromRow({ price_mode: "bogus", discount_mode: "bogus" }, "ILS")
    expect(controls.priceMode).toBe("auto")
    expect(controls.discountMode).toBe("none")
  })

  it("a manual price of zero survives — null means 'not set', 0 means free", () => {
    expect(roomPricingControlsFromRow({ manual_total: "0" }, "ILS").manualTotal).toBe(0)
    expect(roomPricingControlsFromRow({ manual_total: null }, "ILS").manualTotal).toBe(null)
  })
})

describe("per-room validation uses the reservation's own validator", () => {
  it("rejects a negative manual nightly rate", () => {
    const errors = validateRoomPricing(
      room({ priceMode: "manual_nightly", manualNightlyRate: -1 }),
      CTX,
    )
    expect(errors.map((e) => e.field)).toContain("manualNightlyRate")
  })

  it("rejects a percentage discount above 100", () => {
    const errors = validateRoomPricing(
      room({ discountMode: "percent_per_night", discountValue: 140 }),
      CTX,
    )
    expect(errors.map((e) => e.field)).toContain("discountValue")
  })

  it("passes a well-formed room", () => {
    expect(validateRoomPricing(room(), CTX)).toEqual([])
  })
})
