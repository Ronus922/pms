"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { useTenant, usePermissions } from "@/lib/hooks/use-tenant"
import { getAutomationStats } from "@/lib/actions/automations"
import { TemplatesTab } from "@/components/automations/TemplatesTab"
import { RulesTab } from "@/components/automations/RulesTab"
import { QueueTab } from "@/components/automations/QueueTab"
import { HistoryTab } from "@/components/automations/HistoryTab"
import { SettingsTab } from "@/components/automations/SettingsTab"
import { VariablesTab } from "@/components/automations/VariablesTab"
import { CreateTemplatePanel } from "@/components/automations/CreateTemplatePanel"
import { TemplateDetailPanel } from "@/components/automations/TemplateDetailPanel"
import { CreateRulePanel } from "@/components/automations/CreateRulePanel"
import { RuleDetailPanel } from "@/components/automations/RuleDetailPanel"
import type { AutomationStats, AutomationTab } from "@/lib/types/automations"

/* ── KPI card config ──────────────────────────────────────── */

interface KpiDef {
  key: keyof AutomationStats
  label: string
  icon: string
  color: string
  tab?: AutomationTab
}

const KPI_CARDS: KpiDef[] = [
  { key: "active_automations",  label: "אוטומציות פעילות",  icon: "bolt",             color: "text-emerald-600", tab: "automations" },
  { key: "paused_automations",  label: "מושבתות",           icon: "toggle_off",       color: "text-slate-500",   tab: "automations" },
  { key: "sent_today",          label: "נשלחו היום",        icon: "send",             color: "text-blue-600",    tab: "history" },
  { key: "failed_today",        label: "נכשלו",             icon: "error",            color: "text-red-500",     tab: "history" },
  { key: "pending_queue",       label: "ממתינות",           icon: "schedule",         color: "text-amber-600",   tab: "queue" },
  { key: "active_templates",    label: "תבניות פעילות",     icon: "description",      color: "text-indigo-600",  tab: "templates" },
]

/* ── Tab definitions ──────────────────────────────────────── */

interface TabDef {
  key: AutomationTab
  label: string
  icon: string
}

const TABS: TabDef[] = [
  { key: "templates",   label: "תבניות",       icon: "description" },
  { key: "automations", label: "אוטומציות",    icon: "bolt" },
  { key: "queue",       label: "תור הודעות",   icon: "send" },
  { key: "history",     label: "היסטוריה",     icon: "history" },
  { key: "settings",    label: "הגדרות",       icon: "settings" },
  { key: "variables",   label: "משתנים",       icon: "key" },
]

/* ── Main component ───────────────────────────────────────── */

export function AutomationsPageClient() {
  const { tenantId } = useTenant()
  const { isSuperAdmin } = usePermissions()
  const [activeTab, setActiveTab] = useState<AutomationTab>("templates")
  const [stats, setStats] = useState<AutomationStats>({
    active_automations: 0,
    paused_automations: 0,
    sent_today: 0,
    failed_today: 0,
    pending_queue: 0,
    active_templates: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [showCreateRule, setShowCreateRule] = useState(false)
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await getAutomationStats(tenantId)
      setStats(data)
    } catch {
      // silent
    } finally {
      setStatsLoading(false)
    }
  }, [tenantId])

  useEffect(() => { loadStats() }, [loadStats])

  /* ── Access check ───────────────────────────────────────── */

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4" dir="rtl">
        <Icon name="lock" size="xl" className="opacity-30" />
        <p className="text-lg font-medium">אין הרשאה</p>
        <p className="text-sm">עמוד זה זמין למנהלי-על בלבד</p>
      </div>
    )
  }

  /* ── Tab content ────────────────────────────────────────── */

  function renderTab() {
    switch (activeTab) {
      case "templates":
        return <TemplatesTab onCreateNew={() => setShowCreateTemplate(true)} onSelect={(id) => setSelectedTemplateId(id)} />
      case "automations":
        return <RulesTab onCreateNew={() => setShowCreateRule(true)} onSelect={(id) => setSelectedRuleId(id)} />
      case "queue":
        return <QueueTab />
      case "history":
        return <HistoryTab />
      case "settings":
        return <SettingsTab />
      case "variables":
        return <VariablesTab />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">אוטומציות והודעות</h1>
        <p className="text-sm text-muted-foreground">ניהול תבניות, אוטומציות שליחה, תור הודעות והיסטוריה</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {KPI_CARDS.map((kpi) => (
          <button
            key={kpi.key}
            onClick={() => kpi.tab && setActiveTab(kpi.tab)}
            className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex flex-col items-center gap-3 hover:shadow-md transition-shadow text-center min-h-[44px]"
          >
            <div className={`flex items-center justify-center w-10 h-10 rounded-xl bg-accent ${kpi.color}`}>
              <Icon name={kpi.icon} size="md" />
            </div>
            <div className="flex flex-col gap-0.5">
              {statsLoading ? (
                <Icon name="hourglass_empty" size="sm" className="animate-spin mx-auto text-muted-foreground" />
              ) : (
                <span className="text-2xl font-bold">{stats[kpi.key]}</span>
              )}
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Tabs — Azure Ethos Subtle Card (Variation 3) */}
      <div className="inline-flex bg-accent p-1 rounded-xl flex-wrap" dir="rtl">
        {TABS.map((tab) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 min-h-[40px] ${
                active
                  ? "bg-card text-primary shadow-[0_2px_4px_rgba(0,0,0,0.05)] font-semibold"
                  : "text-muted-foreground hover:text-primary font-medium"
              }`}
            >
              <Icon name={tab.icon} size="sm" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {renderTab()}

      {/* Panels */}
      <CreateTemplatePanel
        isOpen={showCreateTemplate}
        onClose={() => setShowCreateTemplate(false)}
        onCreated={() => { loadStats(); setShowCreateTemplate(false) }}
      />

      <TemplateDetailPanel
        templateId={selectedTemplateId}
        onClose={() => setSelectedTemplateId(null)}
        onUpdated={loadStats}
      />

      <CreateRulePanel
        isOpen={showCreateRule}
        onClose={() => setShowCreateRule(false)}
        onCreated={() => { loadStats(); setShowCreateRule(false) }}
      />

      <RuleDetailPanel
        ruleId={selectedRuleId}
        onClose={() => setSelectedRuleId(null)}
        onUpdated={loadStats}
      />
    </div>
  )
}
