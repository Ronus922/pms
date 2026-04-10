"use client"

import { useEffect, useCallback, useState, useRef, useMemo } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TiptapLink from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { SidePanel } from "@/components/shared/SidePanel"
import { Icon } from "@/components/shared/Icon"
import { FormField, inputClass, selectClass, textareaClass } from "@/components/shared/FormField"
import { NumberStepper } from "@/components/shared/NumberStepper"
import { useRoomFormStore, type RoomFormStore, type RoomTranslation, type RoomImage } from "@/lib/stores/room-form-store"
import { useTenant } from "@/lib/hooks/use-tenant"
import {
  getRoomFormOptions,
  getRoomById,
  createRoom,
  updateRoom,
  getEquipmentList,
  type RoomTypeOption,
  type BuildingOption,
  type FloorOption,
  type EquipmentItem,
} from "@/lib/actions/room-form"

/* ── Constants ──────────────────────────────────────────────── */

const STEPS = [
  { key: "general", label: "פרטים כלליים", icon: "info" },
  { key: "amenities", label: "איבזור ותמונות", icon: "star" },
  { key: "seo", label: "אתר / SEO", icon: "search" },
] as const

const LANGUAGES = [
  { code: "he", label: "עברית", flag: "🇮🇱" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ar", label: "عربية", flag: "🇸🇦" },
] as const

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const MAX_IMAGE_SIZE = 15 * 1024 * 1024 // 15MB
const MAX_IMAGES = 20
const MIN_IMAGE_WIDTH = 1600
const MIN_IMAGE_HEIGHT = 900

/* ── Main Component ─────────────────────────────────────────── */

interface RoomFormDialogProps {
  onSaved?: () => void
}

export function RoomFormDialog({ onSaved }: RoomFormDialogProps) {
  const { tenantId, propertyId } = useTenant()
  const store = useRoomFormStore()
  const [submitError, setSubmitError] = useState("")
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([])
  const [buildings, setBuildings] = useState<BuildingOption[]>([])
  const [floors, setFloors] = useState<FloorOption[]>([])
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [amenitySearch, setAmenitySearch] = useState("")
  const [newAmenityName, setNewAmenityName] = useState("")
  const contentRef = useRef<HTMLDivElement>(null)

  const isEditing = !!store.editingRoomId
  const currentStep = store.activeTab

  // Load options when dialog opens
  useEffect(() => {
    if (!store.isOpen) return
    async function load() {
      const [opts, equipmentList] = await Promise.all([
        getRoomFormOptions(tenantId),
        getEquipmentList(tenantId),
      ])
      setRoomTypes(opts.roomTypes)
      setBuildings(opts.buildings)
      setFloors(opts.floors)
      setEquipment(equipmentList)

      // If editing, load room data
      if (store.editingRoomId) {
        const room = await getRoomById(store.editingRoomId, tenantId)
        if (room) {
          store.setField("is_active", room.is_active as boolean)
          store.setField("is_listed", (room.is_listed as boolean) ?? true)
          store.setField("room_number", room.room_number as string)
          store.setField("room_type_id", (room.room_type_id as string) || "")
          store.setField("wing", (room.wing as string) || "")
          store.setField("sort_order", (room.sort_order as number) || 0)
          store.setField("building_id", (room.building_id as string) || "")
          store.setField("floor_id", (room.floor_id as string) || "")
          store.setField("max_occupancy", (room.max_occupancy as number) || 2)
          store.setField("default_guests", (room.default_guests as number) || 2)
          store.setField("max_adults", (room.max_adults as number) || 2)
          store.setField("max_children", (room.max_children as number) || 0)
          store.setField("max_infants", (room.max_infants as number) || 0)
          store.setField("single_beds", (room.single_beds as number) || 0)
          store.setField("double_beds", (room.double_beds as number) || 1)
          store.setField("queen_beds", (room.queen_beds as number) || 0)
          store.setField("sofa_beds", (room.sofa_beds as number) || 0)
          store.setField("cribs", (room.cribs as number) || 0)
          store.setField("sleeping_arrangement_note", (room.sleeping_arrangement_note as string) || "")
          store.setField("primary_image_id", (room.primary_image_id as string) || "")
          if (room.translations) store.setField("translations", room.translations)
          if (room.equipment_ids) store.setField("equipment_ids", room.equipment_ids)
          if (room.images) store.setImages(room.images)
        }
      }
    }
    load()
  }, [store.isOpen, store.editingRoomId, tenantId])

  // Keyboard handler
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") store.close()
    },
    [store],
  )

  useEffect(() => {
    if (!store.isOpen) return
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [store.isOpen, handleKey])

  // Scroll content to top on step change
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [currentStep])

  // Filter floors by building
  const filteredFloors = store.building_id
    ? floors.filter((f) => f.building_id === store.building_id)
    : floors

  /* ── Validation ─────────────────────────────────────────── */

  function validateStep(step: number): Record<string, string> {
    const errors: Record<string, string> = {}
    if (step === 0) {
      const lang = store.currentLanguage
      const t = store.translations[lang]
      if (!t?.room_name?.trim()) errors.room_name = "חובה להזין שם חדר"
      if (!store.room_number.trim()) errors.room_number = "חובה להזין מספר חדר"
      if (store.default_guests > store.max_occupancy) errors.default_guests = "תפוסת ברירת מחדל לא יכולה לעלות על מקסימום"
      if (store.max_adults > store.max_occupancy) errors.max_adults = "מבוגרים לא יכול לעלות על תפוסה מקסימלית"
    }
    if (step === 1) {
      if (store.images.length > MAX_IMAGES) errors.images = `מקסימום ${MAX_IMAGES} תמונות`
    }
    return errors
  }

  function validateAll(): boolean {
    const allErrors: Record<string, string> = {}
    for (let i = 0; i <= 2; i++) {
      Object.assign(allErrors, validateStep(i))
    }
    store.setField("errors", allErrors)
    return Object.keys(allErrors).length === 0
  }

  function handleNext() {
    const errors = validateStep(currentStep)
    store.setField("errors", errors)
    if (Object.keys(errors).length > 0) return
    if (currentStep < 2) store.setActiveTab(currentStep + 1)
  }

  function handleBack() {
    if (currentStep > 0) store.setActiveTab(currentStep - 1)
  }

  function goToStep(step: number) {
    store.setActiveTab(step)
  }

  /* ── Submit ─────────────────────────────────────────────── */

  async function handleSubmit() {
    setSubmitError("")
    if (!validateAll()) return

    store.setField("isSubmitting", true)
    const payload = {
      is_active: store.is_active,
      is_listed: store.is_listed,
      room_number: store.room_number,
      room_type_id: store.room_type_id,
      wing: store.wing,
      sort_order: store.sort_order,
      building_id: store.building_id,
      floor_id: store.floor_id,
      max_occupancy: store.max_occupancy,
      default_guests: store.default_guests,
      max_adults: store.max_adults,
      max_children: store.max_children,
      max_infants: store.max_infants,
      single_beds: store.single_beds,
      double_beds: store.double_beds,
      queen_beds: store.queen_beds,
      sofa_beds: store.sofa_beds,
      cribs: store.cribs,
      sleeping_arrangement_note: store.sleeping_arrangement_note,
      translations: store.translations,
      equipment_ids: store.equipment_ids,
      primary_image_id: store.primary_image_id,
    }

    const result = isEditing
      ? await updateRoom(store.editingRoomId!, tenantId, payload)
      : await createRoom(tenantId, propertyId, payload)

    store.setField("isSubmitting", false)

    if (!result.success) {
      setSubmitError(result.error || "שגיאה בשמירת החדר")
      return
    }

    store.close()
    onSaved?.()
  }

  /* ── Completion Status ──────────────────────────────────── */

  const stepCompletion = useMemo(() => {
    const step1 = !!(
      store.translations[store.currentLanguage]?.room_name?.trim() &&
      store.room_number.trim()
    )
    const step2 = store.equipment_ids.length > 0
    const step3 = !!(
      store.translations[store.currentLanguage]?.seo_title?.trim() ||
      store.translations[store.currentLanguage]?.seo_description?.trim()
    )
    return [step1, step2, step3]
  }, [store.translations, store.currentLanguage, store.room_number, store.equipment_ids])

  return (
    <SidePanel
      isOpen={store.isOpen}
      onClose={store.close}
      title={isEditing ? "ניהול חדר" : "הקמת חדר"}
      subtitle="הגדרת פרטי חדר, איבזור ותוכן"
    >
      <div className="flex flex-col -m-6" style={{ minHeight: "calc(100vh - 80px)" }}>
        {/* ── Step Progress Bar ───────────────────────────── */}
        <div className="shrink-0 bg-gradient-to-l from-[#003aa0]/10 to-[#3F51B5]/10 px-6 py-4 border-b border-border/15">
          <div className="flex items-center justify-center gap-0">
            {STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center">
                <button
                  onClick={() => goToStep(i)}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer"
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      currentStep === i
                        ? "bg-primary text-white shadow-md"
                        : stepCompletion[i]
                        ? "bg-primary/20 text-primary"
                        : "bg-accent text-muted-foreground group-hover:bg-border/40"
                    }`}
                  >
                    {stepCompletion[i] && currentStep !== i ? (
                      <Icon name="check_circle" size="sm" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-bold whitespace-nowrap ${
                      currentStep === i ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>

                {i < STEPS.length - 1 && (
                  <div
                    className={`w-16 h-0.5 mx-2 mt-[-18px] rounded-full transition-colors ${
                      currentStep > i ? "bg-primary" : "bg-border/30"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Body: Side Nav + Content ────────────────────── */}
        <div className="flex-1 flex min-h-0">
          {/* Side Navigation */}
          <div className="w-48 shrink-0 border-l border-border/15 bg-card/50 py-4 flex flex-col">
            <nav className="flex-1 space-y-1 px-2">
              {STEPS.map((step, i) => (
                <button
                  key={step.key}
                  onClick={() => goToStep(i)}
                  className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-bold transition-all text-right min-h-[44px] ${
                    currentStep === i
                      ? "bg-primary/10 text-primary border-r-4 border-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0 ${
                      currentStep === i
                        ? "bg-primary text-white"
                        : stepCompletion[i]
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                        : "bg-accent text-muted-foreground"
                    }`}
                  >
                    {stepCompletion[i] && currentStep !== i ? (
                      <Icon name="check_circle" size="sm" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span>{step.label}</span>
                </button>
              ))}
            </nav>

            <div className="px-3 pt-3 border-t border-border/15">
              <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                <Icon name="info" size="sm" className="opacity-50" />
                שלב {currentStep + 1} מתוך {STEPS.length}
              </p>
            </div>
          </div>

          {/* Main Content Area */}
          <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-5">
            {currentStep === 0 && (
              <Step1General
                store={store}
                roomTypes={roomTypes}
                buildings={buildings}
                floors={filteredFloors}
              />
            )}
            {currentStep === 1 && (
              <Step2Amenities
                store={store}
                equipment={equipment}
                amenitySearch={amenitySearch}
                setAmenitySearch={setAmenitySearch}
                newAmenityName={newAmenityName}
                setNewAmenityName={setNewAmenityName}
              />
            )}
            {currentStep === 2 && (
              <Step3SEO
                store={store}
                roomTypes={roomTypes}
              />
            )}

            {submitError && (
              <div className="bg-red-50 dark:bg-red-950/20 text-destructive px-5 py-3 rounded-xl text-sm flex items-center gap-3 mt-6">
                <Icon name="error" size="sm" />
                {submitError}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border/15 px-6 py-4 bg-card/80 backdrop-blur-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentStep < 2 ? (
              <button
                onClick={handleNext}
                className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 min-h-[44px] flex items-center gap-2"
              >
                הבא
                <Icon name="chevron_left" size="sm" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={store.isSubmitting}
                className="bg-gradient-to-l from-[#003aa0] to-[#3F51B5] text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 min-h-[44px] flex items-center gap-2"
              >
                {store.isSubmitting ? "שומר..." : "שמור"}
                {!store.isSubmitting && <Icon name="check_circle" size="sm" />}
              </button>
            )}
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="border border-border/30 text-muted-foreground px-6 py-3 rounded-xl font-bold text-sm hover:bg-accent transition-colors min-h-[44px] flex items-center gap-2"
              >
                <Icon name="chevron_right" size="sm" />
                חזרה
              </button>
            )}
          </div>

          <button
            onClick={store.close}
            className="border border-border/30 text-muted-foreground px-6 py-3 rounded-xl font-bold text-sm hover:bg-accent transition-colors min-h-[44px]"
          >
            ביטול
          </button>
        </div>
      </div>
    </SidePanel>
  )
}

/* ══════════════════════════════════════════════════════════════
   STEP 1 — BASIC DETAILS + LANGUAGES + OCCUPANCY
   ══════════════════════════════════════════════════════════════ */

function Step1General({
  store,
  roomTypes,
  buildings,
  floors,
}: {
  store: RoomFormStore
  roomTypes: RoomTypeOption[]
  buildings: BuildingOption[]
  floors: FloorOption[]
}) {
  const lang = store.currentLanguage
  const t = store.translations[lang] ?? {
    room_name: "",
    description_html: "",
    meta_search_summary: "",
    seo_title: "",
    seo_description: "",
  }

  return (
    <div className="space-y-8">
      {/* ── Top Actions Row ──────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Language selector */}
        <div className="flex items-center gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => store.setCurrentLanguage(l.code)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] ${
                lang === l.code
                  ? "bg-primary text-white shadow-sm"
                  : "bg-accent text-muted-foreground hover:bg-border/30 border border-border/20"
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>

        {/* Duplicate actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-accent text-muted-foreground hover:bg-border/30 border border-border/20 transition-all min-h-[44px]"
          >
            <Icon name="translate" size="sm" />
            שכפל משפה אחרת
            <Icon name="chevron_left" size="sm" />
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all min-h-[44px]"
          >
            <Icon name="copy" size="sm" />
            שכפל חדר
          </button>
        </div>
      </div>

      {/* ── Room Name ─────────────────────────────────────── */}
      <SectionCard title="שם החדר">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="shrink-0 w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-muted-foreground hover:bg-border/30 transition-colors"
          >
            <Icon name="chevron_right" size="sm" />
          </button>
          <input
            type="text"
            value={t.room_name}
            onChange={(e) => store.setTranslation(lang, "room_name", e.target.value)}
            placeholder="לדוגמה: סוויטת פרימיום פנטהאוס עם נוף לים"
            className={inputClass}
          />
          <button
            type="button"
            className="shrink-0 w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-muted-foreground hover:bg-border/30 transition-colors"
          >
            <Icon name="chevron_left" size="sm" />
          </button>
        </div>
        {store.errors.room_name && (
          <p className="text-[11px] text-destructive mt-1 mr-1">{store.errors.room_name}</p>
        )}
      </SectionCard>

      {/* ── Room Number ───────────────────────────────────── */}
      <SectionCard title="מספר חדר">
        <input
          type="text"
          value={store.room_number}
          onChange={(e) => store.setField("room_number", e.target.value)}
          placeholder="לדוגמה: 101"
          className={inputClass}
        />
        {store.errors.room_number && (
          <p className="text-[11px] text-destructive mt-1 mr-1">{store.errors.room_number}</p>
        )}
      </SectionCard>

      {/* ── Room Settings Row ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <SectionCard title="סוג חדר">
          <select
            value={store.room_type_id}
            onChange={(e) => store.setField("room_type_id", e.target.value)}
            className={selectClass}
          >
            <option value="">בחר סוג חדר</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </select>
        </SectionCard>

        <SectionCard title="אגף / בניין">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={store.building_id}
              onChange={(e) => {
                store.setField("building_id", e.target.value)
                store.setField("floor_id", "")
              }}
              className={selectClass}
            >
              <option value="">בניין</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              value={store.floor_id}
              onChange={(e) => store.setField("floor_id", e.target.value)}
              className={selectClass}
            >
              <option value="">קומה</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </SectionCard>
      </div>

      {/* ── Room Description (WYSIWYG) ───────────────────── */}
      <SectionCard title="תיאור החדר">
        <RichTextEditor
          content={t.description_html}
          onChange={(html) => store.setTranslation(lang, "description_html", html)}
          placeholder="תיאור מפורט של החדר או האירוע..."
        />
        <div className="text-xs text-muted-foreground mt-1 mr-1">
          {t.description_html.replace(/<[^>]*>/g, "").length} / 724
        </div>
      </SectionCard>

      {/* ── Occupancy ─────────────────────────────────────── */}
      <SectionCard title="תפוסה">
        <div className="grid grid-cols-2 gap-6 max-sm:grid-cols-1">
          <NumberStepper
            label="תפוסת ברירת מחדל"
            value={store.default_guests}
            onChange={(v) => store.setField("default_guests", v)}
            min={1}
            max={store.max_occupancy}
          />
          <NumberStepper
            label="תפוסה מקסימלית"
            value={store.max_occupancy}
            onChange={(v) => store.setField("max_occupancy", v)}
            min={1}
            max={20}
          />
        </div>
        {(store.errors.default_guests || store.errors.max_adults) && (
          <p className="text-[11px] text-destructive mt-2 mr-1">
            {store.errors.default_guests || store.errors.max_adults}
          </p>
        )}

        <div className="grid grid-cols-3 gap-4 mt-6 max-sm:grid-cols-1">
          <NumberStepper
            label="מקסימום מבוגרים"
            value={store.max_adults}
            onChange={(v) => store.setField("max_adults", v)}
            min={1}
            max={store.max_occupancy}
          />
          <NumberStepper
            label="מקסימום ילדים"
            value={store.max_children}
            onChange={(v) => store.setField("max_children", v)}
            max={10}
          />
          <NumberStepper
            label="מקסימום תינוקות"
            value={store.max_infants}
            onChange={(v) => store.setField("max_infants", v)}
            max={5}
          />
        </div>
      </SectionCard>

      {/* ── Meta Summary ──────────────────────────────────── */}
      <SectionCard title="תקציר SEO / Meta Summary">
        <textarea
          value={t.meta_search_summary}
          onChange={(e) => store.setTranslation(lang, "meta_search_summary", e.target.value)}
          placeholder="תקציר קצר לתוצאות חיפוש..."
          rows={2}
          className={textareaClass}
          maxLength={140}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1 mr-1">
          <span>יעד: 80-140 תווים</span>
          <span
            className={
              t.meta_search_summary.length >= 80 && t.meta_search_summary.length <= 140
                ? "text-emerald-600"
                : t.meta_search_summary.length > 140
                ? "text-destructive"
                : ""
            }
          >
            {t.meta_search_summary.length} / 140
          </span>
        </div>
      </SectionCard>

      {/* ── Toggles Row ───────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <ToggleCard
          label="חדר פעיל"
          description="חדר זמין להזמנות"
          checked={store.is_active}
          onChange={(v) => store.setField("is_active", v)}
        />
        <ToggleCard
          label="מוצג באתר"
          description="חדר נראה לאורחים"
          checked={store.is_listed}
          onChange={(v) => store.setField("is_listed", v)}
        />
        <SectionCard title="סדר מיון">
          <input
            type="number"
            value={store.sort_order}
            onChange={(e) => store.setField("sort_order", parseInt(e.target.value) || 0)}
            className={inputClass}
            min={0}
          />
        </SectionCard>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   STEP 2 — AMENITIES + IMAGES
   ══════════════════════════════════════════════════════════════ */

function Step2Amenities({
  store,
  equipment,
  amenitySearch,
  setAmenitySearch,
  newAmenityName,
  setNewAmenityName,
}: {
  store: RoomFormStore
  equipment: EquipmentItem[]
  amenitySearch: string
  setAmenitySearch: (v: string) => void
  newAmenityName: string
  setNewAmenityName: (v: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filtered amenities
  const filteredEquipment = amenitySearch
    ? equipment.filter((e) =>
        e.name.toLowerCase().includes(amenitySearch.toLowerCase())
      )
    : equipment

  // Group by category
  const groupedEquipment = useMemo(() => {
    const groups = new Map<string, EquipmentItem[]>()
    for (const eq of filteredEquipment) {
      const cat = eq.category || "כללי"
      const list = groups.get(cat) || []
      list.push(eq)
      groups.set(cat, list)
    }
    return groups
  }, [filteredEquipment])

  // Fallback amenities if no DB equipment loaded
  const FALLBACK_AMENITIES = [
    "WiFi", "מזגן", "טלוויזיה", "מקרר", "מיני בר", "כספת",
    "מרפסת", "ג׳קוזי", "מקלחון", "אמבטיה", "שירותים נפרדים",
    "מכונת קפה", "קומקום", "מייבש שיער", "מגהץ", "כביסה",
    "נגישות", "חניה", "נוף לים", "נוף להר", "בריכה פרטית",
    "ספה", "מיטת יחיד", "מיטה זוגית", "מיטת קווין", "Smart TV",
    "Free WiFi", "מכונת כביסה", "מייבש", "ארון", "שידה", "שולחן כתיבה",
  ]

  function handleAddAmenity() {
    if (!newAmenityName.trim()) return
    store.toggleEquipment(newAmenityName.trim())
    setNewAmenityName("")
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) continue
      if (file.size > MAX_IMAGE_SIZE) continue
      if (store.images.length >= MAX_IMAGES) break

      const url = URL.createObjectURL(file)
      const img = new window.Image()
      img.onload = () => {
        const newImage: RoomImage = {
          id: `temp-${Date.now()}-${i}`,
          file_url: url,
          file_name: file.name,
          file_size: file.size,
          width: img.width,
          height: img.height,
          sort_order: store.images.length,
          is_primary: store.images.length === 0,
        }
        store.addImage(newImage)
        if (store.images.length === 0) {
          store.setPrimaryImage(newImage.id)
        }
      }
      img.src = url
    }

    e.target.value = ""
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const dt = e.dataTransfer
    if (!dt.files) return

    const fakeEvent = {
      target: { files: dt.files, value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>
    handleFileSelect(fakeEvent)
  }

  return (
    <div className="space-y-8">
      {/* ── Amenities ─────────────────────────────────────── */}
      <SectionCard title="איבזור ושירותים">
        {/* Search */}
        <div className="relative mb-4">
          <Icon name="search" size="sm" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={amenitySearch}
            onChange={(e) => setAmenitySearch(e.target.value)}
            placeholder="חיפוש איבזור..."
            className={`${inputClass} pr-11`}
          />
        </div>

        {/* Amenity chips */}
        {equipment.length > 0 ? (
          <div className="space-y-4">
            {Array.from(groupedEquipment.entries()).map(([category, items]) => (
              <div key={category}>
                <p className="text-xs font-bold text-muted-foreground mb-2">{category}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((eq) => {
                    const isSelected = store.equipment_ids.includes(eq.id)
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => store.toggleEquipment(eq.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          isSelected
                            ? "bg-primary text-white shadow-sm"
                            : "bg-accent text-muted-foreground hover:bg-border/30 border border-border/10"
                        }`}
                      >
                        {eq.icon && <Icon name={eq.icon} size="sm" />}
                        {eq.name}
                        {isSelected && <Icon name="check_circle" size="sm" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Fallback if no DB amenities */
          <div className="flex flex-wrap gap-2">
            {FALLBACK_AMENITIES.map((amenity) => {
              const isSelected = store.equipment_ids.includes(amenity)
              return (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => store.toggleEquipment(amenity)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                    isSelected
                      ? "bg-primary text-white shadow-sm"
                      : "bg-accent text-muted-foreground hover:bg-border/30 border border-border/10"
                  }`}
                >
                  {amenity}
                </button>
              )
            })}
          </div>
        )}

        {/* Add new amenity */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/15">
          <input
            type="text"
            value={newAmenityName}
            onChange={(e) => setNewAmenityName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddAmenity()}
            placeholder="הוסף איבזור חדש..."
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={handleAddAmenity}
            disabled={!newAmenityName.trim()}
            className="bg-primary text-white px-5 py-3 rounded-xl font-bold text-sm min-h-[48px] hover:shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Icon name="add" size="sm" />
            הוסף
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          {store.equipment_ids.length} פריטים נבחרו
        </p>
      </SectionCard>

      {/* ── Images ────────────────────────────────────────── */}
      <SectionCard title="תמונות">
        {/* Upload area */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border/40 rounded-[20px] p-10 flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon name="upload" size="xl" className="text-primary" />
          </div>
          <p className="text-sm font-bold text-foreground">גרור תמונות לכאן</p>
          <p className="text-xs text-muted-foreground">או לחץ לבחירת קבצים</p>
          <p className="text-[12px] text-muted-foreground/60">
            JPG, PNG, WEBP | מקסימום {MAX_IMAGES} תמונות | עד 15MB לתמונה | מומלץ {MIN_IMAGE_WIDTH}x{MIN_IMAGE_HEIGHT} לפחות
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Image grid */}
        {store.images.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mt-6 max-sm:grid-cols-2">
            {store.images.map((img) => (
              <div
                key={img.id}
                className={`relative group rounded-xl overflow-hidden border-2 transition-all ${
                  img.is_primary ? "border-primary shadow-md" : "border-border/20"
                }`}
              >
                <div className="aspect-video bg-accent">
                  <img
                    src={img.file_url}
                    alt={img.file_name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => store.setPrimaryImage(img.id)}
                    className="w-10 h-10 rounded-xl bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
                    title="הגדר כתמונה ראשית"
                  >
                    <Icon name="crown" size="sm" className={img.is_primary ? "text-amber-500" : "text-muted-foreground"} />
                  </button>
                  <button
                    type="button"
                    onClick={() => store.removeImage(img.id)}
                    className="w-10 h-10 rounded-xl bg-white/90 flex items-center justify-center hover:bg-red-50 transition-colors"
                    title="מחק תמונה"
                  >
                    <Icon name="trash" size="sm" className="text-destructive" />
                  </button>
                </div>

                {/* Badges */}
                <div className="absolute top-2 right-2 flex flex-col gap-1">
                  {img.is_primary && (
                    <span className="bg-primary text-white text-[12px] font-bold px-2 py-0.5 rounded-full">
                      ראשית
                    </span>
                  )}
                  {img.width < MIN_IMAGE_WIDTH && (
                    <span className="bg-amber-500 text-white text-[12px] font-bold px-2 py-0.5 rounded-full">
                      קטנה מדי
                    </span>
                  )}
                  {img.height > img.width && (
                    <span className="bg-amber-500 text-white text-[12px] font-bold px-2 py-0.5 rounded-full">
                      אנכית
                    </span>
                  )}
                </div>

                {/* Info bar */}
                <div className="px-3 py-2 bg-card text-[12px] text-muted-foreground flex items-center justify-between">
                  <span>{img.width}x{img.height}</span>
                  <span>{(img.file_size / 1024).toFixed(0)} KB</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {store.images.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            {store.images.length} / {MAX_IMAGES} תמונות
          </p>
        )}

        {store.errors.images && (
          <p className="text-[11px] text-destructive mt-2">{store.errors.images}</p>
        )}
      </SectionCard>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   STEP 3 — SEO + FINAL REVIEW
   ══════════════════════════════════════════════════════════════ */

function Step3SEO({
  store,
  roomTypes,
}: {
  store: RoomFormStore
  roomTypes: RoomTypeOption[]
}) {
  const lang = store.currentLanguage
  const t = store.translations[lang] ?? {
    room_name: "",
    description_html: "",
    meta_search_summary: "",
    seo_title: "",
    seo_description: "",
  }

  const roomType = roomTypes.find((rt) => rt.id === store.room_type_id)
  const primaryImage = store.images.find((img) => img.is_primary) || store.images[0]

  // Validation summary
  const issues: string[] = []
  if (!t.room_name?.trim()) issues.push("שם חדר חסר")
  if (!store.room_number.trim()) issues.push("מספר חדר חסר")
  if (!t.seo_title?.trim()) issues.push("כותרת SEO חסרה")
  if (!t.seo_description?.trim()) issues.push("תיאור SEO חסר")
  if (store.images.length === 0) issues.push("אין תמונות")
  if (store.equipment_ids.length === 0) issues.push("אין איבזור נבחר")

  // Check language completion
  const langCompletion = LANGUAGES.map((l) => {
    const tr = store.translations[l.code]
    const filled = tr
      ? [tr.room_name, tr.description_html, tr.seo_title].filter(Boolean).length
      : 0
    return { ...l, filled, total: 3 }
  })

  return (
    <div className="space-y-8">
      {/* ── SEO Fields ────────────────────────────────────── */}
      <SectionCard title="הגדרות SEO">
        <div className="space-y-4">
          <FormField label="כותרת SEO (Title Tag)">
            <input
              type="text"
              value={t.seo_title}
              onChange={(e) => store.setTranslation(lang, "seo_title", e.target.value)}
              placeholder="כותרת המופיעה בתוצאות חיפוש..."
              className={inputClass}
              maxLength={60}
            />
            <div className="text-xs text-muted-foreground mt-1 text-left">
              {t.seo_title.length} / 60
            </div>
          </FormField>

          <FormField label="תיאור SEO (Meta Description)">
            <textarea
              value={t.seo_description}
              onChange={(e) => store.setTranslation(lang, "seo_description", e.target.value)}
              placeholder="תיאור קצר המופיע בתוצאות גוגל..."
              rows={3}
              className={textareaClass}
              maxLength={160}
            />
            <div className="text-xs text-muted-foreground mt-1 text-left">
              {t.seo_description.length} / 160
            </div>
          </FormField>
        </div>
      </SectionCard>

      {/* ── Website Preview Card ──────────────────────────── */}
      <SectionCard title="תצוגה מקדימה באתר">
        <div className="bg-accent rounded-[20px] overflow-hidden border border-border/20">
          {/* Image */}
          <div className="aspect-[16/9] bg-muted relative">
            {primaryImage ? (
              <img
                src={primaryImage.file_url}
                alt={t.room_name || "Room preview"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon name="image" size="xl" className="text-muted-foreground/30" />
              </div>
            )}
          </div>
          <div className="p-5 space-y-3">
            <h3 className="text-lg font-bold">
              {t.room_name || "שם החדר"}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {t.meta_search_summary || t.description_html?.replace(/<[^>]*>/g, "").slice(0, 140) || "תקציר החדר..."}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Icon name="group" size="sm" />
                עד {store.max_occupancy} אורחים
              </span>
              {roomType && (
                <span className="flex items-center gap-1">
                  <Icon name="hotel_class" size="sm" />
                  {roomType.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Icon name="star" size="sm" />
                {store.equipment_ids.length} שירותים
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Search Result Preview ─────────────────────────── */}
      <SectionCard title="תצוגה בתוצאות חיפוש">
        <div className="bg-white dark:bg-card rounded-xl p-5 border border-border/20 space-y-1">
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            www.yourhotel.com/rooms/{store.room_number || "101"}
          </p>
          <h4 className="text-primary text-base font-bold hover:underline cursor-pointer">
            {t.seo_title || t.room_name || "כותרת SEO של החדר"}
          </h4>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {t.seo_description || t.meta_search_summary || "תיאור SEO המופיע בתוצאות חיפוש של גוגל..."}
          </p>
        </div>
      </SectionCard>

      {/* ── Language Completion ────────────────────────────── */}
      <SectionCard title="מצב השלמת שפות">
        <div className="grid grid-cols-3 gap-3">
          {langCompletion.map((l) => (
            <div
              key={l.code}
              className={`rounded-xl p-4 text-center border ${
                l.filled === l.total
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                  : l.filled > 0
                  ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                  : "border-border/20 bg-accent"
              }`}
            >
              <span className="text-lg">{l.flag}</span>
              <p className="text-sm font-bold mt-1">{l.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {l.filled} / {l.total} שדות
              </p>
              <div className="w-full bg-border/20 rounded-full h-1.5 mt-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    l.filled === l.total ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${(l.filled / l.total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Final Validation Summary ──────────────────────── */}
      <SectionCard title="סיכום אימות">
        {issues.length === 0 ? (
          <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
            <Icon name="check_circle" size="md" />
            <span className="text-sm font-bold">כל הנתונים מלאים — אפשר לשמור!</span>
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue) => (
              <div
                key={issue}
                className="flex items-center gap-3 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3"
              >
                <Icon name="priority_high" size="sm" />
                <span className="text-sm font-bold">{issue}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ══════════════════════════════════════════════════════════════ */

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  )
}

function ToggleCard({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="bg-card rounded-[20px] border border-border/15 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">{label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`w-12 h-7 rounded-full transition-colors relative ${
            checked ? "bg-primary" : "bg-border/40"
          }`}
          aria-label={label}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${
              checked ? "left-0.5" : "left-[calc(100%-1.625rem)]"
            }`}
          />
        </button>
      </div>
    </div>
  )
}

/* ── Rich Text Editor ───────────────────────────────────────── */

function RichTextEditor({
  content,
  onChange,
  placeholder,
}: {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      TiptapLink.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || "הקלד כאן...",
      }),
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[120px] px-5 py-4 focus:outline-none text-right",
        dir: "rtl",
      },
    },
  })

  if (!editor) return null

  return (
    <div className="border border-border/40 rounded-xl overflow-hidden bg-accent">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/20 bg-card/50">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          icon="format_bold"
          title="מודגש"
        />
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          icon="format_italic"
          title="נטוי"
        />
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          icon="format_underlined"
          title="קו תחתון"
        />
        <span className="w-px h-5 bg-border/30 mx-1" />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          icon="format_list_bulleted"
          title="רשימה"
        />
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          icon="format_list_numbered"
          title="רשימה ממוספרת"
        />
        <span className="w-px h-5 bg-border/30 mx-1" />
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={() => {
            const url = window.prompt("URL:")
            if (url) {
              editor.chain().focus().setLink({ href: url }).run()
            }
          }}
          icon="link"
          title="קישור"
        />
        <ToolbarButton
          active={false}
          onClick={() => {/* Image upload placeholder */}}
          icon="image"
          title="תמונה"
        />
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  icon,
  title,
}: {
  active: boolean
  onClick: () => void
  icon: string
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent"
      }`}
    >
      <Icon name={icon} size="sm" />
    </button>
  )
}
