"use client"

import { useEffect, useCallback } from "react"
import { toast } from "sonner"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { useMessagingStore } from "@/lib/stores/messaging-store"
import { getReservationTemplates } from "@/lib/actions/messaging/get-reservation-templates"
import { renderReservationTemplate } from "@/lib/actions/messaging/render-reservation-template"
import { sendReservationEmailFromTemplate } from "@/lib/actions/messaging/send-reservation-email"
import { logWhatsAppSend } from "@/lib/actions/messaging/log-whatsapp-send"
import { openWhatsApp } from "@/lib/utils/reservation-export-client"

export function SendMessagePanel() {
  const s = useMessagingStore()
  const isWhatsApp = s.channel === "whatsapp"
  const title = isWhatsApp ? "שליחת WhatsApp" : "שליחת אימייל"

  /* ── Load templates when panel opens ─────────────────────── */
  useEffect(() => {
    if (!s.isOpen || !s.tenantId) return
    let cancelled = false
    s.setTemplatesLoading(true)
    s.setError("")
    getReservationTemplates(s.tenantId, s.channel)
      .then((rows) => {
        if (cancelled) return
        s.setTemplates(rows)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        s.setError(err instanceof Error ? err.message : "שגיאה בטעינת תבניות")
      })
      .finally(() => {
        if (!cancelled) s.setTemplatesLoading(false)
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.isOpen, s.tenantId, s.channel])

  /* ── Render selected template ────────────────────────────── */
  const handleTemplateChange = useCallback(async (templateId: string) => {
    s.selectTemplate(templateId)
    if (!templateId) {
      s.setRendered("", "")
      return
    }
    s.setRendering(true)
    s.setError("")
    const res = await renderReservationTemplate(s.tenantId, s.reservationId, templateId)
    s.setRendering(false)
    if (res.success) {
      s.setRendered(res.subject || "", res.body || "")
    } else {
      s.setError(res.error || "שגיאה בעיבוד תבנית")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tenantId, s.reservationId])

  /* ── Send action ─────────────────────────────────────────── */
  const handleSend = useCallback(async () => {
    if (!s.recipient.trim()) {
      s.setError(isWhatsApp ? "חובה למלא מספר טלפון" : "חובה למלא כתובת מייל")
      return
    }
    if (!s.body.trim()) {
      s.setError("חובה למלא תוכן הודעה")
      return
    }
    if (!isWhatsApp && !s.subject.trim()) {
      s.setError("חובה למלא נושא")
      return
    }
    s.setError("")

    if (isWhatsApp) {
      const opened = openWhatsApp(s.recipient, s.body)
      if (!opened) {
        s.setError("מספר טלפון לא תקין")
        return
      }
      await logWhatsAppSend({
        tenantId: s.tenantId,
        templateId: s.selectedTemplateId,
        recipient: s.recipient,
        body: s.body,
      })
      toast.success("הודעת WhatsApp נפתחה")
      s.close()
      return
    }

    s.setSending(true)
    const res = await sendReservationEmailFromTemplate({
      tenantId: s.tenantId,
      reservationId: s.reservationId,
      templateId: s.selectedTemplateId,
      recipient: s.recipient,
      subject: s.subject,
      body: s.body,
    })
    s.setSending(false)
    if (res.success) {
      toast.success("המייל נשלח בהצלחה")
      s.close()
    } else {
      s.setError(res.error || "שליחת המייל נכשלה")
      toast.error(res.error || "שליחת המייל נכשלה")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.recipient, s.subject, s.body, s.tenantId, s.reservationId, s.selectedTemplateId, isWhatsApp])

  const footerEl = (
    <div className="border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between">
      <button
        type="button"
        onClick={s.close}
        className="min-h-[44px] px-4 py-3 text-muted-foreground text-sm hover:text-foreground transition-colors"
      >
        ביטול
      </button>
      <button
        type="button"
        onClick={handleSend}
        disabled={s.isSending || s.isRendering || !s.body.trim()}
        className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {s.isSending ? (
          <>
            <Icon name="hourglass_empty" size="sm" className="animate-spin" />
            שולח...
          </>
        ) : isWhatsApp ? (
          <>
            <Icon name="whatsapp" size="sm" />
            פתח ב-WhatsApp
          </>
        ) : (
          <>
            <Icon name="send" size="sm" />
            שלח מייל
          </>
        )}
      </button>
    </div>
  )

  return (
    <SidePanel
      isOpen={s.isOpen}
      onClose={s.close}
      title={title}
      noPadding
      footer={footerEl}
    >
      <div className="flex flex-col h-full overflow-y-auto p-6 gap-4">
        {/* Template selector */}
        <div className="bg-accent/50 rounded-[20px] p-4 space-y-3">
          <label className="block text-[12px] font-bold text-muted-foreground">בחירת תבנית</label>
          {s.templatesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="hourglass_empty" size="sm" className="animate-spin" />
              טוען תבניות...
            </div>
          ) : s.templates.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              אין תבניות פעילות לערוץ זה. ניתן ליצור תבניות חדשות במודול האוטומציות
              ({isWhatsApp ? "WhatsApp" : "אימייל"} · קטגוריה: הזמנות).
            </div>
          ) : (
            <select
              value={s.selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full bg-card border border-border/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— בחר תבנית —</option>
              {s.templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          {s.isRendering && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="hourglass_empty" size="sm" className="animate-spin" />
              מעבד משתנים...
            </div>
          )}
        </div>

        {/* Recipient */}
        <div className="bg-accent/50 rounded-[20px] p-4 space-y-2">
          <label className="block text-[12px] font-bold text-muted-foreground">
            {isWhatsApp ? "מספר טלפון" : "נמען"}
          </label>
          <input
            type={isWhatsApp ? "tel" : "email"}
            dir="ltr"
            value={s.recipient}
            onChange={(e) => s.setRecipient(e.target.value)}
            className="w-full bg-transparent border-0 border-b border-border/30 px-1 py-2 text-sm focus:outline-none focus:border-primary"
            placeholder={isWhatsApp ? "050-1234567" : "guest@example.com"}
          />
        </div>

        {/* Subject (email only) */}
        {!isWhatsApp && (
          <div className="bg-accent/50 rounded-[20px] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[12px] font-bold text-muted-foreground">נושא</label>
              {s.selectedTemplateId && (
                <button
                  type="button"
                  onClick={s.toggleEditable}
                  className="text-[11px] font-bold text-primary hover:underline"
                >
                  {s.isEditable ? "נעל לעריכה" : "ערוך לפני שליחה"}
                </button>
              )}
            </div>
            <input
              type="text"
              value={s.subject}
              onChange={(e) => s.setSubject(e.target.value)}
              readOnly={!s.isEditable && !!s.selectedTemplateId}
              className="w-full bg-transparent border-0 border-b border-border/30 px-1 py-2 text-sm focus:outline-none focus:border-primary disabled:opacity-60"
              placeholder="נושא ההודעה"
            />
          </div>
        )}

        {/* Body */}
        <div className="bg-accent/50 rounded-[20px] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[12px] font-bold text-muted-foreground">תוכן ההודעה</label>
            {isWhatsApp && s.selectedTemplateId && (
              <button
                type="button"
                onClick={s.toggleEditable}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                {s.isEditable ? "נעל לעריכה" : "ערוך לפני שליחה"}
              </button>
            )}
          </div>
          <textarea
            value={s.body}
            onChange={(e) => s.setBody(e.target.value)}
            readOnly={!s.isEditable && !!s.selectedTemplateId}
            rows={isWhatsApp ? 8 : 12}
            className="w-full bg-card border border-border/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed whitespace-pre-wrap"
            placeholder="בחר תבנית כדי לטעון את התוכן, או הזן הודעה ידנית"
          />
        </div>

        {/* Error */}
        {s.error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
            {s.error}
          </div>
        )}

        {/* WhatsApp note */}
        {isWhatsApp && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
            לחיצה על &quot;פתח ב-WhatsApp&quot; תפתח את WhatsApp עם ההודעה מוכנה. השליחה הסופית תתבצע ידנית מהמכשיר.
          </div>
        )}
      </div>
    </SidePanel>
  )
}
