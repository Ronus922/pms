/* ── Automation Module Types ──────────────────────────────── */

export type ChannelType = "email" | "whatsapp" | "sms" | "in_app" | "push_notification"
export type TemplateCategory = "registration" | "reservations" | "tasks" | "cleaning" | "maintenance" | "attendance" | "suppliers" | "system"
export type TriggerType = "event" | "relative_date" | "exact_time" | "conditional"
export type QueueStatus = "pending" | "scheduled" | "sending" | "sent" | "failed" | "cancelled" | "retry"
export type LogStatus = "sent" | "failed" | "opened" | "clicked" | "bounced"

/* ── Template ─────────────────────────────────────────────── */

export interface AutomationTemplate {
  id: string
  tenant_id: string
  key: string
  name: string
  category: TemplateCategory
  description: string
  channel_type: ChannelType
  subject: string
  body: string
  is_active: boolean
  is_system_locked: boolean
  allow_super_admin_edit: boolean
  default_trigger: string | null
  default_delay_minutes: number
  available_variables: string[]
  notes_internal: string
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface TemplateCreateInput {
  key: string
  name: string
  category: TemplateCategory
  description?: string
  channel_type: ChannelType
  subject?: string
  body?: string
  default_trigger?: string
  default_delay_minutes?: number
  available_variables?: string[]
  notes_internal?: string
}

/* ── Rule ─────────────────────────────────────────────────── */

export interface AutomationRule {
  id: string
  tenant_id: string
  key: string
  name: string
  description: string
  is_active: boolean
  trigger_type: TriggerType
  trigger_entity: string
  trigger_condition: Record<string, unknown>
  delay_minutes: number
  send_time: string | null
  send_days_before: number | null
  send_days_after: number | null
  repeat_every: number | null
  repeat_unit: string | null
  stop_when_condition_met: boolean
  priority: number
  execution_order: number
  channel_priority: ChannelType[]
  template_id: string | null
  fallback_template_id: string | null
  created_at: string
  updated_at: string
  /* Joined */
  template_name?: string
}

export interface RuleCreateInput {
  key: string
  name: string
  description?: string
  trigger_type: TriggerType
  trigger_entity: string
  trigger_condition?: Record<string, unknown>
  delay_minutes?: number
  send_time?: string
  send_days_before?: number
  send_days_after?: number
  repeat_every?: number
  repeat_unit?: string
  stop_when_condition_met?: boolean
  priority?: number
  channel_priority?: ChannelType[]
  template_id?: string
  fallback_template_id?: string
}

/* ── Queue ─────────────────────────────────────────────────── */

export interface MessageQueueItem {
  id: string
  tenant_id: string
  automation_rule_id: string | null
  template_id: string | null
  target_entity_type: string
  target_entity_id: string | null
  recipient_name: string
  recipient_email: string
  recipient_phone: string
  channel_type: ChannelType
  scheduled_for: string
  sent_at: string | null
  delivery_status: QueueStatus
  error_message: string | null
  retry_count: number
  payload_snapshot: Record<string, unknown>
  created_at: string
  /* Joined */
  template_name?: string
  rule_name?: string
}

/* ── Log ──────────────────────────────────────────────────── */

export interface MessageLogEntry {
  id: string
  tenant_id: string
  queue_id: string | null
  template_id: string | null
  channel_type: ChannelType
  recipient: string
  subject: string
  body_snapshot: string
  delivery_status: string
  provider_response: string | null
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  failed_at: string | null
  error_message: string | null
  created_at: string
  /* Joined */
  template_name?: string
}

/* ── Variable ─────────────────────────────────────────────── */

export interface DynamicVariable {
  id: string
  tenant_id: string
  entity_type: string
  variable_key: string
  variable_label: string
  example_value: string
  description: string
  created_at: string
}

/* ── Stats ─────────────────────────────────────────────────── */

export interface AutomationStats {
  active_automations: number
  paused_automations: number
  sent_today: number
  failed_today: number
  pending_queue: number
  active_templates: number
}

/* ── Tab ──────────────────────────────────────────────────── */

export type AutomationTab = "templates" | "automations" | "queue" | "history" | "settings" | "variables"

/* ── Filters ──────────────────────────────────────────────── */

export interface TemplateFilters {
  search?: string
  category?: TemplateCategory | "all"
  channel?: ChannelType | "all"
  active?: boolean | "all"
}

export interface RuleFilters {
  search?: string
  trigger_type?: TriggerType | "all"
  active?: boolean | "all"
}

export interface LogFilters {
  search?: string
  channel?: ChannelType | "all"
  status?: string | "all"
  dateFrom?: string
  dateTo?: string
  template_id?: string | "all"
}
