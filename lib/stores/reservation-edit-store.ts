import { create } from "zustand"
import { getReservationFull } from "@/lib/actions/reservation-detail"
import { type ReservationRoom, computeRoomRate } from "@/lib/stores/reservation-form-store"

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

  // Computed
  isDirty: boolean
  nights: number

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
  toggleCardReveal: () => void
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
  editableRooms: [],
  originalEditableRooms: null,
  payments: [],
  charges: [],
  logs: [],

  isDirty: false,
  nights: 0,
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
      cardRevealed: false,
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
      rooms: roomsData,
      editableRooms: editable,
      originalEditableRooms: editable.map((r) => ({ ...r })),
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
    editableRooms: [],
    originalEditableRooms: null,
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
        isDirty:
          !deepEqual(newData, state.originalData) ||
          roomsDirty(state.editableRooms, state.originalEditableRooms),
        nights: (key === "checkIn" || key === "checkOut")
          ? computeNights(newData.checkIn, newData.checkOut)
          : state.nights,
      }
    }),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setErrors: (errors) => set({ errors }),
  setSaving: (v) => set({ isSaving: v }),
  toggleCardReveal: () => set((s) => ({ cardRevealed: !s.cardRevealed })),

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

  return {
    editableRooms: recomputed,
    data: newData,
    nights: computeNights(newData.checkIn, newData.checkOut),
    isDirty:
      !deepEqual(newData, state.originalData) ||
      roomsDirty(recomputed, state.originalEditableRooms),
  }
}
