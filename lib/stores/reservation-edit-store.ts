import { create } from "zustand"
import { getReservationFull } from "@/lib/actions/reservation-detail"
import { type ReservationRoom, computeRoomRate } from "@/lib/stores/reservation-form-store"
import {
  computePricing,
  deriveHistoricalVatRate,
  enumerateNights,
  type DiscountMode,
  type NightRate,
  type PriceMode,
  type PricingResult,
} from "@/lib/pricing/engine"

/* ── Types ──────────────────────────────────────────────────── */

export interface RoomData {
  id: string
  room_id: string
  room_number: string
  room_type_name: string
  floor_name: string
  building_name: string
  rate_per_night: number
  check_in: string
  check_out: string
  room_status: string
  max_occupancy?: number
  max_adults?: number | null
  max_children?: number | null
  max_infants?: number | null
  /** Per-row composition + guest contact persisted from
   *  migration 2026-04-21_reservation_rooms_per_room_fields.sql. */
  adults?: number
  children?: number
  infants?: number
  guest_first_name?: string | null
  guest_last_name?: string | null
  guest_phone?: string | null
  guest_email?: string | null
  guest_id_number?: string | null
  base_price?: number
  extra_person_price?: number
  default_occupancy?: number
}

export interface PaymentRecord {
  id: string
  amount: number
  method: string
  status?: string
  notes?: string
  created_at: string
}

export interface LogEntry {
  id: string
  action: string
  entity_type: string
  user_name: string
  created_at: string
  changes: Record<string, unknown>
}

export interface ChargeRecord {
  id: string
  description: string
  amount: number
  quantity: number
  total: number
  charge_date: string
  created_at: string
}

/* ── External source detection ──────────────────────────────── */

const EXTERNAL_SOURCES = new Set([
  "booking", "booking.com", "airbnb", "expedia", "agent", "corporate",
])

function detectExternal(source: string | null, externalId: string | null, channelManagerId: string | null): boolean {
  if (channelManagerId) return true
  if (externalId) return true
  if (source && EXTERNAL_SOURCES.has(source)) return true
  return false
}

/* ── Editable fields ────────────────────────────────────────── */

export interface ReservationEditData {
  // Guest
  firstName: string
  lastName: string
  guestName: string
  phone: string
  email: string
  idNumber: string
  language: string
  country: string
  company: string
  isVip: boolean

  // Booking
  source: string
  status: string
  paymentStatus: string
  paymentMethod: string
  generalNotes: string
  internalNotes: string
  receptionNotes: string

  // Stay
  checkIn: string
  checkOut: string
  checkInTime: string
  checkOutTime: string
  earlyCheckIn: boolean
  lateCheckOut: boolean
  adults: number
  children: number
  infants: number
  accessible: boolean
  specialRequests: string
  mealPlan: string

  // External
  externalId: string
  channelManagerId: string
  cancellationPolicy: string
  agent: string
  adSource: string

  // Pricing — every figure here is DERIVED from the engine (see derivePricing).
  totalPrice: number
  totalPaid: number
  balanceDue: number
  deposit: number
  discountPercent: number
  discountPerNight: number
  taxExempt: boolean
  taxAmount: number
  subtotal: number
  currency: string

  // Pricing engine controls (lib/pricing/engine.ts)
  priceMode: PriceMode
  manualNightlyRate: number | null
  manualTotal: number | null
  discountMode: DiscountMode
  discountValue: number
  /** Whether the entered money already contains VAT. */
  vatInclusive: boolean
  /** FRACTION (0.1800), never a percent — reservations.vat_rate. Loaded from
   *  the reservation's OWN row: tenants.vat_rate is mutable and was changed
   *  17 -> 18, so it cannot restate what an older stay was sold at. */
  vatRate: number
  ratePlanId: string
  exchangeRate: number
  /** Extras already folded into the price. Recovered from pricing_breakdown
   *  because creation persists only the total, never the individual lines —
   *  without this an edit would silently drop them from the reservation. */
  extraCharges: number

  // Credit card — PCI: last four digits only. Never a PAN, never a CVV.
  cardHolderName: string
  cardLast4: string
  cardHolderId: string
  cardExpiryMonth: string
  cardExpiryYear: string
  cardApprovalCode: string
  cardTransactionRef: string
  cardInstallments: number
}

/* ── Store interface ────────────────────────────────────────── */

export interface ReservationEditStore {
  // Panel state
  isOpen: boolean
  isLoading: boolean
  isSaving: boolean
  activeTab: number
  errors: Record<string, string>

  // Identity
  reservationId: string
  reservationNumber: string
  tenantId: string
  guestId: string
  isExternal: boolean

  // Timestamps (read-only)
  createdAt: string
  updatedAt: string
  createdBy: string

  // Editable data
  data: ReservationEditData
  originalData: ReservationEditData | null

  // Related data (read-only snapshot from the server — display / legacy usage)
  rooms: RoomData[]
  /** Editable per-room draft. Each row mirrors reservation_rooms 1:1 so the
   *  panel writes per-room fields directly (see updateReservationRooms). */
  editableRooms: ReservationRoom[]
  /** Snapshot of editableRooms at load time for dirty-detection. */
  originalEditableRooms: ReservationRoom[] | null
  payments: PaymentRecord[]
  charges: ChargeRecord[]
  logs: LogEntry[]

  // Computed — all of these come out of lib/pricing/engine.ts. The panel used
  // to freeze whatever the server sent, so editing a rate or a date left every
  // total stale until the next reload.
  isDirty: boolean
  nights: number
  pricing: PricingResult
  totalPrice: number
  taxAmount: number
  netAmount: number
  /** Negative means the guest is in credit. */
  balanceDue: number

  /** Monotonic counter bumped on every successful save. Pages (reservations
   *  table, calendar board, etc.) subscribe to this and re-fetch their list
   *  queries when it changes — the panel lives at the shell level so it
   *  can't reach each page's loader directly. */
  savedTick: number

  // Actions
  open: (reservationId: string, tenantId: string) => Promise<void>
  close: () => void
  setField: <K extends keyof ReservationEditData>(key: K, value: ReservationEditData[K]) => void
  setActiveTab: (tab: number) => void
  setErrors: (errors: Record<string, string>) => void
  setSaving: (v: boolean) => void
  /* Per-room editing actions — true source of truth for rooms during edit. */
  addEditableRoom: (room: ReservationRoom) => void
  updateEditableRoom: (id: string, updates: Partial<ReservationRoom>) => void
  removeEditableRoom: (id: string) => void
  /* Notify subscribers (table/calendar) that a save just completed. */
  bumpSaved: () => void
}

/* ── Helpers ─────────────────────────────────────────────────── */

/** postgres.js returns DATE columns as JavaScript Date objects. A naive
 *  `String(date).slice(0, 10)` produces "Mon Apr 13" (Date's default
 *  toString()), NOT "2026-04-13". That breaks <input type="date"> binding
 *  AND the server-side datesChanged comparison. This helper is the single
 *  way to coerce any shape coming off the driver into canonical ISO. */
function toIsoDateValue(v: unknown): string {
  if (v == null || v === "") return ""
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return ""
    return v.toISOString().slice(0, 10)
  }
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

function computeNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0
  const ci = new Date(checkIn)
  const co = new Date(checkOut)
  return Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000))
}

const PRICE_MODES: ReadonlySet<string> = new Set<PriceMode>([
  "auto",
  "manual_nightly",
  "manual_total",
])

const DISCOUNT_MODES: ReadonlySet<string> = new Set<DiscountMode>([
  "none",
  "amount_per_night",
  "percent_per_night",
  "amount_total",
  "percent_total",
])

function toPriceMode(v: unknown): PriceMode {
  return typeof v === "string" && PRICE_MODES.has(v) ? (v as PriceMode) : "auto"
}

function toDiscountMode(v: unknown): DiscountMode {
  return typeof v === "string" && DISCOUNT_MODES.has(v) ? (v as DiscountMode) : "none"
}

/** NUMERIC columns arrive as strings from the driver; NULL must stay null so
 *  the engine can tell "no manual price" from "a manual price of zero". */
function toNullableNumber(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** The extras the reservation was priced with, read back off its stored
 *  breakdown. Nothing else records them: the create action folds the total
 *  into subtotal and discards the line items. */
function extrasFromBreakdown(raw: unknown): number {
  if (!Array.isArray(raw)) return 0
  let total = 0
  for (const line of raw) {
    if (line == null || typeof line !== "object") continue
    const { kind, amount } = line as { kind?: unknown; amount?: unknown }
    if (kind !== "extra") continue
    const n = Number(amount)
    if (Number.isFinite(n)) total += n
  }
  return total
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapServerToEdit(res: any): ReservationEditData {
  const totalPrice = Number(res.total_price) || 0
  const taxAmount = Number(res.tax_amount) || 0
  // NEVER fall back to tenants.vat_rate here. It is mutable — it was changed
  // 17 -> 18 in this database and four live reservations were sold at 17%.
  // A row that predates the pricing migration carries its rate implicitly in
  // its own figures, which is what deriveHistoricalVatRate recovers.
  const storedVatRate = toNullableNumber(res.vat_rate)
  const vatRate =
    storedVatRate !== null ? storedVatRate : deriveHistoricalVatRate(totalPrice, taxAmount)

  return {
    firstName: res.first_name || "",
    lastName: res.last_name || "",
    guestName: res.guest_name || "",
    phone: res.guest_phone || "",
    email: res.guest_email || "",
    idNumber: res.guest_id_number || "",
    language: res.guest_language || "he",
    country: res.guest_country || "IL",
    company: res.company || "",
    isVip: res.is_vip || res.guest_vip || false,

    source: res.source || "",
    status: res.status || "",
    paymentStatus: res.payment_status || "",
    paymentMethod: res.payment_method || "",
    generalNotes: res.general_notes || "",
    internalNotes: res.internal_notes || "",
    receptionNotes: res.reception_notes || "",

    checkIn: toIsoDateValue(res.check_in),
    checkOut: toIsoDateValue(res.check_out),
    checkInTime: res.actual_checkin_time || res.estimated_arrival_time || "15:00",
    checkOutTime: res.actual_checkout_time || res.estimated_departure_time || "11:00",
    earlyCheckIn: res.is_early_checkin || false,
    lateCheckOut: res.is_late_checkout || false,
    adults: res.adults || 1,
    children: res.children || 0,
    infants: res.infants || 0,
    accessible: res.accessibility || false,
    specialRequests: res.special_requests || "",
    mealPlan: res.meal_plan || "none",

    externalId: res.external_id || "",
    channelManagerId: res.channel_manager_id || "",
    cancellationPolicy: res.cancellation_policy || "",
    agent: res.agent || "",
    adSource: res.ad_source || "",

    totalPrice,
    totalPaid: Number(res.total_paid) || 0,
    balanceDue: Number(res.balance_due) || 0,
    deposit: Number(res.deposit) || 0,
    discountPercent: Number(res.discount_percent) || 0,
    discountPerNight: Number(res.discount_per_night) || 0,
    taxExempt: res.tax_exempt || false,
    taxAmount,
    subtotal: Number(res.subtotal) || 0,
    currency: res.currency || "ILS",

    priceMode: toPriceMode(res.price_mode),
    manualNightlyRate: toNullableNumber(res.manual_nightly_rate),
    manualTotal: toNullableNumber(res.manual_total),
    discountMode: toDiscountMode(res.discount_mode),
    discountValue: Number(res.discount_value) || 0,
    vatInclusive: res.vat_inclusive ?? true,
    vatRate,
    ratePlanId: res.rate_plan_id || "",
    exchangeRate: Number(res.exchange_rate) || 1,
    extraCharges: extrasFromBreakdown(res.pricing_breakdown),

    cardHolderName: res.card_holder_name || "",
    cardLast4: res.card_last4 || "",
    cardHolderId: res.card_holder_id || "",
    cardExpiryMonth: res.card_expiry_month || "",
    cardExpiryYear: res.card_expiry_year || "",
    cardApprovalCode: res.card_approval_code || "",
    cardTransactionRef: res.card_transaction_ref || "",
    cardInstallments: Number(res.card_installments) || 1,
  }
}

function deepEqual(a: ReservationEditData, b: ReservationEditData | null): boolean {
  if (!b) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Map a loaded reservation_rooms row (RoomData) into the editable canonical
 *  ReservationRoom shape used across create + edit flows. */
function roomDataToEditable(row: RoomData): ReservationRoom {
  return {
    id: row.id,
    roomId: row.room_id || "",
    roomNumber: row.room_number || "",
    roomTypeId: "",
    roomTypeName: row.room_type_name || "",
    boardType: "room_only",
    ratePerNight: Number(row.rate_per_night) || 0,
    basePrice: Number(row.base_price) || Number(row.rate_per_night) || 0,
    defaultOccupancy: Number(row.default_occupancy) || 1,
    extraPersonPrice: Number(row.extra_person_price) || 0,
    maxOccupancy: Number(row.max_occupancy) || 0,
    maxAdults: Number(row.max_adults) || 0,
    maxChildren: Number(row.max_children) || 0,
    maxInfants: Number(row.max_infants) || 0,
    checkIn: toIsoDateValue(row.check_in),
    checkOut: toIsoDateValue(row.check_out),
    adults: Number(row.adults) || 1,
    children: Number(row.children) || 0,
    infants: Number(row.infants) || 0,
    guestFirstName: row.guest_first_name || "",
    guestLastName: row.guest_last_name || "",
    guestPhone: row.guest_phone || "",
    guestEmail: row.guest_email || "",
    guestIdNumber: row.guest_id_number || "",
  }
}

/* ── Derived pricing ─────────────────────────────────────────
 * Mirrors computeDerived in reservation-form-store: one NightRate per
 * ROOM-night, then lib/pricing/engine.ts owns every rule after that. There is
 * no second money formula in this file. */

function pricingNightsFor(data: ReservationEditData, rooms: ReservationRoom[]): NightRate[] {
  const ratePlanId = data.ratePlanId || null

  if (rooms.length > 0) {
    return rooms.flatMap((r) =>
      enumerateNights(r.checkIn || data.checkIn, r.checkOut || data.checkOut).map((date) => ({
        date,
        baseRate: r.ratePerNight || 0,
        appliedRate: r.ratePerNight || 0,
        source: "room_type_base" as const,
        ratePlanId,
        losRuleApplied: null,
      })),
    )
  }

  // Room-less reservation (legacy rows). `subtotal` is the gross the engine
  // itself produces, so feeding it back is a fixed point; total_price is not —
  // it already carries VAT and would compound on every derive pass.
  const dates = enumerateNights(data.checkIn, data.checkOut)
  const base = data.subtotal > 0 ? data.subtotal : data.totalPrice
  const perNight = dates.length > 0 ? base / dates.length : 0
  return dates.map((date) => ({
    date,
    baseRate: perNight,
    appliedRate: perNight,
    source: "room_type_base" as const,
    ratePlanId,
    losRuleApplied: null,
  }))
}

interface DerivedPricing {
  data: ReservationEditData
  pricing: PricingResult
  totalPrice: number
  taxAmount: number
  netAmount: number
  balanceDue: number
}

function derivePricing(data: ReservationEditData, rooms: ReservationRoom[]): DerivedPricing {
  const pricing = computePricing({
    nights: pricingNightsFor(data, rooms),
    priceMode: data.priceMode,
    manualNightlyRate: data.manualNightlyRate,
    manualTotal: data.manualTotal,
    discountMode: data.discountMode,
    discountValue: data.discountValue,
    extraCharges: Math.max(0, data.extraCharges || 0),
    vatInclusive: data.vatInclusive,
    vatRate: Math.max(0, data.vatRate || 0),
    vatExempt: data.taxExempt,
    // A deposit IS a payment. Subtracting it again is what made the panel
    // disagree with every other view of the same reservation.
    payments: (data.totalPaid || 0) + (data.deposit || 0),
    currency: data.currency,
    exchangeRate: data.exchangeRate || 1,
  })

  return {
    // Fold the result back onto `data` so the summary tab and the save payload
    // cannot show one number while the pricing tab shows another.
    data: {
      ...data,
      totalPrice: pricing.grandTotal,
      taxAmount: pricing.vatAmount,
      subtotal: pricing.grossBeforeDiscount,
      balanceDue: pricing.balanceDue,
    },
    pricing,
    totalPrice: pricing.grandTotal,
    taxAmount: pricing.vatAmount,
    netAmount: pricing.netAmount,
    balanceDue: pricing.balanceDue,
  }
}

function roomsDirty(a: ReservationRoom[], b: ReservationRoom[] | null): boolean {
  if (!b) return false
  if (a.length !== b.length) return true
  return JSON.stringify(a) !== JSON.stringify(b)
}

/* ── Empty state ─────────────────────────────────────────────── */

const EMPTY_DATA: ReservationEditData = {
  firstName: "", lastName: "", guestName: "", phone: "", email: "", idNumber: "",
  language: "he", country: "IL", company: "", isVip: false,
  source: "", status: "", paymentStatus: "", paymentMethod: "",
  generalNotes: "", internalNotes: "", receptionNotes: "",
  checkIn: "", checkOut: "", checkInTime: "15:00", checkOutTime: "11:00",
  earlyCheckIn: false, lateCheckOut: false,
  adults: 1, children: 0, infants: 0, accessible: false,
  specialRequests: "", mealPlan: "none",
  externalId: "", channelManagerId: "", cancellationPolicy: "", agent: "", adSource: "",
  totalPrice: 0, totalPaid: 0, balanceDue: 0, deposit: 0,
  discountPercent: 0, discountPerNight: 0, taxExempt: false, taxAmount: 0, subtotal: 0,
  currency: "ILS",
  priceMode: "auto", manualNightlyRate: null, manualTotal: null,
  discountMode: "none", discountValue: 0, vatInclusive: true, vatRate: 0,
  ratePlanId: "", exchangeRate: 1, extraCharges: 0,
  cardHolderName: "", cardLast4: "", cardHolderId: "",
  cardExpiryMonth: "", cardExpiryYear: "",
  cardApprovalCode: "", cardTransactionRef: "", cardInstallments: 1,
}

const EMPTY_DERIVED = derivePricing(EMPTY_DATA, [])

/* ── Store ───────────────────────────────────────────────────── */

export const useReservationEditStore = create<ReservationEditStore>((set) => ({
  isOpen: false,
  isLoading: false,
  isSaving: false,
  activeTab: 0,
  errors: {},

  reservationId: "",
  reservationNumber: "",
  tenantId: "",
  guestId: "",
  isExternal: false,

  createdAt: "",
  updatedAt: "",
  createdBy: "",

  data: { ...EMPTY_DATA },
  originalData: null,

  rooms: [],
  editableRooms: [],
  originalEditableRooms: null,
  payments: [],
  charges: [],
  logs: [],

  isDirty: false,
  nights: 0,
  pricing: EMPTY_DERIVED.pricing,
  totalPrice: 0,
  taxAmount: 0,
  netAmount: 0,
  balanceDue: 0,
  savedTick: 0,

  open: async (reservationId, tenantId) => {
    // Clear every stale field from any previously-open reservation BEFORE
    // the async fetch resolves. Without this the panel can briefly render
    // the prior reservation's dates/guest/rooms on top of the new id,
    // which users read as "my details got lost".
    set({
      isOpen: true,
      isLoading: true,
      reservationId,
      tenantId,
      activeTab: 0,
      errors: {},
      data: { ...EMPTY_DATA },
      originalData: null,
      rooms: [],
      editableRooms: [],
      originalEditableRooms: null,
      payments: [],
      charges: [],
      logs: [],
      isDirty: false,
      nights: 0,
      pricing: EMPTY_DERIVED.pricing,
      totalPrice: 0,
      taxAmount: 0,
      netAmount: 0,
      balanceDue: 0,
    })

    const raw = await getReservationFull(reservationId)

    if (!raw) {
      set({ isLoading: false, errors: { load: "לא נמצאה הזמנה" } })
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = raw as any

    const editData = mapServerToEdit(result)
    const isExternal = detectExternal(result.source, result.external_id, result.channel_manager_id)

    const roomsData = (result.rooms || []) as unknown as RoomData[]
    const editable = roomsData.map(roomDataToEditable)

    // Price on load, and treat the priced result as the baseline. Otherwise a
    // row whose stored totals were already stale would open dirty and nag the
    // user about a change they never made.
    const derived = derivePricing(editData, editable)

    set({
      isLoading: false,
      reservationNumber: result.reservation_number || "",
      guestId: result.guest_id || "",
      isExternal,
      createdAt: result.created_at ? String(result.created_at) : "",
      updatedAt: result.updated_at ? String(result.updated_at) : "",
      createdBy: result.created_by || "",
      data: derived.data,
      originalData: { ...derived.data },
      rooms: roomsData,
      editableRooms: editable,
      originalEditableRooms: editable.map((r) => ({ ...r })),
      payments: (result.payments || []) as unknown as PaymentRecord[],
      charges: (result.charges || []) as unknown as ChargeRecord[],
      logs: (result.logs || []) as unknown as LogEntry[],
      isDirty: false,
      nights: computeNights(derived.data.checkIn, derived.data.checkOut),
      pricing: derived.pricing,
      totalPrice: derived.totalPrice,
      taxAmount: derived.taxAmount,
      netAmount: derived.netAmount,
      balanceDue: derived.balanceDue,
    })
  },

  close: () => set({
    isOpen: false,
    isLoading: false,
    isSaving: false,
    reservationId: "",
    data: { ...EMPTY_DATA },
    originalData: null,
    rooms: [],
    editableRooms: [],
    originalEditableRooms: null,
    payments: [],
    charges: [],
    logs: [],
    isDirty: false,
    pricing: EMPTY_DERIVED.pricing,
    totalPrice: 0,
    taxAmount: 0,
    netAmount: 0,
    balanceDue: 0,
  }),

  setField: (key, value) =>
    set((state) => {
      const derived = derivePricing({ ...state.data, [key]: value }, state.editableRooms)
      return {
        data: derived.data,
        pricing: derived.pricing,
        totalPrice: derived.totalPrice,
        taxAmount: derived.taxAmount,
        netAmount: derived.netAmount,
        balanceDue: derived.balanceDue,
        isDirty:
          !deepEqual(derived.data, state.originalData) ||
          roomsDirty(state.editableRooms, state.originalEditableRooms),
        nights: computeNights(derived.data.checkIn, derived.data.checkOut),
      }
    }),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setErrors: (errors) => set({ errors }),
  setSaving: (v) => set({ isSaving: v }),

  addEditableRoom: (room) =>
    set((state) => {
      const editableRooms = [...state.editableRooms, room]
      return deriveFromRooms(state, editableRooms)
    }),

  updateEditableRoom: (id, updates) =>
    set((state) => {
      const editableRooms = state.editableRooms.map((r) => r.id === id ? { ...r, ...updates } : r)
      return deriveFromRooms(state, editableRooms)
    }),

  removeEditableRoom: (id) =>
    set((state) => {
      const editableRooms = state.editableRooms.filter((r) => r.id !== id)
      return deriveFromRooms(state, editableRooms)
    }),

  bumpSaved: () => set((state) => ({ savedTick: state.savedTick + 1 })),
}))

/** Keep data.checkIn/checkOut/adults/children/infants in sync with
 *  editableRooms so pricing + summary display stay consistent with the
 *  per-room source of truth. Also re-prices each room (matches create-flow
 *  behavior in computeDerived) so composition changes flow into
 *  reservation_rooms.rate_per_night on save. */
function deriveFromRooms(state: ReservationEditStore, editableRooms: ReservationRoom[]) {
  // Re-price per-room when we have pricing inputs. If basePrice is 0 (old
  // reservations that never joined room_types), leave ratePerNight untouched
  // — the admin's stored rate stays as-is.
  const recomputed = editableRooms.map((r) => {
    if (!r.basePrice || r.basePrice <= 0) return r
    const guests = (r.adults || 0) + (r.children || 0) + (r.infants || 0)
    return {
      ...r,
      ratePerNight: computeRoomRate(r.basePrice, r.defaultOccupancy, r.extraPersonPrice, guests),
    }
  })

  const cis = recomputed.map((r) => r.checkIn).filter(Boolean).sort()
  const cos = recomputed.map((r) => r.checkOut).filter(Boolean).sort()
  const derivedCheckIn = cis[0] ?? state.data.checkIn
  const derivedCheckOut = cos[cos.length - 1] ?? state.data.checkOut
  const derivedAdults = recomputed.length
    ? Math.max(1, recomputed.reduce((s, r) => s + (r.adults || 0), 0))
    : state.data.adults
  const derivedChildren = recomputed.reduce((s, r) => s + (r.children || 0), 0)
  const derivedInfants = recomputed.reduce((s, r) => s + (r.infants || 0), 0)

  const newData: ReservationEditData = {
    ...state.data,
    checkIn: derivedCheckIn,
    checkOut: derivedCheckOut,
    adults: derivedAdults,
    children: derivedChildren,
    infants: derivedInfants,
  }

  const derived = derivePricing(newData, recomputed)

  return {
    editableRooms: recomputed,
    data: derived.data,
    pricing: derived.pricing,
    totalPrice: derived.totalPrice,
    taxAmount: derived.taxAmount,
    netAmount: derived.netAmount,
    balanceDue: derived.balanceDue,
    nights: computeNights(derived.data.checkIn, derived.data.checkOut),
    isDirty:
      !deepEqual(derived.data, state.originalData) ||
      roomsDirty(recomputed, state.originalEditableRooms),
  }
}
