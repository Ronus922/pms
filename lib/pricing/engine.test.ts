import { describe, it, expect } from "vitest"
import {
  computePricing,
  resolveNightRates,
  selectLosRule,
  enumerateNights,
  deriveHistoricalVatRate,
  round2,
  validatePricingInput,
  type LosRule,
  type NightRate,
  type PricingInput,
} from "./engine"

const VAT_18 = 0.18
const VAT_17 = 0.17

function nights(count: number, rate: number, startDay = 1): NightRate[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-08-${String(startDay + i).padStart(2, "0")}`,
    baseRate: rate,
    appliedRate: rate,
    source: "room_type_base" as const,
    ratePlanId: null,
    losRuleApplied: null,
  }))
}

function input(over: Partial<PricingInput> = {}): PricingInput {
  return {
    nights: nights(1, 100),
    priceMode: "auto",
    manualNightlyRate: null,
    manualTotal: null,
    discountMode: "none",
    discountValue: 0,
    extraCharges: 0,
    vatInclusive: true,
    vatRate: VAT_18,
    vatExempt: false,
    payments: 0,
    currency: "ILS",
    exchangeRate: 1,
    ...over,
  }
}

describe("VAT", () => {
  it("inclusive: 31 nights x 588 keeps the entered total and splits it", () => {
    const r = computePricing(input({ nights: nights(31, 588), vatInclusive: true }))
    expect(r.grossBeforeDiscount).toBe(18228)
    expect(r.grandTotal).toBe(18228)
    expect(r.netAmount).toBe(15447.46)
    expect(r.vatAmount).toBe(2780.54)
    expect(round2(r.netAmount + r.vatAmount)).toBe(r.grandTotal)
  })

  it("exclusive: the same stay adds VAT on top", () => {
    const r = computePricing(input({ nights: nights(31, 588), vatInclusive: false }))
    expect(r.netAmount).toBe(18228)
    expect(r.vatAmount).toBe(3281.04)
    expect(r.grandTotal).toBe(21509.04)
  })

  it("exempt: no VAT regardless of the toggle", () => {
    for (const vatInclusive of [true, false]) {
      const r = computePricing(input({ nights: nights(3, 500), vatExempt: true, vatInclusive }))
      expect(r.vatAmount).toBe(0)
      expect(r.netAmount).toBe(1500)
      expect(r.grandTotal).toBe(1500)
    }
  })

  it("net + vat === grandTotal for a rate that does not divide cleanly", () => {
    for (const rate of [333.33, 0.01, 999.99, 1.005, 7777.77]) {
      const r = computePricing(input({ nights: nights(7, rate) }))
      expect(round2(r.netAmount + r.vatAmount)).toBe(r.grandTotal)
    }
  })

  it("never hardcodes a rate — 17% and 18% both flow from the input", () => {
    const a = computePricing(input({ nights: nights(1, 117), vatRate: VAT_17 }))
    expect(a.netAmount).toBe(100)
    expect(a.vatAmount).toBe(17)
    const b = computePricing(input({ nights: nights(1, 118), vatRate: VAT_18 }))
    expect(b.netAmount).toBe(100)
    expect(b.vatAmount).toBe(18)
  })
})

describe("discount modes x VAT — all 8 combinations", () => {
  const base = { nights: nights(10, 100) } // gross 1000
  const cases: Array<[PricingInput["discountMode"], number, number]> = [
    ["amount_per_night", 10, 100],
    ["percent_per_night", 15, 150],
    ["amount_total", 250, 250],
    ["percent_total", 20, 200],
  ]

  for (const [mode, value, expectedDiscount] of cases) {
    for (const vatInclusive of [true, false]) {
      it(`${mode} (${value}) with vatInclusive=${vatInclusive}`, () => {
        const r = computePricing(
          input({ ...base, discountMode: mode, discountValue: value, vatInclusive }),
        )
        expect(r.discountTotal).toBe(expectedDiscount)
        const afterDiscount = 1000 - expectedDiscount
        if (vatInclusive) {
          expect(r.grandTotal).toBe(afterDiscount)
        } else {
          expect(r.netAmount).toBe(afterDiscount)
          expect(r.grandTotal).toBe(round2(afterDiscount * (1 + VAT_18)))
        }
        expect(round2(r.netAmount + r.vatAmount)).toBe(r.grandTotal)
      })
    }
  }

  it("an amount discount can never push the total below zero", () => {
    const r = computePricing(
      input({ nights: nights(2, 100), discountMode: "amount_total", discountValue: 5000 }),
    )
    expect(r.discountTotal).toBe(200)
    expect(r.grandTotal).toBe(0)
  })
})

describe("price modes", () => {
  it("manual_nightly overrides the rate plan", () => {
    const resolved = resolveNightRates({
      dates: enumerateNights("2026-08-01", "2026-08-04"),
      roomTypeBasePrice: 400,
      ratePlanId: "plan-1",
      ratePlanPrice: 350,
      overrides: [],
      losRules: [],
      priceMode: "manual_nightly",
      manualNightlyRate: 275,
    })
    expect(resolved).toHaveLength(3)
    expect(resolved.every((n) => n.appliedRate === 275 && n.source === "manual")).toBe(true)
  })

  it("manual_total lands on exactly the stated figure, no rounding drift", () => {
    const r = computePricing(
      input({ nights: nights(7, 999.99), priceMode: "manual_total", manualTotal: 15000 }),
    )
    expect(r.grandTotal).toBe(15000)
    expect(round2(r.nights.reduce((s, n) => s + n.appliedRate, 0))).toBe(15000)
    expect(round2(r.netAmount + r.vatAmount)).toBe(15000)
  })

  it("manual_total ignores discount and extras so the figure cannot move", () => {
    const r = computePricing(
      input({
        nights: nights(3, 500),
        priceMode: "manual_total",
        manualTotal: 1234.56,
        discountMode: "percent_total",
        discountValue: 50,
        extraCharges: 900,
      }),
    )
    expect(r.grandTotal).toBe(1234.56)
    expect(r.discountTotal).toBe(0)
    expect(r.extraCharges).toBe(0)
  })

  it("a 13-night manual_total still sums exactly (worst rounding case)", () => {
    const r = computePricing(
      input({ nights: nights(13, 1), priceMode: "manual_total", manualTotal: 1000 }),
    )
    expect(round2(r.nights.reduce((s, n) => s + n.appliedRate, 0))).toBe(1000)
  })
})

describe("LOS rules", () => {
  const rules: LosRule[] = [
    { id: "los-7", minNights: 7, maxNights: null, discountType: "percent", discountValue: 10, isActive: true },
    { id: "los-28", minNights: 28, maxNights: null, discountType: "percent", discountValue: 15, isActive: true },
  ]

  it("applies exactly one rule — the highest floor that fits", () => {
    expect(selectLosRule(rules, 31)?.id).toBe("los-28")
    expect(selectLosRule(rules, 10)?.id).toBe("los-7")
    expect(selectLosRule(rules, 3)).toBeNull()
  })

  it("28+ at 15% is applied automatically and recorded", () => {
    const resolved = resolveNightRates({
      dates: Array.from({ length: 31 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`),
      roomTypeBasePrice: 600,
      ratePlanId: "plan-1",
      ratePlanPrice: null,
      overrides: [],
      losRules: rules,
      priceMode: "auto",
      manualNightlyRate: null,
    })
    expect(resolved[0].appliedRate).toBe(510)
    expect(resolved[0].source).toBe("rate_plan_los")
    expect(resolved[0].losRuleApplied).toBe("los-28")
    const r = computePricing(input({ nights: resolved }))
    expect(r.losRuleApplied).toBe("los-28")
  })

  it("ignores inactive rules", () => {
    const off = rules.map((r) => ({ ...r, isActive: r.id !== "los-28" }))
    expect(selectLosRule(off, 31)?.id).toBe("los-7")
  })

  it("respects a closed window", () => {
    const windowed: LosRule[] = [
      { id: "w", minNights: 7, maxNights: 14, discountType: "percent", discountValue: 10, isActive: true },
    ]
    expect(selectLosRule(windowed, 20)).toBeNull()
    expect(selectLosRule(windowed, 14)?.id).toBe("w")
  })
})

describe("night resolution priority", () => {
  it("rate_override beats LOS, plan and base for that night only", () => {
    const resolved = resolveNightRates({
      dates: enumerateNights("2026-08-01", "2026-08-11"),
      roomTypeBasePrice: 500,
      ratePlanId: "plan-1",
      ratePlanPrice: 450,
      overrides: [{ dateFrom: "2026-08-05", dateTo: "2026-08-06", price: 1200 }],
      losRules: [
        { id: "los-7", minNights: 7, maxNights: null, discountType: "percent", discountValue: 10, isActive: true },
      ],
      priceMode: "auto",
      manualNightlyRate: null,
    })
    const byDate = Object.fromEntries(resolved.map((n) => [n.date, n]))
    expect(byDate["2026-08-05"].appliedRate).toBe(1200)
    expect(byDate["2026-08-05"].source).toBe("rate_override")
    expect(byDate["2026-08-05"].losRuleApplied).toBeNull()
    // A non-overridden night takes the plan price, discounted by the LOS tier.
    expect(byDate["2026-08-02"].appliedRate).toBe(405)
    expect(byDate["2026-08-02"].source).toBe("rate_plan_los")
  })

  it("falls back to room_type_base when no plan price exists", () => {
    const resolved = resolveNightRates({
      dates: enumerateNights("2026-08-01", "2026-08-03"),
      roomTypeBasePrice: 320,
      ratePlanId: null,
      ratePlanPrice: null,
      overrides: [],
      losRules: [],
      priceMode: "auto",
      manualNightlyRate: null,
    })
    expect(resolved.every((n) => n.appliedRate === 320 && n.source === "room_type_base")).toBe(true)
  })
})

describe("balance", () => {
  it("partial, full and overpayment", () => {
    const stay = { nights: nights(10, 1000) } // 10,000 inclusive
    expect(computePricing(input({ ...stay, payments: 6500 })).balanceDue).toBe(3500)
    expect(computePricing(input({ ...stay, payments: 10000 })).balanceDue).toBe(0)
    const credit = computePricing(input({ ...stay, payments: 12000 }))
    expect(credit.balanceDue).toBe(-2000)
    expect(credit.breakdown.find((l) => l.kind === "balance")?.label).toBe("יתרת זכות")
  })

  it("a deposit is a payment, never a second subtraction", () => {
    // 2,000 total, 500 deposit recorded as a payment, 300 further payment.
    const r = computePricing(input({ nights: nights(2, 1000), payments: 800 }))
    expect(r.balanceDue).toBe(1200)
  })
})

describe("validation — the server gate", () => {
  it("rejects zero nights, negative money and out-of-range percentages", () => {
    expect(validatePricingInput(input({ nights: [] })).some((e) => e.field === "nights")).toBe(true)
    expect(
      validatePricingInput(input({ discountMode: "percent_total", discountValue: 150 })).some(
        (e) => e.field === "discountValue",
      ),
    ).toBe(true)
    expect(
      validatePricingInput(input({ nights: nights(1, -50) })).some((e) => e.field === "nights"),
    ).toBe(true)
    expect(
      validatePricingInput(input({ priceMode: "manual_total", manualTotal: -1 })).some(
        (e) => e.field === "manualTotal",
      ),
    ).toBe(true)
    expect(validatePricingInput(input({ exchangeRate: 0 })).length).toBeGreaterThan(0)
  })

  it("rejects an amount discount larger than the gross", () => {
    const errs = validatePricingInput(
      input({ nights: nights(2, 100), discountMode: "amount_total", discountValue: 500 }),
    )
    expect(errs.some((e) => e.field === "discountValue")).toBe(true)
  })

  it("accepts a clean input", () => {
    expect(validatePricingInput(input())).toHaveLength(0)
  })
})

describe("dates and currency", () => {
  it("enumerateNights excludes the check-out date", () => {
    expect(enumerateNights("2026-08-01", "2026-08-04")).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ])
    expect(enumerateNights("2026-08-01", "2026-08-01")).toEqual([])
    // Reversed dates produce no nights rather than a negative stay.
    expect(enumerateNights("2026-08-05", "2026-08-01")).toEqual([])
  })

  it("carries currency and exchange rate through as a snapshot", () => {
    const r = computePricing(input({ currency: "USD", exchangeRate: 3.72 }))
    expect(r.currency).toBe("USD")
    expect(r.exchangeRate).toBe(3.72)
  })
})

describe("historical VAT recovery", () => {
  it("recovers the rate a reservation was actually sold at", () => {
    expect(deriveHistoricalVatRate(117, 17)).toBe(0.17)
    expect(deriveHistoricalVatRate(10325, 1575)).toBe(0.18)
    expect(deriveHistoricalVatRate(6613.43, 960.93)).toBe(0.17)
    // Seeded rows carry no VAT at all.
    expect(deriveHistoricalVatRate(2200, 0)).toBe(0)
    expect(deriveHistoricalVatRate(0, 0)).toBe(0)
  })
})
