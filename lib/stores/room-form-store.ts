import { create } from "zustand"

export interface RoomTranslation {
  room_name: string
  description_html: string
  meta_search_summary: string
  seo_title: string
  seo_description: string
}

export interface RoomImage {
  id: string
  file_url: string
  file_name: string
  file_size: number
  width: number
  height: number
  sort_order: number
  is_primary: boolean
}

interface RoomFormState {
  isOpen: boolean
  editingRoomId: string | null
  activeTab: number
  isSubmitting: boolean
  errors: Record<string, string>

  // Global fields
  room_number: string
  wing: string
  room_type_id: string
  is_active: boolean
  is_listed: boolean
  sort_order: number
  building_id: string
  floor_id: string

  // Occupancy
  max_occupancy: number
  default_guests: number
  max_adults: number
  max_children: number
  max_infants: number

  // Beds
  single_beds: number
  double_beds: number
  queen_beds: number
  sofa_beds: number
  cribs: number
  sleeping_arrangement_note: string

  // Multi-language
  currentLanguage: string
  translations: Record<string, RoomTranslation>

  // Images
  images: RoomImage[]
  primary_image_id: string

  // Equipment
  equipment_ids: string[]
}

interface RoomFormActions {
  open: (roomId?: string) => void
  close: () => void
  setField: (key: string, value: unknown) => void
  setActiveTab: (tab: number) => void
  setTranslation: (lang: string, field: keyof RoomTranslation, value: string) => void
  setCurrentLanguage: (lang: string) => void
  toggleEquipment: (id: string) => void
  setImages: (images: RoomImage[]) => void
  addImage: (image: RoomImage) => void
  removeImage: (id: string) => void
  setPrimaryImage: (id: string) => void
  reset: () => void
}

export type RoomFormStore = RoomFormState & RoomFormActions

const EMPTY_TRANSLATION: RoomTranslation = {
  room_name: "",
  description_html: "",
  meta_search_summary: "",
  seo_title: "",
  seo_description: "",
}

const DEFAULTS: RoomFormState = {
  isOpen: false,
  editingRoomId: null,
  activeTab: 0,
  isSubmitting: false,
  errors: {},

  room_number: "",
  wing: "",
  room_type_id: "",
  is_active: true,
  is_listed: true,
  sort_order: 0,
  building_id: "",
  floor_id: "",

  max_occupancy: 2,
  default_guests: 2,
  max_adults: 2,
  max_children: 0,
  max_infants: 0,

  single_beds: 0,
  double_beds: 1,
  queen_beds: 0,
  sofa_beds: 0,
  cribs: 0,
  sleeping_arrangement_note: "",

  currentLanguage: "he",
  translations: {
    he: { ...EMPTY_TRANSLATION },
    en: { ...EMPTY_TRANSLATION },
    ar: { ...EMPTY_TRANSLATION },
  },

  images: [],
  primary_image_id: "",

  equipment_ids: [],
}

function freshDefaults(): RoomFormState {
  return {
    ...DEFAULTS,
    errors: {},
    translations: {
      he: { ...EMPTY_TRANSLATION },
      en: { ...EMPTY_TRANSLATION },
      ar: { ...EMPTY_TRANSLATION },
    },
    images: [],
    equipment_ids: [],
  }
}

export const useRoomFormStore = create<RoomFormStore>((set) => ({
  ...freshDefaults(),

  open: (roomId?: string) =>
    set({
      ...freshDefaults(),
      isOpen: true,
      editingRoomId: roomId ?? null,
    }),

  close: () => set({ isOpen: false }),

  setField: (key, value) =>
    set((state) => {
      const errors = { ...state.errors }
      delete errors[key]
      return { [key]: value, errors } as Partial<RoomFormStore>
    }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setTranslation: (lang, field, value) =>
    set((state) => {
      const langData = state.translations[lang] ?? { ...EMPTY_TRANSLATION }
      return {
        translations: {
          ...state.translations,
          [lang]: { ...langData, [field]: value },
        },
      }
    }),

  setCurrentLanguage: (lang) => set({ currentLanguage: lang }),

  toggleEquipment: (id) =>
    set((state) => {
      const current = state.equipment_ids
      const next = current.includes(id)
        ? current.filter((eid) => eid !== id)
        : [...current, id]
      return { equipment_ids: next }
    }),

  setImages: (images) => set({ images }),

  addImage: (image) =>
    set((state) => ({ images: [...state.images, image] })),

  removeImage: (id) =>
    set((state) => ({
      images: state.images.filter((img) => img.id !== id),
      primary_image_id:
        state.primary_image_id === id ? "" : state.primary_image_id,
    })),

  setPrimaryImage: (id) =>
    set((state) => ({
      primary_image_id: id,
      images: state.images.map((img) => ({
        ...img,
        is_primary: img.id === id,
      })),
    })),

  reset: () => set(freshDefaults()),
}))
