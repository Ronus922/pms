/**
 * Per-room pricing — the layer between ONE room and ONE reservation.
 *
 * This module contains no arithmetic of its own. Every figure it returns was
 * produced by lib/pricing/engine.ts; all this file decides is WHICH engine call
 * to make and WHICH of its outputs is the room's contribution to the
 * reservation. Money math keeps exactly one home, and the store, the edit UI
 * and the server action all reach that home through here — so a room subtotal
 * shown on screen is the same number that lands in the database.
 *
 * Two rules the shape of this file encodes:
 *
 *  - The VAT rate is a property of the RESERVATION, never of a room. A room may
 *    declare whether ITS rate already contains VAT (`vatInclusive`), but the
 *    rate itself comes from reservations.vat_rate — the era the stay was sold
 *    in. tenants.vat_rate is mutable and cannot restate history.
 *
 *  - One invoice never adds a VAT-inclusive figure to a VAT-exclusive one. A
 *    room whose convention differs from the reservation's contributes the
 *    engine's own conversion of its total, not the raw number.
 */

import {
  computePricing,
  enumerateNights,
  resolveNightRates,
  validatePricingInput,
  type DiscountMode,
  type NightRate,
  type PriceMode,
  type PricingInput,
  type PricingResult,
  type PricingValidationError,
} from "./engine"

/* ── Shapes ─────────────────────────────────────────────────── */

/** The pricing controls a single room exposes — the same set the reservation
 *  has. Mirrors the reservation_rooms columns added by the 2026-07-25 pricing
 *  migration. */
export interface RoomPricingControls {
  priceMode: PriceMode
  manualNightlyRate: number | null
  manualTotal: number | null
  discountMode: DiscountMode
  discountValue: number
  vatInclusive: boolean
  currency: string
}

/** Structural on purpose: the store's `ReservationRoom` satisfies it, so this
 *  module never imports a store (which would drag a server action into a
 *  server action) and both sides can call the same function. */
export interface RoomPricingSource extends RoomPricingControls {
  checkIn: string
  checkOut: string
  /** The system rate for this room, before any per-room override. */
  ratePerNight: number
}

/** What the reservation imposes on every one of its rooms. */
export interface ReservationPricingContext {
  /** FRACTION (0.18), from reservations.vat_rate — never tenants.vat_rate. */
  vatRate: number
  vatExempt: boolean
  /** The convention the RESERVATION-level figure is expressed in. */
  vatInclusive: boolean
  currency: string
  exchangeRate: number
  ratePlanId: string | null
}

export interface RoomPricingOutcome {
  /** The room priced on its own terms. `grandTotal` is the room's subtotal. */
  result: PricingResult
  /**
   * The room's nights restated so their applied rates sum EXACTLY to what this
   * room contributes to the reservation. Hand these to the reservation-level
   * computePricing and its gross becomes the sum of the rooms by construction —
   * no separate addition anywhere.
   */
  nights: NightRate[]
}

/* ── Coercion (postgres.js hands NUMERIC back as string) ────── */

const PRICE_MODE_VALUES: ReadonlySet<string> = new Set<PriceMode>([
  "auto",
  "manual_nightly",
  "manual_total",
])

const DISCOUNT_MODE_VALUES: ReadonlySet<string> = new Set<DiscountMode>([
  "none",
  "amount_per_night",
  "percent_per_night",
  "amount_total",
  "percent_total",
])

export function toPriceMode(v: unknown): PriceMode {
  return typeof v === "string" && PRICE_MODE_VALUES.has(v) ? (v as PriceMode) : "auto"
}

export function toDiscountMode(v: unknown): DiscountMode {
  return typeof v === "string" && DISCOUNT_MODE_VALUES.has(v) ? (v as DiscountMode) : "none"
}

/** NULL must stay null so the engine can tell "no manual price" apart from
 *  "a manual price of zero". */
export function toNullableAmount(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** The subset of a reservation_rooms row that carries pricing controls. */
export interface RoomPricingRowFields {
  price_mode?: unknown
  manual_nightly_rate?: unknown
  manual_total?: unknown
  discount_mode?: unknown
  discount_value?: unknown
  vat_inclusive?: unknown
  currency?: unknown
}

export function roomPricingControlsFromRow(
  row: RoomPricingRowFields,
  fallbackCurrency: string,
): RoomPricingControls {
  return {
    priceMode: toPriceMode(row.price_mode),
    manualNightlyRate: toNullableAmount(row.manual_nightly_rate),
    manualTotal: toNullableAmount(row.manual_total),
    discountMode: toDiscountMode(row.discount_mode),
    discountValue: Number(row.discount_value) || 0,
    // NULL means "never set" — the column default is true, and so is ours.
    vatInclusive: typeof row.vat_inclusive === "boolean" ? row.vat_inclusive : true,
    currency: typeof row.currency === "string" && row.currency ? row.currency : fallbackCurrency,
  }
}

/* ── Pricing ────────────────────────────────────────────────── */

/**
 * This room's nights, resolved.
 *
 * It has to go through `resolveNightRates` rather than being assembled by hand:
 * `computePricing` only knows what to do with `manual_total`, so a room set to
 * `manual_nightly` whose nights were built directly would be billed at the
 * system rate and the override would vanish without a word. Night resolution is
 * where that mode lives.
 */
function baseNights(room: RoomPricingSource, ctx: ReservationPricingContext): NightRate[] {
  return resolveNightRates({
    dates: enumerateNights(room.checkIn, room.checkOut),
    roomTypeBasePrice: Number(room.ratePerNight) || 0,
    ratePlanId: ctx.ratePlanId,
    // The room row already carries the rate it was sold at; plan prices, dated
    // overrides and LOS tiers are resolved upstream of reservation_rooms.
    ratePlanPrice: null,
    overrides: [],
    losRules: [],
    priceMode: room.priceMode,
    manualNightlyRate: room.manualNightlyRate,
  })
}

/** The engine input for a room priced on its own terms. Extras and payments are
 *  reservation-level concepts — a room is never partly paid for. */
function roomEngineInput(
  room: RoomPricingSource,
  ctx: ReservationPricingContext,
  nights: NightRate[],
): PricingInput {
  return {
    nights,
    priceMode: room.priceMode,
    manualNightlyRate: room.manualNightlyRate,
    manualTotal: room.manualTotal,
    discountMode: room.discountMode,
    discountValue: room.discountValue,
    extraCharges: 0,
    vatInclusive: room.vatInclusive,
    vatRate: Math.max(0, ctx.vatRate),
    vatExempt: ctx.vatExempt,
    payments: 0,
    currency: room.currency || ctx.currency,
    exchangeRate: ctx.exchangeRate || 1,
  }
}

export function priceRoom(
  room: RoomPricingSource,
  ctx: ReservationPricingContext,
): RoomPricingOutcome {
  const nights = baseNights(room, ctx)
  const result = computePricing(roomEngineInput(room, ctx, nights))

  // A room whose VAT convention matches the reservation's contributes the money
  // exactly as it was entered. A room that differs contributes the engine's own
  // conversion — grossed up, or stripped back — so the reservation never adds
  // two figures that mean different things.
  const contribution = ctx.vatInclusive ? result.grandTotal : result.netAmount

  // Restating that contribution as a `manual_total` over the same nights is how
  // the ENGINE (not this file) spreads it night by night, remainder on the last
  // one. vatExempt keeps this pass a pure redistribution: it must not re-apply
  // a tax that the pass above already settled.
  const spread = computePricing({
    nights,
    priceMode: "manual_total",
    manualNightlyRate: null,
    manualTotal: contribution,
    discountMode: "none",
    discountValue: 0,
    extraCharges: 0,
    vatInclusive: true,
    vatRate: 0,
    vatExempt: true,
    payments: 0,
    currency: room.currency || ctx.currency,
    exchangeRate: ctx.exchangeRate || 1,
  })

  return { result, nights: spread.nights }
}

export function priceRooms(
  rooms: readonly RoomPricingSource[],
  ctx: ReservationPricingContext,
): RoomPricingOutcome[] {
  return rooms.map((room) => priceRoom(room, ctx))
}

/** The reservation's nights: every room's contribution, night by night. */
export function reservationNightsFromRooms(
  outcomes: readonly RoomPricingOutcome[],
): NightRate[] {
  return outcomes.flatMap((o) => o.nights)
}

/** Server-side gate for a room's controls. Same validator the reservation uses,
 *  fed the room's own input — there is no second set of rules. */
export function validateRoomPricing(
  room: RoomPricingSource,
  ctx: ReservationPricingContext,
): PricingValidationError[] {
  return validatePricingInput(roomEngineInput(room, ctx, baseNights(room, ctx)))
}
