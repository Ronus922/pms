# 12.9 — החלטות סופיות (אושרו לפני תחילת פיתוח)

> תאריך אישור: 2026-05-08
> מקור: 8 השאלות הפתוחות מסעיף 12 של `attendance-module-plan.md`
> סטטוס: כל ההחלטות אושרו על-ידי המשתמש. הפיתוח יתבצע לפי הקווים שנקבעו כאן.
> **ההחלטות בסעיף זה גוברות על כל קונפליקט בסעיפים 1–11 או 12.1–12.8.**

---

## טבלת סיכום מהיר

| # | נושא | החלטה |
|---|------|--------|
| 12.1 | Scope של גרסת ההשקה | **Phase 1 + 1.5 (מלא)** — גם הגדרות ניהוליות וגם מסך דיווח עובד |
| 12.2 | Feature flag פר-טננט | **ללא flag** — המודול פעיל לכל הטננטים |
| 12.3 | מבנה הקשר אזור↔עובדים | **Pool משותף 1:N** — `attendance_areas` עצמאי, `users.attendance_area_id` FK |
| 12.4 | מחיקת אזור משויך | **אזהרה + מחיקה רכה** — דיאלוג מציג עובדים מושפעים, soft delete + `area_id → NULL` |
| 12.5 | Timezone לחישובי משמרת | **`Asia/Jerusalem` קבוע** — DB ב-UTC, חישובי יום/סכום בפועל ב-TZ קבוע |
| 12.6 | Google Maps API Key | **יש למשתמש מפתח מוכן** — יסופק לפני תחילת Part B |
| 12.7 | Retention לרשומי שעות | **Soft delete בלבד, 7 שנים לפחות** — אין hard delete; cron עתידי לטיהור אחרי 7 שנים |
| 12.8 | סדר בנייה | **Parts A→E רצוף, checkpoint אחרי כל Part** (build ירוק + הדגמה לפני המעבר) |

---

## 12.9.1 — Scope: Phase 1 + 1.5 (מלא)

**מה ייכנס ל-Phase 1 + 1.5:**
- כל הצד הניהולי: הגדרת רמת חובת דיווח פר-עובד (5 רמות), ניהול אזורים (CRUD מלא, 4 סוגי גיאומטריה), קישור עובד↔אזור, toggle דיווח היעדרות.
- כל UI הניהולי: טאב "דיווח" ב-`EmployeeSidePanel`, sub-panel ליצירת אזור (3 טאבים), אינטגרציית Google Maps (תצוגה + ציור + Geocoding).
- מסך דיווח עובד `/staff/punch`: שעון live, כפתור clock-in/out ענק, היסטוריית משמרות חודשית, badge "חופשה".
- חישובי geofencing מלאים בצד שרת (turf.js), הצגת שגיאות מפורטות (חוץ לאזור, GPS לא מדויק, וכו').
- אינטגרציה למודול ההרשאות (מודול `attendance` ב-`MODULES`).

**מה לא ייכנס לגרסה זו:**
- שילוב עם תלוש משכורת (חישובי שעות נוספות, מודלי שכר). שדות `employee_type` ו-`salary_template` יווספו ל-DB אבל לא ייחשפו ב-UI.
- שאילתות ניהוליות מתקדמות (חיפוש, עוקץ, תיקונים בדיעבד).
- אישור שעות ע"י מנהל לפני סגירת חודש.
- ייצוא דוחות (Excel, PDF, CSV).
- Biometric verification, mock GPS detection.
- בקשת היעדרות פורמלית (Phase 2 — עכשיו זה רק badge חזותי לפי מספר שעות).

**אומדן זמן:** ~19-26 שעות פיתוח, מתוכן 14-19 ל-Phase 1 ו-5-7 ל-Phase 1.5.

---

## 12.9.2 — ללא Feature Flag

**ההחלטה:** המודול יהיה פעיל לכל הטננטים מהיום הראשון. לא תיווסף עמודת `tenants.features` ולא יהיה כלל גורף "הפעל/כבה" ברמת טננט.

**אכיפה ברמת המשתמש (לא ברמת הטננט):**
- עובד עם `attendance_required = 'none'` לא רואה את כפתור הדיווח.
- עובד ללא הרשאת `attendance.view` לא רואה את `/staff/punch` בכלל.
- מנהל ללא הרשאת `attendance.edit` לא רואה את הטאב "דיווח" ב-`EmployeeSidePanel`.

**אם בעתיד יידרש flag פר-טננט:**
- נוסיף עמודה `tenants.features JSONB` ב-migration עתידי.
- נעטוף את ה-route ואת הטאב ב-`if (tenant.features?.attendance !== false)`.
- ההוספה תהיה retrofit לא-שובר (default = enabled).

---

## 12.9.3 — Pool משותף 1:N

**הסכמה:** טבלת `attendance_areas` עצמאית, נטענת בנפרד. `users.attendance_area_id` הוא FK יחיד מכל עובד לאזור אחד מתוך ה-pool.

```sql
users.attendance_area_id UUID NULL REFERENCES attendance_areas(id) ON DELETE SET NULL
```

**משמעות תפעולית:**
- מנהל יוצר אזור "כניסה ראשית – מלון" פעם אחת.
- 5 ניקיונאים, 3 פקידי קבלה, 2 אנשי תחזוקה — כולם משתפים את אותו אזור.
- שינוי גיאומטרי (החלפת מיקום, הרחבת הרדיוס) נעשה במקום אחד ומשפיע על כולם.
- ביטול קישור של עובד אחד לא משפיע על האחרים.

**ב-`AreaSelector`:** dropdown עם searchable list של כל האזורים הקיימים. עובדים רואים מי מקושר לאיזה אזור (לצורכי ניהול, לא חשיפת לוקציות).

---

## 12.9.4 — אזהרה + מחיקה רכה

**Flow מחיקת אזור:**

```
מנהל → לוחץ "מחק אזור X"
       ↓
   ┌─────────────────────────────────────────────────┐
   │ ⚠️  אזור X משויך ל-N עובדים:                  │
   │     • דני כהן                                  │
   │     • שרה לוי                                  │
   │     • ...                                       │
   │                                                 │
   │  אם תמחק את האזור:                              │
   │   • הוא ייעלם מהרשימה אבל יישמר במסד הנתונים   │
   │     (soft delete) לצורכי היסטוריה.             │
   │   • העובדים הללו ינותקו מהאזור (area_id → NULL) │
   │     ודרישת הדיווח שלהם תיכנס למצב לא-תקין       │
   │     עד שיוקצה להם אזור אחר.                    │
   │                                                 │
   │           [ביטול]    [מחק את האזור]            │
   └─────────────────────────────────────────────────┘
```

**מה קורה ברמת ה-Server Action `deleteAttendanceArea`:**

1. דורש `requirePermission('attendance', 'edit')`.
2. שולף רשימת `users.id` שמקושרים לאזור (`WHERE attendance_area_id = $1 AND deleted_at IS NULL`).
3. אם הרשימה לא ריקה ולא הועבר `confirmCascade: true` — מחזיר `{ success: false, error: 'AREA_HAS_USERS', affectedUserIds: [...] }`.
4. אם `confirmCascade: true`:
   - `UPDATE attendance_areas SET deleted_at = NOW() WHERE id = $1` (soft delete).
   - `UPDATE users SET attendance_area_id = NULL, updated_at = NOW() WHERE attendance_area_id = $1` (ניתוק).
   - **שדה `attendance_required` של העובדים לא משתנה** — כך שאם הם היו `'required_inside'` הם נשארים `'required_inside'` עם NULL area_id, וה-validation ב-`clockIn` יחזיר שגיאה ברורה ("אין אזור משויך").
5. רישומי `attendance_punches` קיימים שמצביעים על האזור הזה לא נוגעים — `area_snapshot` שלהם כבר מכיל את הגיאומטריה ההיסטורית.

**מצב לא-תקין מבחינת UI:**
- ב-`AttendanceTab` עובד עם `attendance_required = 'required_inside'` ו-`attendance_area_id = NULL` יוצג עם אזהרה אדומה: "⚠️ דרישת דיווח נדרשת אזור — לא מוקצה אזור. בחר אזור או שנה לרמת דיווח אחרת".

---

## 12.9.5 — `Asia/Jerusalem` קבוע

**ההחלטה:** מודול הנוכחות יחשב כל "יום עבודה", "סך שעות חודש", וחיתוך תאריכים ב-`Asia/Jerusalem` קבוע, ללא תלות ב-`tenants.timezone` (לא קיים) או `users.timezone` (קיים אבל לא בשימוש למודול הזה).

**איפה הזמנים נשמרים:**
- `attendance_punches.punched_at TIMESTAMPTZ` → תמיד UTC ב-DB.
- כל הצגה / חישוב / חיתוך יום ב-UI → `Asia/Jerusalem`.

**מימוש:**
- קונסטנטה: `export const ATTENDANCE_TZ = 'Asia/Jerusalem'` ב-`lib/constants/attendance.ts` (קובץ חדש).
- שימוש: `format(toZonedTime(punch.punched_at, ATTENDANCE_TZ), 'HH:mm')` (`date-fns-tz`) — או `Intl.DateTimeFormat` עם `timeZone: ATTENDANCE_TZ`.
- חיתוך יום: `startOfDayInTimezone(date, ATTENDANCE_TZ)` כדי שמשמרת לילה (23:30 → 02:00) תהיה ביום הנכון.

**אם בעתיד יהיה צורך תמיכה רב-TZ:**
- הוספת `tenants.timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem'` (migration לא-שובר).
- החלפת ה-קונסטנטה בקריאת `tenants.timezone`.
- עדכון 1 קובץ — `lib/constants/attendance.ts` יהפוך ל-`lib/services/attendance-tz.ts` עם async getter.

---

## 12.9.6 — Google Maps API Key

**סטטוס:** יש למשתמש מפתח Google Maps מוכן.

**לפני תחילת Part B (Google Maps Infrastructure), המשתמש יספק את המפתח לקובץ:**

```env
# .env.local (NEVER commit!)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

**Claude יבצע לפני Part B:**
1. יוסיף `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=` לרשומה ב-`.env.example` (ללא ערך אמיתי).
2. יוודא שב-`.env.local` יש את הערך (yo `cat .env.local | grep GOOGLE_MAPS` ללא הצגת המפתח עצמו).
3. **לא ייכנס** ל-`.env.local` ללא בקשה מפורשת.

**APIs נדרשים מופעלים ב-Google Cloud Project:**
- Maps JavaScript API (תצוגת מפה)
- Geocoding API (חיפוש כתובות)
- Drawing Library (ציור פוליגונים)
- Places API (אופציונלי — autocomplete)

**Restrictions מומלצות לפני production:**
- HTTP Referrer: `https://pms.bios.co.il/*` + `http://localhost:3004/*` (dev)
- API restrictions: רק 4 ה-APIs לעיל

---

## 12.9.7 — Soft Delete + 7 שנים

**טבלת `attendance_punches`:**

```sql
attendance_punches.deleted_at TIMESTAMPTZ NULL
```

(ייתווסף ל-migration ב-Part A — סטייה מ-§3.3 בתוכנית המקורית שאינו כולל `deleted_at`).

**עיקרון:**
- אין hard delete מ-UI לעולם.
- עריכה / ביטול של רשומה = `UPDATE attendance_punches SET deleted_at = NOW(), notes = '... ביטול: <סיבה>' WHERE id = $1`.
- כל קריאה ב-server actions תכלול `WHERE deleted_at IS NULL`.

**Retention של 7 שנים:**
- חוק שעות עבודה התשי"א-1951, סעיף 24א, מחייב מעסיק לנהל "פנקס שעות עבודה" ולשמור רישומים לפחות 7 שנים.
- לא ניצור cron מחיקה ב-Phase 1 / 1.5 — זה עניין operational ל-Phase 2+.
- כש-cron יוצר בעתיד: `DELETE FROM attendance_punches WHERE deleted_at < NOW() - INTERVAL '7 years' AND punched_at < NOW() - INTERVAL '7 years'` (תנאי כפול לבטיחות).

**רשומות אזור:**
- `attendance_areas.deleted_at` קיים ב-§3.2 של התוכנית המקורית.
- אין שינוי — soft delete בלבד, ללא retention אוטומטי.

---

## 12.9.8 — סדר בנייה: A→E רצוף, checkpoint לאחר כל Part

**Sequence:**

```
Part A (Foundation: migration + types + actions)
   ↓ build ירוק + ✅ אישור
Part B (Google Maps Infrastructure)
   ↓ build ירוק + הצגת maps-test page + ✅ אישור
Part C (Settings UI — טאב "דיווח" ב-EmployeeSidePanel)
   ↓ build ירוק + הצגת UI + ✅ אישור
Part D (Area Form Sub-Panel — 3 טאבים)
   ↓ build ירוק + הצגת ציור/חיפוש כתובת/בחירה + ✅ אישור
Part E (Mobile Punch Screen)
   ↓ build ירוק + emulation במובייל + ✅ אישור
   ↓
🎉 מודול נמסר
```

**בכל checkpoint Claude יציג:**
1. `pnpm build` — חייב לעבור.
2. `pnpm lint` — חייב לעבור.
3. `tsc --noEmit` — חייב לעבור.
4. רשימת קבצים שנוצרו / שונו ב-Part זה.
5. הוראות בדיקה ידנית קצרות (URL, מה ללחוץ, מה אמור לקרות).
6. עצירה והמתנה לאישור מפורש לפני המעבר ל-Part הבא.

**אם build נכשל ב-checkpoint:**
- Claude לא ימשיך ל-Part הבא.
- Claude לא "ימחק" את הבעיה דרך `--no-verify` או workaround — תיקון שורש בלבד.
- אם תיקון אורך > 30 דקות, Claude יציג את הבעיה למשתמש לפני הניסיון השני.

---

## אזכורים והפניות בין סעיפים

- §12.9.4 משפיע על §3.1 (אין צורך לשנות `attendance_required` של עובדים בעת מחיקת אזור).
- §12.9.5 דורש קובץ קונסטנטה חדש: `lib/constants/attendance.ts` (לא היה בתוכנית המקורית).
- §12.9.7 מוסיף `deleted_at` ל-§3.3 של ה-migration (`attendance_punches`).
- §12.9.6 חייב להיגמר לפני תחילת Part B (Google Maps Infrastructure).
- §12.9.8 מבטל את האפשרות לדלג על Part B (Maps) — Part C/D תלויים בו.

---

## אישור

✅ כל 8 ההחלטות אושרו על-ידי המשתמש (r@bios.co.il) בתאריך 2026-05-08.
✅ לא יתחיל פיתוח עד שהמשתמש ייתן הוראה מפורשת להתחיל ב-Part A.
✅ סעיף זה הוא אוטוריטטיבי — בכל קונפליקט עם §1-§12.8, סעיף 12.9 גובר.
