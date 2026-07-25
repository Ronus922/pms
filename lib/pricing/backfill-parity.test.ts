/**
 * Regression gate: the engine must reproduce EVERY existing production
 * reservation to the agora, using only the backfilled columns.
 *
 * The fixture is a real snapshot of `reservations` taken before any migration
 * (`ref/proof/baseline-reservations.csv`). If this file ever goes red, the
 * migration or the engine has restated historical money and must not ship.
 *
 * Why the VAT rate is derived per row rather than read from the tenant:
 * `tenants.vat_rate` is mutable and was changed 17 -> 18 in this database.
 * Four live reservations were sold at 17% and would be silently restated if
 * today's tenant rate were applied to them.
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { computePricing, deriveHistoricalVatRate, round2, type PricingInput } from "./engine"

interface BaselineRow {
  reservation_number: string
  tax_exempt: string
  total_price: string
  tax_amount: string
  total_paid: string
  balance_due: string
}

function loadBaseline(): BaselineRow[] {
  const csv = readFileSync(
    join(process.cwd(), "ref/proof/baseline-reservations.csv"),
    "utf8",
  ).trim()
  const [head, ...rows] = csv.split("\n")
  const cols = head.split(",")
  return rows.map((line) => {
    const cells = line.split(",")
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]])) as unknown as BaselineRow
  })
}

const baseline = loadBaseline()

/** Exactly what the backfill writes, expressed as engine input. */
function backfilledInput(row: BaselineRow): PricingInput {
  const totalPrice = Number(row.total_price)
  const taxAmount = Number(row.tax_amount)
  return {
    nights: [],
    priceMode: "manual_total",
    manualNightlyRate: null,
    manualTotal: totalPrice,
    discountMode: "none",
    discountValue: 0,
    extraCharges: 0,
    vatInclusive: true,
    vatRate: deriveHistoricalVatRate(totalPrice, taxAmount),
    vatExempt: row.tax_exempt === "t",
    payments: Number(row.total_paid),
    currency: "ILS",
    exchangeRate: 1,
  }
}

describe("backfill parity against live production rows", () => {
  it("the fixture actually loaded", () => {
    expect(baseline.length).toBe(20)
  })

  for (const row of baseline) {
    it(`${row.reservation_number} reproduces total_price and tax_amount`, () => {
      const result = computePricing(backfilledInput(row))
      expect(result.grandTotal).toBe(round2(Number(row.total_price)))
      expect(result.vatAmount).toBe(round2(Number(row.tax_amount)))
      expect(round2(result.netAmount + result.vatAmount)).toBe(result.grandTotal)
    })
  }

  it("reproduces the GENERATED balance_due (total_price - total_paid) for every row", () => {
    for (const row of baseline) {
      const result = computePricing(backfilledInput(row))
      expect(result.balanceDue).toBe(round2(Number(row.balance_due)))
    }
  })

  it("covers both VAT eras present in the data — 17% and 18%", () => {
    const rates = new Set(
      baseline
        .map((r) => deriveHistoricalVatRate(Number(r.total_price), Number(r.tax_amount)))
        .filter((r) => r > 0),
    )
    expect(rates).toContain(0.17)
    expect(rates).toContain(0.18)
  })

  it("would restate history if the current tenant rate were used instead", () => {
    // Proves the per-row derivation is load-bearing, not decoration.
    const TENANT_RATE_TODAY = 0.18
    const restated = baseline.filter((row) => {
      const total = Number(row.total_price)
      const tax = Number(row.tax_amount)
      if (tax === 0) return false
      const wrong = round2(total - total / (1 + TENANT_RATE_TODAY))
      return Math.abs(wrong - tax) > 0.01
    })
    expect(restated.length).toBeGreaterThan(0)
  })
})
