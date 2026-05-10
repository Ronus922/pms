"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Icon } from "@/components/shared/Icon"
import { useTenant, usePermissions } from "@/lib/hooks/use-tenant"
import { getEmployeeList } from "@/lib/actions/staff"
import { useStaffStore } from "@/lib/stores/staff-store"
import { EmployeeCard } from "@/components/staff/EmployeeCard"
import { StaffFilters } from "@/components/staff/StaffFilters"
import { EmployeeSidePanel } from "@/components/staff/EmployeeSidePanel"
import { AttendanceAreasSidePanel } from "@/components/attendance/AttendanceAreasSidePanel"
import type { EmployeeWithStats } from "@/lib/types/staff"
import type { StaffTab } from "@/lib/types/staff"

/* ── Valid Tabs ─────────────────────────────────────────────── */

const VALID_TABS: StaffTab[] = ["profile", "permissions", "activity", "tasks"]

function isValidTab(value: string | null): value is StaffTab {
  return value !== null && VALID_TABS.includes(value as StaffTab)
}

/* ── Component ─────────────────────────────────────────────── */

export function StaffPageClient() {
  const { tenantId } = useTenant()
  const { isAdmin, can } = usePermissions()
  const {
    filters,
    selectedEmployeeId,
    selectEmployee,
    openInvite,
    closePanel,
    setTab,
  } = useStaffStore()

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [employees, setEmployees] = useState<EmployeeWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [areasPanelOpen, setAreasPanelOpen] = useState(false)

  /* Track whether URL params have been consumed so we don't re-process */
  const urlConsumed = useRef(false)

  const loadEmployees = useCallback(async () => {
    setLoading(true)
    const data = await getEmployeeList(tenantId, filters)
    setEmployees(data)
    setLoading(false)
  }, [tenantId, filters])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  /* ── Read URL params on mount / when searchParams change ── */
  useEffect(() => {
    const employeeParam = searchParams.get("employee")
    const tabParam = searchParams.get("tab")

    if (!employeeParam) {
      urlConsumed.current = false
      return
    }

    /* Avoid re-processing the same URL param if already consumed */
    if (urlConsumed.current && selectedEmployeeId === employeeParam) return

    /* Open employee panel from URL */
    selectEmployee(employeeParam)

    /* Set tab if valid, otherwise default (profile) is already set by selectEmployee */
    if (isValidTab(tabParam)) {
      setTab(tabParam)
    }

    urlConsumed.current = true
  }, [searchParams, selectEmployee, setTab, selectedEmployeeId])

  /* ── Clear URL params when panel is closed ── */
  const prevSelectedRef = useRef<string | null>(null)
  useEffect(() => {
    const wasOpen = prevSelectedRef.current !== null
    const isClosed = selectedEmployeeId === null

    if (wasOpen && isClosed) {
      /* Panel just closed — clear URL params if present */
      const hasUrlParams = searchParams.has("employee")
      if (hasUrlParams) {
        urlConsumed.current = false
        router.replace(pathname, { scroll: false })
      }
    }

    prevSelectedRef.current = selectedEmployeeId
  }, [selectedEmployeeId, searchParams, router, pathname])

  const canEdit = can("staff", "edit")

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-extrabold font-headline">עובדים</h1>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-bold bg-accent px-4 py-2 rounded-full tabular-nums">
            {employees.length} עובדים
          </span>

          {can("attendance", "edit") && (
            <button
              onClick={() => setAreasPanelOpen(true)}
              className="btn btn-outline"
            >
              <Icon name="map" size="sm" />
              אזורי דיווח
            </button>
          )}

          {canEdit && (
            <button
              onClick={openInvite}
              className="btn btn-primary"
            >
              <Icon name="person_add" size="sm" className="text-white" />
              הוסף עובד
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <StaffFilters />

      {/* ── Employee Cards ──────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="hourglass_empty" size="xl" className="opacity-30 animate-spin" />
          <p className="text-sm font-medium">טוען עובדים...</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Icon name="person_off" size="xl" className="opacity-30" />
          <p className="text-lg font-medium">לא נמצאו עובדים</p>
          <p className="text-sm">נסו לשנות את מסנני החיפוש או להוסיף עובד חדש</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {employees.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              onClick={() => selectEmployee(emp.id)}
            />
          ))}
        </div>
      )}

      {/* ── Employee SidePanel ──────────────────────────────── */}
      <EmployeeSidePanel onSaved={loadEmployees} />

      {/* ── Attendance Areas SidePanel ──────────────────────── */}
      <AttendanceAreasSidePanel
        isOpen={areasPanelOpen}
        onClose={() => setAreasPanelOpen(false)}
      />
    </div>
  )
}
