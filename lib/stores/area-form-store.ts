import { create } from "zustand"

interface AreaFormState {
  isOpen: boolean
  editingAreaId: string | null
  isSubmitting: boolean
  errors: Record<string, string>

  name: string
  code: string
  area_type: string
  building_id: string
  floor_id: string
  is_active: boolean
  cleaning_relevant: boolean
  maintenance_relevant: boolean
  sort_order: number
  notes: string
}

interface AreaFormActions {
  open: (areaId?: string) => void
  close: () => void
  setField: (key: string, value: unknown) => void
  reset: () => void
}

export type AreaFormStore = AreaFormState & AreaFormActions

const DEFAULTS: AreaFormState = {
  isOpen: false,
  editingAreaId: null,
  isSubmitting: false,
  errors: {},

  name: "",
  code: "",
  area_type: "",
  building_id: "",
  floor_id: "",
  is_active: true,
  cleaning_relevant: false,
  maintenance_relevant: true,
  sort_order: 0,
  notes: "",
}

function freshDefaults(): AreaFormState {
  return { ...DEFAULTS, errors: {} }
}

export const useAreaFormStore = create<AreaFormStore>((set) => ({
  ...freshDefaults(),

  open: (areaId?: string) =>
    set({
      ...freshDefaults(),
      isOpen: true,
      editingAreaId: areaId ?? null,
    }),

  close: () => set({ isOpen: false }),

  setField: (key, value) =>
    set((state) => {
      const errors = { ...state.errors }
      delete errors[key]
      return { [key]: value, errors } as Partial<AreaFormStore>
    }),

  reset: () => set(freshDefaults()),
}))
