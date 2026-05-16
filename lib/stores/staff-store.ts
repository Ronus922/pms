import { create } from "zustand"
import type { Role } from "@/lib/permissions/constants"
import type { StaffTab, StaffFilter } from "@/lib/types/staff"

/* ── Store Interface ───────────────────────────────────────── */

interface StaffStore {
  /* Panel state */
  selectedEmployeeId: string | null
  panelMode: "view" | "edit" | "invite" | null
  activeTab: StaffTab

  /* Filters */
  filters: StaffFilter

  /* Actions */
  selectEmployee: (id: string) => void
  openInvite: () => void
  closePanel: () => void
  setTab: (tab: StaffTab) => void
  setEditMode: () => void
  setViewMode: () => void
  setSearch: (search: string) => void
  setRoleFilter: (role: Role | "all") => void
  setStatusFilter: (status: "all" | "active" | "inactive") => void
  resetFilters: () => void
}

/* ── Default Filters ───────────────────────────────────────── */

const DEFAULT_FILTERS: StaffFilter = {
  search: "",
  role: "all",
  status: "active",
}

/* ── Store ──────────────────────────────────────────────────── */

export const useStaffStore = create<StaffStore>((set) => ({
  selectedEmployeeId: null,
  panelMode: null,
  activeTab: "profile",
  filters: { ...DEFAULT_FILTERS },

  selectEmployee: (id) =>
    set({ selectedEmployeeId: id, panelMode: "view", activeTab: "profile" }),

  openInvite: () =>
    set({ selectedEmployeeId: "__invite__", panelMode: "invite", activeTab: "profile" }),

  closePanel: () =>
    set({ selectedEmployeeId: null, panelMode: null, activeTab: "profile" }),

  setTab: (tab) => set({ activeTab: tab }),

  setEditMode: () => set({ panelMode: "edit" }),

  setViewMode: () => set({ panelMode: "view" }),

  setSearch: (search) =>
    set((s) => ({ filters: { ...s.filters, search } })),

  setRoleFilter: (role) =>
    set((s) => ({ filters: { ...s.filters, role } })),

  setStatusFilter: (status) =>
    set((s) => ({ filters: { ...s.filters, status } })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
}))
