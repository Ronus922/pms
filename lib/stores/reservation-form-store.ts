import { create } from "zustand"
import {
  computePricing,
  enumerateNights,
  round2,
  type DiscountMode,
  type NightRate,
  type PriceMode,
  type PricingResult,
} from "@/lib/pricing/engine"

/* ── Types ──────────────────────────────────────────────────── */

export interface ReservationRoom {
  id: string
  roomId: string
  roomNumber: string
  roomTypeId: string
  roomTypeName: string
  boardType: string
  /** Per-night total for this room: basePrice + max(0, guests - defaultOccupancy) * extraPersonPrice. */
  ratePerNight: number
  /** Room-type pricing inputs — kept on the row so the store can recompute
   *  ratePerNight when guest counts change without re-hitting the DB. */
  basePrice: number
  defaultOccupancy: number
  extraPersonPrice: number
  /** Per-room effective capacity caps (room override OR room_type fallback).
   *  Populated when the room is attached — the counter UI reads these
   *  directly so it mirrors what Room Management displays. */
  maxOccupancy: number
  maxAdults: number
  maxChildren: number
  maxInfants: number
  /** Per-room stay dates — each room can differ (e.g. family arriving separately). */
  checkIn: string
  checkOut: string
  /** Per-room guest composition — drives pricing + availability filtering. */
  adults: number
  children: number
  infants: number
  guestFirstName: string
  guestLastName: string
  guestPhone: string
  guestEmail: string
  guestIdNumber: string
}

export interface AttachmentFile {
  id: string
  name: string
  type: string
  size: number
  url: string
}

export interface ExtraChargeItem {
  id: string
  type: string
  description: string
  amount: number
}

export interface ReservationFormData {
  // Guest
  firstName: string
  lastName: string
  fullName: string
  fullNameManual: boolean
  phone: string
  email: string
  idNumber: string
  language: string
  country: string
  city: string
  address: string
  zipCode: string
  isVip: boolean
  company: string

  // Booking
  source: string
  adSource: string
  externalId: string
  status: string
  paymentStatus: string
  paymentMethod: string
  externalTransactionId: string
  generalNotes: string
  internalNotes: string

  // Stay
  checkIn: string
  checkOut: string
  checkInTime: string
  checkOutTime: string
  estimatedArrival: string
  estimatedDeparture: string
  earlyCheckIn: boolean
  lateCheckOut: boolean
  adults: number
  children: number
  infants: number
  accessible: boolean
  specialRequests: string

  // Multi-room
  rooms: ReservationRoom[]

  // Legacy single room (for backward compat during migration)
  roomId: string
  roomTypeId: string
  ratePlanId: string
  boardType: string

  // Pricing
  pricePerNight: number
  discountAmount: number
  discountPercent: number
  extraCharges: ExtraChargeItem[]
  taxExempt: boolean
  /** VAT rate as a fraction (0.17 = 17%). Loaded from tenant settings on
   *  modal open — falls back to the Israeli default when unset. */
  taxRate: number
  deposit: number
  amountPaid: number
  currency: string

  // Pricing engine controls (lib/pricing/engine.ts)
  priceMode: PriceMode
  manualNightlyRate: number | null
  manualTotal: number | null
  discountMode: DiscountMode
  discountValue: number
  /** Whether the entered money already contains VAT. Default true. */
  vatInclusive: boolean

  // Credit Card — PCI: last four digits only, never the full PAN, never a CVV.
  cardHolderName: string
  cardLast4: string
  cardHolderId: string
  cardExpiryMonth: string
  cardExpiryYear: string
  cardApprovalCode: string
  cardTransactionRef: string
  cardInstallments: number
  paymentResult: string

  // Attachments
  attachments: AttachmentFile[]
}

/* ── Store Interface ────────────────────────────────────────── */

export interface ReservationFormStore extends ReservationFormData {
  activeTab: number
  isSubmitting: boolean
  errors: Record<string, string>
  isOpen: boolean
  quickViewOpen: boolean

  // Computed — all of these come out of lib/pricing/engine.ts
  nights: number
  totalNightlyRate: number
  baseAmount: number
  discountTotal: number
  netAmount: number
  taxAmount: number
  grandTotal: number
  /** Negative means the guest is in credit. */
  balanceDue: number
  /** Full engine result, for the nightly breakdown and the summary lines. */
  pricing: PricingResult

  // Actions
  setField: <K extends keyof ReservationFormData>(field: K, value: ReservationFormData[K]) => void
  setActiveTab: (tab: number) => void
  setErrors: (errors: Record<string, string>) => void
  setSubmitting: (v: boolean) => void
  open: (prefill?: Partial<ReservationFormData>) => void
  close: () => void
  reset: () => void
  setQuickView: (open: boolean) => void

  // Room actions
  addRoom: (room: ReservationRoom) => void
  updateRoom: (roomId: string, updates: Partial<ReservationRoom>) => void
  removeRoom: (roomId: string) => void

  // Extra charge actions
  addExtraCharge: (charge: ExtraChargeItem) => void
  updateExtraCharge: (id: string, updates: Partial<ExtraChargeItem>) => void
  removeExtraCharge: (id: string) => void

  // Attachment actions
  addAttachment: (file: AttachmentFile) => void
  removeAttachment: (id: string) => void
}

/* ── Defaults ───────────────────────────────────────────────── */

const DEFAULTS: ReservationFormData = {
  firstName: "",
  lastName: "",
  fullName: "",
  fullNameManual: false,
  phone: "",
  email: "",
  idNumber: "",
  language: "he",
  country: "IL",
  city: "",
  address: "",
  zipCode: "",
  isVip: false,
  company: "",

  source: "phone",
  adSource: "",
  externalId: "",
  status: "confirmed",
  paymentStatus: "unpaid",
  paymentMethod: "",
  externalTransactionId: "",
  generalNotes: "",
  internalNotes: "",

  checkIn: "",
  checkOut: "",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  estimatedArrival: "",
  estimatedDeparture: "",
  earlyCheckIn: false,
  lateCheckOut: false,
  adults: 1,
  children: 0,
  infants: 0,
  accessible: false,
  specialRequests: "",

  rooms: [],
  roomId: "",
  roomTypeId: "",
  ratePlanId: "",
  boardType: "room_only",

  pricePerNight: 0,
  discountAmount: 0,
  discountPercent: 0,
  extraCharges: [],
  taxExempt: false,
  // Pre-fetch fallback only. ReservationModal overwrites this from
  // tenants.vat_rate the moment the modal opens; the server never trusts it.
  taxRate: 0.17,
  deposit: 0,
  amountPaid: 0,
  currency: "ILS",

  priceMode: "auto",
  manualNightlyRate: null,
  manualTotal: null,
  discountMode: "none",
  discountValue: 0,
  vatInclusive: true,

  cardHolderName: "",
  cardLast4: "",
  cardHolderId: "",
  cardExpiryMonth: "",
  cardExpiryYear: "",
  cardApprovalCode: "",
  cardTransactionRef: "",
  cardInstallments: 1,
  paymentResult: "",

  attachments: [],
}

/* ── Computed ───────────────────────────────────────────────── */

/** Per-room nightly rate = basePrice + max(0, guests - defaultOccupancy) * extraPersonPrice.
 *  Applies to each room using the FULL reservation guest count. In multi-room
 *  bookings each room is treated as accommodating the reservation's guests
 *  (safer over-charge than under-charge); admins can edit per-room rate after. */
export function computeRoomRate(
  basePrice: number,
  defaultOccupancy: number,
  extraPersonPrice: number,
  guests: number,
): number {
  const base = Number(basePrice) || 0
  const def = Math.max(1, Number(defaultOccupancy) || 1)
  const extra = Number(extraPersonPrice) || 0
  const above = Math.max(0, guests - def)
  return Math.round((base + above * extra) * 100) / 100
}

function computeDerived(state: ReservationFormData) {
  // Recompute per-room nightly rate from base + extras EVERY derive pass, so
  // per-room guest-count changes propagate to the total immediately. Each room
  // now has its own composition (adults/children/infants).
  const recomputedRooms = state.rooms.map((r) => {
    const roomGuests = (r.adults || 0) + (r.children || 0) + (r.infants || 0)
    return {
      ...r,
      ratePerNight:
        r.basePrice != null
          ? computeRoomRate(r.basePrice, r.defaultOccupancy, r.extraPersonPrice, roomGuests)
          : r.ratePerNight,
    }
  })

  // Global dates + composition are DERIVED from rooms (MIN/MAX of dates, SUM
  // of composition). Fall back to explicit state values if no rooms exist yet.
  const roomCheckIns = recomputedRooms.map((r) => r.checkIn).filter(Boolean).sort()
  const roomCheckOuts = recomputedRooms.map((r) => r.checkOut).filter(Boolean).sort()
  const derivedCheckIn = roomCheckIns[0] ?? state.checkIn
  const derivedCheckOut = roomCheckOuts[roomCheckOuts.length - 1] ?? state.checkOut

  const derivedAdults = recomputedRooms.length
    ? recomputedRooms.reduce((s, r) => s + (r.adults || 0), 0)
    : state.adults
  const derivedChildren = recomputedRooms.length
    ? recomputedRooms.reduce((s, r) => s + (r.children || 0), 0)
    : state.children
  const derivedInfants = recomputedRooms.length
    ? recomputedRooms.reduce((s, r) => s + (r.infants || 0), 0)
    : state.infants

  const ci = derivedCheckIn ? new Date(derivedCheckIn) : null
  const co = derivedCheckOut ? new Date(derivedCheckOut) : null
  // Outer span nights (for display only — reservation may span longer than
  // any single room). Pricing uses per-room nights below.
  const nights = ci && co ? Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000)) : 0

  // Sum per-room nightly rate (still useful as a "per-night peak" readout).
  const totalNightlyRate =
    recomputedRooms.length > 0
      ? recomputedRooms.reduce((sum, r) => sum + (r.ratePerNight || 0), 0)
      : state.pricePerNight

  // CORRECT multi-room base amount: sum of (rate × this-room's nights). When
  // rooms span different date ranges inside one reservation, multiplying a
  // single outer-span "nights" by the sum of rates overcharges the shorter
  // stays. Always price each room against its own checkIn/checkOut.
  const baseAmount =
    recomputedRooms.length > 0
      ? recomputedRooms.reduce((sum, r) => {
          const rci = r.checkIn ? new Date(r.checkIn) : null
          const rco = r.checkOut ? new Date(r.checkOut) : null
          const rNights =
            rci && rco ? Math.max(0, Math.round((rco.getTime() - rci.getTime()) / 86400000)) : 0
          return sum + (r.ratePerNight || 0) * rNights
        }, 0)
      : state.pricePerNight * nights

  const extraChargesTotal = Array.isArray(state.extraCharges)
    ? state.extraCharges.reduce((s, c) => s + (c.amount || 0), 0)
    : (state.extraCharges as number) || 0

  // Hand the engine one NightRate per ROOM-night. Summing those reproduces the
  // per-room pricing above exactly, and every rule after that point (discount,
  // VAT, balance) is the engine's — there is no second formula here any more.
  const pricingNights: NightRate[] =
    recomputedRooms.length > 0
      ? recomputedRooms.flatMap((r) =>
          enumerateNights(r.checkIn || derivedCheckIn, r.checkOut || derivedCheckOut).map((date) => ({
            date,
            baseRate: r.ratePerNight || 0,
            appliedRate: r.ratePerNight || 0,
            source: "room_type_base" as const,
            ratePlanId: state.ratePlanId || null,
            losRuleApplied: null,
          })),
        )
      : enumerateNights(derivedCheckIn, derivedCheckOut).map((date) => ({
          date,
          baseRate: state.pricePerNight,
          appliedRate: state.pricePerNight,
          source: "room_type_base" as const,
          ratePlanId: state.ratePlanId || null,
          losRuleApplied: null,
        }))

  const pricing: PricingResult = computePricing({
    nights: pricingNights,
    priceMode: state.priceMode,
    manualNightlyRate: state.manualNightlyRate,
    manualTotal: state.manualTotal,
    discountMode: state.discountMode,
    discountValue: state.discountValue,
    extraCharges: extraChargesTotal,
    vatInclusive: state.vatInclusive,
    vatRate: Math.max(0, Number(state.taxRate) || 0),
    vatExempt: state.taxExempt,
    // A deposit IS a payment. It is never subtracted a second time — this is
    // what previously made the preview disagree with every post-save view.
    payments: (state.amountPaid || 0) + (state.deposit || 0),
    currency: state.currency,
    exchangeRate: 1,
  })

  // Legacy mirrors, DERIVED from the engine controls so there is exactly one
  // source of truth. Older consumers still read these.
  const discountAmount =
    state.discountMode === "amount_total" || state.discountMode === "amount_per_night"
      ? pricing.discountTotal
      : 0
  const discountPercent =
    state.discountMode === "percent_total" || state.discountMode === "percent_per_night"
      ? state.discountValue
      : 0

  return {
    nights,
    totalNightlyRate,
    baseAmount: pricing.grossBeforeDiscount,
    discountTotal: pricing.discountTotal,
    discountAmount,
    discountPercent,
    netAmount: pricing.netAmount,
    taxAmount: pricing.vatAmount,
    grandTotal: pricing.grandTotal,
    balanceDue: pricing.balanceDue,
    pricing,
    rooms: recomputedRooms,
    checkIn: derivedCheckIn,
    checkOut: derivedCheckOut,
    adults: derivedAdults,
    children: derivedChildren,
    infants: derivedInfants,
  }
}

/* ── Store ──────────────────────────────────────────────────── */

export const useReservationFormStore = create<ReservationFormStore>((set) => ({
  ...DEFAULTS,
  activeTab: 0,
  isSubmitting: false,
  errors: {},
  isOpen: false,
  quickViewOpen: false,
  ...computeDerived(DEFAULTS),

  setField: (field, value) => {
    set((state) => {
      const updated = { ...state, [field]: value }

      if ((field === "firstName" || field === "lastName") && !state.fullNameManual) {
        updated.fullName = `${updated.firstName} ${updated.lastName}`.trim()
      }
      if (field === "fullName") {
        updated.fullNameManual = true
      }

      return { ...updated, ...computeDerived(updated) }
    })
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setErrors: (errors) => set({ errors }),
  setSubmitting: (v) => set({ isSubmitting: v }),
  setQuickView: (open) => set({ quickViewOpen: open }),

  open: (prefill) => {
    const merged = { ...DEFAULTS, ...(prefill || {}) }
    set({
      ...merged,
      ...computeDerived(merged),
      activeTab: 0,
      isSubmitting: false,
      errors: {},
      isOpen: true,
      quickViewOpen: false,
    })
  },

  close: () => set({ isOpen: false, quickViewOpen: false }),

  reset: () =>
    set({
      ...DEFAULTS,
      ...computeDerived(DEFAULTS),
      activeTab: 0,
      isSubmitting: false,
      errors: {},
      isOpen: false,
      quickViewOpen: false,
    }),

  addRoom: (room) =>
    set((state) => {
      const rooms = [...state.rooms, room]
      const updated = { ...state, rooms }
      // computeDerived now owns the final `rooms` value (it re-prices each row
      // against the latest guest count), so don't spread `rooms` first.
      return { ...computeDerived(updated) }
    }),

  updateRoom: (roomId, updates) =>
    set((state) => {
      const rooms = state.rooms.map((r) =>
        r.id === roomId ? { ...r, ...updates } : r
      )
      const updated = { ...state, rooms }
      return { ...computeDerived(updated) }
    }),

  removeRoom: (roomId) =>
    set((state) => {
      const rooms = state.rooms.filter((r) => r.id !== roomId)
      const updated = { ...state, rooms }
      return { ...computeDerived(updated) }
    }),

  addExtraCharge: (charge) =>
    set((state) => {
      const updated = { ...state, extraCharges: [...state.extraCharges, charge] }
      return { extraCharges: updated.extraCharges, ...computeDerived(updated) }
    }),

  updateExtraCharge: (id, updates) =>
    set((state) => {
      const extraCharges = state.extraCharges.map((c) => c.id === id ? { ...c, ...updates } : c)
      const updated = { ...state, extraCharges }
      return { extraCharges, ...computeDerived(updated) }
    }),

  removeExtraCharge: (id) =>
    set((state) => {
      const extraCharges = state.extraCharges.filter((c) => c.id !== id)
      const updated = { ...state, extraCharges }
      return { extraCharges, ...computeDerived(updated) }
    }),

  addAttachment: (file) =>
    set((state) => ({
      attachments: [...state.attachments, file],
    })),

  removeAttachment: (id) =>
    set((state) => ({
      attachments: state.attachments.filter((f) => f.id !== id),
    })),
}))
