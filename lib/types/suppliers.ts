/* ── Supplier Types — single source of truth ─────────────── */

export type SupplierStatus = "active" | "inactive" | "archived"
export type SupplierPaymentTerms = "immediate" | "net_15" | "net_30" | "net_45" | "net_60" | "net_90" | "other"
export type SupplierActivityAction =
  | "created"
  | "updated"
  | "document_uploaded"
  | "document_deleted"
  | "status_changed"
  | "linked_to_task"
  | "linked_to_issue"
  | "archived"
  | "restored"

export type SupplierLinkType = "task" | "issue" | "area" | "property"

/* ── Core Entity ──────────────────────────────────────────── */

export interface Supplier {
  id: string
  tenant_id: string
  display_name: string
  company_name: string
  contact_person: string
  supplier_type: string
  status: SupplierStatus
  phone: string
  mobile: string
  email: string
  website: string
  address: string
  city: string
  tax_id: string
  bank_name: string
  bank_branch: string
  bank_account: string
  payment_terms: SupplierPaymentTerms
  notes: string
  internal_notes: string
  rating: number | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  /* Joined counts */
  documents_count?: number
  links_count?: number
}

/* ── Document ─────────────────────────────────────────────── */

export interface SupplierDocument {
  id: string
  tenant_id: string
  supplier_id: string
  file_name: string
  file_url: string
  file_size_bytes: number
  mime_type: string
  doc_type: string
  uploaded_by: string | null
  uploaded_by_name: string | null
  created_at: string
}

/* ── Activity Log ─────────────────────────────────────────── */

export interface SupplierActivity {
  id: string
  tenant_id: string
  supplier_id: string
  action_type: SupplierActivityAction
  changed_by: string | null
  changed_by_name: string | null
  message: string
  metadata_json: Record<string, unknown>
  created_at: string
}

/* ── Link ─────────────────────────────────────────────────── */

export interface SupplierLink {
  id: string
  tenant_id: string
  supplier_id: string
  link_type: SupplierLinkType
  linked_entity_id: string
  linked_entity_label: string
  created_by: string | null
  created_at: string
}

/* ── Create / Update Inputs ───────────────────────────────── */

export interface SupplierCreateInput {
  display_name: string
  company_name?: string
  contact_person?: string
  supplier_type?: string
  phone?: string
  mobile?: string
  email?: string
  website?: string
  address?: string
  city?: string
  tax_id?: string
  bank_name?: string
  bank_branch?: string
  bank_account?: string
  payment_terms?: SupplierPaymentTerms
  notes?: string
  internal_notes?: string
  rating?: number
}

export interface SupplierUpdateInput extends Partial<SupplierCreateInput> {
  status?: SupplierStatus
}

/* ── Filters ──────────────────────────────────────────────── */

export interface SupplierFilters {
  search?: string
  status?: SupplierStatus | "all"
  type?: string | "all"
}

/* ── Tabs ─────────────────────────────────────────────────── */

export type SupplierTab = "details" | "documents" | "activity" | "links"
