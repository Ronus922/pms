"use client"

import { useState, useEffect, useCallback } from "react"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { useConfirm } from "@/components/shared/ConfirmDialog"
import { toast } from "sonner"
import { MaintenanceAuditTimeline } from "./MaintenanceAuditTimeline"
import { MaintenanceMediaSection } from "./MaintenanceMediaSection"
import {
  MAINTENANCE_STATUS_MAP,
  MAINTENANCE_PRIORITY_MAP,
  MAINTENANCE_URGENCY_MAP,
  MAINTENANCE_CATEGORY_MAP,
  MAINTENANCE_TARGET_MAP,
  MAINTENANCE_RESOLUTION_MAP,
  MAINTENANCE_STATUS_TRANSITIONS,
} from "@/lib/constants/maintenance"
import {
  getMaintenanceTask,
  getMaintenanceAuditLog,
  getMaintenanceTaskMedia,
  changeMaintenanceStatus,
  reopenMaintenanceTask,
  updateMaintenanceTask,
  addMaintenanceMedia,
  removeMaintenanceMedia,
  deleteMaintenanceTask,
  getMaintenanceWorkers,
  getRoomsForPicker,
} from "@/lib/actions/maintenance"
import type {
  MaintenanceTask,
  MaintenanceAuditEntry,
  MaintenanceTaskMedia,
  MaintenanceWorkerSummary,
  MaintenanceStatus,
  MaintenanceMediaPhase,
} from "@/lib/types/maintenance"

interface MaintenanceDetailPanelProps {
  isOpen: boolean
  onClose: () => void
  taskId: string | null
  tenantId: string
  userId: string
  userName: string
  canEdit: boolean
  isManager: boolean
  onUpdated: () => void
}

function fmtDate(v: string | null): string {
  if (!v) return "—"
  const d = new Date(v)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

export function MaintenanceDetailPanel({
  isOpen,
  onClose,
  taskId,
  tenantId,
  userId,
  userName,
  canEdit,
  isManager,
  onUpdated,
}: MaintenanceDetailPanelProps) {
  const [tab, setTab] = useState<"details" | "media" | "history">("details")
  const [task, setTask] = useState<MaintenanceTask | null>(null)
  const [audit, setAudit] = useState<MaintenanceAuditEntry[]>([])
  const [media, setMedia] = useState<MaintenanceTaskMedia[]>([])
  const [workers, setWorkers] = useState<MaintenanceWorkerSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Edit state
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [resolutionCode, setResolutionCode] = useState("")

  const reload = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    const [t, a, m, w] = await Promise.all([
      getMaintenanceTask(tenantId, taskId),
      getMaintenanceAuditLog(tenantId, taskId),
      getMaintenanceTaskMedia(tenantId, taskId),
      getMaintenanceWorkers(tenantId),
    ])
    setTask(t)
    setAudit(a)
    setMedia(m)
    setWorkers(w)
    setResolutionNotes(t?.resolution_notes ?? "")
    setResolutionCode(t?.resolution_code ?? "")
    setLoading(false)
  }, [taskId, tenantId])

  useEffect(() => {
    if (isOpen && taskId) reload()
  }, [isOpen, taskId, reload])

  const handleStatusChange = async (newStatus: MaintenanceStatus) => {
    if (!task) return
    setBusy(true)
    const result = await changeMaintenanceStatus(
      tenantId,
      task.id,
      newStatus,
      userId,
      userName,
      newStatus === "resolved" ? resolutionNotes : undefined,
      newStatus === "resolved" ? resolutionCode : undefined,
    )
    setBusy(false)
    if (result.success) {
      toast.success("הסטטוס עודכן")
      await reload()
      onUpdated()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  const handleReopen = async () => {
    if (!task) return
    setBusy(true)
    const result = await reopenMaintenanceTask(tenantId, task.id, userId, userName)
    setBusy(false)
    if (result.success) {
      toast.success("המשימה נפתחה מחדש")
      await reload()
      onUpdated()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  const handleAssign = async (workerId: string) => {
    if (!task) return
    setBusy(true)
    const result = await updateMaintenanceTask(
      tenantId,
      task.id,
      { assigned_to: workerId || null },
      userId,
      userName,
    )
    setBusy(false)
    if (result.success) {
      toast.success("העובד עודכן")
      await reload()
      onUpdated()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  const handleUpload = async (files: File[], phase: MaintenanceMediaPhase) => {
    if (!task) return
    setUploading(true)
    // For now, create object URLs (in production, upload to Supabase storage first)
    const fileData = files.map((f) => ({
      url: URL.createObjectURL(f),
      name: f.name,
      mime: f.type,
      size: f.size,
    }))
    const result = await addMaintenanceMedia(tenantId, task.id, fileData, phase, userId, userName)
    setUploading(false)
    if (result.success) {
      toast.success("הקבצים הועלו")
      await reload()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  const handleRemoveMedia = async (mediaId: string) => {
    const result = await removeMaintenanceMedia(tenantId, mediaId, userId, userName)
    if (result.success) {
      toast.success("הקובץ הוסר")
      await reload()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  const { confirm, confirmDialog } = useConfirm()

  const handleDelete = async () => {
    if (!task) return
    if (!(await confirm({ message: "למחוק את המשימה?", danger: true, confirmLabel: "מחק" }))) return
    setBusy(true)
    const result = await deleteMaintenanceTask(tenantId, task.id, userId, userName)
    setBusy(false)
    if (result.success) {
      toast.success("המשימה נמחקה")
      onUpdated()
      onClose()
    } else {
      toast.error(result.error ?? "שגיאה")
    }
  }

  if (!taskId) return null

  const statusVis = task ? MAINTENANCE_STATUS_MAP[task.status] : null
  const allowedTransitions = task ? MAINTENANCE_STATUS_TRANSITIONS[task.status] ?? [] : []
  const canReopen = task && isManager && (task.status === "resolved" || task.status === "cancelled")

  const tabs = [
    { key: "details" as const, label: "פרטים", icon: "description" },
    { key: "media" as const, label: "תמונות", icon: "photo_camera", count: media.length },
    { key: "history" as const, label: "היסטוריה", icon: "history", count: audit.length },
  ]

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={task ? `תקלה #${task.task_number}` : "טוען..."}
      subtitle={task?.title ?? ""}
      footer={
        canEdit && task ? (
          <div className="flex items-center gap-3 justify-between">
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="px-4 py-2.5 text-sm font-medium text-red-600 hover:text-red-700 transition-colors rounded-xl min-h-[44px]"
            >
              <Icon name="delete" size="sm" />
            </button>
            <div className="flex items-center gap-2 ms-auto">
              {canReopen && (
                <button
                  type="button"
                  onClick={handleReopen}
                  disabled={busy}
                  className="px-4 py-2.5 text-sm font-bold text-amber-600 border border-amber-300 rounded-xl hover:bg-amber-50 transition-colors min-h-[44px]"
                >
                  פתח מחדש
                </button>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : task ? (
        <>
          {/* Tabs — Azure Ethos Subtle Card (Variation 3) */}
          <div className="mb-5 flex justify-end">
            <div className="inline-flex bg-accent p-1 rounded-xl flex-wrap" dir="rtl">
              {tabs.map((t) => {
                const active = tab === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 min-h-[40px] ${
                      active
                        ? "bg-card text-primary shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                        : "text-muted-foreground hover:text-primary font-medium"
                    }`}
                  >
                    <Icon name={t.icon} size="sm" />
                    {t.label}
                    {t.count != null && t.count > 0 && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${active ? "bg-primary/10 text-primary" : "bg-card text-muted-foreground"}`}>
                        {t.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {tab === "details" && (
            <div className="space-y-4">
              {/* Recurring task banner */}
              {task.is_recurring && (
                <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 rounded-xl text-sm border border-primary/10">
                  <Icon name="repeat" size="sm" className="text-primary" />
                  <span className="font-bold text-primary">משימה חוזרת</span>
                  {canEdit && task.recurrence_rule_id && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !(await confirm({
                            message: "לבטל את החזרתיות? משימות שכבר נוצרו לא ימחקו.",
                            confirmLabel: "בטל חזרתיות",
                          }))
                        )
                          return
                        const { deactivateRecurrenceRule } = await import("@/lib/actions/maintenance")
                        const result = await deactivateRecurrenceRule(tenantId, task.recurrence_rule_id!)
                        if (result.success) {
                          toast.success("החזרתיות בוטלה")
                          await reload()
                          onUpdated()
                        } else {
                          toast.error(result.error ?? "שגיאה")
                        }
                      }}
                      className="ms-auto text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                    >
                      בטל חזרתיות
                    </button>
                  )}
                </div>
              )}

              {/* Status bar with actions */}
              <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-bold">סטטוס:</span>
                  {statusVis && (
                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${statusVis.bg} ${statusVis.text} ${statusVis.border}`}>
                      {statusVis.label}
                    </span>
                  )}
                </div>
                {canEdit && allowedTransitions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {allowedTransitions
                      .filter((s) => s !== "open") // reopen has separate button
                      .map((s) => {
                        const vis = MAINTENANCE_STATUS_MAP[s]
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleStatusChange(s)}
                            disabled={busy}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all min-h-[36px] ${vis.bg} ${vis.text} ${vis.border} hover:opacity-80`}
                          >
                            {vis.label}
                          </button>
                        )
                      })}
                  </div>
                )}
              </div>

              {/* Resolution fields when resolving */}
              {task.status === "in_progress" && canEdit && (
                <div className="bg-card rounded-[20px] p-5 shadow-sm border border-emerald-200 space-y-3">
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">לסגירת התקלה:</div>
                  <select
                    value={resolutionCode}
                    onChange={(e) => setResolutionCode(e.target.value)}
                    className="w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm text-right min-h-[48px]"
                  >
                    <option value="">קוד פתרון</option>
                    {Object.entries(MAINTENANCE_RESOLUTION_MAP).map(([key, vis]) => (
                      <option key={key} value={key}>{vis.label}</option>
                    ))}
                  </select>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="הערות פתרון..."
                    rows={2}
                    className="w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm text-right resize-none min-h-[48px] outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="עדיפות" value={MAINTENANCE_PRIORITY_MAP[task.priority].label} />
                <InfoCard label="דחיפות" value={MAINTENANCE_URGENCY_MAP[task.urgency_level].label} />
                <InfoCard label="קטגוריה" value={MAINTENANCE_CATEGORY_MAP[task.issue_category].label} />
                <InfoCard label="יעד" value={MAINTENANCE_TARGET_MAP[task.target_type].label} />
                <InfoCard label="מיקום" value={task.room_number ? `חדר ${task.room_number}` : task.target_label} />
                <InfoCard label="תאריך מתוכנן" value={fmtDate(task.scheduled_date)} />
                {task.scheduled_time_from && (
                  <InfoCard label="שעה" value={`${task.scheduled_time_from.slice(0, 5)}${task.scheduled_time_to ? ` - ${task.scheduled_time_to.slice(0, 5)}` : ""}`} />
                )}
                <InfoCard label="דווח על ידי" value={task.reported_by_name ?? "—"} />
                <InfoCard label="דווח ב" value={fmtDate(task.reported_at)} />
                {task.reopened_count > 0 && (
                  <InfoCard label="נפתח מחדש" value={`${task.reopened_count} פעמים`} />
                )}
              </div>

              {/* Assignment */}
              <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
                <label className="block text-xs font-bold text-muted-foreground mb-2">עובד מטפל</label>
                {canEdit ? (
                  <select
                    value={task.assigned_to ?? ""}
                    onChange={(e) => handleAssign(e.target.value)}
                    disabled={busy}
                    className="w-full bg-accent border-0 rounded-xl px-5 py-3.5 text-sm text-right min-h-[48px]"
                  >
                    <option value="">לא משויך</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>{w.full_name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm">{task.assigned_to_name ?? "לא משויך"}</p>
                )}
              </div>

              {/* Description */}
              <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20">
                <h4 className="text-sm font-bold text-foreground mb-2">תיאור</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description || "—"}</p>
              </div>

              {/* Access notes */}
              {task.access_notes && (
                <div className="p-4 rounded-[16px] bg-amber-50 dark:bg-amber-950/10 border border-amber-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="key" size="sm" className="text-amber-600" />
                    <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400">הערות גישה</h4>
                  </div>
                  <p className="text-sm text-amber-600 dark:text-amber-400">{task.access_notes}</p>
                </div>
              )}

              {/* Resolution */}
              {task.resolution_notes && (
                <div className="p-4 rounded-[16px] bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-200">
                  <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1">הערות פתרון</h4>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{task.resolution_notes}</p>
                  {task.resolution_code && (
                    <p className="text-[11px] text-emerald-500 mt-1">
                      קוד: {MAINTENANCE_RESOLUTION_MAP[task.resolution_code]?.label ?? task.resolution_code}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "media" && (
            <MaintenanceMediaSection
              media={media}
              onUpload={handleUpload}
              onRemove={canEdit ? handleRemoveMedia : undefined}
              canEdit={canEdit}
              uploading={uploading}
            />
          )}

          {tab === "history" && (
            <MaintenanceAuditTimeline entries={audit} loading={loading} />
          )}
          {confirmDialog}
        </>
      ) : (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <p>משימה לא נמצאה</p>
        </div>
      )}
    </SidePanel>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-accent">
      <div className="text-[11px] text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm font-bold text-foreground truncate">{value}</div>
    </div>
  )
}
