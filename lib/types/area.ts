/* ── Area Types — operational spaces that are not rooms ────── */

export interface Area {
  id: string
  tenant_id: string
  property_id: string
  name: string
  code: string
  area_type: string
  building_id: string | null
  floor_id: string | null
  is_active: boolean
  cleaning_relevant: boolean
  maintenance_relevant: boolean
  sort_order: number
  notes: string | null
  created_at: string
  updated_at: string
  /** Joined from buildings table */
  building_name?: string | null
  /** Joined from floors table */
  floor_name?: string | null
  /** Joined from lookup_items — Hebrew label for area_type */
  area_type_label?: string | null
  /** Joined from lookup_items — icon for area_type */
  area_type_icon?: string | null
}

export interface AreaCreateInput {
  name: string
  code?: string
  area_type: string
  building_id?: string
  floor_id?: string
  is_active?: boolean
  cleaning_relevant?: boolean
  maintenance_relevant?: boolean
  sort_order?: number
  notes?: string
}

export interface AreaUpdateInput {
  name?: string
  code?: string
  area_type?: string
  building_id?: string | null
  floor_id?: string | null
  is_active?: boolean
  cleaning_relevant?: boolean
  maintenance_relevant?: boolean
  sort_order?: number
  notes?: string | null
}

export interface AreaPickerItem {
  id: string
  name: string
  code: string
  area_type_label: string
  area_type_icon: string | null
}
