# ביקורת אבטחה — מנוע תמחור/תשלומים בהזמנות

תאריך: 2026-07-25 · ענף: `feat/reservation-pricing-engine` · worktree: `/var/www/wt-pms-pricing`
כל הבדיקות בוצעו בקריאה בלבד מול `pms-dryrun` (שחזור מלא של פרודקשן, DB `dryrun`) וקריאת קוד בענף. **ערכים של כרטיס/CVC/PAN לא נבחרו ולא הודפסו בשום שלב.**

---

## א. פסק דין על סעיף 12 (CVC מהערוץ)

**מסקנה: אין היום שום מקור נתונים ל-CVC מהערוץ, ולכן אי אפשר לבנות UI לחשיפת CVC — כל מימוש כזה כרגע יהיה feature לא-ניתן-לבדיקה מול מקור לא-מוכח.**

נמדד:
- `docker exec -i pms-dryrun psql -U postgres -d dryrun -X -c "select count(*) from channel_booking_revisions;"` → **0 שורות**. אין ולו התכתבות ערוץ אחת שמורה בפרודקשן להסתכל עליה — לא ניתן אפילו לבדוק אמפירית אילו מפתחות `payload` ה-OTAs שולחים בפועל.
- `lib/integrations/channex/client.ts` — נמדדו 12 פונקציות מיוצאות (`testConnection, listProperties, createProperty, createRoomType, createRatePlan, pushRestrictions, pushAvailability, listBookingRevisionsFeed, acknowledgeBookingRevision, subscribeWebhook, listWebhooks, deleteWebhook`). **אף אחת אינה endpoint תשלום/כרטיס.** תואם לעובדה שנמסרה (11 endpoints, ללא payment).
- `lib/integrations/channex/types.ts:221` — `guarantee?: unknown` בתוך `ChannexBookingRevision`. שדה קיים בטיפוס, **לא נקרא בשום מקום בקוד** (`grep -rn "guarantee" lib/integrations/channex/` מחזיר רק את שורת ה-declare). גם אם payload עתידי יכיל אובייקט guarantee, אין קוד שמפרק אותו.
- `ChannexBookingRevision` כן מכיל `payment_collect?: "property" | "ota"` ו-`payment_type?: "credit_card" | "bank_transfer"` (types.ts:215-216) — אלה מטא-דאטה על **מי גובה** ו**באיזה אמצעי**, לא נתוני כרטיס עצמם. גם שדות אלה לא נקראים היום בקוד החי (`orchestrator.ts` כותב את כל ה-payload כ-JSON גולמי, לא שולף שדות ספציפיים ממנו — ראה `orchestrator.ts:723`: `${JSON.stringify(rev)}::jsonb`).
- `channels` (טבלה, dryrun): `\d channels` → עמודות `id, tenant_id, name, type, api_credentials, is_connected, is_active, last_sync_at, sync_status, created_at`. **אין עמודת capabilities/features** שיכולה לציין אם ל-OTA מסוים יש virtual-card/guarantee. גם ברמת המודל אין איפה "לתלות" תמיכה בכרטיס וירטואלי.

**מה צריך להיות נכון כדי שזה יהפוך לאפשרי:**
1. פיצ'ר בחשבון Channex/OTA שמחזיר guarantee עם נתוני VCC (תלוי ב-property setup ב-Channex, לא בקוד שלנו).
2. endpoint חדש ב-`client.ts` שקורא במפורש ל-resource הזה (אין כזה היום).
3. פרסור מפורש של `guarantee` ב-`orchestrator.ts` (או שירות נפרד) שכותב שדות מסוננים (לא raw payload) לטבלה ייעודית עם הצפנה.
4. לפחות רשומת production אחת ב-`channel_booking_revisions` עם מבנה `guarantee` אמיתי כדי לאמת parsing — **כרגע אין אף אחת (0 שורות).**

עד שכל 4 מתקיימים — כל "כפתור חשיפת CVC" הוא UI שרץ מול null קבוע. אסור לבנות אותו עכשיו.

---

## ב. ארבעת מצבי "למה לא זמין"

טבלת המצבים, התנאי המדויק, הטקסט המומלץ, ומצב הזיהוי בפועל:

| # | מצב | תנאי זיהוי מדויק | טקסט לפרונט (עברית) | ניתן לזיהוי היום? |
|---|-----|-------------------|----------------------|---------------------|
| 1 | הערוץ אינו תומך בכרטיס וירטואלי | דגל capability על `channels`/`channel_connections` (למשל `supports_virtual_card boolean`) — **לא קיים היום** | "הערוץ שממנו הגיעה ההזמנה אינו תומך בגבייה באמצעות כרטיס וירטואלי" | **לא אומת / לא קיים** — אין עמודת capability בשום טבלת ערוץ (`\d channels`, `\d channel_connections` נבדקו) |
| 2 | חלון הגבייה טרם נפתח | `now() < check_in - policy_days` כאשר `policy_days` הוא קבוע/הגדרה של המדיניות | "חלון הגבייה עדיין לא נפתח — ניתן לגבות החל מ-{תאריך}" | **חלקי** — `reservations.check_in` קיים ונקרא בכל מקום (למשל `lib/actions/reservation-detail.ts:10`), אז ה-*תנאי הזמן* חשיב, אבל **אין היום שום עמודת policy/config ל-`policy_days`** — כלומר החישוב לא ממומש בפועל |
| 3 | חלון הגבייה נסגר | `now() > check_out` (או cutoff מדיניות מוגדר) | "חלון הגבייה נסגר — לא ניתן לגבות רטרואקטיבית דרך הערוץ" | **חלקי**, אותה סיבה כמו #2 — `check_out` קיים אך אין cutoff config |
| 4 | חסרה הרשאה בצד Channex | תגובת שגיאת permission/403 מ-endpoint ה-guarantee **שעדיין לא קיים** | "לחשבון Channex המחובר אין הרשאה לגישה לפרטי הגבייה של הזמנה זו" | **לא — אין endpoint לקרוא ממנו תגובת שגיאה בכלל** |

מסקנה מרוכזת: **אף אחד מארבעת המצבים אינו ניתן לזיהוי אמיתי מהמערכת כפי שהיא היום.** #2/#3 קרובים ביותר כי עמודות התאריך קיימות בפועל בסכימה — אך המדיניות (הסף) שהופכת תאריך לסטטוס לא קיימת בקוד. #1/#4 דורשים תשתית חדשה לגמרי (capability flag, endpoint). **אין לרנדר "זמין/לא זמין" בינארי — יש להחזיר קוד מצב מפורש (enum) מהשרת, כאשר עד שהתשתית החסרה תיבנה, המצב היחיד החוקי להחזרה הוא מצב חמישי כללי: "לא ניתן לקבוע — התשתית לא קיימת" (ולא לנחש/למפות לאחד מארבעת המצבים).**

---

## ג. חוזה PCI מחייב — non-negotiables לכל מימוש עתידי

1. **איסור אחסון מוחלט** — CVC ו-PAN מלא (16 ספרות) **לעולם לא** נכתבים ל: PostgreSQL (שום טבלה), Redis/cache, `localStorage`, `sessionStorage`, Zustand `persist` middleware, לוגים (`console.*`, error tracking), audit trail. גם לא בצורה מוצפנת — אין הצדקה לשמור CVC בכלל (תואם PCI-DSS: CVC אסור לאחסון תחת כל תנאי, גם מוצפן).
2. **On-demand server-action בלבד, ללא prefetch** — חשיפת פרטי כרטיס (ככל שתמומש) חייבת לרוץ כ-`"use server"` action שנקרא רק בלחיצת המשתמש על "הצג", ולא כחלק מטעינת עמוד. **קריטי: `getReservationFull` ב-`lib/actions/reservation-detail.ts:6-85` הוא ה-loader הראשי של מסך ההזמנה — אסור בהחלט להוסיף אליו שליפת guarantee/card, גם לא "for convenience", כי זה הופך prefetch אוטומטי לכל טעינת מסך.**
3. **שער הרשאה עם החתימה האמיתית** — `requirePermission(module: string, action: Action)` מ-`lib/auth/actor.ts:96-105`, כאשר `Action = "view" | "edit" | "delete"` (`lib/permissions/constants.ts:5`). **אין** צורת מחרוזת עם נקודתיים כמו `"reservations:edit"` — כל שימוש בסגנון הזה הוא שגוי. לפעולת חשיפת כרטיס: `requirePermission("reservations", "view")` (או module ייעודי חדש אם ננקוט medium-risk isolation, אך MODULES קיים ב-`constants.ts:33-54` ואין בו module בשם card/payment — צריך להוסיף).
4. **אימות tenant_id** — כל שאילתה שמביאה/עדכנית הזמנה סביב הפעולה הזו חייבת `AND tenant_id = ${actor.tenantId}` באותו statement שמביא את השורה הרגישה, לא רק ב-endpoint outer. ראו סעיף פערים ב-Task 2 למטה — יש כבר כיום מקומות בקוד הקיים בלי הצמדה עקבית; אסור לשכפל את הדפוס הזה לקוד חשיפת כרטיס.
5. **Audit את הגישה, לא את הערך** — כל קריאה מוצלחת/כושלת לחשיפת כרטיס נכתבת ל-audit trail עם `{actor.userId, reservationId, timestamp, result: "revealed"|"denied"|"error"}` — **בלי** ערך הכרטיס עצמו בתוך ה-payload המבוקר.
6. **UI: hidden by default + auto-hide + no DOM until revealed** — השדה לא נטען ל-DOM כלל עד פעולת reveal; לאחר reveal — auto-hide אחרי 60 שניות (setTimeout שמנקה state, לא רק CSS mask); `autocomplete="off"` על כל input; אין React state שמחזיק ערך אחרי hide (לנקות את ה-state עצמו, לא רק את התצוגה).
7. **שגיאה גנרית ללקוח** — אם ה-server action נכשל (הרשאה/מקור/timeout) — התשובה ללקוח היא קוד מצב כללי (ר' סעיף ב), לעולם לא stack trace/שגיאת DB גולמית.

---

## ד. פער ה-audit log

**אין כיום writer עובד ל-audit trail הכללי של הזמנות.** נמדד:
- הטבלה החיה בפרודקשן (dryrun restore) היא **`audit_log` (יחיד)** בלבד: `select to_regclass('public.audit_log'), to_regclass('public.audit_logs');` → `audit_log` קיים, `audit_logs` = NULL (לא קיים בפועל).
- עמודות `audit_log` (מ-`\d audit_log`): `id uuid, tenant_id uuid NOT NULL, user_id uuid, entity_type text NOT NULL, entity_id uuid NOT NULL, action text NOT NULL, changes jsonb, ip_address text, created_at timestamptz`.
- הקוד החי קורא ממנה: `lib/actions/reservation-detail.ts:74-82` (`FROM audit_log al ... WHERE al.entity_id = ${reservationId}`) — **קריאה בלבד**.
- `grep -rn "INSERT INTO audit_log" .` (לא כולל `maintenance_task_audit_log`, טבלה נפרדת) — **0 תוצאות בכל הריפו.** אין שום כתיבה ל-`audit_log` (יחיד) בקוד החי.
- הכתיבה היחידה הקיימת בריפו היא `src/services/audit.ts:48` (`admin.from('audit_logs').insert(...)`) — לטבלת **`audit_logs` (רבים)**, שמוגדרת רק ב-`database/schema.sql:301` (סכמה מיועדת/dead) ו**לא קיימת בפועל בפרודקשן** (אומת מול dryrun). בנוסף, `tsconfig.json:22` ממפה `"@/*": ["./*"]` — כלומר `src/` לא נגיש דרך alias הפרויקט, ואין אף import ל-`services/audit` בשום קובץ חי (`grep -rn "services/audit"` → 0 תוצאות) — **מת בוודאות, לא רק בחשד**.
- מסקנה: כרגע כל מה שמסך ההזמנה מציג תחת "היסטוריית פעולות" הוא טבלה ריקה-לנצח (אין כותב), ו-Task 3/ה' (audit על גישה ל-card data) **לא יכול להיכתב לשום מקום קיים** בלי לבנות writer חדש.

**מה נדרש ל-writer אמיתי דרך `lib/db.ts`:**
- `lib/db.ts` חושף `db` = מופע `postgres()` (porsager) מחובר ל-`DATABASE_URL` (`lib/db.ts:9-13`) — זהה למופע שכל שאר ה-actions (`reservation-detail.ts`, `create-reservation.ts` וכו') כבר משתמשים בו.
- writer תקין: פונקציה `createAuditLog(tenantId, userId, entityType, entityId, action, changes)` שמריצה `INSERT INTO audit_log (tenant_id, user_id, entity_type, entity_id, action, changes) VALUES (...)` דרך אותו `db` — **לא** דרך Supabase admin client (`src/services/audit.ts` המת עושה זאת דרך Supabase, ערוץ אחר לגמרי מ-`lib/db.ts`, ולכן גם לא היה יכול לפעול נגד סכימת ה-DB האמיתית).
- כל קריאה ל-writer הזה חייבת לקרות **אחרי** ההצלחה של הפעולה המבוקרת (לא לפני), ולא לחסום/להיכשל את הפעולה העסקית אם ה-INSERT ל-audit נכשל (best-effort, בדומה לדפוס `sendReservationNotifications(...).catch(() => {})` ב-`lib/actions/create-reservation.ts:492`).

---

## ה. מה שנשמר במקום (סעיפים 8+9)

השדות שכן ממומשים היום בטופס (`components/reservations/steps/Step3Pricing.tsx`) ובחנות (`lib/stores/reservation-form-store.ts:120-128,236-243`): `cardHolderName, cardNumber, cardHolderId, cardExpiryMonth, cardExpiryYear, cardApprovalCode, cardTransactionRef, cardInstallments` — 6 שדות editable (`cardHolderName, cardNumber, cardHolderId, cardExpiryMonth, cardExpiryYear, cardInstallments`) + 2 readonly auto-populated (`cardApprovalCode, cardTransactionRef`, מסומנים "יוזן אוטומטית לאחר חיוב", `Step3Pricing.tsx:483-490`).

**היעד למימוש:** 4 ספרות אחרונות בלבד, שם בעל הכרטיס, תוקף, קוד אישור, אסמכתא, תשלומים. **PAN מלא ו-CVV לעולם לא נשמרים, גם לא מוצפנים** — אין להם column ייעודי בכלל.

ממצאים קונקרטיים:
- **`CardNumberInput` (`components/reservations/steps/Step3Pricing.tsx:24-56`) מחזיק היום את מספר הכרטיס המלא (עד 16 ספרות) ב-state של React** — `const raw = value.replace(/\D/g, "").slice(0, 16)` (שורה 27), עם מיסוך תצוגה בלבד (`masked` state, שורות 25, 29-30) — **המספר המלא קיים ב-memory של הדפדפן**, לא רק 4 ספרות אחרונות. **חובה לצמצם: ה-input צריך לקבל/להחזיק אך ורק 4 ספרות אחרונות, לא לקבל 16 ספרות ולמסך רק בתצוגה.**
- `ReservationModal.tsx:204-211` שולח את **כל 8 שדות הכרטיס, כולל `cardNumber` המלא ו-`cardHolderId`** (ת.ז., PII רגיש) בתוך `formData` ל-`createReservation(tenantId, propertyId, formData)`.
- `lib/actions/create-reservation.ts` — `grep -n "card" -i lib/actions/create-reservation.ts` מחזיר **0 תוצאות**. אף שדה כרטיס לא נקרא, לא נבדק ולא נכתב ב-INSERT להזמנה (`INSERT INTO reservations (...)`, שורות 424-448) — **כל 8 השדות, כולל המספר המלא שכבר עבר ברשת/ב-payload של ה-server action, נזרקים ב-silence**. זו בעיה כפולה: (א) חשיפה מיותרת של PAN מלא בתעבורת הרשת בין client ל-server action, גם אם הוא לא נשמר בסוף; (ב) UX שקרי — המשתמש ממלא שדות שלא עושים דבר.
- `reservations.card_holder_id` (עמודה שנוספה ב-`scripts/migrations/2026-04-10_availability_and_email.sql:57`) — `grep -rn "card_holder_id"` מלבד המיגרציה עצמה מחזיר **0 תוצאות קוד**. עמודה קיימת בסכימה, אף פעם לא נכתבת ואף פעם לא נקראת.

**מסקנה מעשית לפיצ'ר 8+9:** יש לבנות סכימה חדשה (טבלה/עמודות ייעודיות) שמכילה רק `last4, cardholder_name, expiry_month, expiry_year, approval_code, transaction_ref, installments` — בלי עמודת מספר כרטיס מלא בשום מקום — ולשנות את `CardNumberInput` כך שיקבל/ישמור state של 4 ספרות בלבד (לא לקצץ בתצוגה תוך שמירת 16 ב-state).

---

## נספח — פערי tenant_id שנמצאו (context ל-ג.4)

Task 2 ביקש לצטט WHERE clauses. נבדקו שלושת הקבצים; רוב הנתיבים מסננים tenant_id בעקביות, אבל נמצאו כמה שאילתות משניות (לא ה-SELECT הראשי שמאמת בעלות) בלי `AND tenant_id = ...`, שמסתמכות על כך ש-ID כבר אומת קודם באותה פונקציה:

- `lib/actions/reservation-detail.ts:56` (`rooms`), `:63` (`charges`), `:70` (`payments`), `:79` (`logs`, audit_log) — כל ארבע ה-שאילתות המשניות מסננות רק לפי `reservation_id`/`entity_id`, **בלי** `tenant_id`. הן מוגנות בפועל כי השורה הראשית (`reservation-detail.ts:29`: `WHERE r.id = ${reservationId} AND r.tenant_id = ${actor.tenantId}`) כבר מוודאת בעלות לפני שהקוד ממשיך — אך זה תלוי-סדר-ריצה ולא defense-in-depth עצמאי; שינוי עתידי (הפרדת פונקציה) עלול לאבד את ההגנה.
- `lib/actions/create-reservation.ts:342` (בדיקת קיבולת אפקטיבית: `WHERE r.id = ${rc.roomId}`) ו-`:408` (`UPDATE guests ... WHERE id = ${guestId}`) — גם כאן, ללא `tenant_id` ישיר בשורה עצמה, אך `roomId`/`guestId` כבר אומתו כנגד tenant בשלב מוקדם יותר באותה פונקציה (שורה 263 ו-393 בהתאמה).
- לעומת זאת `lib/actions/reservation-update.ts` עקבי לחלוטין — כל שלוש הפעולות (`replaceReservationRoom`, `updateReservation`) מצמידות `tenant_id` בכל UPDATE/SELECT רגיש (שורות 72, 79, 101, 142, 169, 209).

**המלצה לקוד הכרטיס החדש:** לצמד `tenant_id` בכל שאילתה שנוגעת ברשומה רגישה (reservation/guarantee), גם אם ה-ID "כבר אומת" קודם בפונקציה — לא להעתיק את הדפוס החסר שנמצא כאן.

---

*כל טענה מגובה ב-`path:line` או בפקודה שהורצה בפועל מול `pms-dryrun`. שום ערך של כרטיס/guarantee לא נבחר בשאילתה כלשהי.*
