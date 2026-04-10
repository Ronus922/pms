import { create } from "zustand"

/* ── Types ──────────────────────────────────────────────────── */

export interface ReservationRoom {
  id: string
  roomId: string
  roomTypeId: string
  boardType: string
  ratePerNight: number
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
  extraCharges: number
  taxExempt: boolean
  deposit: number
  amountPaid: number
  currency: string

  // Credit Card
  cardHolderName: string
  cardLast4: string
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

  // Computed
  nights: number
  totalNightlyRate: number
  baseAmount: number
  discountTotal: number
  taxAmount: number
  grandTotal: number
  balanceDue: number

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
  extraCharges: 0,
  taxExempt: false,
  deposit: 0,
  amountPaid: 0,
  currency: "ILS",

  cardHolderName: "",
  cardLast4: "",
  cardExpiryMonth: "",
  cardExpiryYear: "",
  cardApprovalCode: "",
  cardTransactionRef: "",
  cardInstallments: 1,
  paymentResult: "",

  attachments: [],
}

/* ── Computed ───────────────────────────────────────────────── */

const TAX_RATE = 0.17

function computeDerived(state: ReservationFormData) {
  const ci = state.checkIn ? new Date(state.checkIn) : null
  const co = state.checkOut ? new Date(state.checkOut) : null
  const nights = ci && co ? Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000)) : 0

  // Multi-room: sum all room rates, or fallback to single pricePerNight
  const totalNightlyRate =
    state.rooms.length > 0
      ? state.rooms.reduce((sum, r) => sum + (r.ratePerNight || 0), 0)
      : state.pricePerNight

  const baseAmount = totalNightlyRate * nights

  let discountTotal = 0
  if (state.discountPercent > 0) {
    discountTotal = baseAmount * (state.discountPercent / 100)
  } else if (state.discountAmount > 0) {
    discountTotal = state.discountAmount
  }

  const afterDiscount = Math.max(0, baseAmount - discountTotal) + state.extraCharges
  const taxAmount = state.taxExempt ? 0 : afterDiscount * TAX_RATE
  const grandTotal = afterDiscount + taxAmount
  const balanceDue = Math.max(0, grandTotal - state.amountPaid - state.deposit)

  return { nights, totalNightlyRate, baseAmount, discountTotal, taxAmount, grandTotal, balanceDue }
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

  open: (prefill) =>
    set({
      ...DEFAULTS,
      ...computeDerived(DEFAULTS),
      ...(prefill || {}),
      activeTab: 0,
      isSubmitting: false,
      errors: {},
      isOpen: true,
      quickViewOpen: false,
    }),

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
      return { rooms, ...computeDerived(updated) }
    }),

  updateRoom: (roomId, updates) =>
    set((state) => {
      const rooms = state.rooms.map((r) =>
        r.id === roomId ? { ...r, ...updates } : r
      )
      const updated = { ...state, rooms }
      return { rooms, ...computeDerived(updated) }
    }),

  removeRoom: (roomId) =>
    set((state) => {
      const rooms = state.rooms.filter((r) => r.id !== roomId)
      const updated = { ...state, rooms }
      return { rooms, ...computeDerived(updated) }
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
