"use client"

import { useState } from "react"
import { Icon } from "@/components/shared/Icon"
import { TimeInput } from "@/components/shared/TimeInput"
import { toast } from "sonner"

const inputClass = "w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm min-h-[48px] outline-none focus:ring-2 focus:ring-primary/20"
const labelClass = "block text-xs font-bold text-muted-foreground mb-1.5"

export function SettingsTab() {
  const [senderEmail, setSenderEmail] = useState("")
  const [senderName, setSenderName] = useState("")
  const [supportPhone, setSupportPhone] = useState("")
  const [testEmail, setTestEmail] = useState("")
  const [retryAttempts, setRetryAttempts] = useState("3")
  const [quietStart, setQuietStart] = useState("22:00")
  const [quietEnd, setQuietEnd] = useState("07:00")
  const [businessDaysOnly, setBusinessDaysOnly] = useState(false)

  function handleSave() {
    toast.success("ההגדרות נשמרו — שמירה ל-DB תתווסף בשלב הבא")
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Email Settings */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <h3 className="text-base font-bold text-foreground">הגדרות אימייל</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>אימייל שולח</label>
            <input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} className={inputClass} placeholder="noreply@hotel.com" dir="ltr" />
          </div>
          <div>
            <label className={labelClass}>שם שולח</label>
            <input value={senderName} onChange={(e) => setSenderName(e.target.value)} className={inputClass} placeholder="מלון הים" />
          </div>
        </div>
        <div>
          <label className={labelClass}>אימייל לבדיקות</label>
          <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className={inputClass} placeholder="admin@hotel.com" dir="ltr" />
          <p className="text-[11px] text-muted-foreground mt-1">שליחות בדיקה יישלחו לכתובת זו</p>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <h3 className="text-base font-bold text-foreground">פרטי קשר</h3>
        </div>
        <div>
          <label className={labelClass}>טלפון תמיכה</label>
          <input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} className={inputClass} placeholder="03-1234567" dir="ltr" />
          <p className="text-[11px] text-muted-foreground mt-1">יופיע בהודעות דרך המשתנה {"{{support_phone}}"}</p>
        </div>
      </div>

      {/* Retry + Quiet Hours */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <h3 className="text-base font-bold text-foreground">ניסיונות חוזרים ושעות שקט</h3>
        </div>
        <div>
          <label className={labelClass}>מספר ניסיונות חוזרים</label>
          <input type="number" value={retryAttempts} onChange={(e) => setRetryAttempts(e.target.value)} min={0} max={10} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>תחילת שעות שקט</label>
            <TimeInput value={quietStart} onChange={setQuietStart} />
          </div>
          <div>
            <label className={labelClass}>סיום שעות שקט</label>
            <TimeInput value={quietEnd} onChange={setQuietEnd} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">הודעות לא יישלחו בשעות שקט (ימתינו לבוקר)</p>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-accent">
          <input type="checkbox" checked={businessDaysOnly} onChange={(e) => setBusinessDaysOnly(e.target.checked)} id="business-days" className="w-5 h-5 rounded" />
          <label htmlFor="business-days" className="text-sm font-medium cursor-pointer">שליחה בימי עסקים בלבד (א׳-ה׳)</label>
        </div>
      </div>

      {/* Provider Status */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <h3 className="text-base font-bold text-foreground">סטטוס ערוצים</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-accent rounded-xl">
            <div className="flex items-center gap-2"><Icon name="email" size="sm" className="text-blue-600" /><span className="text-sm font-bold">אימייל</span></div>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />מחובר</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-accent rounded-xl">
            <div className="flex items-center gap-2"><Icon name="chat" size="sm" className="text-emerald-600" /><span className="text-sm font-bold">וואטסאפ</span></div>
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" />לא מוגדר</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-accent rounded-xl">
            <div className="flex items-center gap-2"><Icon name="sms" size="sm" className="text-violet-600" /><span className="text-sm font-bold">SMS</span></div>
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" />לא מוגדר</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-accent rounded-xl">
            <div className="flex items-center gap-2"><Icon name="notifications" size="sm" className="text-amber-600" /><span className="text-sm font-bold">התראות פנימיות</span></div>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />מחובר</span>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-start">
        <button
          onClick={handleSave}
          className="btn btn-primary"
        >
          <Icon name="check" size="sm" />
          שמור הגדרות
        </button>
      </div>
    </div>
  )
}
