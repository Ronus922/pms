"use client"

import { useEffect, useState, useCallback } from "react"
import { getLookupItems, getAllLookups } from "@/lib/actions/settings"
import type { LookupItem, LookupCategoryId } from "@/lib/types/lookup"

/**
 * Fetch lookup items for a single category.
 * Returns { value, label } array ready for <select> dropdowns.
 */
export function useLookup(tenantId: string, category: LookupCategoryId) {
  const [items, setItems] = useState<LookupItem[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const data = await getLookupItems(tenantId, category, true)
    setItems(data)
    setLoading(false)
  }, [tenantId, category])

  useEffect(() => { reload() }, [reload])

  /** For <select> dropdowns: [{ value, label }, ...] */
  const options = items.map((i) => ({ value: i.value, label: i.label }))

  /** For display: value → label */
  const labelMap: Record<string, string> = {}
  for (const i of items) labelMap[i.value] = i.label

  /** For display: value → color */
  const colorMap: Record<string, string> = {}
  for (const i of items) if (i.color) colorMap[i.value] = i.color

  return { items, options, labelMap, colorMap, loading, reload }
}

/**
 * Fetch multiple categories at once (batch).
 * Returns a record of { [category]: LookupItem[] }
 */
export function useLookupBatch(tenantId: string, categories: LookupCategoryId[]) {
  const [data, setData] = useState<Record<string, LookupItem[]>>({})
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const result = await getAllLookups(tenantId, categories)
    setData(result)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, categories.join(",")])

  useEffect(() => { reload() }, [reload])

  return { data, loading, reload }
}
