/**
 * Reservation pricing engine — THE single source of truth for money.
 *
 * Pure by contract: no I/O, no React, no db, no Date.now(). Everything the
 * engine needs arrives in `PricingInput`. This is what makes it testable and
 * what lets the server and the client agree on a number instead of each
 * inventing one (which is exactly how the 17%/18% preview drift happened).
 *
 * Rules that are NOT negotiable, and why:
 *  - The VAT rate is always supplied by the caller from `reservations.vat_rate`
 *    (falling back to `tenants.vat_rate`). The tenant rate is MUTABLE and was
 *    in fact changed 17 -> 18 in this database, so recomputing an old
 *    reservation against today's tenant rate would silently restate history.
 *  - `balanceDue = grandTotal - paid`. A deposit is a payment, never a second
 *    subtraction. `reservations.balance_due` is a GENERATED column
 *    (total_price - total_paid) and this mirrors it exactly.
 *  - Every returned figure is rounded to 2 decimals, and `netAmount + vatAmount`
 *    is forced to equal `grandTotal` after rounding.
 */

export type PriceMode = "auto" | "manual_nightly" | "manual_total"

export type DiscountMode =
  | "none"
  | "amount_per_night"
  | "percent_per_night"
  | "amount_total"
  | "percent_total"

export type NightRateSource =
  | "rate_override"
  | "rate_plan_los"
  | "rate_plan"
  | "room_type_base"
  | "manual"

export interface NightRate {
  /** ISO date, YYYY-MM-DD. */
  date: string
  /** What the system worked out before any manual override. */
  baseRate: number
  /** What is actually charged for this night. */
  appliedRate: number
  source: NightRateSource
  ratePlanId: string | null
  /** Identifier of the single LOS rule that won, or null. */
  losRuleApplied: string | null
}

export type PricingLineKind =
  | "gross"
  | "discount"
  | "extra"
  | "net"
  | "vat"
  | "total"
  | "paid"
  | "balance"

export interface PricingLine {
  key: string
  /** Hebrew label, ready to render. */
  label: string
  amount: number
  kind: PricingLineKind
}

export interface PricingInput {
  /** Resolved per-night rates for ONE room, or for the whole reservation. */
  nights: NightRate[]
  priceMode: PriceMode
  manualNightlyRate: number | null
  manualTotal: number | null
  discountMode: DiscountMode
  discountValue: number
  extraCharges: number
  /** Whether the entered money already contains VAT. Default true. */
  vatInclusive: boolean
  /** Fraction, not percent: 0.18 — never a hardcoded literal in this file. */
  vatRate: number
  vatExempt: boolean
  /** Sum of real payment rows. A deposit is one of them. */
  payments: number
  currency: string
  exchangeRate: number
}

export interface PricingResult {
  nights: NightRate[]
  nightsCount: number
  grossBeforeDiscount: number
  discountTotal: number
  extraCharges: number
  netAmount: number
  vatAmount: number
  grandTotal: number
  paid: number
  /** Negative means the guest is in credit. */
  balanceDue: number
  effectiveNightlyRate: number
  breakdown: PricingLine[]
  currency: string
  exchangeRate: number
  /** The single LOS rule that was applied, if any. */
  losRuleApplied: string | null
}

/* ── Rounding ───────────────────────────────────────────────────
 * One helper, used everywhere. Rounds at the end of each step rather than
 * letting error accumulate. Number.EPSILON nudges the classic 1.005 case. */

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/* ── LOS rules ──────────────────────────────────────────────────
 * A rate plan may carry several length-of-stay tiers. Exactly ONE applies:
 * the highest `minNights` among those whose window contains the actual stay.
 * `rate_plans` already has a single min/max pair per row; these tiers are the
 * multi-tier layer that a single row cannot express (7+ AND 28+ together). */

export interface LosRule {
  id: string
  minNights: number
  /** null = open ended. */
  maxNights: number | null
  discountType: "percent" | "amount_per_night" | "amount_total"
  discountValue: number
  isActive: boolean
}

export function selectLosRule(rules: readonly LosRule[], nightsCount: number): LosRule | null {
  const eligible = rules.filter(
    (r) =>
      r.isActive &&
      nightsCount >= r.minNights &&
      (r.maxNights === null || nightsCount <= r.maxNights),
  )
  if (eligible.length === 0) return null
  // Highest minNights wins. Ties broken by the larger discount so the guest is
  // never worse off because two tiers were configured with the same floor.
  return eligible.reduce((best, r) => {
    if (r.minNights !== best.minNights) return r.minNights > best.minNights ? r : best
    return r.discountValue > best.discountValue ? r : best
  })
}

/* ── Night resolution ───────────────────────────────────────────
 * Priority: rate_override -> LOS tier -> rate plan -> room type base.
 * `manual_nightly` overrides all four. Pure: the caller does the DB reads and
 * hands the already-fetched rows in. */

export interface DatedOverride {
  /** Inclusive. */
  dateFrom: string
  /** Inclusive. */
  dateTo: string
  price: number
}

export interface ResolveNightsInput {
  /** Stay nights as ISO dates, one per night (check-out date excluded). */
  dates: readonly string[]
  roomTypeBasePrice: number
  ratePlanId: string | null
  /** Flat plan price per night, when the plan sets one. */
  ratePlanPrice: number | null
  overrides: readonly DatedOverride[]
  losRules: readonly LosRule[]
  priceMode: PriceMode
  manualNightlyRate: number | null
}

function findOverride(overrides: readonly DatedOverride[], date: string): DatedOverride | null {
  for (const o of overrides) {
    if (date >= o.dateFrom && date <= o.dateTo) return o
  }
  return null
}

export function resolveNightRates(input: ResolveNightsInput): NightRate[] {
  const {
    dates,
    roomTypeBasePrice,
    ratePlanId,
    ratePlanPrice,
    overrides,
    losRules,
    priceMode,
    manualNightlyRate,
  } = input

  const losRule = selectLosRule(losRules, dates.length)

  return dates.map((date) => {
    const override = findOverride(overrides, date)

    let baseRate: number
    let source: NightRateSource
    if (override) {
      baseRate = override.price
      source = "rate_override"
    } else if (ratePlanPrice !== null) {
      baseRate = ratePlanPrice
      source = "rate_plan"
    } else {
      baseRate = roomTypeBasePrice
      source = "room_type_base"
    }

    // A LOS tier discounts whatever the priority chain produced. It never
    // replaces an explicit date override — an override is a deliberate price
    // for that night and outranks a stay-length rule.
    let appliedRate = baseRate
    if (losRule && !override) {
      if (losRule.discountType === "percent") {
        appliedRate = baseRate * (1 - losRule.discountValue / 100)
      } else if (losRule.discountType === "amount_per_night") {
        appliedRate = baseRate - losRule.discountValue
      } else {
        appliedRate = baseRate - losRule.discountValue / Math.max(dates.length, 1)
      }
      appliedRate = Math.max(0, appliedRate)
      source = "rate_plan_los"
    }

    if (priceMode === "manual_nightly" && manualNightlyRate !== null) {
      return {
        date,
        baseRate: round2(baseRate),
        appliedRate: round2(manualNightlyRate),
        source: "manual",
        ratePlanId,
        losRuleApplied: null,
      }
    }

    return {
      date,
      baseRate: round2(baseRate),
      appliedRate: round2(appliedRate),
      source,
      ratePlanId,
      losRuleApplied: losRule && !override ? losRule.id : null,
    }
  })
}

/* ── Discounts ──────────────────────────────────────────────── */

function computeDiscount(
  mode: DiscountMode,
  value: number,
  nights: readonly NightRate[],
  gross: number,
): number {
  if (value <= 0) return 0
  switch (mode) {
    case "none":
      return 0
    case "amount_per_night":
      return round2(value * nights.length)
    case "percent_per_night":
      return round2(nights.reduce((sum, n) => sum + n.appliedRate * (value / 100), 0))
    case "amount_total":
      return round2(value)
    case "percent_total":
      return round2(gross * (value / 100))
    default:
      return 0
  }
}

/* ── Validation ─────────────────────────────────────────────────
 * Server-side gate. The UI mirrors these, but the server is what enforces. */

export interface PricingValidationError {
  field: string
  message: string
}

export function validatePricingInput(input: PricingInput): PricingValidationError[] {
  const errors: PricingValidationError[] = []

  if (input.nights.length === 0 && input.priceMode !== "manual_total") {
    errors.push({ field: "nights", message: "לא ניתן לתמחר שהות ללא לילות" })
  }
  if (input.nights.some((n) => n.appliedRate < 0)) {
    errors.push({ field: "nights", message: "תעריף לילה אינו יכול להיות שלילי" })
  }
  if (input.priceMode === "manual_nightly") {
    if (input.manualNightlyRate === null || input.manualNightlyRate < 0) {
      errors.push({ field: "manualNightlyRate", message: "מחיר ידני ללילה אינו יכול להיות שלילי" })
    }
  }
  if (input.priceMode === "manual_total") {
    if (input.manualTotal === null || input.manualTotal < 0) {
      errors.push({ field: "manualTotal", message: "סה״כ ידני אינו יכול להיות שלילי" })
    }
  }
  if (input.discountMode === "percent_per_night" || input.discountMode === "percent_total") {
    if (input.discountValue < 0 || input.discountValue > 100) {
      errors.push({ field: "discountValue", message: "אחוז הנחה חייב להיות בין 0 ל-100" })
    }
  }
  if (input.discountMode === "amount_per_night" || input.discountMode === "amount_total") {
    if (input.discountValue < 0) {
      errors.push({ field: "discountValue", message: "סכום הנחה אינו יכול להיות שלילי" })
    }
  }
  if (input.vatRate < 0 || input.vatRate > 1) {
    errors.push({ field: "vatRate", message: "שיעור מע״מ חייב להיות שבר בין 0 ל-1" })
  }
  if (input.exchangeRate <= 0) {
    errors.push({ field: "exchangeRate", message: "שער חליפין חייב להיות גדול מאפס" })
  }
  if (input.extraCharges < 0) {
    errors.push({ field: "extraCharges", message: "תוספות אינן יכולות להיות שליליות" })
  }

  // Amount discounts may not exceed what there is to discount.
  const gross = input.nights.reduce((s, n) => s + n.appliedRate, 0)
  if (input.discountMode === "amount_total" && input.discountValue > gross && gross > 0) {
    errors.push({ field: "discountValue", message: "סכום ההנחה גדול מהסכום לפני הנחה" })
  }

  return errors
}

/* ── The engine ─────────────────────────────────────────────── */

export function computePricing(input: PricingInput): PricingResult {
  const {
    nights: nightsIn,
    priceMode,
    manualNightlyRate,
    manualTotal,
    discountMode,
    discountValue,
    extraCharges,
    vatInclusive,
    vatRate,
    vatExempt,
    payments,
    currency,
    exchangeRate,
  } = input

  // `manual_nightly` is also applied by resolveNightRates, but a caller that
  // assembled NightRate[] by hand (every store and server action does) would
  // otherwise have the mode silently ignored and be billed the system rate.
  // Applying it here too makes the engine correct on any path; doing it twice
  // is idempotent.
  const nights =
    priceMode === "manual_nightly" && manualNightlyRate !== null
      ? nightsIn.map((n) => ({
          ...n,
          appliedRate: round2(Math.max(0, manualNightlyRate)),
          source: "manual" as const,
          losRuleApplied: null,
        }))
      : nightsIn

  const nightsCount = nights.length
  const effectiveVatRate = vatExempt ? 0 : Math.max(0, vatRate)

  const grossBeforeDiscount = round2(nights.reduce((sum, n) => sum + n.appliedRate, 0))

  let discountTotal = 0
  let netOrGross: number

  if (priceMode === "manual_total") {
    // The operator states the figure. Nothing downstream may move it, so no
    // discount and no extras are re-applied — the UI disables both in this
    // mode. `vatInclusive` still decides whether that figure contains VAT.
    netOrGross = round2(Math.max(0, manualTotal ?? 0))
  } else {
    discountTotal = Math.min(
      computeDiscount(discountMode, discountValue, nights, grossBeforeDiscount),
      grossBeforeDiscount,
    )
    netOrGross = round2(Math.max(0, grossBeforeDiscount - discountTotal) + Math.max(0, extraCharges))
  }

  let netAmount: number
  let vatAmount: number
  let grandTotal: number

  if (effectiveVatRate === 0) {
    netAmount = netOrGross
    vatAmount = 0
    grandTotal = netOrGross
  } else if (vatInclusive) {
    grandTotal = netOrGross
    netAmount = round2(grandTotal / (1 + effectiveVatRate))
    vatAmount = round2(grandTotal - netAmount)
  } else {
    netAmount = netOrGross
    vatAmount = round2(netAmount * effectiveVatRate)
    grandTotal = round2(netAmount + vatAmount)
  }

  // Force the identity to survive rounding. The VAT line absorbs the remainder
  // because the net and the total are the two figures a human reconciles.
  const drift = round2(grandTotal - (netAmount + vatAmount))
  if (drift !== 0) vatAmount = round2(vatAmount + drift)

  const paid = round2(payments)
  const balanceDue = round2(grandTotal - paid)
  const effectiveNightlyRate = nightsCount > 0 ? round2(grandTotal / nightsCount) : 0

  const losRuleApplied = nights.find((n) => n.losRuleApplied !== null)?.losRuleApplied ?? null

  const breakdown: PricingLine[] = [
    { key: "gross", label: "סכום לפני הנחה", amount: grossBeforeDiscount, kind: "gross" },
  ]
  if (discountTotal > 0) {
    breakdown.push({ key: "discount", label: "הנחה", amount: -discountTotal, kind: "discount" })
  }
  if (priceMode !== "manual_total" && extraCharges > 0) {
    breakdown.push({ key: "extras", label: "תוספות", amount: round2(extraCharges), kind: "extra" })
  }
  breakdown.push(
    { key: "net", label: "סכום ללא מע״מ", amount: netAmount, kind: "net" },
    {
      key: "vat",
      label: vatExempt ? "מע״מ (פטור)" : `מע״מ (${round2(effectiveVatRate * 100)}%)`,
      amount: vatAmount,
      kind: "vat",
    },
    { key: "total", label: "סה״כ לתשלום", amount: grandTotal, kind: "total" },
    { key: "paid", label: "שולם", amount: paid, kind: "paid" },
    {
      key: "balance",
      label: balanceDue < 0 ? "יתרת זכות" : "יתרה לתשלום",
      amount: balanceDue,
      kind: "balance",
    },
  )

  // `manual_total` spreads the stated figure across nights for DISPLAY only —
  // the remainder lands on the last night so the sum is exactly grandTotal.
  let outNights = nights
  if (priceMode === "manual_total" && nightsCount > 0) {
    const per = round2(grandTotal / nightsCount)
    outNights = nights.map((n, i) => ({
      ...n,
      appliedRate: i === nightsCount - 1 ? round2(grandTotal - per * (nightsCount - 1)) : per,
      source: "manual" as const,
    }))
  }

  return {
    nights: outNights,
    nightsCount,
    grossBeforeDiscount,
    discountTotal,
    extraCharges: priceMode === "manual_total" ? 0 : round2(Math.max(0, extraCharges)),
    netAmount,
    vatAmount,
    grandTotal,
    paid,
    balanceDue,
    effectiveNightlyRate,
    breakdown,
    currency,
    exchangeRate,
    losRuleApplied,
  }
}

/* ── Helpers shared by callers ──────────────────────────────── */

/** Stay nights as ISO dates. Check-out is excluded — you do not sleep on it. */
export function enumerateNights(checkIn: string, checkOut: string): string[] {
  const out: string[] = []
  const start = new Date(`${checkIn}T00:00:00Z`)
  const end = new Date(`${checkOut}T00:00:00Z`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return out
  for (let d = start; d < end; d = new Date(d.getTime() + 86400000)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/** `tenants.vat_rate` / `reservations.vat_rate` are stored as percent. */
export function vatPercentToFraction(percent: number | string | null | undefined): number {
  const n = Number(percent)
  return Number.isFinite(n) ? Math.max(0, n / 100) : 0
}

/**
 * The VAT rate a historical reservation was actually sold at, recovered from
 * its own stored figures. Used by the backfill and by any recompute of a row
 * that predates a tenant rate change. Returns a fraction.
 */
export function deriveHistoricalVatRate(totalPrice: number, taxAmount: number): number {
  const net = totalPrice - taxAmount
  if (net <= 0) return 0
  return Math.round((taxAmount / net) * 10000) / 10000
}
