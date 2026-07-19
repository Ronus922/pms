import { Icon } from "@/components/shared/Icon"

interface KpiCardData {
  icon: string
  label: string
  value: string
  subtext?: string
  subtextTone?: "default" | "success" | "error"
  iconBg: string
  iconColor: string
  progress?: number
}

const KPI_CARDS: KpiCardData[] = [
  {
    icon: "exit_to_app",
    label: "יציאות להיום",
    value: "24",
    subtext: "15 צ'ק-אאוט הושלמו",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    icon: "login",
    label: "כניסות להיום",
    value: "12",
    subtext: "4 חדרים כבר נמסרו",
    iconBg: "bg-primary",
    iconColor: "text-primary-foreground",
  },
  {
    icon: "build",
    label: "תחזוקה",
    value: "3",
    subtext: "! חדרים בטיפול דחוף",
    subtextTone: "error",
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
  },
  {
    icon: "percent",
    label: "תפוסה",
    value: "84%",
    subtext: "+2.4% משבוע שעבר",
    subtextTone: "success",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    progress: 84,
  },
]

function CircularProgress({ value }: { value: number }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
      <circle cx="28" cy="28" r={radius} fill="none" stroke="#eff6ff" strokeWidth="5" />
      <circle
        cx="28"
        cy="28"
        r={radius}
        fill="none"
        stroke="#1e40af"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* KPI Cards — Azure Ethos */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {KPI_CARDS.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl p-6 border border-border flex items-start justify-between min-h-[140px]"
          >
            <div className="flex flex-col gap-1 text-right">
              <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
              <p className="text-[2.25rem] font-bold text-foreground leading-tight">{card.value}</p>
              {card.subtext && (
                <p
                  className={`text-xs ${
                    card.subtextTone === "error"
                      ? "text-destructive font-semibold"
                      : card.subtextTone === "success"
                        ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                        : "text-muted-foreground"
                  }`}
                >
                  {card.subtext}
                </p>
              )}
            </div>
            {card.progress !== undefined ? (
              <CircularProgress value={card.progress} />
            ) : (
              <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.iconBg} ${card.iconColor}`}>
                <Icon name={card.icon} />
              </span>
            )}
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
