# PHASE 1 — תוכנית המימוש (כפי שבוצעה)

נגזרת מ-`pricing-audit.md` בלבד. כל סטייה מהבקשה המקורית מנומקת ב-`DECISIONS.md`.

---

## חוזה המנוע — `lib/pricing/engine.ts`

פונקציה טהורה. אין I/O, אין React, אין db, אין `Date.now()` בנתיב החישוב.

| ייצוא | תפקיד |
|---|---|
| `computePricing(PricingInput): PricingResult` | הלב. כל סכום במערכת עובר דרכו. |
| `resolveNightRates(ResolveNightsInput): NightRate[]` | סדר הקדימות ללילה: `rate_override` → מדרגת LOS → `rate_plan` → `room_types.base_price`. `manual_nightly` דורך על כולם. |
| `selectLosRule(rules, nights): LosRule \| null` | **כלל אחד בלבד** — ה-`minNights` הגבוה מבין המתקיימים; שוויון נשבר לטובת ההנחה הגדולה. |
| `validatePricingInput(input): PricingValidationError[]` | שער השרת. נקרא ב-`create-reservation` וב-`reservation-update` לפני כל כתיבה. |
| `enumerateNights(checkIn, checkOut): string[]` | לילות השהות. תאריך העזיבה **אינו** לילה. תאריכים הפוכים → מערך ריק, לא שהות שלילית. |
| `deriveHistoricalVatRate(total, tax): number` | משחזר את השיעור שבו הזמנה **נמכרה בפועל**, מהמספרים שלה. |
| `round2(n): number` | עיגול יחיד לכל המערכת. |
| `vatPercentToFraction(p): number` | `tenants.vat_rate` הוא אחוזים; המנוע עובד בשברים. |

### כללים שהמנוע אוכף

- **מע"מ כלול** (ברירת מחדל): `net = total/(1+r)`, `vat = total − net`.
  **לא כלול**: `vat = net×r`, `total = net+vat`. **פטור**: `vat = 0`.
- אחרי העיגול נכפית הזהות `net + vat === grandTotal`; שורת המע"מ סופגת את השארית, כי הנטו
  והסה"כ הם שני המספרים שאדם מיישב מולם.
- `manual_total` → `grandTotal` הוא **בדיוק** הסכום שהוזן. הנחות ותוספות אינן מוחלות שוב
  (אחרת הדרישה אינה ניתנת לקיום), והפיזור ללילות נועד לתצוגה בלבד — השארית נוחתת על הלילה
  האחרון כדי שהסכום יסתדר לאגורה.
- `balanceDue = grandTotal − paid`, כאשר `paid = total_paid + deposit`. **מקדמה היא תשלום.**
- `vatRate` תמיד מגיע מהקורא. **אין `0.17` ואין `0.18` בקוד.**

---

## עמודות (ראה שני קבצי המיגרציה)

`reservations` +11 (`price_mode`, `manual_nightly_rate`, `manual_total`, `discount_mode`,
`discount_value`, `vat_inclusive`, `vat_rate`, `currency`, `exchange_rate`, `pricing_breakdown`,
`rate_plan_id`) +7 כרטיס · `reservation_rooms` +10 (`rate_plan_id` כבר היה) ·
`rate_plan_los_discounts` חדשה · `tenants.enabled_currencies`.

**לא נוספו:** `tenants.vat_rate` (קיים), `reservation_rooms.rate_plan_id` (קיים),
עמודת PAN מלא, עמודת CVV.

---

## מפת הקריאות — מי מחשב מה

| קובץ | לפני | אחרי |
|---|---|---|
| `lib/stores/reservation-form-store.ts` | `computeDerived()` עם נוסחה משלו | בונה `NightRate[]` וקורא ל-`computePricing`. השדות הישנים `discountAmount`/`discountPercent` נגזרים מהמנוע ולא להפך. |
| `lib/actions/create-reservation.ts` | אריתמטיקה inline + `* vat` | `validatePricingInput` → `computePricing` → INSERT. השרת הוא הסמכות. |
| `lib/stores/reservation-edit-store.ts` | **לא חישב כלל** — טען וקפא | חישוב נגזר דרך המנוע |
| `lib/actions/reservation-update.ts` | שמר את מה שהלקוח שלח | `computePricing` בשרת |
| `components/**/Step3Pricing`, `EditStep3Pricing` | שני עצי JSX כמעט זהים | שניהם מרנדרים `PricingEditor` + `CardFields` |

**אחרי השלב: אפס אריתמטיקה של מחיר מחוץ ל-`lib/pricing/engine.ts`.**
נאכף ב-`ref/audit/pricing-signoff.md`.

---

## סדר הקומיטים

1. `feat(pricing)` — המנוע + 56 טסטים (כולל שחזור 20 שורות פרודקשן)
2. `chore(db)` — מיגרציית התמחור + backfill מאמת-עצמו
3. `feat(pricing)` — `PricingEditor` + `CardFields` + זרימת היצירה + מיגרציית הכרטיס
4. `feat(reservations)` — זרימת העריכה
5. `docs` — סגירה

כל קומיט מקמט קבצים **אחד-אחד**. אין `git add -A`. לפני כל staging נבדק
`git status --porcelain -- <file>` כדי לא לבלוע עבודה זרה בעץ המשותף.
