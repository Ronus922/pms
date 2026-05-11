"use client"

import { useState, useMemo } from "react"
import type { RoomFormStore } from "@/lib/stores/room-form-store"
import { Icon } from "@/components/shared/Icon"

interface Equipment {
  id: string
  name: string
  icon: string
  category: string
}

interface AmenitiesTabProps {
  store: RoomFormStore
  equipment: Equipment[]
}

const CATEGORIES = [
  { key: "all", label: "הכל" },
  { key: "kitchen", label: "מטבח" },
  { key: "entertainment", label: "בידור" },
  { key: "bathroom", label: "רחצה" },
  { key: "luxury", label: "יוקרה" },
  { key: "general", label: "כללי" },
]

export function AmenitiesTab({ store, equipment }: AmenitiesTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")

  const filteredEquipment = useMemo(() => {
    let items = equipment

    if (activeCategory !== "all") {
      items = items.filter((e) => e.category === activeCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      items = items.filter((e) => e.name.toLowerCase().includes(q))
    }

    return items
  }, [equipment, activeCategory, searchQuery])

  const selectedItems = useMemo(
    () => equipment.filter((e) => store.equipment_ids.includes(e.id)),
    [equipment, store.equipment_ids]
  )

  return (
    <div className="space-y-4" dir="rtl">
      {/* Search */}
      <div className="relative">
        <Icon
          name="search"
          size="sm"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="חיפוש ציוד..."
          className="w-full rounded-xl border-0 bg-accent min-h-[48px] pr-10 pl-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveCategory(cat.key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              activeCategory === cat.key
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-foreground hover:bg-accent/80"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Selected chips */}
      {selectedItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground">
            פריטים שנבחרו ({selectedItems.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => store.toggleEquipment(item.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                {item.name}
                <Icon name="close" size="sm" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Equipment grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredEquipment.map((item) => {
          const isSelected = store.equipment_ids.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => store.toggleEquipment(item.id)}
              className={`rounded-[20px] p-4 text-right transition-all flex items-center gap-3 min-h-[44px] ${
                isSelected
                  ? "border-2 border-primary bg-primary/5 shadow-sm"
                  : "border border-border/20 hover:border-border/40 hover:shadow-sm"
              }`}
            >
              <span className="shrink-0 w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                <Icon name={item.icon} size="md" className="text-muted-foreground" />
              </span>
              <span className="text-sm font-medium flex-1">{item.name}</span>
              {isSelected && (
                <Icon name="check_circle" size="md" className="text-primary shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {filteredEquipment.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          לא נמצאו פריטים תואמים
        </p>
      )}
    </div>
  )
}
