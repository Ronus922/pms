# UX Audit — Pricing Surfaces (PricingEditor / CardFields / Step3Pricing / EditStep3Pricing)

עץ עבודה: `/var/www/wt-pms-pricing` · לא בוצע אף שינוי קוד — ביקורת בלבד.
נבדק מול `CLAUDE.md` + `claude/CLAUDE.md` (Iron Rules, Minimum Padding, Prohibited Patterns).
`EditStep3Pricing.tsx` **כן** מייבא ומרנדר את `PricingEditor`/`CardFields` נכון — הוא כבר עבר את המיזוג, לא באמצע עבודה שחסר בה הקישור.

## תקציר

| # | חומרה | מיקום | תקלה |
|---|--------|-------|------|
| 1 | 🔴 חוסם | `PricingEditor.tsx:300-339` | `discountValue` גולמי אחד משמש גם ל-% וגם לסכום; מעבר מצב מפרש מחדש את אותו מספר בשקט, ללא ניקוי/התראה |
| 2 | 🟠 חשוב | `EditStep3Pricing.tsx:67-89` | `extraChargesSlot` אף פעם לא מועבר ל-`PricingEditor` בזרימת העריכה — אי אפשר להוסיף/לערוך תוספות בעריכת הזמנה |
| 3 | 🟠 חשוב | `StatusPill.tsx:77`, נצרך מ-`Step3Pricing.tsx:197`, `EditStep3Pricing.tsx:192,340` (וגם `Step4Review.tsx`, מחוץ להיקף) | `StatusPill` הוא `rounded-full border` — badge, לא `border-r-4` — מפר את כלל "סטטוס = צבע גבול" |
| 4 | 🟠 חשוב | `shared.tsx:13-20` (`SectionCard`) | הרווח בין הכותרת לתוכן הוא `mb-4` על ה-`h3`, לא `gap` על ה-wrapper — עקרון "Gap Over Margin" מופר בקומפוננטה המשותפת עצמה, בשימוש בעשרות מקומות |
| 5 | 🟡 שיפור | `Step3Pricing.tsx:89,178,186`; `EditStep3Pricing.tsx:169`; `PricingEditor.tsx:255,353,374` | עוד מופעים של אותו דפוס — `margin` לריווח בין ילדים ללא `gap` על ההורה |
| 6 | 🟡 שיפור | `EditStep3Pricing.tsx:189-191` | תאריך תשלום בהיסטוריה בלי `dir="ltr"`/`tabular-nums` |
| 7 | 🟡 שיפור | `CardFields.tsx:100` | `grid-cols-2` (חודש/שנה) בלי `max-sm:grid-cols-1` |
| 8 | 🟡 שיפור | `PricingEditor.tsx:409` | תווית אחוז המע״מ מחושבת מחדש מ-`vatAmount/netAmount` המעוגלים ולא מ-`vatRate` עצמו — עיוות תצוגה אפשרי בסכומים זעירים |
| 9 | 🟠 חשוב | `Step3Pricing.tsx:101-158` מול `EditStep3Pricing.tsx:93-149` | בלוק "אמצעי תשלום" (~45 שורות) עדיין כפול כמעט מילה-במילה בשני הקבצים שכן עברו את הריפקטור — לא חולץ לקומפוננטה משותפת כמו `PricingEditor`/`CardFields` |
| 10 | 🟡 שיפור | `CardFields.tsx:147-171` | `cardApprovalCode`/`cardTransactionRef` עם `dir="ltr"` אבל בלי `tabular-nums` |
| 11 | 🟡 שיפור | `PricingEditor.tsx:211` | אין מצב-ריק מפורש כש-`rooms.length === 0` (בהשוואה ל-`Step4Review.tsx` שמציג אזהרה כתומה מפורשת) |
| 12 | 🟡 שיפור | `PricingEditor.tsx:245-253` | לחצן הרחבת הפירוט הלילי עם `aria-expanded` אבל בלי `aria-controls` לפאנל שהוא שולט בו |

---

## 1. Touch Targets — מדידה בפועל

כל ה-`<input>`/`<select>` בחמשת הקבצים משתמשים ב-`inputClass`/`selectClass` מ-`components/shared/FormField.tsx`, ששניהם נושאים `min-h-[48px]` — מעל ה-44px, בכל מקום. לא נמצא אף `<input>`/`<select>` מתחת ל-44px.

כל ה-`<button>` בהיקף (יש רק 3):

- **`ToggleSwitch`** (`shared.tsx:73-93`) — הבקשה ביקשה לוודא שה-track החזותי 48×28 (`w-12 h-7`) אכן יוצא ל-hit area של 44px. אימתתי חישובית: הכפתור הוא `flex items-center justify-center min-w-11 min-h-11 px-2 py-2 -m-2`. עם `items-center/justify-center` הגודל בפועל = תוכן+padding (לא רק ה-min): רוחב = 48 (track) + 16 (px-2 בשני הצדדים) = **64px**; גובה = 28 (track) + 16 (py-2) = **44px בדיוק** — תואם ל-`min-h-11` (2.75rem=44px) בול, לא פחות. `-m-2` (−8px בכל צד) מקזז ויזואלית את ה-padding כך שהמיקום בפריסה לא זז — טכניקת hit-slop לגיטימית, לא ריווח-סיבלינגים אסור. **התוצאה: 64×44 — עומד בדיוק במינימום בציר האנכי (0px מרווח ביטחון), עובר בנוחות בציר האופקי.** תקין, אך ללא שום מרווח ביטחון אנכי — כל שינוי עתידי ב-`h-7`/`py-2`/`min-h-11` עלול להפיל את זה מתחת ל-44 בלי אזהרה ויזואלית.
- **לחצן הרחבת פירוט לילי** (`PricingEditor.tsx:245-253`, `px-2 py-2 -mx-2 min-h-11`) — אותה טכניקה, `min-h-11`=44px מובטח, רוחב תלוי-תוכן (טקסט "פירוט לילי (X לילות)" + אייקון) בהכרח > 44px. תקין.
- **`.btn`/`.btn-primary`** ("חייב עכשיו", `Step3Pricing.tsx:187-194`) — מוגדר ב-`app/styles/base.css:2-8`: `padding: 0.5rem 1rem` (=`px-4 py-2`, תואם טבלת המינימום בדיוק) + `min-height: 44px` מפורש. תקין.

**מסקנת סעיף 1: לא נמצא אף אלמנט אינטראקטיבי מתחת ל-44×44 בחמשת הקבצים.** ההערכה מבוססת על ניתוח סטטי של מחלקות Tailwind ו-CSS מקומפל בפועל (ראו מתודולוגיה בסוף) — לא על מדידת פיקסלים בדפדפן אמיתי, שלא זמינה כאן.

שורה נוספת שנבדקה: שורת חדר (`PricingEditor.tsx:213-231`) ושורת היסטוריית תשלום (`EditStep3Pricing.tsx:184-197`) — שתיהן **לא אינטראקטיביות** (אין `onClick`, אין `role`), רק תצוגה. כלל ה-44px לא חל.

---

## 2. כיוון מספרים (dir/tabular-nums)

רוב הכיסוי תקין. הבדיקה עברה על כל currency/percent/date/card figure בקבצים:

- **תקין**: `PricingEditor.tsx` — שדה "תעריף מחושב" (144), שני שדות ידניים (161,183), שדה הנחה (330), שורות חדר (223,226), טבלת פירוט לילי (267,270), כל `SummaryRow` (דרך `shared.tsx:42`, שתמיד `dir="ltr"`).
- **תקין**: `CardFields.tsx` — `cardLast4` (74), `cardHolderId` (89), `cardInstallments` (141) — כולם `dir="ltr" ... tabular-nums`.
- **חסר `tabular-nums`** (ממצא 10): `cardApprovalCode` (147-158, `dir="ltr" text-start` בלי `tabular-nums`) ו-`cardTransactionRef` (160-171, אותו דבר). אלה קודים אלפאנומריים חופשיים ולא מספרים טהורים, כך שהחוסר פחות קריטי מאשר בשדה כספי — אך "קוד אישור מחברת אשראי" עשוי להיות כולו ספרות בפועל, ולכן שווה תיקון עקבי.
- **חסר `dir="ltr"` וגם `tabular-nums`** (ממצא 6): `EditStep3Pricing.tsx:189-191` —
  ```tsx
  <span className="text-xs text-muted-foreground">
    {new Date(p.created_at).toLocaleDateString("he-IL")} • {p.method}
  </span>
  ```
  התאריך המעוצב (`DD.MM.YYYY` בלוקאל he-IL) מוצג בלי בידוד bidi ובלי `tabular-nums`, בניגוד לכל שאר התאריכים/מספרים בקובץ. **תיקון**: לעטוף רק את חלק התאריך ב-`<span dir="ltr" className="tabular-nums">`, להשאיר את `• {p.method}` מחוץ לעטיפה.

---

## 3. מובייל — `grid-cols-2`

שישה מופעים נמצאו בחמשת הקבצים (`grep -n "grid-cols-2"`):

| מיקום | יש `max-sm:grid-cols-1`? |
|---|---|
| `PricingEditor.tsx:141` (תעריף/מחיר ידני + מטבע) | ✅ |
| `PricingEditor.tsx:298` (סוג הנחה + ערך) | ✅ |
| `CardFields.tsx:53` (השדות הראשיים) | ✅ |
| `CardFields.tsx:100` (חודש/שנה תוקף) | ❌ (ממצא 7) |
| `Step3Pricing.tsx:118` (מקדמה/סכום ששולם) | ✅ |
| `EditStep3Pricing.tsx:109` (מקדמה/סכום ששולם) | ✅ |

`CardFields.tsx:100` (`<div className="grid grid-cols-2 gap-2">`) הוא הבן-יחיד בלי override. בפועל הסיכון נמוך — שני ה-`<select>` מכילים תוכן קצר מאוד ("01".."12", "2026"), כך שגם ב-320px רוחב שני עמודות קטנות עדיין קריא ולא נשבר — אך זה עדיין בניגוד מילולי לכלל, ועדיף `max-sm:grid-cols-1` לעקביות אם לא מנימוק מפורש שהזוג נשאר יחד בכוונה (כמו שדה תוקף כרטיס אשראי קונבנציונלי).

הערה מתודולוגית (לא ממצא בדירוג): כל ששת המקומות משתמשים בדפוס "`grid-cols-2` כברירת מחדל + `max-sm:` דורס למטה" ולא "`grid-cols-1` כברירת מחדל + `sm:grid-cols-2` בונה למעלה". שתי הגישות מגיעות לאותה תוצאה החזותית בפועל, אבל "Mobile First" הבנוי כלשונו ב-`claude/CLAUDE.md` ("Design for 320px, then scale up") הוא דפוס ה-`min-width` הבונה-למעלה, לא ה-`max-width` הדורס-למטה. לא סימנתי זאת כממצא נפרד כי זה עובד נכון בכל הרוחבים שנבדקו, רק מציין שהכיוון ההפוך.

---

## 4. גלישה אופקית — טבלת הפירוט הלילי

`PricingEditor.tsx:255` עוטף את הטבלה ב-`overflow-x-auto rounded-xl border border-border/20`, והטבלה עצמה `w-full`. זה מכיל כל גלישה אופקית **בתוך** האלמנט הזה בלבד — הדף עצמו לא יכול לגלוש בגלל הטבלה הזאת, כי אין wrapper הורה עם `w-max`/רוחב קבוע שדוחף רוחב יתר החוצה. **מאומת: תקין**, ללא סייג.

---

## 5. סמל המטבע מול הערך המוקלד (pe-12)

הדפוס: `<input dir="ltr" className="${inputClass} pe-12 text-start tabular-nums" />` + `<div className="absolute ... start-4 ...">{sym}</div>` בתוך `<div className="relative">` (למשל `PricingEditor.tsx:152-168`).

בדקתי את זה בקומפילציה אמיתית של Tailwind v4 (לא ניחוש): `inputClass` מכיל `px-5`, ש-Tailwind v4 מקמפל ל-**`padding-inline`** (shorthand לוגי, לא `padding-left`/`padding-right` פיזי!). `pe-12` מקמפל ל-`padding-inline-end` בלבד, ומופיע **אחרי** `.px-5` ב-stylesheet המקומפל (וידאתי בפועל דרך `@tailwindcss/postcss`) — כך ש-`padding-inline-end` הסופי הוא 48px (לא 20px מ-`px-5`), בלי קשר לסדר המחלקות במחרוזת ה-className.

הנקודה העדינה: ה-`<input>` עצמו הוא `dir="ltr"`, בעוד ה-wrapper `<div className="relative">` שנושא את הסמל **יורש** `dir="rtl"` מהשורש. לכן:
- על ה-input (היקף `ltr`): `pe-12` = `padding-inline-end` = physical **right** (ב-ltr, end=ימין).
- על ה-wrapper (היקף `rtl`, יורש): `start-4` = `inset-inline-start` = physical **right** (ב-rtl, start=ימין, בדיוק כמו שכלל 11 ב-CLAUDE.md אומר).

שני הצדדים מתלכדים לאותו physical right — לא במקרה: זו זהות מבנית (rtl-start ≡ ltr-end, תמיד, כשה-wrapper rtl וה-input בתוכו ltr). כך שהסמל (`start-4` = 16px מהקצה) יושב בנוחות בתוך אזור ה-padding השמור (48px), בלי חפיפה. ה-padding עצמו הוא box-model reserved space — טקסט לעולם לא "יזלוג" מתחתיו (padding אינו חלק מה-content box), כך שגם ערך ארוך מאוד לא יכול לגעת בסמל. **מאומת: תקין, בכל חמשת מופעי הדפוס (`PricingEditor.tsx:152-168, 174-191, 316-338`; `Step3Pricing.tsx:120-133,137-150`; `EditStep3Pricing.tsx:111-124,128-141`).**

---

## 6. שינוי מצב שמוחק קלט

בדקתי את `lib/pricing/engine.ts` ואת `lib/stores/reservation-form-store.ts`/`reservation-edit-store.ts` (`setField`) כדי לענות במדויק "מה קורה היום", לא בהשערה:

**priceMode (auto/manual_nightly/manual_total):** `setField` לא מנקה כלום — `manualNightlyRate`/`manualTotal` הם שדות נפרדים בסטור, ומעבר מצב פשוט מסתיר את השדה הלא-רלוונטי מהתצוגה. `computePricing`/`resolveNightRates` קוראים רק את השדה של המצב הפעיל. **מסקנה: הערך לא נמחק, רק מוסתר** — אם המשתמש חוזר ל-`manual_nightly` אחרי סיבוב דרך `auto`, הערך הישן חוזר להופיע בלי שום סימון שזה ערך "ישן". לא הרסני, אבל עלול להפתיע.

**discountMode + discountValue — הממצא האמיתי (ממצא 1, חוסם):** בניגוד ל-priceMode, יש **שדה גולמי יחיד** (`value.discountValue`) שמשותף לכל 4 מצבי ההנחה (`amount_per_night`, `percent_per_night`, `amount_total`, `percent_total`). ב-`PricingEditor.tsx:300-339`:
```tsx
<select value={value.discountMode} onChange={(e) => onChange("discountMode", e.target.value as DiscountMode)} ...>
  {DISCOUNT_MODES.map(...)}
</select>
{discountMeta.suffix && (
  <input
    value={value.discountValue || ""}
    onChange={(e) => {
      const raw = Number(e.target.value) || 0
      onChange("discountValue", discountMeta.suffix === "%" ? Math.min(100, Math.max(0, raw)) : Math.max(0, raw))
    }}
    ...
  />
)}
```
ה-clamp ל-[0,100] קורה רק **בזמן ההקלדה**, לא בזמן החלפת `discountMode`. כלומר: משתמש מזין 20 באחוזי-הנחה-ללילה (`percent_per_night`), עובר ל"הנחה בסכום להזמנה" (`amount_total`) — אותם 20 שהיו % הופכים בשקט ל-20 ₪, ו-`computeDiscount` ב-`lib/pricing/engine.ts:252-273` מיישם אותם לפי המצב **החדש** בלי שום איפוס, אזהרה, או אינדיקציה חוץ מהסמל שליד השדה שמתחלף מ-`%` ל-`sym`. זו לא רק "מחיקה שקטה" — זו **פרשנות שונה בשקט לאותו מספר**, מה שעלול לשנות סכום להזמנה אמיתי בלי שהמשתמש יבחין. `validatePricingInput` (`engine.ts:302-311`) לא תופס את זה כי הערך תקין כשלעצמו בכל מצב (0-100 גם כ-₪ הגיוני).
**תיקון מוצע**: לאפס `discountValue` ל-0 (או לשמור ערך נפרד per-suffix) בכל `onChange("discountMode", ...)`, ולהציג toast/הודעה "ההנחה אופסה עקב שינוי סוג".

---

## 7. מצבי ריקה/שגיאה

| מצב | מה קורה בפועל | תקין? |
|---|---|---|
| אין חדרים (`rooms=[]`) | `PricingEditor.tsx:211` — `{rooms.length > 0 && (...)}` — הסקשן כולו נעלם בשקט, בלי הודעה. שאר הטופס (מצב מחיר/הנחה/מע״מ/סיכום) ממשיך לפעול. | חלקית — לא שובר כלום, אבל בהשוואה ל-`Step4Review.tsx:264-267` שמציג בפירוש "לא נבחרו חדרים" בתיבה כתומה, ל-`PricingEditor` אין מקבילה (ממצא 11). |
| אין תוכניות תעריפים (`ratePlans=[]`, `rate_plans` ריקה בפרודקשן) | `<select>` (101-115) מרנדר רק `<option value="">ללא תוכנית</option>` — dropdown תקין עם אופציה יחידה, אין קריסה, אין "undefined". | **תקין**, מאומת. |
| יתרה שלילית (זיכוי) | `PricingEditor.tsx:426-437` — תווית מתחלפת ל"יתרת זכות", ערך תמיד `Math.abs(...)` (לא מוצג מינוס כפול), צבע emerald לעומת red ל-חוב. | **תקין**, מאומת בכוונה. |
| VAT-exempt | תווית `"מע״מ (פטור)"` (405-411, 407 ב-notice), `vatAmount=0` דרך `engine.ts:350`, מוצג כ-0.00 באותה שורה — עקבי. | **תקין**, מאומת. |

הערה נלווית (ממצא 8, שיפור): תווית האחוז לצד "מע״מ" ב-`PricingEditor.tsx:409` —
```tsx
`מע״מ (${(result.vatAmount / Math.max(result.netAmount, 1) * 100).toFixed(0)}%) — ...`
```
זו חישוב-לאחור מ-`vatAmount`/`netAmount` **המעוגלים כבר** (`round2` בשני הצדדים ב-engine), לא הצגה ישירה של `vatRate` שהוזן. בסכומים זעירים (למשל נטו של כמה אגורות) העיגול הכפול עלול להציג "33%" או דומה במקום שיעור המע״מ האמיתי (18%). לא משפיע על הסכום שנגבה בפועל (`vatAmount` עצמו נכון) — רק על תווית התצוגה. תיקון: להעביר את `vatRate` המקורי (fraction) עד ל-`PricingResult` ולהציג `round2(vatRate*100)` ישירות, כמו ש-`breakdown` הפנימי כבר עושה ב-`engine.ts:412`.

---

## 8. כפילות שהוסרה — ומה שנשאר

**PricingEditor/CardFields — כן הוסרה, עם מספרים אמיתיים מ-git:**
- קומיט `401c799` (מוזג): `Step3Pricing.tsx` **-422 / +112** שורות, ובמקביל נוצרו `pricing/PricingEditor.tsx` (+450), `pricing/CardFields.tsx` (+174), `pricing/shared.tsx` (+94).
- שינוי לא-מקומט נוכחי (עבודת סוכן אחר על `EditStep3Pricing.tsx`, שכבר נקלטה בעץ העבודה): **-202 / +152** שורות, עובר לאותם `PricingEditor`/`CardFields`.
- סה"כ: **~624 שורות** של לוגיקת UI לתמחור/כרטיס-אשראי שהיו כפולות ועצמאיות בשני קבצי ה-Step הוסרו, והוחלפו ב-**718 שורות במקום משותף אחד** (`pricing/`) הנצרך משני call sites דקים (204 שורות כל אחד כיום). זה בדיוק סוג ה-DRY שכלל 8 דורש, ומאומת ולא מוערך.

**מה שלא הוסר — בתוך אותם קבצים שכן עברו ריפקטור (ממצא 9):** בלוק "אמצעי תשלום" (SectionCard שלם, שדה `select` + גריד מקדמה/סכום ששולם) עדיין כפול כמעט מילה-במילה:
- `Step3Pricing.tsx:101-158` (~58 שורות)
- `EditStep3Pricing.tsx:93-149` (~57 שורות)

ההבדלים היחידים: שם השדה השני (`amountPaid` מול `totalPaid`), ומקור הערכים (`store.` מול `data.`). זה בדיוק סוג המבנה החוזר שכלל 8 (DRY) מבקש לחלץ לקומפוננטה — לא נעשה כאן, אף שנעשה בהצלחה ל-pricing/card. מומלץ: `PaymentMethodFields` באותה תיקיית `pricing/`.

**`Step4Review.tsx` מול `EditStep4Summary.tsx` — לא היו חלק מהריפקטור, כמצופה, וזה עדיין חוב מלא:**
שני הקבצים (378 ו-310 שורות) מגדירים **בנפרד** את אותן פרימיטיבות: `SectionCard` (`Step4Review.tsx:14-24` מול `EditStep4Summary.tsx:12-23`), `ReviewRow` (35-45 / 24-32), `SummaryAmountRow` (47-72 / 34-43), ופונקציית פורמט מטבע (`formatCurrency` ב-74-77 מול `fmt` ב-45-47). `diff` בין הקבצים מראה כ-446 שורות שונות מתוך ~688 סה״כ — כלומר רוב שני הקבצים הוא אותו מבנה תצוגה (כרטיסי אורח/שהייה/חדרים/תמחור/תשלום) עם קישור לשני סטורים שונים. **חמור יותר מ"רק כפילות"**: פונקציות התאריך כבר **סטו זו מזו** — `Step4Review.tsx`'s `fmtDateTime(isoDate, time)` (27-33) מפרק ISO string ידנית, בעוד `EditStep4Summary.tsx`'s `fmtDateTime(v)` (58-61) בונה `new Date(v)` ושואב שעה/דקה בדרך שונה לגמרי. זה בדיוק ה"drift" שקומיט 401c799 מתאר כבעיה שהוא פותר לתמחור — וכאן הוא כבר קרה, לא רק עומד לקרות. **לא בהיקף המשימה הזו לתקן — רק לדווח כחוב פתוח**, מומלץ לחלץ באותו דפוס ל-`pricing/` (או `review/`) shared module.

---

## 9. נגישות

- **`ToggleSwitch`** (`shared.tsx:73-93`): `role="switch"`, `aria-checked={checked}`, `aria-label={label}` — שלושתם קיימים ונכונים. **תקין**.
- **לחצן הרחבת פירוט לילי** (`PricingEditor.tsx:245-253`): יש `aria-expanded={showNightly}` ותווית טקסט גלויה (לא icon-only, אז `aria-label` לא נדרש) — אבל **חסר `aria-controls`** שמצביע על ה-`id` של הטבלה שהוא שולט בה (ממצא 12). תיקון: `id="nightly-breakdown"` על ה-wrapper בשורה 255, ו-`aria-controls="nightly-breakdown"` על הכפתור.
- **`CardFields`**: `<select>` חודש/שנה (101-128) נושאים `aria-label="חודש תוקף"`/`"שנת תוקף"` במפורש — טוב, כי אין `<label>` נפרד לכל אחד (הם תת-שדות בתוך `FormField` אחד "תוקף (חודש / שנה)"). **תקין**.
- **תיוג תוויות (labels tied to inputs)**: `FormField` (`components/shared/FormField.tsx`, לא בהיקף הסקירה אך נצרך על ידי כל חמשת הקבצים) מרנדר `<label>` **בלי `htmlFor`** ו**בלי `id` מועבר לילד**. כלומר בפועל, בכל שדה בחמשת הקבצים (רוב השדות בכל 5 הקבצים), הקישור בין התווית לשדה הוא ויזואלי-בלבד — קורא מסך שמקבל פוקוס ישירות על ה-`<input>` לא בהכרח יכריז את תוכן ה-`<label>`. זו לא תקלה בקוד שנכתב מחדש בענף הזה, אבל היא חוסמת את התשובה המלאה ל"labels tied to inputs" — שווה לדווח למי שאחראי על `FormField.tsx` (מחוץ להיקף השינוי שלי).
- **StatusPill**: ה-icon בתוכו (`Icon name={item.icon}`) הוא דקורטיבי בלבד לצד טקסט גלוי — אין בעיית a11y שם, הבעיה ב-`StatusPill` היא עיצובית (ממצא 3), לא נגישות.

---

## מה אומת כתקין (לא רק רשימת תקלות)

- כל input/select בחמשת הקבצים עומד ב-44px+ (בפועל 48px, מעל למינימום) — ראו סעיף 1.
- `ToggleSwitch` אכן משיג בדיוק 44px גובה / 64px רוחב hit area מעל track חזותי של 48×28 — מאומת חישובית.
- אין אף `grid-cols-2` בלי `max-sm:grid-cols-1` **מלבד** `CardFields.tsx:100` (ממצא קל, סיכון נמוך בפועל).
- טבלת הפירוט הלילי לא יכולה לגרום לגלילה אופקית של הדף — `overflow-x-auto` מקומי סוגר את זה הרמטית.
- דפוס `pe-12` + סמל אבסולוטי עובד נכון ב-RTL בכל חמשת המופעים שלו — מאומת עד רמת ה-CSS המקומפל בפועל (Tailwind v4, `padding-inline` vs `padding-inline-end`), לא רק בהנחה.
- מצבי ריקה/קצה: `rate_plans` ריקה, יתרת זכות, VAT-exempt — כולם קריאים ונכונים כפי שנבדק בקוד.
- אין `any`, אין `console.log`, אין `style={{...}}`, אין `!important` בחמשת הקבצים.
- כל הכפתורים/inputs/selects משתמשים ב-`rounded-xl`/`rounded-[20px]`/`rounded-lg` (`.btn`) — בלי פינות ריבועיות.
- Padding מינימלי: `SectionCard` (`p-5`), inputs (`px-5 py-3.5` בפועל, מעל ל-`px-3 py-2` הנדרש), table cells (`px-4 py-3`, תואם בדיוק), badges של `StatusPill` (`px-3 py-1.5`/`px-2.5 py-1`, מעל ל-`px-2 py-0.5`) — תוכן בשום מקום לא נוגע בגבול.
- `PricingEditor`/`CardFields` אכן קומפוננטה יחידה הנצרכת משני זרמי create/edit — לא שני עותקים — מאומת גם מקריאת קוד וגם מהיסטוריית git (סעיף 8).
- זרימת ה-`disabled`/`SmartField` בעריכה: `lockType="warning"` (לא `"locked"`) עבור הזמנות חיצוניות ב-`EditStep3Pricing.tsx:66` הוא מכוון — `WarningField` (ב-`FieldLock.tsx`) לא מנטרל שדות, רק מוסיף הודעת אזהרה, בהתאם להערת הקוד בראש הקובץ ("a clerk still has to record how that guest paid"). לא באג.

---

## מתודולוגיה / מגבלות

- מדידות ה-44×44 מבוססות על ניתוח מחלקות Tailwind + קומפילציה בפועל של ה-CSS דרך `@tailwindcss/postcss` (לא ניחוש) — לא על screenshot/מדידת פיקסלים אמיתית בדפדפן, שלא הייתה זמינה בסביבת הביקורת הזאת. אם יש `box-sizing`/reset גלובלי לא-סטנדרטי שמשנה את חישוב ה-padding, זה עשוי לשנות תוצאות — לא נבדק מעבר ל-Tailwind preflight הסטנדרטי.
- לא נבדקו רינדור בפועל בדפדפן/מובייל אמיתי, רק ניתוח סטטי של קוד + CSS מקומפל.
- `components/shared/FormField.tsx`, `StatusPill.tsx`, `FieldLock.tsx` אינם בהיקף הקבצים שהתבקשתי לסקור — צוינו רק כשתקלה שהם מכניסים גולשת דרך אחד מחמשת הקבצים הנסקרים (StatusPill, FormField labels).
