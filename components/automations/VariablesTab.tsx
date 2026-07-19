"use client"

import { useEffect, useState, useCallback } from "react"
import { Icon } from "@/components/shared/Icon"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getVariables, seedDefaultVariables } from "@/lib/actions/automations"
import { toast } from "sonner"
import type { DynamicVariable } from "@/lib/types/automations"

const ENTITY_TYPE_MAP: Record<string, { label: string; icon: string }> = {
  global: { label: "כללי", icon: "public" },
  guest: { label: "אורח", icon: "person" },
  reservation: { label: "הזמנה", icon: "book_online" },
  task: { label: "משימה", icon: "check_circle" },
  maintenance: { label: "תחזוקה", icon: "construction" },
  supplier: { label: "ספק", icon: "local_shipping" },
  user: { label: "משתמש", icon: "person" },
}

function groupByEntity(variables: DynamicVariable[]): Record<string, DynamicVariable[]> {
  const groups: Record<string, DynamicVariable[]> = {}
  for (const v of variables) {
    if (!groups[v.entity_type]) groups[v.entity_type] = []
    groups[v.entity_type].push(v)
  }
  return groups
}

export function VariablesTab() {
  const { tenantId } = useTenant()
  const [variables, setVariables] = useState<DynamicVariable[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getVariables(tenantId)
      setVariables(data)
    } catch {
      toast.error("שגיאה בטעינת משתנים")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function handleSeed() {
    setSeeding(true)
    try {
      await seedDefaultVariables(tenantId)
      toast.success("ברירות מחדל נטענו בהצלחה")
      load()
    } catch {
      toast.error("שגיאה בטעינת ברירות מחדל")
    } finally {
      setSeeding(false)
    }
  }

  function copyToClipboard(key: string) {
    navigator.clipboard.writeText(`{{${key}}}`)
    toast.success(`הועתק: {{${key}}}`)
  }

  const grouped = groupByEntity(variables)
  const entityOrder = ["global", "guest", "reservation", "task", "maintenance", "supplier", "user"]
  const sortedEntities = entityOrder.filter((e) => grouped[e])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="hourglass_empty" className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          משתנים דינמיים זמינים לשימוש בתבניות הודעות. העתק את שם המשתנה כדי להשתמש בו.
        </p>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-3 min-h-[44px] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {seeding ? (
            <Icon name="hourglass_empty" size="sm" className="animate-spin" />
          ) : (
            <Icon name="download" size="sm" />
          )}
          טען ברירות מחדל
        </button>
      </div>

      {variables.length === 0 ? (
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 text-center py-12">
          <Icon name="bolt" size="xl" className="mx-auto opacity-30 mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">אין משתנים מוגדרים. לחץ על &quot;טען ברירות מחדל&quot; ליצירת משתנים בסיסיים.</p>
        </div>
      ) : (
        sortedEntities.map((entityType) => {
          const meta = ENTITY_TYPE_MAP[entityType] ?? { label: entityType, icon: "bolt" }
          const vars = grouped[entityType]
          return (
            <div key={entityType} className="bg-card rounded-[20px] shadow-sm border border-border/20 overflow-hidden">
              {/* Group Header */}
              <div className="flex items-center gap-3 px-5 py-4 bg-accent/60 border-b border-border/10">
                <Icon name={meta.icon} size="md" className="text-muted-foreground" />
                <h3 className="text-sm font-semibold">{meta.label}</h3>
                <span className="text-xs text-muted-foreground">({vars.length})</span>
              </div>

              {/* Table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary/10">
                    <th className="text-right px-5 py-3 text-xs font-bold text-foreground/70 w-[220px]">משתנה</th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-foreground/70">תווית</th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-foreground/70">ערך לדוגמה</th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-foreground/70 max-lg:hidden">תיאור</th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-foreground/70 w-[80px]">העתק</th>
                  </tr>
                </thead>
                <tbody>
                  {vars.map((v, idx) => (
                    <tr
                      key={v.id}
                      className={`border-t border-border/10 transition-colors ${idx % 2 === 1 ? "bg-accent/40" : ""}`}
                    >
                      <td className="px-5 py-3">
                        <code className="bg-accent px-2 py-0.5 rounded text-xs font-mono text-primary">
                          {`{{${v.variable_key}}}`}
                        </code>
                      </td>
                      <td className="px-5 py-3 text-sm">{v.variable_label}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{v.example_value}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground max-lg:hidden">{v.description || "—"}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => copyToClipboard(v.variable_key)}
                          className="p-2 rounded-lg hover:bg-accent transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="העתק"
                        >
                          <Icon name="copy" size="sm" className="text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </div>
  )
}
