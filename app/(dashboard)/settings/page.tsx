"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { LookupTable } from "@/components/settings/LookupTable"
import { TimeInput } from "@/components/shared/TimeInput"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getLookupItems, getTenantSettings, updateTenantSettings } from "@/lib/actions/settings"
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
  { id: "rooms", label: "חדרים ואזורים", icon: "bed" },
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
  { id: "area_type", label: "סוגי אזורים", icon: "meeting_room", group: "rooms", category: "area_type", showColor: false, showIcon: true },

  // Files
  { id: "attachment_category", label: "קטגוריות קבצים", icon: "attach_file", group: "files", category: "attachment_category", showColor: false, showIcon: true },
]

/* ── Page Component ────────────────────────────────────── */

export default function SettingsPage() {
  const { tenantId } = useTenant()
  const [activeSection, setActiveSection] = useState<string>("reservation_source")
  const [items, setItems] = useState<LookupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notificationEmail, setNotificationEmail] = useState("")
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailSaved, setEmailSaved] = useState(false)

  // Operational times
  const [defaultCheckinTime, setDefaultCheckinTime] = useState("15:00")
  const [defaultCheckoutTime, setDefaultCheckoutTime] = useState("11:00")
  const [sabbathCheckinTime, setSabbathCheckinTime] = useState("")
  const [sabbathCheckoutTime, setSabbathCheckoutTime] = useState("")
  const [timesSaving, setTimesSaving] = useState(false)
  const [timesSaved, setTimesSaved] = useState(false)

  // Taxes
  const [vatRate, setVatRate] = useState(17)
  const [vatSaving, setVatSaving] = useState(false)
  const [vatSaved, setVatSaved] = useState(false)

  const section = SECTIONS.find((s) => s.id === activeSection)

  const loadItems = useCallback(async () => {
    if (!section) return
    setLoading(true)
    const data = await getLookupItems(tenantId, section.category)
    setItems(data)
    setLoading(false)
  }, [tenantId, section])

  useEffect(() => { loadItems() }, [loadItems])

  useEffect(() => {
    getTenantSettings(tenantId).then((s) => {
      setNotificationEmail(s.notificationEmail)
      setDefaultCheckinTime(s.defaultCheckinTime)
      setDefaultCheckoutTime(s.defaultCheckoutTime)
      setSabbathCheckinTime(s.sabbathCheckinTime)
      setSabbathCheckoutTime(s.sabbathCheckoutTime)
      setVatRate(s.vatRate)
    })
  }, [tenantId])

  async function saveVatRate() {
    setVatSaving(true)
    await updateTenantSettings(tenantId, { vatRate })
    setVatSaving(false)
    setVatSaved(true)
    setTimeout(() => setVatSaved(false), 2000)
  }

  async function saveNotificationEmail() {
    setEmailSaving(true)
    await updateTenantSettings(tenantId, { notificationEmail: notificationEmail })
    setEmailSaving(false)
    setEmailSaved(true)
    setTimeout(() => setEmailSaved(false), 2000)
  }

  async function saveOperationalTimes() {
    setTimesSaving(true)
    await updateTenantSettings(tenantId, {
      defaultCheckinTime,
      defaultCheckoutTime,
      sabbathCheckinTime: sabbathCheckinTime || null,
      sabbathCheckoutTime: sabbathCheckoutTime || null,
    })
    setTimesSaving(false)
    setTimesSaved(true)
    setTimeout(() => setTimesSaved(false), 2000)
  }

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
              // Render taxes group with its custom tax_rate button even when it
              // has no lookup-backed sections yet.
              if (groupSections.length === 0 && group.id !== "taxes") return null

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
                  {group.id === "taxes" && (
                    <button
                      type="button"
                      onClick={() => setActiveSection("tax_rate")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-right min-h-[44px] ${
                        activeSection === "tax_rate"
                          ? "bg-primary/10 text-primary border-r-4 border-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Icon name="percent" size="sm" className={activeSection === "tax_rate" ? "text-primary" : "opacity-50"} />
                      מע&quot;מ / מיסים
                    </button>
                  )}
                </div>
              )
            })}

            {/* Tenant settings */}
            <div className="space-y-1">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 px-3 pb-1">
                <Icon name="tune" size="sm" className="opacity-50" />
                הגדרות כלליות
              </h3>
              <button
                type="button"
                onClick={() => setActiveSection("tenant_settings")}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-right min-h-[44px] ${
                  activeSection === "tenant_settings"
                    ? "bg-primary/10 text-primary border-r-4 border-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon name="mail" size="sm" className={activeSection === "tenant_settings" ? "text-primary" : "opacity-50"} />
                התראות ומיילים
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("operational_times")}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-right min-h-[44px] ${
                  activeSection === "operational_times"
                    ? "bg-primary/10 text-primary border-r-4 border-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon name="schedule" size="sm" className={activeSection === "operational_times" ? "text-primary" : "opacity-50"} />
                זמני תפעול
              </button>
            </div>
          </nav>
        </div>
      </div>

      {/* ── Content Area ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {activeSection === "tax_rate" ? (
          <div className="space-y-6">
            <div className="bg-[#1e40af]/5 rounded-xl p-6 border border-[#dad9e3]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#1e40af] flex items-center justify-center">
                  <Icon name="percent" size="md" className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-headline text-foreground">מע&quot;מ / מיסים</h2>
                  <p className="text-sm text-muted-foreground">
                    שיעור המס המוחל על מחיר ההזמנה. סיכום ההזמנה מחשב מע&quot;מ לפי הערך שמוגדר כאן.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-[20px] border border-border/15 p-6 shadow-sm space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-muted-foreground">שיעור מע&quot;מ (%)</label>
                <p className="text-xs text-muted-foreground">
                  ברירת המחדל בישראל 17%. הגדר 0 כדי לכבות חישוב מע&quot;מ (למשל באזורים פטורים).
                </p>
                <div className="flex gap-3 max-sm:flex-col items-center">
                  <div className="relative flex-1 max-w-xs">
                    <input
                      type="number"
                      value={vatRate}
                      onChange={(e) => setVatRate(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      min={0}
                      max={100}
                      step={0.5}
                      dir="ltr"
                      className="w-full bg-accent border border-border/40 rounded-xl px-5 py-3.5 pe-12 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none min-h-[48px] text-start tabular-nums"
                    />
                    <div className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none text-sm font-bold">%</div>
                  </div>
                  <button
                    type="button"
                    onClick={saveVatRate}
                    disabled={vatSaving}
                    className="btn btn-primary"
                  >
                    <Icon name={vatSaved ? "check" : "save"} size="sm" />
                    {vatSaving ? "שומר..." : vatSaved ? "נשמר" : "שמור"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeSection === "operational_times" ? (
          <div className="space-y-6">
            <div className="bg-[#1e40af]/5 rounded-xl p-6 border border-[#dad9e3]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#1e40af] flex items-center justify-center">
                  <Icon name="schedule" size="md" className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-headline text-foreground">זמני תפעול</h2>
                  <p className="text-sm text-muted-foreground">
                    שעות ברירת מחדל לכניסה ויציאה. משמשות את היומן לתצוגת תפוסה חלקית של יום.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-[20px] border border-border/15 p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold mb-3 text-foreground">ברירת מחדל</h3>
                <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted-foreground">שעת כניסה</label>
                    <TimeInput value={defaultCheckinTime} onChange={setDefaultCheckinTime} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted-foreground">שעת יציאה</label>
                    <TimeInput value={defaultCheckoutTime} onChange={setDefaultCheckoutTime} />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/30">
                <h3 className="text-sm font-bold mb-1 text-foreground">שבת / חג (אופציונלי)</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  אם מוגדר — יחול על הגעות/יציאות שחלות ביום שישי או שבת. השאר ריק כדי להשתמש בברירת המחדל.
                </p>
                <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted-foreground">שעת כניסה בשבת</label>
                    <TimeInput value={sabbathCheckinTime} onChange={setSabbathCheckinTime} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted-foreground">שעת יציאה בשבת</label>
                    <TimeInput value={sabbathCheckoutTime} onChange={setSabbathCheckoutTime} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={saveOperationalTimes}
                  disabled={timesSaving}
                  className="btn btn-primary"
                >
                  <Icon name={timesSaved ? "check" : "save"} size="sm" />
                  {timesSaving ? "שומר..." : timesSaved ? "נשמר" : "שמור"}
                </button>
              </div>
            </div>
          </div>
        ) : activeSection === "tenant_settings" ? (
          <div className="space-y-6">
            <div className="bg-[#1e40af]/5 rounded-xl p-6 border border-[#dad9e3]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#1e40af] flex items-center justify-center">
                  <Icon name="mail" size="md" className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-headline text-foreground">התראות ומיילים</h2>
                  <p className="text-sm text-muted-foreground">הגדרות מייל עסקי לקבלת הזמנות והתראות</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-[20px] border border-border/15 p-6 shadow-sm space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-muted-foreground">מייל בית העסק לקבלת הזמנות</label>
                <p className="text-xs text-muted-foreground">כתובת המייל שתקבל עותק מכל הזמנה חדשה</p>
                <div className="flex gap-3 max-sm:flex-col">
                  <input
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder="bookings@hotel.com"
                    dir="ltr"
                    className="flex-1 bg-accent border border-border/40 rounded-xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none min-h-[48px] text-start"
                  />
                  <button
                    type="button"
                    onClick={saveNotificationEmail}
                    disabled={emailSaving}
                    className="btn btn-primary"
                  >
                    <Icon name={emailSaved ? "check" : "save"} size="sm" />
                    {emailSaving ? "שומר..." : emailSaved ? "נשמר" : "שמור"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : section ? (
          <div className="space-y-6">
            {/* Section Header */}
            <div className="bg-[#1e40af]/5 rounded-xl p-6 border border-[#dad9e3]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#1e40af] flex items-center justify-center">
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
