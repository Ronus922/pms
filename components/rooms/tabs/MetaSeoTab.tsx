"use client"

import type { RoomFormStore } from "@/lib/stores/room-form-store"

interface MetaSeoTabProps {
  store: RoomFormStore
}

export function MetaSeoTab({ store }: MetaSeoTabProps) {
  const currentTranslation = store.translations[store.currentLanguage] ?? {
    room_name: "",
    description_html: "",
    meta_search_summary: "",
    seo_title: "",
    seo_description: "",
  }

  const previewTitle = currentTranslation.seo_title || currentTranslation.room_name || "כותרת החדר"
  const previewDescription =
    currentTranslation.seo_description ||
    currentTranslation.meta_search_summary ||
    "תיאור החדר יופיע כאן..."
  const previewUrl = `guesthub.com/rooms/${store.room_number || "000"}`

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-[20px] p-5 border border-border/20 shadow-sm space-y-4">
        {/* seo_title */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">כותרת SEO</label>
          <input
            type="text"
            value={currentTranslation.seo_title}
            onChange={(e) =>
              store.setTranslation(store.currentLanguage, "seo_title", e.target.value)
            }
            placeholder={currentTranslation.room_name || "כותרת לתוצאות חיפוש"}
            className="w-full rounded-xl border border-border/40 bg-accent min-h-[48px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-xs text-muted-foreground">
            {currentTranslation.seo_title.length}/60 תווים
          </p>
        </div>

        {/* seo_description */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">תיאור SEO</label>
          <textarea
            value={currentTranslation.seo_description}
            onChange={(e) =>
              store.setTranslation(store.currentLanguage, "seo_description", e.target.value)
            }
            placeholder={currentTranslation.meta_search_summary || "תיאור מפורט יותר לתוצאות חיפוש"}
            rows={3}
            className="w-full rounded-xl border border-border/40 bg-accent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {currentTranslation.seo_description.length}/160 תווים
          </p>
        </div>
      </div>

      {/* Google-style preview */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-muted-foreground">תצוגה מקדימה בגוגל</label>
        <div className="rounded-[20px] p-5 border border-border/20 shadow-sm bg-white dark:bg-card">
          <div className="space-y-1" dir="ltr">
            {/* URL line */}
            <div className="flex items-center gap-1.5">
              <span className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-muted-foreground">
                G
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{previewUrl}</p>
              </div>
            </div>
            {/* Title */}
            <p className="text-lg text-[#1a0dab] dark:text-blue-400 font-medium leading-snug hover:underline cursor-default">
              {previewTitle}
            </p>
            {/* Description */}
            <p className="text-sm text-[#545454] dark:text-muted-foreground leading-relaxed line-clamp-2">
              {previewDescription}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
