"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { LookupTable } from "@/components/settings/LookupTable"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getLookupItems } from "@/lib/actions/settings"
import type { LookupItem, LookupCategoryId } from "@/lib/types/lookup"

/* ── Settings Sections ─────────────────────────────────── */

interface SettingsSection {
  id: string
  label: string
  icon: string
  group: string
  category: LookupCategoryId
  showColor?: boolean
  showIcon?: boolean
}

const GROUPS = [
  { id: "reservations", label: "הזמנות", icon: "book_online" },
  { id: "payments", label: "תשלומים", icon: "payments" },
  { id: "guests", label: "אורחים", icon: "group" },
  { id: "rooms", label: "חדרים", icon: "bed" },
  { id: "taxes", label: "מיסים ועמלות", icon: "receipt_long" },
  { id: "files", label: "קבצים ומסמכים", icon: "folder" },
  { id: "defaults", label: "ברירות מחדל", icon: "tune" },
]

const SECTIONS: SettingsSection[] = [
  // Reservations
  { id: "reservation_source", label: "מקורות הזמנה", icon: "call_made", group: "reservations", category: "reservation_source", showColor: true, showIcon: true },
  { id: "reservation_status", label: "סטטוסי הזמנה", icon: "check_circle", group: "reservations", category: "reservation_status", showColor: true, showIcon: true },
  { id: "cancellation_policy", label: "מדיניות ביטול", icon: "block", group: "reservations", category: "cancellation_policy", showColor: false, showIcon: true },

  // Payments
  { id: "payment_status", label: "סטטוסי תשלום", icon: "account_balance_wallet", group: "payments", category: "payment_status", showColor: true, showIcon: true },
  { id: "payment_method", label: "אמצעי תשלום", icon: "credit_card", group: "payments", category: "payment_method", showColor: true, showIcon: true },
  { id: "currency", label: "מטבעות", icon: "currency_exchange", group: "payments", category: "currency", showColor: false, showIcon: false },

  // Guests
  { id: "language", label: "שפות", icon: "translate", group: "guests", category: "language", showColor: false, showIcon: false },
  { id: "country", label: "מדינות", icon: "public", group: "guests", category: "country", showColor: false, showIcon: false },
  { id: "guest_tag", label: "תגיות אורח", icon: "label", group: "guests", category: "guest_tag", showColor: true, showIcon: true },

  // Rooms
  { id: "board_type", label: "סוגי ארוחות", icon: "restaurant", group: "rooms", category: "board_type", showColor: false, showIcon: true },
  { id: "room_tag", label: "תגיות חדר", icon: "label", group: "rooms", category: "room_tag", showColor: true, showIcon: true },

  // Files
  { id: "attachment_category", label: "קטגוריות קבצים", icon: "attach_file", group: "files", category: "attachment_category", showColor: false, showIcon: true },
]

/* ── Page Component ────────────────────────────────────── */

export default function SettingsPage() {
  const { tenantId } = useTenant()
  const [activeSection, setActiveSection] = useState<string>("reservation_source")
  const [items, setItems] = useState<LookupItem[]>([])
  const [loading, setLoading] = useState(true)

  const section = SECTIONS.find((s) => s.id === activeSection)

  const loadItems = useCallback(async () => {
    if (!section) return
    setLoading(true)
    const data = await getLookupItems(tenantId, section.category)
    setItems(data)
    setLoading(false)
  }, [tenantId, section])

  useEffect(() => { loadItems() }, [loadItems])

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)] max-sm:flex-col">
      {/* ── Left Navigation ──────────────────────────────────── */}
      <div className="w-64 shrink-0 max-sm:w-full">
        <div className="sticky top-24 space-y-6">
          {/* Page Title */}
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold font-headline text-foreground">הגדרות PMS</h1>
            <p className="text-sm text-muted-foreground">ניהול ערכים, סטטוסים וברירות מחדל</p>
          </div>

          {/* Nav Groups */}
          <nav className="space-y-5">
            {GROUPS.map((group) => {
              const groupSections = SECTIONS.filter((s) => s.group === group.id)
              if (groupSections.length === 0) return null

              return (
                <div key={group.id} className="space-y-1">
                  <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 px-3 pb-1">
                    <Icon name={group.icon} size="sm" className="opacity-50" />
                    {group.label}
                  </h3>
                  {groupSections.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSection(s.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-right min-h-[44px] ${
                        activeSection === s.id
                          ? "bg-primary/10 text-primary border-r-4 border-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Icon name={s.icon} size="sm" className={activeSection === s.id ? "text-primary" : "opacity-50"} />
                      {s.label}
                    </button>
                  ))}
                </div>
              )
            })}

            {/* Defaults section — placeholder for now */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 px-3 pb-1">
                <Icon name="tune" size="sm" className="opacity-50" />
                ברירות מחדל
              </h3>
              <button
                type="button"
                disabled
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold text-muted-foreground/50 text-right min-h-[44px] cursor-not-allowed"
              >
                <Icon name="settings" size="sm" className="opacity-30" />
                הגדרות ברירת מחדל
                <span className="ms-auto text-[12px] bg-accent px-2 py-0.5 rounded-full">בקרוב</span>
              </button>
            </div>
          </nav>
        </div>
      </div>

      {/* ── Content Area ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {section ? (
          <div className="space-y-6">
            {/* Section Header */}
            <div className="bg-gradient-to-l from-[#003aa0]/8 to-[#3F51B5]/8 rounded-[20px] p-6 border border-border/15">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-l from-[#003aa0] to-[#3F51B5] flex items-center justify-center">
                  <Icon name={section.icon} size="md" className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-headline text-foreground">{section.label}</h2>
                  <p className="text-sm text-muted-foreground">
                    ניהול ערכים עבור {section.label.toLowerCase()} — הוסף, ערוך, הפעל/כבה
                  </p>
                </div>
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Icon name="hourglass_empty" size="xl" className="text-muted-foreground opacity-30 animate-spin" />
              </div>
            ) : (
              <LookupTable
                tenantId={tenantId}
                category={section.category}
                items={items}
                onReload={loadItems}
                showColor={section.showColor}
                showIcon={section.showIcon}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Icon name="settings" size="xl" className="opacity-30" />
          </div>
        )}
      </div>
    </div>
  )
}
