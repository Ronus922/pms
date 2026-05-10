"use client"

import { RateGrid } from "@/components/yield/rate-grid/RateGrid"

export default function BulkUpdatePage() {
  return (
    <div className="space-y-5 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] max-sm:text-[22px] font-extrabold font-headline text-foreground">
            רשת תעריפים
          </h1>
          <p className="text-sm text-muted-foreground">
            מחירים, מגבלות לילות וזמינות לכל חדר ותאריך. לחיצה על תא — עריכה
            ישירה. כפתור עדכון קבוצתי — לשינוי רבים בבת אחת.
          </p>
        </div>
      </div>

      <RateGrid />
    </div>
  )
}
