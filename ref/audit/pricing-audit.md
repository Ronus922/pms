# PHASE 0 — AUDIT: מנוע תמחור הזמנות

עץ עבודה: `/var/www/wt-pms-pricing` · ענף `feat/reservation-pricing-engine` · בסיס `644356f`
DB: `proj_pms` כמשתמש `pms_app`, 70 טבלאות. **כל השאילתות בשלב זה קריאה בלבד.**

---

## 0. הריפו הנכון

הבקשה מתארת `pms.bios.co.il` ותהליך PM2 בשם `pms`. ספריית העבודה של הסשן היא
`/var/www/guesthub` — פרויקט **אחר**, שבו אף אחד מהנתיבים בבקשה אינו קיים. הפרויקט הנכון הוא
`/var/www/pms` (`git@github.com:Ronus922/pms.git`, פורט 3004). כל 10 הקבצים שהוזכרו אומתו שם.

---

## 1. הסכמה החיה — מה שהריפו לא מכיל

`database/schema.sql` הוא תבנית גנרית ללא אף טבלה עסקית (`reservations` אינה שם). הסכמה החיה
נסחפה ואינה משוחזרת מהריפו. לכן נסרקה ישירות — הפלט המלא ב-`ref/audit/live-schema.txt`.

### נפחי נתונים (רלוונטי לכל הערכת סיכון)

| טבלה | שורות |
|---|---|
| `reservations` | **20** |
| `reservation_rooms` | 22 |
| `rate_overrides` | 6 |
| `room_daily_pricing` | 98 |
| `tenants` | 1 |
| `rate_plans` | **0** |
| `payments` | **0** |
| `reservation_charges` | **0** |
| `pricing_plans` | **0** |
| `channel_booking_revisions` | **0** |

### אישורים והפרכות מול הסכמה

- ✅ **`reservations.balance_due` הוא GENERATED** — `generated always as ((total_price - total_paid)) stored`.
  ההערה בקוד ([reservation-update.ts:179-182](../../lib/actions/reservation-update.ts#L179-L182)) נכונה, וכעת מאומתת מול ה-DB ולא מול הערה.
- ✅ כל עמודות הכסף הן `numeric(10,2)` — עיגול לשתי ספרות נאכף כבר ברמת ה-DB.
- ❌ **`reservations.currency` אינה קיימת.** ❌ **`reservations.rate_plan_id` אינה קיימת.**
- ⚠️ **`reservation_rooms.rate_plan_id` כן קיימת** (uuid, nullable) — תוכנית תעריף ברמת חדר כבר ממודלת ב-DB ואינה בשימוש בקוד.
- ⚠️ **`rate_plans` כבר מחזיקה `min_nights`, `max_nights`, `modifier_type`, `modifier_value`, `active_days`** —
  כלומר שכבת LOS ברמת *תוכנית אחת* כבר קיימת מבנית. מה שחסר הוא **כמה מדרגות לאותה תוכנית**
  (הבקשה דורשת 7+ ו-28+ יחד עם "הגבוה חל"), ולכן טבלת המדרגות הנפרדת עדיין מוצדקת.
- `card_holder_id` היא עמודת הכרטיס **היחידה** שקיימת, ואינה נכתבת ואינה נקראת באף מקום.

---

## 2. שתי הפרכות של הטיוטה שלי עצמה

הבדיקה המקדימה שלי טעתה בשתי נקודות. שתיהן תוקנו לפי מדידה.

### 2.1 מע"מ: 18% **הוא** השיעור בפועל

טענתי ש"אין 18% במערכת". **שגוי.** ה-*default* של העמודה הוא 17.00, אבל **שורת הדייר בפועל
מחזיקה `vat_rate = 18.00`**. התווית ב-UI דינמית (`מע״מ (X%)`), ולכן היא מציגה **18%** בפועל —
בדיוק כפי שהבקשה תיארה.

מה שכן שגוי בניסוח המקורי של הבאג:
- **המילה "כלול" אינה קיימת** בשום מקום ליד תווית המע"מ. כל התצוגות מציגות `+` — מע"מ **נוסף מלמעלה**.
- **הקוד אינו "מחשב 17%".** השרת קורא את שיעור הדייר מה-DB ([create-reservation.ts:378-381](../../lib/actions/create-reservation.ts#L378-L381)).
  ה-`0.17` ב-[reservation-form-store.ts:231](../../lib/stores/reservation-form-store.ts#L231) הוא **ברירת מחדל לפני ה-fetch** בלבד.

**הבאג האמיתי שנשאר:** אם ה-fetch ב-`ReservationModal` נכשל, ה-preview מחשב 17% בעוד השרת
שומר 18% — פער שקט של אחוז אחד בין מה שהמשתמש ראה למה שנשמר.

### 2.2 שיעור המע"מ ההיסטורי אינו ניתן לשחזור מהדייר

זו הטעות המסוכנת יותר. תוכניתי אמרה "backfill עם `vat_inclusive=true` וזה משחזר הכל". המדידה
מראה ש**שיעור הדייר שונה 17→18 בעבר**, והוא שדה **משתנה**:

| טווח | שיעור בפועל בשורות |
|---|---|
| `RES-20260407-011`, `-20260410-001`, `-20260417-001`, `-20260418-001` | **17%** |
| `RES-20260420-001` ואילך | **18%** |
| 10 שורות seed (`RES-002`…`RES-201C`) | 0 — `subtotal`/`tax_amount` מעולם לא נכתבו, רק `total_price` |

לכן **אסור** להשתמש ב-`tenants.vat_rate` ל-backfill: הוא יחיל 18% על הזמנות שנמכרו ב-17%.
זו בדיוק הסיבה ש-`reservations.vat_rate` חייבת להתמלא **לכל שורה מהמספרים של אותה שורה**.

**נוסחת ה-backfill המוכחת:**

```
vat_rate_row   = tax_amount / (total_price − tax_amount)   [אם המכנה > 0, אחרת 0]
vat_inclusive  = true
manual_total   = total_price
price_mode     = 'manual_total'
```

ואז המנוע מחזיר `net = total/(1+r)` ו-`vat = total − net`.

**תוצאה: 20 מתוך 20 שורות OK**, כולל שורות ה-seed (r=0 → vat=0, total נשמר). הפלט המלא הודבק
ב-`ref/proof/backfill-parity-live.txt`, וה-baseline ב-`ref/proof/baseline-reservations.csv`.

> תופעת לוואי חיובית: שמירת השיעור לכל הזמנה מנטרלת באג שלא הוזכר בבקשה — שינוי עתידי של
> שיעור המע"מ של הדייר היה מחיל את השיעור החדש על חישוב מחדש של הזמנה ישנה.

---

## 3. אישור/הפרכה של ארבעת הבאגים שנטענו

| # | הטענה | פסק |
|---|---|---|
| 1 | חוסר עקביות מע"מ 17 מול 18, ו-UI אומר "כלול" | **חלקית.** מע"מ אכן נוסף מלמעלה בכל מקום, והשיעור בפועל הוא 18%. אבל "כלול" אינו קיים, והקוד אינו מקבע 17% — ראה §2.1. |
| 2 | ספירה כפולה: `balance = total − paid − deposit` | **מאושר כפער, שגוי בסיווג.** `balance_due` ה-GENERATED מחסר `total_paid` בלבד. הביטוי עם ה-deposit חי רק ב-preview ([:341](../../lib/stores/reservation-form-store.ts#L341)) ובמשתנה מת בשרת ([:384](../../lib/actions/create-reservation.ts#L384), לא נכנס ל-INSERT). **הבאג: ה-preview חולק על כל תצוגה שלאחר השמירה.** `payments` ריקה, ולכן אין ספירה כפולה דרך טבלת תשלומים. |
| 3 | `discount_per_night = discountAmount / nights` | **מאושר** ([:442](../../lib/actions/create-reservation.ts#L442)). בהנחת אחוזים `discountAmount=0` ולכן נשמר **0** ומידע ההנחה אובד. גם לא מתעדכן לעולם — אינו ב-UPDATE. |
| 4 | תוכנית תעריפים אינה מיושמת | **מאושר במלואו, ורחב יותר.** `ratePlanId` לא מוצג בשום UI, לא נצרך בשרת, ואין לו עמודה ב-`reservations`. **ובנוסף: `rate_plans` ריקה לגמרי (0 שורות)** — אין תוכניות כלל, ומסך `/rate-plans` הוא stub "בפיתוח". |

---

## 4. כל מקומות חישוב המחיר

| # | מקום | מע"מ |
|---|---|---|
| 1 | `computeDerived()` — [reservation-form-store.ts:268-358](../../lib/stores/reservation-form-store.ts#L268-L358) | נוסף מלמעלה |
| 2 | `createReservation` — [create-reservation.ts:361-384](../../lib/actions/create-reservation.ts#L361-L384) (הסמכות ל-INSERT) | נוסף מלמעלה |
| 3 | `reservation-edit-store.ts` — **אינו מחשב כלל**; טוען ערכים ומקפיא אותם | — |
| 4 | `EditStep3Pricing.tsx:48-61` — מחשב `baseAmount` לתצוגה שאינה מוזנת חזרה לסכומים הנשמרים | — |
| 5 | `reservation-update.ts:183-210` — כותב `total_price`/`tax_amount` **ללא חישוב**; `subtotal`, `discount_per_night` אינם ב-UPDATE כלל | — |
| 6 | `ReservationPrintView.tsx:272` — גוזר את שורת ההנחה עצמאית מ-`subtotal × discount_percent/100` | — |
| 7 | `lib/utils/effective-pricing.ts` — פתרון מחיר לפי תאריך, **ליומן בלבד**, מתועד שם כאסור לזרימת ההזמנה | — |

**המשמעות:** זרימת ההזמנה מתמחרת אך ורק לפי `room_types.base_price` + `extra_person_price`,
ומתעלמת מ-6 שורות `rate_overrides` ומ-98 שורות `room_daily_pricing` הקיימות ב-DB.

---

## 5. שדות כרטיס אשראי — השרשרת קטועה בארבעה מקומות

1. **UI יצירה:** 6 שדות ניתנים להקלדה ([Step3Pricing.tsx:402-511](../../components/reservations/steps/Step3Pricing.tsx#L402-L511)).
2. **UI עריכה:** **0 inputs** — רק מחרוזת ממוסכת **קשיחה** `"4580 **** **** ****"` ([EditStep3Pricing.tsx:206-208](../../components/reservations/edit-steps/EditStep3Pricing.tsx#L206-L208)). כפתור "חייב עכשיו" בלי `onClick`.
3. **Store עריכה:** ל-`ReservationEditData` **אין** שדות כרטיס כלל.
4. **DB:** ה-INSERT משמיט את כולם; ה-UPDATE משמיט את כולם; `getReservationFull` לא בורר אותם.

**הסיבה שנטענה — `isExternal`/`SmartField` — שגויה.** אזור הכרטיס אינו עטוף ב-`SmartField` כלל
(`SmartField` מופיע ב-`EditStep3Pricing` פעם אחת בלבד, שורה 67, סביב גוש החדרים). התסמין אינו
ייחודי להזמנות ערוץ: **פרטי כרטיס אינם נשמרים באף הזמנה, מכל מקור.**

---

## 6. סעיפים ללא יעד קיים

| סעיף | ממצא |
|---|---|
| 10 — הסרת "הערות חיוב" | `grep -r "הערות חיוב"` → **0**. `billing_notes`/`billingNotes` → **0**. השדות הקיימים: `general_notes`, `internal_notes`, `reception_notes`, `cleaning_notes`, `maintenance_notes`. |
| 11 — "הערות" מעל "מדיניות ביטול" | **אין קומפוננטת מדיניות ביטול.** `cancellation_policy` נכתבת ([reservation-update.ts:207](../../lib/actions/reservation-update.ts#L207)) ואינה מוצגת. |
| 12 — CVC מהערוץ | המחרוזת "לא התקבל קוד סודי מהערוץ" → **0**. כרטיס "גבייה מהערוץ" → אינו קיים. ה-client מממש 11 endpoints, **אף אחד לא לכרטיסים**. `guarantee?: unknown` מוצהר ולא נקרא. **ו-`channel_booking_revisions` ריקה (0 שורות)** — אין אפילו נתון לבדוק מולו. |

---

## 7. משטח הרגרסיה

צרכני `total_price`/`balance_due`/`total_paid`/`tax_amount` שאותרו: `reservation-detail`,
`reservations`, `reservation-search`, `guests`, `guest-profile`, `calendar`,
`reservation-export-excel`, `render-reservation-template`, `reservation-emails`,
`reservation-pdf-client`, `ReservationPdfDocument`, `ReservationPrintView`,
`ReservationDetailView`, `EditStep3Pricing`, `EditStep4Summary`, `board-types`,
`ReservationBlock`, `guests/ReservationTable`, `reservations/page`, `guests/[id]/page`,
`constants/automations`, `CreateTemplatePanel` — **22 צרכנים**.

---

## 8. מה שאינו מוכח

- לא נבדקו טריגרים/פונקציות PL/pgSQL מעבר ל-`balance_due`. `check_room_availability` לא נסרקה בשלב זה.
- RLS לא נבדקה; כל הגישה היא דרך `postgres.js` עם `pms_app`.
- אין תשתית בדיקות בפרויקט (אין vitest/jest/playwright, אין `test`/`typecheck` ב-package.json).
