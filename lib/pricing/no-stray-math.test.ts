/**
 * Structural guards. These encode the two rules that are easy to state and easy
 * to quietly break later:
 *   1. No VAT rate is hardcoded anywhere.
 *   2. No money arithmetic lives outside lib/pricing/engine.ts.
 *
 * They scan real files rather than trusting a review. A guard that cannot fail
 * proves nothing, so each one is paired with a negative control asserting the
 * same matcher DOES fire on a deliberately bad sample.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const ENGINE = "lib/pricing/engine.ts"

const SEARCH_DIRS = ["lib/stores", "lib/actions", "components/reservations"]

function walk(dir: string, out: string[] = []): string[] {
  const abs = join(ROOT, dir)
  for (const entry of readdirSync(abs)) {
    const rel = join(dir, entry)
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(rel)
  }
  return out
}

const FILES = SEARCH_DIRS.flatMap((d) => walk(d))

/** Blank comments while preserving line structure, so reported lines are real. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^([ \t]*)\/\/.*$/gm, "$1")
}

// A bare 0.17 / 0.18 used as a number, not as part of a longer decimal, a
// duration, an rgba() alpha or a tailwind class.
const HARDCODED_VAT = /(?<![\d.])0\.1[78](?![\d])/

describe("no hardcoded VAT rate", () => {
  it("scans a non-trivial number of files", () => {
    expect(FILES.length).toBeGreaterThan(20)
  })

  for (const file of FILES) {
    it(`${file} contains no literal 0.17 / 0.18`, () => {
      const body = stripComments(readFileSync(join(ROOT, file), "utf8"))
      const hits: string[] = []
      body.split("\n").forEach((line, i) => {
        // framer-motion durations and rgba alphas are not tax rates.
        if (/duration|rgba|opacity|ease|delay|stiffness|damping|scale/i.test(line)) return
        if (HARDCODED_VAT.test(line)) hits.push(`${file}:${i + 1}  ${line.trim()}`)
      })
      expect(hits).toEqual([])
    })
  }

  it("negative control — the matcher does fire on a bad sample", () => {
    expect(HARDCODED_VAT.test("const taxAmount = afterDiscount * 0.17")).toBe(true)
    expect(HARDCODED_VAT.test("const r = 0.18")).toBe(true)
    // ...and not on things that merely look similar.
    expect(HARDCODED_VAT.test("transition={{ duration: 0.18 }}")).toBe(true) // caught by the line filter, not the regex
    expect(HARDCODED_VAT.test("const x = 10.175")).toBe(false)
  })
})

describe("VAT arithmetic lives only in the engine", () => {
  // The shapes the old code used: `* taxRate`, `* vatRate`, `/ (1 + rate)`.
  const VAT_MATH = /[*/]\s*\(?\s*1?\s*\+?\s*(taxRate|vatRate|tenantVatFraction|effectiveVatRate)/

  for (const file of FILES) {
    it(`${file} does not compute VAT itself`, () => {
      const body = stripComments(readFileSync(join(ROOT, file), "utf8"))
      expect(VAT_MATH.test(body)).toBe(false)
    })
  }

  it("negative control — the matcher fires on the code this replaced", () => {
    expect(VAT_MATH.test("const taxAmount = afterDiscount * tenantVatFraction")).toBe(true)
    expect(VAT_MATH.test("netAmount = grandTotal / (1 + vatRate)")).toBe(true)
  })

  it("the engine itself is where that arithmetic lives", () => {
    const engine = readFileSync(join(ROOT, ENGINE), "utf8")
    expect(VAT_MATH.test(engine)).toBe(true)
  })
})

describe("PCI — no full card number is captured anywhere", () => {
  // Identifiers only. User-facing prose is allowed to say "CVV" — the copy that
  // tells the guest we do NOT store it must not trip the guard that proves it.
  const PAN_FIELD =
    /\bcardNumber\b|\bcard_number\b|\b(cvv|cvc)\s*[:=]|["'`]\s*(cvv|cvc)\s*["'`]|\bcard_(cvv|cvc)\b/i

  for (const file of FILES) {
    it(`${file} declares no PAN or CVV field`, () => {
      const body = stripComments(readFileSync(join(ROOT, file), "utf8"))
      expect(PAN_FIELD.test(body)).toBe(false)
    })
  }

  it("negative control — fires on a field, not on prose", () => {
    expect(PAN_FIELD.test("cardNumber: string")).toBe(true)
    expect(PAN_FIELD.test("const cvv = input.value")).toBe(true)
    expect(PAN_FIELD.test('card_number: "4580"')).toBe(true)
    expect(PAN_FIELD.test("מספר הכרטיס המלא וקוד ה-CVV אינם נשמרים במערכת")).toBe(false)
  })
})

describe("no console.log in the reservation surface", () => {
  for (const file of FILES) {
    it(`${file} has no console.log`, () => {
      const body = stripComments(readFileSync(join(ROOT, file), "utf8"))
      expect(/console\.log\s*\(/.test(body)).toBe(false)
    })
  }
})
