"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/shared/Icon"

const TABS = [
  { href: "/channels", label: "סקירה", icon: "dashboard" },
  { href: "/channels/mapping", label: "מיפוי", icon: "link" },
  { href: "/channels/sync", label: "מעקב סנכרון", icon: "sync" },
  { href: "/channels/bookings", label: "תיבת הזמנות", icon: "inbox" },
  { href: "/channels/webhooks", label: "Webhooks", icon: "bolt" },
  { href: "/channels/settings", label: "הגדרות", icon: "settings" },
] as const

interface Props {
  title?: string
  subtitle?: string
  children: React.ReactNode
}

export function ChannelsShell({
  title = "ערוצים",
  subtitle = "ניהול חיבור לערוצי הפצה (Channex, Booking, Airbnb ועוד)",
  children,
}: Props) {
  const pathname = usePathname()
  return (
    <div className="space-y-5 p-6" dir="rtl">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] max-sm:text-[22px] font-extrabold font-headline text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Tabs — Azure Ethos Subtle Card */}
      <div className="inline-flex bg-[#f4f2fc] p-1 rounded-xl flex-wrap">
        {TABS.map((tab) => {
          const active =
            tab.href === "/channels"
              ? pathname === "/channels"
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-all duration-200 ${
                active
                  ? "bg-white text-[#1e40af] shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                  : "text-[#474747] hover:text-[#1e40af]"
              }`}
            >
              <Icon name={tab.icon} size="sm" />
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Tab content */}
      {children}
    </div>
  )
}
