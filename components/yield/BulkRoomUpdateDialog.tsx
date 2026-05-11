"use client"

import { Icon } from "@/components/shared/Icon"
import { SidePanel } from "@/components/shared/SidePanel"
import {
  useBulkRoomUpdate,
  type BulkApplyResult,
} from "@/lib/hooks/use-bulk-room-update"

import { DatesSection } from "./bulk-update/DatesSection"
import { FieldsSection } from "./bulk-update/FieldsSection"
import { RoomsSection } from "./bulk-update/RoomsSection"
import { PreviewSection } from "./bulk-update/PreviewSection"

interface Props {
  isOpen: boolean
  onClose: () => void
  /**
   * Fired ONLY after a successful DB save. Receives the row counts so the
   * caller can display "העדכון נשמר בהצלחה במערכת" + the affected-records
   * figure AND then trigger auto channel sync separately.
   */
  onApplied?: (result: BulkApplyResult) => void
  /** Rooms that should be pre-selected when the dialog opens. */
  preselectedRoomIds?: string[]
}

export function BulkRoomUpdateDialog({
  isOpen,
  onClose,
  onApplied,
  preselectedRoomIds,
}: Props) {
  const bulk = useBulkRoomUpdate({ isOpen, onApplied, preselectedRoomIds })

  const footer = (
    <div className="bg-card/80 backdrop-blur-lg border-t border-border/10 px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Icon name="bed" size="sm" />
          {bulk.scope.roomIds.length} חדרים
        </span>
        <span className="flex items-center gap-1">
          <Icon name="calendar_month" size="sm" />
          {bulk.scope.dateFrom} – {bulk.scope.dateTo}
        </span>
        {bulk.preview && (
          <span className="flex items-center gap-1">
            <Icon name="edit" size="sm" />
            {bulk.preview.affectedRecords} רשומות
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-outline"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={bulk.runPreview}
          disabled={bulk.previewLoading || bulk.hasBlockingLive}
          className="btn btn-outline"
        >
          <Icon name="visibility" size="sm" />
          תצוגה מקדימה
        </button>
        <button
          type="button"
          onClick={bulk.apply}
          disabled={bulk.applying || bulk.hasBlockingLive}
          className="btn btn-primary"
        >
          <Icon name={bulk.applying ? "hourglass_empty" : "check_circle"} size="sm" />
          {bulk.applying ? "מעדכן..." : "עדכן"}
        </button>
      </div>
    </div>
  )

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="עדכון חדרים קבוצתי"
      subtitle="עדכון מחיר, זמינות ומגבלות לילות במספר חדרים ותאריכים"
      widthClass="w-[95vw] max-w-[1100px] max-sm:w-full max-sm:max-w-none"
      footer={footer}
      noPadding
    >
      <div className="h-full flex flex-col overflow-hidden">
        {bulk.loadingData ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Icon name="hourglass_empty" size="xl" className="opacity-30" />
              <span className="text-xs">טוען חדרים...</span>
            </div>
          </div>
        ) : bulk.dataError ? (
          <div className="flex-1 flex items-center justify-center text-destructive">
            <div className="flex flex-col items-center gap-2">
              <Icon name="error" size="xl" />
              <span className="text-xs font-bold">{bulk.dataError}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
            <DatesSection
              scope={bulk.scope}
              setScope={bulk.setScope}
              toggleWeekday={bulk.toggleWeekday}
              selectAllWeekdays={bulk.selectAllWeekdays}
              clearWeekdays={bulk.clearWeekdays}
            />

            <FieldsSection fields={bulk.fields} setFields={bulk.setFields} />

            <RoomsSection
              formData={bulk.formData}
              filteredRooms={bulk.filteredRooms}
              scope={bulk.scope}
              filters={bulk.filters}
              setFilters={bulk.setFilters}
              toggleRoom={bulk.toggleRoom}
              selectAllFilteredRooms={bulk.selectAllFilteredRooms}
              clearRoomSelection={bulk.clearRoomSelection}
            />

            <PreviewSection
              preview={bulk.preview}
              previewLoading={bulk.previewLoading}
              onRunPreview={bulk.runPreview}
            />
          </div>
        )}
      </div>
    </SidePanel>
  )
}
