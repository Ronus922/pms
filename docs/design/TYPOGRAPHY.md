# Sapphire Design System -- Typography

## Font Family

| Token | Value | Usage |
|-------|-------|-------|
| `font-sans` (body) | `"Noto Sans Hebrew", "Segoe UI", system-ui, -apple-system, sans-serif` | All body text, inputs, labels |
| `font-headline` | `"Noto Sans Hebrew", "Segoe UI", system-ui, sans-serif` | Page titles, panel headers, hero text |

### Font Loading

```tsx
// next/font setup
import { Noto_Sans_Hebrew } from 'next/font/google'

const notoSansHebrew = Noto_Sans_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-sans',
})
```

```html
<!-- HTML root -->
<html lang="he" dir="rtl" className={notoSansHebrew.variable}>
```

---

## Type Scale

| Level | Size | Weight | Line Height | Letter Spacing | Tailwind Classes |
|-------|------|--------|-------------|----------------|-----------------|
| H1 | 28px | 800 | 1.2 | -0.02em | `text-[28px] font-extrabold leading-tight tracking-tight` |
| H2 | 22px | 700 | 1.3 | -0.01em | `text-[22px] font-bold leading-snug tracking-tight` |
| H3 | 18px | 600 | 1.4 | normal | `text-lg font-semibold` |
| H4 | 16px | 600 | 1.4 | normal | `text-base font-semibold` |
| H5 | 14px | 700 | 1.4 | 0.05em | `text-sm font-bold uppercase tracking-wider` |
| Body | 16px | 400 | 1.6 | normal | `text-base` |
| Label | 14px | 700 | 1.4 | normal | `text-sm font-bold` |
| Caption | 13px | 400 | 1.4 | normal | `text-[13px]` |
| Tag | 12px | 700 | 1.3 | 0.03em | `text-xs font-bold tracking-wide` |
| Tiny | 11px | 700 | 1.3 | 0.05em | `text-[11px] font-bold tracking-wider` |

---

## Usage Examples

### Page Titles

```tsx
// Main page title (H1)
<h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-foreground">
  ניהול הזמנות
</h1>

// Page subtitle
<p className="text-muted-foreground text-base mt-1">
  סקירה של כל ההזמנות במערכת
</p>
```

### Section Headers

```tsx
// Card / section title (H3)
<h3 className="text-lg font-semibold text-foreground">
  פרטי אורח
</h3>

// Subsection title (H4)
<h4 className="text-base font-semibold text-foreground">
  מידע ליצירת קשר
</h4>

// Category label (H5 -- uppercase)
<h5 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
  Payment Details
</h5>
```

### Form Elements

```tsx
// Input label
<label className="text-sm font-bold text-muted-foreground">
  שם מלא
  <span className="text-destructive mr-1">*</span>
</label>

// Input value
<input className="text-base text-foreground" />

// Error message
<p className="text-[11px] text-destructive font-bold mt-1">
  שדה חובה
</p>

// Helper text
<p className="text-[13px] text-muted-foreground mt-1">
  הכנס את שם האורח המלא כפי שמופיע בדרכון
</p>
```

### Data Display

```tsx
// KPI number
<span className="text-[28px] font-extrabold text-foreground">
  142
</span>

// KPI label
<span className="text-sm font-bold text-muted-foreground">
  הזמנות פעילות
</span>

// Table header
<th className="text-sm font-bold text-muted-foreground px-4 py-3">
  שם אורח
</th>

// Table cell
<td className="text-base text-foreground px-4 py-3">
  ישראל ישראלי
</td>

// Tag / badge
<span className="text-xs font-bold tracking-wide">
  מאושר
</span>
```

---

## RTL Text Rules

### Default Alignment

All text defaults to `text-right` via the `dir="rtl"` on the root element. Do not add explicit `text-right` unless overriding a parent.

```tsx
// Correct -- inherits RTL from root
<p className="text-foreground">טקסט בעברית שמיושר אוטומטית</p>

// Override for LTR content (numbers, codes, English)
<span className="font-mono text-left ltr" dir="ltr">INV-2026-001</span>
```

### Mixed Content (Hebrew + Numbers)

```tsx
// Price display -- number stays LTR, currency on left (visual right in RTL)
<span className="text-foreground font-bold">
  <span className="font-mono" dir="ltr">1,250</span> ש"ח
</span>

// Phone number
<a href="tel:+972501234567" className="font-mono text-primary" dir="ltr">
  050-123-4567
</a>

// Email
<span className="font-mono text-sm" dir="ltr">guest@example.com</span>
```

### Truncation

```tsx
// Single line truncation
<p className="truncate text-base text-foreground">
  טקסט ארוך שנחתך עם שלוש נקודות
</p>

// Multi-line clamp (2 lines)
<p className="line-clamp-2 text-base text-foreground">
  טקסט ארוך שיכול לתפוס עד שתי שורות ואז ייחתך
</p>
```

---

## Weight Reference

| Weight | Tailwind | Usage |
|--------|----------|-------|
| 400 | `font-normal` | Body text, descriptions, table cells |
| 500 | `font-medium` | Navigation items, button text (secondary) |
| 600 | `font-semibold` | Section titles (H3, H4), input values |
| 700 | `font-bold` | Labels, badges, KPI labels, H2 |
| 800 | `font-extrabold` | H1 page titles, KPI numbers |

---

## Forbidden Patterns

- Never use `font-light` (300) or `font-thin` (100) -- poor readability in Hebrew
- Never use font sizes below 11px
- Never use `text-left` for Hebrew content without explicit reason
- Never mix font families within the same component
- Never use `letter-spacing` tighter than -0.02em on Hebrew text
- Never use decorative/script fonts
