"use client"

import { useMemo } from "react"
import type { RoomFormStore } from "@/lib/stores/room-form-store"
import { LanguageSwitcher } from "@/components/rooms/shared/LanguageSwitcher"
import { RichTextEditor } from "@/components/rooms/shared/RichTextEditor"

interface LanguagesTabProps {
  store: RoomFormStore
}

export function LanguagesTab({ store }: LanguagesTabProps) {
  const currentTranslation = store.translations[store.currentLanguage] ?? {
    room_name: "",
    description_html: "",
    meta_search_summary: "",
    seo_title: "",
    seo_description: "",
  }

  const completionStatus = useMemo(() => {
    const status: Record<string, "complete" | "partial" | "missing"> = {}
    for (const [lang, t] of Object.entries(store.translations)) {
      const hasName = t.room_name.trim().length > 0
      const hasSummary = t.meta_search_summary.trim().length > 0
      if (hasName && hasSummary) {
        status[lang] = "complete"
      } else if (hasName || hasSummary) {
        status[lang] = "partial"
      } else {
        status[lang] = "missing"
      }
    }
    return status
  }, [store.translations])

  const summaryLength = currentTranslation.meta_search_summary.length
  const summaryInRange = summaryLength >= 80 && summaryLength <= 140
  const summaryTooShort = summaryLength > 0 && summaryLength < 80
  const summaryTooLong = summaryLength > 140

  return (
    <div className="space-y-4" dir="rtl">
      <LanguageSwitcher
        currentLanguage={store.currentLanguage}
        onLanguageChange={store.setCurrentLanguage}
        completionStatus={completionStatus}
      />

      <div className="rounded-[20px] p-5 border border-border/20 shadow-sm space-y-4">
        {/* room_name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">שם החדר</label>
          <input
            type="text"
            value={currentTranslation.room_name}
            onChange={(e) =>
              store.setTranslation(store.currentLanguage, "room_name", e.target.value)
            }
            placeholder="לדוגמה: סוויטת דלקס עם נוף לים"
            className="w-full rounded-xl border border-border/40 bg-accent min-h-[48px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* description_html */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">תיאור החדר</label>
          <RichTextEditor
            content={currentTranslation.description_html}
            onChange={(val) =>
              store.setTranslation(store.currentLanguage, "description_html", val)
            }
            placeholder="תאר את החדר, האווירה והחוויה..."
          />
        </div>

        {/* meta_search_summary */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">תקציר למנועי חיפוש</label>
          <textarea
            value={currentTranslation.meta_search_summary}
            onChange={(e) =>
              store.setTranslation(
                store.currentLanguage,
                "meta_search_summary",
                e.target.value
              )
            }
            placeholder="תיאור קצר שיופיע בתוצאות חיפוש (80-140 תווים)"
            rows={3}
            className="w-full rounded-xl border border-border/40 bg-accent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <div className="flex items-center justify-between">
            <div>
              {summaryTooShort && (
                <p className="text-xs text-amber-500">קצר מדי - מומלץ לפחות 80 תווים</p>
              )}
              {summaryTooLong && (
                <p className="text-xs text-amber-500">ארוך מדי - מומלץ עד 140 תווים</p>
              )}
              {summaryInRange && (
                <p className="text-xs text-emerald-500">אורך מיטבי</p>
              )}
            </div>
            <span
              className={`text-xs tabular-nums ${
                summaryInRange
                  ? "text-emerald-500"
                  : summaryLength === 0
                    ? "text-muted-foreground"
                    : "text-amber-500"
              }`}
            >
              {summaryLength}/140
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
