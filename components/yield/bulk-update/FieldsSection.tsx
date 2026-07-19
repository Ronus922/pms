"use client"

import { Icon } from "@/components/shared/Icon"
import { InfoTooltip } from "@/components/shared/InfoTooltip"
import type {
  BulkUpdateFields,
  BulkCurrency,
  PriceMode,
} from "@/lib/types/bulk-room-update"
import { BULK_CURRENCIES } from "@/lib/types/bulk-room-update"

const FIELD_HELP = {
  price:
    "המחיר ללילה לחדרים שנבחרו. אפשר להחליף לגמרי, להוסיף, להפחית, או לשנות באחוזים לפי בחירת המצב.",
  currency: "המטבע שבו נקוב המחיר. ישתנה לכל החדרים שנבחרו בטווח התאריכים.",
  availability:
    "האם ניתן להזמין את החדר בתאריכים האלה. סגור = לא זמין להזמנות חדשות כלל.",
  minNights:
    "מספר הלילות המינימלי לכל הזמנה שחופפת את התאריכים. חוסם הזמנות קצרות מדי.",
  maxNights:
    "מספר הלילות המקסימלי לכל הזמנה. משמש להגבלת שהיות ארוכות בתאריכי ביקוש גבוה.",
  minNightsOnArrival:
    "מינימום לילות חל רק אם תאריך ההגעה נופל בטווח. דוגמה: לחייב 2 לילות לצ'ק-אין בשישי, בלי להשפיע על מי שכבר שוהה.",
  closedOnArrival:
    "אסור להתחיל הזמנה חדשה בתאריכים האלה. אורח שכבר שוהה יכול להמשיך.",
  closedOnDeparture:
    "אסור לסיים הזמנה בתאריכים האלה. מאלץ את האורח להישאר לפחות עוד לילה.",
} as const

interface Props {
  fields: BulkUpdateFields
  setFields: (updater: (prev: BulkUpdateFields) => BulkUpdateFields) => void
}

const PRICE_MODE_LABELS: Record<PriceMode, string> = {
  replace: "החלפה מלאה",
  add: "תוספת למחיר קיים",
  subtract: "הפחתה ממחיר קיים",
  percent_add: "אחוז תוספת",
  percent_subtract: "אחוז הפחתה",
}

/** iOS-style toggle. Touch target 44px. */
function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center h-7 w-12 min-w-[44px] min-h-[44px] p-1 rounded-full transition-colors shrink-0 ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-card shadow transform transition-transform ${
          checked ? "-translate-x-0" : "-translate-x-5"
        }`}
      />
    </button>
  )
}

/**
 * Numeric stepper — "− N +" style.
 * Empty state ("") means "don't update this field". Shows "—" instead of a number.
 * − does nothing when empty.
 * + on empty sets to 1.
 * × clears back to empty.
 */
function Stepper({
  value,
  onChange,
  min = 1,
}: {
  value: number | ""
  onChange: (next: number | "") => void
  min?: number
}) {
  const isEmpty = value === ""
  const num = isEmpty ? min : Number(value)
  return (
    <div className="flex items-center bg-accent/60 rounded-xl p-1 gap-1 relative group">
      <button
        type="button"
        onClick={() => {
          if (isEmpty) return
          onChange(Math.max(min, num - 1))
        }}
        disabled={isEmpty}
        className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-base font-bold text-muted-foreground hover:bg-card disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        aria-label="הפחת"
      >
        −
      </button>
      {isEmpty ? (
        <div className="flex-1 text-center text-base font-bold text-muted-foreground/60 min-h-[44px] flex items-center justify-center select-none">
          —
        </div>
      ) : (
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === "") {
              onChange("")
              return
            }
            const n = Number(raw)
            onChange(Number.isNaN(n) ? "" : Math.max(min, n))
          }}
          min={min}
          className="flex-1 w-full text-center bg-transparent border-0 outline-none text-sm font-bold min-h-[44px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      )}
      <button
        type="button"
        onClick={() => onChange(isEmpty ? min : num + 1)}
        className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-base font-bold text-muted-foreground hover:bg-card"
        aria-label="הוסף"
      >
        +
      </button>
      {!isEmpty && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground text-muted-foreground text-[10px] font-bold flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          aria-label="נקה"
          title="נקה — לא לעדכן שדה זה"
        >
          ×
        </button>
      )}
    </div>
  )
}

/** Inline switch control — "פתוח"/"סגור" label + iOS toggle. */
function OpenClosedSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel: string
}) {
  return (
    <div className="bg-accent/60 rounded-xl px-4 min-h-[48px] flex items-center justify-between gap-3">
      <span
        className={`text-xs font-bold ${
          checked ? "text-destructive" : "text-foreground"
        }`}
      >
        {checked ? "סגור" : "פתוח"}
      </span>
      <Toggle checked={checked} onChange={onChange} ariaLabel={ariaLabel} />
    </div>
  )
}

/** Compact field wrapper — label + optional info tooltip + control. */
function Field({
  label,
  help,
  children,
}: {
  label: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-[11px] font-bold text-muted-foreground">
          {label}
        </label>
        {help && <InfoTooltip text={help} />}
      </div>
      {children}
    </div>
  )
}

const inputClass =
  "w-full bg-accent/60 border-0 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none min-h-[48px]"

const selectClass =
  "w-full bg-accent/60 border-0 rounded-xl px-4 py-3 pe-10 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none min-h-[48px] appearance-none cursor-pointer"

/** White grouped card with section title. */
function GroupCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary" />
        <h3 className="text-base font-bold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export function FieldsSection({ fields, setFields }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {/* Price & currency */}
      <GroupCard title="מחיר ומטבע">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
          <Field label="מחיר" help={FIELD_HELP.price}>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={fields.price.value === "" ? "" : fields.price.value}
                onChange={(e) => {
                  const v = e.target.value
                  setFields((p) => ({
                    ...p,
                    price: {
                      ...p.price,
                      enabled: true,
                      value: v === "" ? "" : Number(v),
                    },
                  }))
                }}
                className={inputClass}
              />
              <div className="relative">
                <select
                  value={fields.price.mode}
                  onChange={(e) =>
                    setFields((p) => ({
                      ...p,
                      price: {
                        ...p.price,
                        enabled: true,
                        mode: e.target.value as PriceMode,
                      },
                    }))
                  }
                  className={selectClass}
                >
                  {(Object.keys(PRICE_MODE_LABELS) as PriceMode[]).map((m) => (
                    <option key={m} value={m}>
                      {PRICE_MODE_LABELS[m]}
                    </option>
                  ))}
                </select>
                <Icon
                  name="expand_more"
                  size="sm"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
              </div>
            </div>
          </Field>

          <Field label="מטבע" help={FIELD_HELP.currency}>
            <div className="relative">
              <select
                value={fields.currency.value}
                onChange={(e) =>
                  setFields((p) => ({
                    ...p,
                    currency: {
                      ...p.currency,
                      enabled: true,
                      value: e.target.value as BulkCurrency,
                    },
                  }))
                }
                className={selectClass}
              >
                {BULK_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                size="sm"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>
          </Field>
        </div>
      </GroupCard>

      {/* Availability */}
      <GroupCard title="זמינות">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
          <Field label="זמינות חדר" help={FIELD_HELP.availability}>
            <OpenClosedSwitch
              checked={fields.availability.closed}
              onChange={(v) =>
                setFields((p) => ({
                  ...p,
                  availability: {
                    ...p.availability,
                    enabled: true,
                    closed: v,
                  },
                }))
              }
              ariaLabel="זמינות חדר"
            />
          </Field>

          <Field label="מינימום לילות" help={FIELD_HELP.minNights}>
            <Stepper
              value={fields.min_nights.value}
              onChange={(v) =>
                setFields((p) => ({
                  ...p,
                  min_nights: {
                    ...p.min_nights,
                    enabled: v !== "",
                    value: v,
                  },
                }))
              }
              min={1}
            />
          </Field>

          <Field label="מקסימום לילות" help={FIELD_HELP.maxNights}>
            <Stepper
              value={fields.max_nights.value}
              onChange={(v) =>
                setFields((p) => ({
                  ...p,
                  max_nights: {
                    ...p.max_nights,
                    enabled: v !== "",
                    value: v,
                  },
                }))
              }
              min={1}
            />
          </Field>

          <Field label="מינימום לילות בהגעה" help={FIELD_HELP.minNightsOnArrival}>
            <Stepper
              value={fields.min_nights_on_arrival.value}
              onChange={(v) =>
                setFields((p) => ({
                  ...p,
                  min_nights_on_arrival: {
                    ...p.min_nights_on_arrival,
                    enabled: v !== "",
                    value: v,
                  },
                }))
              }
              min={1}
            />
          </Field>

          <Field label="סגור להגעה" help={FIELD_HELP.closedOnArrival}>
            <OpenClosedSwitch
              checked={fields.closed_on_arrival.closed}
              onChange={(v) =>
                setFields((p) => ({
                  ...p,
                  closed_on_arrival: {
                    ...p.closed_on_arrival,
                    enabled: true,
                    closed: v,
                  },
                }))
              }
              ariaLabel="סגור להגעה"
            />
          </Field>

          <Field label="סגור לעזיבה" help={FIELD_HELP.closedOnDeparture}>
            <OpenClosedSwitch
              checked={fields.closed_on_departure.closed}
              onChange={(v) =>
                setFields((p) => ({
                  ...p,
                  closed_on_departure: {
                    ...p.closed_on_departure,
                    enabled: true,
                    closed: v,
                  },
                }))
              }
              ariaLabel="סגור לעזיבה"
            />
          </Field>
        </div>
      </GroupCard>
    </div>
  )
}
