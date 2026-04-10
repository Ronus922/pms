import { Icon } from "@/components/shared/Icon"

const KPI_CARDS = [
  { icon: "percent", label: "תפוסה", value: "84%", trend: "+2.4%", trendUp: true, color: "text-primary bg-primary/10" },
  { icon: "meeting_room", label: "חדרים פנויים", value: "12", color: "text-secondary bg-secondary/10" },
  { icon: "login", label: "צ'ק-אין היום", value: "24", color: "text-tertiary bg-tertiary/10" },
  { icon: "construction", label: "חדרים בתחזוקה", value: "3", color: "text-amber-600 bg-amber-50" },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {KPI_CARDS.map((card) => (
          <div key={card.label} className="kpi-card bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={`p-2 rounded-xl ${card.color}`}>
                <Icon name={card.icon} />
              </span>
              {card.trend && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${card.trendUp ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                  {card.trend}
                </span>
              )}
            </div>
            <p className="text-3xl font-extrabold mt-2">{card.value}</p>
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </section>

      {/* Placeholder for calendar preview */}
      <section className="bg-card rounded-[20px] border border-border/20 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border/20 flex justify-between items-center bg-accent/30">
          <div className="flex items-center gap-6">
            <h3 className="text-lg font-bold font-headline">יומן חדרים</h3>
            <div className="flex items-center bg-card rounded-lg border border-border p-1">
              <button className="p-1 hover:bg-accent rounded min-w-[44px] min-h-[44px] flex items-center justify-center">
                <Icon name="chevron_right" size="sm" />
              </button>
              <span className="px-4 text-sm font-bold">6 - 12 אפריל, 2026</span>
              <button className="p-1 hover:bg-accent rounded min-w-[44px] min-h-[44px] flex items-center justify-center">
                <Icon name="chevron_left" size="sm" />
              </button>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">מאושר</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-muted-foreground">ממתין</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-muted-foreground">שולם</span>
            </div>
          </div>
        </div>
        <div className="p-12 text-center text-muted-foreground">
          <Icon name="calendar_today" size="xl" className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">לוח תפוסה מלא — בפיתוח</p>
          <p className="text-sm">יוצג כאן עם Timeline ויזואלי, Drag & Drop והזמנות בזמן אמת</p>
        </div>
      </section>

      {/* Urgent Tasks */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-2">משימות דחופות</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card p-5 rounded-[20px] shadow-sm border-r-4 border-amber-400 flex gap-4 items-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Icon name="person" className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">מר קובלסקי (VIP)</p>
              <p className="text-xs text-muted-foreground">צ'ק-אאוט מאוחר 402</p>
            </div>
            <Icon name="chevron_left" size="sm" className="text-muted-foreground" />
          </div>

          <div className="bg-card p-5 rounded-[20px] shadow-sm border-r-4 border-primary flex gap-4 items-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon name="local_laundry_service" className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">ניקיון דחוף - 501</p>
              <p className="text-xs text-muted-foreground">מוכנות ל-14:00</p>
            </div>
            <span className="text-[12px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">עכשיו</span>
          </div>

          <div className="bg-card p-5 rounded-[20px] shadow-sm border-r-4 border-destructive flex gap-4 items-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <Icon name="restaurant" className="text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">ארוחת בוקר בחדר</p>
              <p className="text-xs text-muted-foreground">חדר 204 - דחוף</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
