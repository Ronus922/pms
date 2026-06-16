"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Icon } from "@/components/shared/Icon"
import { useTenant } from "@/lib/hooks/use-tenant"
import { createClientSupabase } from "@/lib/supabase/client"
import {
  getRoomsForPicker,
  getMaintenanceWorkers,
} from "@/lib/actions/maintenance"
import {
  addMaintenanceMediaAsReporter,
  canCurrentUserAssignMaintenance,
  createMaintenanceUploadTargets,
  reportMaintenanceIssue,
} from "@/lib/actions/maintenance-report"
import { getAreasForPicker } from "@/lib/actions/areas"
import type {
  MaintenanceTaskCreateInput,
  MaintenancePriority,
} from "@/lib/types/maintenance"

const BUCKET = "maintenance-media"
const MAX_IMAGES = 5
const MAX_VIDEOS = 3

type LocationType = "room" | "area" | "other"

interface RoomPick {
  id: string
  room_number: string
}
interface AreaPick {
  id: string
  name: string
}
interface WorkerPick {
  id: string
  full_name: string
}

const URGENCY_OPTIONS: Array<{ value: MaintenancePriority; label: string }> = [
  { value: "low", label: "נמוכה" },
  { value: "medium", label: "בינונית" },
  { value: "high", label: "גבוהה" },
  { value: "critical", label: "קריטית" },
]

function deriveTitle(description: string): string {
  const trimmed = description.trim()
  if (trimmed.length <= 60) return trimmed
  const cut = trimmed.slice(0, 60)
  const lastSpace = cut.lastIndexOf(" ")
  return lastSpace > 30 ? cut.slice(0, lastSpace) : cut
}

export default function MaintenanceReportPage() {
  const router = useRouter()
  const { tenantId } = useTenant()

  // Form state
  const [locationType, setLocationType] = useState<LocationType>("room")
  const [roomId, setRoomId] = useState<string>("")
  const [areaId, setAreaId] = useState<string>("")
  const [locationLabel, setLocationLabel] = useState<string>("")
  const [priority, setPriority] = useState<MaintenancePriority>("medium")
  const [description, setDescription] = useState<string>("")
  const [images, setImages] = useState<File[]>([])
  const [videos, setVideos] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [videoPreviews, setVideoPreviews] = useState<string[]>([])
  const [assignedTo, setAssignedTo] = useState<string>("")

  // Reference data
  const [rooms, setRooms] = useState<RoomPick[]>([])
  const [areas, setAreas] = useState<AreaPick[]>([])
  const [workers, setWorkers] = useState<WorkerPick[]>([])
  const [canAssign, setCanAssign] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  // Hidden file inputs
  const galleryImgRef = useRef<HTMLInputElement>(null)
  const cameraImgRef = useRef<HTMLInputElement>(null)
  const galleryVidRef = useRef<HTMLInputElement>(null)
  const cameraVidRef = useRef<HTMLInputElement>(null)

  // Load reference data
  useEffect(() => {
    let cancelled = false
    Promise.all([
      getRoomsForPicker(tenantId),
      getAreasForPicker(tenantId, { maintenanceRelevant: true }),
      canCurrentUserAssignMaintenance(),
    ]).then(async ([roomList, areaList, mayAssign]) => {
      if (cancelled) return
      setRooms(roomList.map((r) => ({ id: r.id, room_number: r.room_number })))
      setAreas(areaList.map((a) => ({ id: a.id, name: a.name })))
      setCanAssign(mayAssign)
      if (mayAssign) {
        const workerList = await getMaintenanceWorkers(tenantId)
        if (!cancelled) {
          setWorkers(workerList.map((w) => ({ id: w.id, full_name: w.full_name })))
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  // Revoke preview URLs on unmount
  useEffect(() => {
    return () => {
      imagePreviews.forEach((u) => URL.revokeObjectURL(u))
      videoPreviews.forEach((u) => URL.revokeObjectURL(u))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addImages = useCallback(
    (files: FileList | null) => {
      if (!files) return
      const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"))
      const room = MAX_IMAGES - images.length
      const accepted = incoming.slice(0, Math.max(0, room))
      if (incoming.length > accepted.length) {
        toast.error(`ניתן להעלות עד ${MAX_IMAGES} תמונות`)
      }
      const previews = accepted.map((f) => URL.createObjectURL(f))
      setImages((prev) => [...prev, ...accepted])
      setImagePreviews((prev) => [...prev, ...previews])
    },
    [images.length],
  )

  const addVideos = useCallback(
    (files: FileList | null) => {
      if (!files) return
      const incoming = Array.from(files).filter((f) => f.type.startsWith("video/"))
      const room = MAX_VIDEOS - videos.length
      const accepted = incoming.slice(0, Math.max(0, room))
      if (incoming.length > accepted.length) {
        toast.error(`ניתן להעלות עד ${MAX_VIDEOS} סרטונים`)
      }
      const previews = accepted.map((f) => URL.createObjectURL(f))
      setVideos((prev) => [...prev, ...accepted])
      setVideoPreviews((prev) => [...prev, ...previews])
    },
    [videos.length],
  )

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx])
    setImages((prev) => prev.filter((_, i) => i !== idx))
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const removeVideo = (idx: number) => {
    URL.revokeObjectURL(videoPreviews[idx])
    setVideos((prev) => prev.filter((_, i) => i !== idx))
    setVideoPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    // Local validation
    if (description.trim().length < 3) {
      toast.error("חובה לרשום תיאור (לפחות 3 תווים)")
      return
    }
    if (locationType === "room" && !roomId) {
      toast.error("בחר מספר חדר")
      return
    }
    if (locationType === "area" && !areaId) {
      toast.error("בחר אזור")
      return
    }
    if (locationType === "other" && locationLabel.trim().length === 0) {
      toast.error("רשום תיאור מיקום")
      return
    }

    setSubmitting(true)
    try {
      const room = rooms.find((r) => r.id === roomId)
      const area = areas.find((a) => a.id === areaId)

      let targetType: "room" | "area" | "equipment"
      let targetId: string | undefined
      let targetLabel: string
      let roomNumber: string | undefined

      if (locationType === "room") {
        targetType = "room"
        targetId = roomId
        roomNumber = room?.room_number
        targetLabel = `חדר ${room?.room_number ?? ""}`.trim()
      } else if (locationType === "area") {
        targetType = "area"
        targetId = areaId
        targetLabel = area?.name ?? "אזור"
      } else {
        targetType = "equipment"
        targetId = undefined
        targetLabel = locationLabel.trim()
      }

      const input: MaintenanceTaskCreateInput = {
        source_type: "staff_report",
        target_type: targetType,
        target_id: targetId,
        target_label: targetLabel,
        room_number: roomNumber,
        issue_category: "general",
        title: deriveTitle(description),
        description: description.trim(),
        priority,
        urgency_level: "normal",
        assigned_to: canAssign && assignedTo ? assignedTo : undefined,
      }

      const res = await reportMaintenanceIssue(input)
      if (!res.success || !res.taskId) {
        toast.error(res.error ?? "שגיאה ביצירת התקלה")
        setSubmitting(false)
        return
      }

      const allFiles = [...images, ...videos]
      if (allFiles.length > 0) {
        const planned = allFiles.map((f) => ({
          media_type: (f.type.startsWith("video/") ? "video" : "image") as
            | "image"
            | "video",
          mime_type: f.type,
        }))

        const targetsRes = await createMaintenanceUploadTargets(res.taskId, planned)
        if (!targetsRes.success || !targetsRes.targets) {
          toast.error(targetsRes.error ?? "שגיאה ביצירת קישורי העלאה")
          setSubmitting(false)
          return
        }

        const supabase = createClientSupabase()
        for (const target of targetsRes.targets) {
          const file = allFiles[target.index]
          const { error } = await supabase.storage
            .from(BUCKET)
            .uploadToSignedUrl(target.storage_path, target.token, file)
          if (error) {
            toast.error(`שגיאה בהעלאת קובץ: ${error.message}`)
            setSubmitting(false)
            return
          }
        }

        const mediaPayload = targetsRes.targets.map((t) => ({
          url: t.storage_path,
          name: allFiles[t.index].name,
          mime: allFiles[t.index].type,
          size: allFiles[t.index].size,
        }))
        const mediaRes = await addMaintenanceMediaAsReporter(
          res.taskId,
          mediaPayload,
          "general",
        )
        if (!mediaRes.success) {
          toast.error(mediaRes.error ?? "שגיאה בשמירת מדיה")
        }
      }

      toast.success("הדיווח נשלח בהצלחה")
      router.back()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשליחה")
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-l from-[#1e40af] to-[#3F51B5] px-3 py-2.5 shadow-md">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
            aria-label="חזרה"
          >
            <Icon name="chevron_right" size="sm" className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white font-headline">דיווח על תקלה</h1>
            <p className="text-[11px] text-white opacity-85">פתיחת קריאת שירות</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="build" size="sm" className="text-white" />
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        <div className="bg-card rounded-2xl p-5 border border-border/20 space-y-5">
          {/* Location type */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-foreground">סוג מיקום *</label>
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value as LocationType)}
              className="w-full min-h-[48px] px-3 py-2 bg-accent border border-border/40 rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
            >
              <option value="room">חדר</option>
              <option value="area">אזור</option>
              <option value="other">אחר</option>
            </select>
          </div>

          {/* Room picker */}
          {locationType === "room" && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground">מספר חדר *</label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full min-h-[48px] px-3 py-2 bg-accent border border-border/40 rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              >
                <option value="">בחר חדר...</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Area picker */}
          {locationType === "area" && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground">אזור *</label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full min-h-[48px] px-3 py-2 bg-accent border border-border/40 rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              >
                <option value="">בחר אזור...</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Other location label */}
          {locationType === "other" && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground">תיאור מיקום *</label>
              <input
                type="text"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value.slice(0, 120))}
                placeholder="לדוגמה: לובי, חניון"
                maxLength={120}
                className="w-full min-h-[48px] px-3 py-2 bg-accent border border-border/40 rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          {/* Urgency */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-foreground">דחיפות *</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as MaintenancePriority)}
              className="w-full min-h-[48px] px-3 py-2 bg-accent border border-border/40 rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
            >
              {URGENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-foreground">תיאור התקלה *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              placeholder="תאר את התקלה בפירוט... מה הבעיה? איפה בדיוק?"
              rows={5}
              className="w-full px-3 py-3 bg-accent border border-border/40 rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
            />
            <div className="text-[10px] text-muted-foreground text-end tabular-nums">
              {description.length} / 2000
            </div>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-foreground">תמונות (עד 5 תמונות)</h3>
              <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                {images.length}/{MAX_IMAGES} תמונות
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => galleryImgRef.current?.click()}
                disabled={images.length >= MAX_IMAGES}
                className="min-h-[96px] rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/10 flex flex-col items-center justify-center gap-1.5 transition-colors hover:bg-emerald-50 disabled:opacity-40"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Icon name="upload" size="md" className="text-emerald-600" />
                </div>
                <span className="text-[12px] font-bold text-emerald-700">בחר מגלריה</span>
              </button>
              <button
                type="button"
                onClick={() => cameraImgRef.current?.click()}
                disabled={images.length >= MAX_IMAGES}
                className="min-h-[96px] rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 dark:bg-blue-950/10 flex flex-col items-center justify-center gap-1.5 transition-colors hover:bg-blue-50 disabled:opacity-40"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <Icon name="photo_camera" size="md" className="text-blue-600" />
                </div>
                <span className="text-[12px] font-bold text-blue-700">צלם תמונה</span>
                <span className="text-[10px] text-blue-600/80">פתח מצלמה</span>
              </button>
            </div>
            <input
              ref={galleryImgRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addImages(e.target.files)
                e.target.value = ""
              }}
            />
            <input
              ref={cameraImgRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                addImages(e.target.files)
                e.target.value = ""
              }}
            />
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {imagePreviews.map((src, idx) => (
                  <div
                    key={src}
                    className="relative aspect-square rounded-xl overflow-hidden border border-border/20"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                      aria-label="הסר תמונה"
                    >
                      <Icon name="close" size="sm" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Videos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-foreground">סרטונים (עד 3 סרטונים)</h3>
              <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                {videos.length}/{MAX_VIDEOS} סרטונים
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => galleryVidRef.current?.click()}
                disabled={videos.length >= MAX_VIDEOS}
                className="min-h-[96px] rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/50 dark:bg-purple-950/10 flex flex-col items-center justify-center gap-1.5 transition-colors hover:bg-purple-50 disabled:opacity-40"
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/15 flex items-center justify-center">
                  <Icon name="upload" size="md" className="text-purple-600" />
                </div>
                <span className="text-[12px] font-bold text-purple-700">בחר וידאו</span>
              </button>
              <button
                type="button"
                onClick={() => cameraVidRef.current?.click()}
                disabled={videos.length >= MAX_VIDEOS}
                className="min-h-[96px] rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50/50 dark:bg-rose-950/10 flex flex-col items-center justify-center gap-1.5 transition-colors hover:bg-rose-50 disabled:opacity-40"
              >
                <div className="w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center">
                  <Icon name="videocam" size="md" className="text-rose-600" />
                </div>
                <span className="text-[12px] font-bold text-rose-700">צלם וידאו</span>
                <span className="text-[10px] text-rose-600/80">פתח מצלמה</span>
              </button>
            </div>
            <input
              ref={galleryVidRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addVideos(e.target.files)
                e.target.value = ""
              }}
            />
            <input
              ref={cameraVidRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                addVideos(e.target.files)
                e.target.value = ""
              }}
            />
            {videoPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {videoPreviews.map((src, idx) => (
                  <div
                    key={src}
                    className="relative aspect-square rounded-xl overflow-hidden border border-border/20 bg-black"
                  >
                    <video src={src} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeVideo(idx)}
                      className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                      aria-label="הסר סרטון"
                    >
                      <Icon name="close" size="sm" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assign to (admin / can_assign only) */}
          {canAssign && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground">שיוך לעובד</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full min-h-[48px] px-3 py-2 bg-accent border border-border/40 rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
              >
                <option value="">ללא — ממתין לשיבוץ</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Submit row */}
        <div className="grid grid-cols-2 gap-2 pt-2 pb-8">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={submitting}
            className="min-h-[48px] rounded-xl border-2 border-border/40 bg-accent/30 font-bold text-sm disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="min-h-[48px] rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-sm shadow-md disabled:opacity-50"
          >
            {submitting ? "שולח..." : "שלח דיווח"}
          </button>
        </div>
      </main>
    </div>
  )
}
