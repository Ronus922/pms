import { create } from "zustand"
import { getReservationFull } from "@/lib/actions/reservation-detail"

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

  // Pricing
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
}

/* ── Store interface ────────────────────────────────────────── */

export interface ReservationEditStore {
  // Panel state
  isOpen: boolean
  isLoading: boolean
  isSaving: boolean
  activeTab: number
  errors: Record<string, string>
  cardRevealed: boolean

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

  // Related data (read-only)
  rooms: RoomData[]
  payments: PaymentRecord[]
  charges: ChargeRecord[]
  logs: LogEntry[]

  // Computed
  isDirty: boolean
  nights: number

  // Actions
  open: (reservationId: string, tenantId: string) => Promise<void>
  close: () => void
  setField: <K extends keyof ReservationEditData>(key: K, value: ReservationEditData[K]) => void
  setActiveTab: (tab: number) => void
  setErrors: (errors: Record<string, string>) => void
  setSaving: (v: boolean) => void
  toggleCardReveal: () => void
}

/* ── Helpers ─────────────────────────────────────────────────── */

function computeNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0
  const ci = new Date(checkIn)
  const co = new Date(checkOut)
  return Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapServerToEdit(res: any): ReservationEditData {
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

    checkIn: res.check_in ? String(res.check_in).slice(0, 10) : "",
    checkOut: res.check_out ? String(res.check_out).slice(0, 10) : "",
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

    totalPrice: Number(res.total_price) || 0,
    totalPaid: Number(res.total_paid) || 0,
    balanceDue: Number(res.balance_due) || 0,
    deposit: Number(res.deposit) || 0,
    discountPercent: Number(res.discount_percent) || 0,
    discountPerNight: Number(res.discount_per_night) || 0,
    taxExempt: res.tax_exempt || false,
    taxAmount: Number(res.tax_amount) || 0,
    subtotal: Number(res.subtotal) || 0,
    currency: "ILS",
  }
}

function deepEqual(a: ReservationEditData, b: ReservationEditData | null): boolean {
  if (!b) return false
  return JSON.stringify(a) === JSON.stringify(b)
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
}

/* ── Store ───────────────────────────────────────────────────── */

export const useReservationEditStore = create<ReservationEditStore>((set) => ({
  isOpen: false,
  isLoading: false,
  isSaving: false,
  activeTab: 0,
  errors: {},
  cardRevealed: false,

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
  payments: [],
  charges: [],
  logs: [],

  isDirty: false,
  nights: 0,

  open: async (reservationId, tenantId) => {
    set({
      isOpen: true,
      isLoading: true,
      reservationId,
      tenantId,
      activeTab: 0,
      errors: {},
      cardRevealed: false,
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

    set({
      isLoading: false,
      reservationNumber: result.reservation_number || "",
      guestId: result.guest_id || "",
      isExternal,
      createdAt: result.created_at ? String(result.created_at) : "",
      updatedAt: result.updated_at ? String(result.updated_at) : "",
      createdBy: result.created_by || "",
      data: editData,
      originalData: { ...editData },
      rooms: (result.rooms || []) as unknown as RoomData[],
      payments: (result.payments || []) as unknown as PaymentRecord[],
      charges: (result.charges || []) as unknown as ChargeRecord[],
      logs: (result.logs || []) as unknown as LogEntry[],
      isDirty: false,
      nights: computeNights(editData.checkIn, editData.checkOut),
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
    payments: [],
    charges: [],
    logs: [],
    isDirty: false,
    cardRevealed: false,
  }),

  setField: (key, value) =>
    set((state) => {
      const newData = { ...state.data, [key]: value }
      return {
        data: newData,
        isDirty: !deepEqual(newData, state.originalData),
        nights: (key === "checkIn" || key === "checkOut")
          ? computeNights(newData.checkIn, newData.checkOut)
          : state.nights,
      }
    }),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setErrors: (errors) => set({ errors }),
  setSaving: (v) => set({ isSaving: v }),
  toggleCardReveal: () => set((s) => ({ cardRevealed: !s.cardRevealed })),
}))
