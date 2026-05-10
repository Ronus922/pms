import { create } from "zustand"

export type CalendarView = "week" | "two-weeks" | "month"

interface CalendarState {
  startDate: Date
  view: CalendarView
  selectedReservationId: string | null
  filters: {
    building: string | null
    floor: string | null
    roomType: string | null
    status: string | null
  }
  setStartDate: (date: Date) => void
  setView: (view: CalendarView) => void
  selectReservation: (id: string | null) => void
  setFilter: (key: string, value: string | null) => void
  goToday: () => void
  goForward: () => void
  goBackward: () => void
}

function startOfDay(d: Date) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  return date
}

function getDaysForView(view: CalendarView): number {
  switch (view) {
    case "week":
      return 7
    case "two-weeks":
      return 14
    case "month":
      return 30
  }
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  startDate: startOfDay(new Date()),
  view: "two-weeks",
  selectedReservationId: null,
  filters: {
    building: null,
    floor: null,
    roomType: null,
    status: null,
  },
  setStartDate: (date) => set({ startDate: startOfDay(date) }),
  setView: (view) => set({ view }),
  selectReservation: (id) => set({ selectedReservationId: id }),
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  goToday: () => set({ startDate: startOfDay(new Date()) }),
  goForward: () => {
    const { startDate, view } = get()
    const next = new Date(startDate)
    next.setDate(next.getDate() + getDaysForView(view))
    set({ startDate: next })
  },
  goBackward: () => {
    const { startDate, view } = get()
    const prev = new Date(startDate)
    prev.setDate(prev.getDate() - getDaysForView(view))
    set({ startDate: prev })
  },
}))
