"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { WorkerTabBar } from "@/components/layout/WorkerTabBar"
import { ReservationModal } from "@/components/reservations/ReservationModal"
import { ExistingReservationPanel } from "@/components/reservations/ExistingReservationPanel"
import { SendMessagePanel } from "@/components/reservations/messaging/SendMessagePanel"
import { TenantProvider } from "@/lib/hooks/use-tenant"
import { getTenantForUser } from "@/lib/actions/tenant"

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "דשבורד",
  "/calendar": "יומן חדרים",
  "/reservations": "הזמנות",
  "/guests": "אורחים",
  "/rooms": "חדרים ואזורים",
  "/rooms/blocks": "חסימות חדרים",
  "/housekeeping": "ניקיון",
  "/maintenance": "תחזוקה",
  "/maintenance/my-tasks": "המשימות שלי — תחזוקה",
  "/maintenance/report": "דיווח על תקלה",
  "/staff": "עובדים",
  "/documents": "מסמכים",
  "/finance": "כספים",
  "/suppliers": "ספקים",
  "/reports": "דוחות",
  "/channels": "אינטגרציות",
  "/rate-plans": "תוכניות מחיר",
  "/automations": "אוטומציות",
  "/settings": "הגדרות",
  "/billing": "חיוב ותשלום",
  "/permissions": "הרשאות",
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [tenant, setTenant] = useState<Awaited<ReturnType<typeof getTenantForUser>>>(null)
  const pathname = usePathname()
  const router = useRouter()
  const title = PAGE_TITLES[pathname] || "GuestHub"

  useEffect(() => {
    getTenantForUser().then((t) => {
      if (t) setTenant(t)
    })
  }, [])

  // Redirect cleaner users to their dedicated views. The allowlist
  // matches the tabs exposed by WorkerTabBar — a cleaner who lands on
  // any other path is bounced back to the cleaning queue.
  useEffect(() => {
    const allowedPaths = [
      "/housekeeping/my-tasks",
      "/maintenance/my-tasks",
      "/maintenance/report",
      "/attendance/my",
      "/attendance/my-requests",
    ]
    if (
      tenant?.role === "cleaner" &&
      !allowedPaths.some((p) => pathname.startsWith(p))
    ) {
      router.replace("/housekeeping/my-tasks")
    }
  }, [tenant, pathname, router])

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
      </div>
    )
  }

  // Worker mobile view → no sidebar, no topbar, no reservation modals
  const isCleanerMobileView =
    tenant.role === "cleaner" ||
    pathname.startsWith("/housekeeping/my-tasks") ||
    pathname.startsWith("/maintenance/my-tasks") ||
    pathname.startsWith("/maintenance/report")

  if (isCleanerMobileView) {
    return (
      <TenantProvider tenantId={tenant.tenantId} propertyId={tenant.propertyId} userId={tenant.userId} role={tenant.role} permissions={tenant.permissions}>
        <WorkerTabBar />
        <main className="min-h-screen bg-background">
          {children}
        </main>
      </TenantProvider>
    )
  }

  return (
    <TenantProvider tenantId={tenant.tenantId} propertyId={tenant.propertyId} userId={tenant.userId} role={tenant.role} permissions={tenant.permissions}>
      <div className="flex min-h-screen">
        <Sidebar
          tenantName="GuestHub"
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
        {/* sm:min-w-0 lets flex children with internal horizontal scroll (e.g.
            the calendar board) stay contained on tablet/desktop. Left off below
            sm so the fixed sidebar margin (mr-72) doesn't squeeze mobile content
            into a sliver — mobile keeps its prior overflow behaviour. */}
        <div className={`flex-1 sm:min-w-0 flex flex-col transition-all duration-300 ${collapsed ? "mr-20" : "mr-72"}`}>
          <TopBar title={title} />
          <main className="flex-1 px-8 py-6">
            {children}
          </main>
        </div>
        <ReservationModal />
        <ExistingReservationPanel />
        <SendMessagePanel />
      </div>
    </TenantProvider>
  )
}
