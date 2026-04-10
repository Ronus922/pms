import { create } from "zustand"

interface RoomTypesStore {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useRoomTypesStore = create<RoomTypesStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
