/* ── Employee / Staff Types — single source of truth ────────── */

import type { Role, ModulePermission } from "@/lib/permissions/constants"

/* ── Core Employee ─────────────────────────────────────────── */

export interface Employee {
  id: string
  tenant_id: string
  email: string
  full_name: string
  phone: string
  avatar_url: string | null
  role: Role
  is_active: boolean
  last_login: string | null
  created_at: string
  updated_at: string
  invited_by: string | null
  /* Extended fields */
  job_title: string | null
  department: string | null
  notes: string | null
  emergency_contact: string | null
  start_date: string | null
}

/* ── Employee With Computed Stats ──────────────────────────── */

export interface EmployeeWithStats extends Employee {
  active_tasks_count: number
  completed_tasks_today: number
  invited_by_name: string | null
}

/* ── Employee With Permissions ─────────────────────────────── */

export interface EmployeeWithPermissions extends Employee {
  permissions: ModulePermission[]
}

/* ── Activity Entry ────────────────────────────────────────── */

export interface EmployeeActivity {
  id: string
  type: "task_completed" | "task_assigned" | "login" | "status_change"
  description: string
  timestamp: string
  metadata?: Record<string, string>
}

/* ── Task Summary ──────────────────────────────────────────── */

export interface EmployeeTaskSummary {
  today: number
  this_week: number
  this_month: number
  pending: number
}

/* ── Staff Tab ─────────────────────────────────────────────── */

export type StaffTab =
  | "profile"
  | "attendance"
  | "permissions"
  | "activity"
  | "tasks"
  | "hours"

/* ── Staff Filters ─────────────────────────────────────────── */

export interface StaffFilter {
  search: string
  role: Role | "all"
  status: "all" | "active" | "inactive"
}
