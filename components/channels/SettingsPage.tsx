"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Icon } from "@/components/shared/Icon"
import { useConfirm } from "@/components/shared/ConfirmDialog"
import { ChannelsShell } from "./ChannelsShell"
import { ConnectionStatusPill } from "./shared/StatusPills"
import {
  getChannelConnection,
  retestConnection,
  saveChannelConnection,
  unlinkChannelConnection,
} from "@/lib/actions/channex"
import type { ChannelConnectionRow } from "@/lib/integrations/channex/types"

export function SettingsPage() {
  const [connection, setConnection] = useState<ChannelConnectionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [unlinking, setUnlinking] = useState(false)

  // Form state
  const [env, setEnv] = useState<"staging" | "production">("staging")
  const [apiKey, setApiKey] = useState("")

  const load = useCallback(async () => {
    const c = await getChannelConnection()
    setConnection(c)
    if (c) setEnv(c.environment)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    if (apiKey.trim().length < 10) {
      toast.error("מפתח API קצר מדי")
      return
    }
    setSaving(true)
    const res = await saveChannelConnection({ environment: env, apiKey: apiKey.trim() })
    setSaving(false)
    if (res.success) {
      toast.success("החיבור נשמר ואומת")
      setApiKey("")
      load()
    } else {
      toast.error(res.error)
      load()
    }
  }

  const handleTest = async () => {
    setTesting(true)
    const res = await retestConnection()
    setTesting(false)
    if (res.success) toast.success("חיבור תקין")
    else toast.error(res.error)
    load()
  }

  const { confirm, confirmDialog } = useConfirm()

  const handleUnlink = async () => {
    if (
      !(await confirm({
        message: "לנתק את החיבור ל-Channex? (הלוגים יישמרו)",
        danger: true,
        confirmLabel: "נתק",
      }))
    )
      return
    setUnlinking(true)
    const res = await unlinkChannelConnection()
    setUnlinking(false)
    if (res.success) {
      toast.success("החיבור נותק")
      load()
    } else {
      toast.error(res.error)
    }
  }

  const webhookUrl =
    process.env.NEXT_PUBLIC_CHANNEX_WEBHOOK_URL ??
    "https://pms.bios.co.il/api/channex/webhooks"

  return (
    <ChannelsShell>
      {confirmDialog}
      {loading ? (
        <div className="bg-card rounded-[20px] p-16 shadow-sm border border-border/20 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Credentials card */}
          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <h3 className="text-base font-bold">חיבור ל-Channex</h3>
              </div>
              <ConnectionStatusPill status={connection?.status ?? null} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground">
                  סביבה
                </label>
                <div className="relative">
                  <select
                    value={env}
                    onChange={(e) => setEnv(e.target.value as "staging" | "production")}
                    className="w-full bg-accent/60 border-0 rounded-xl px-4 py-3 pe-10 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none min-h-[48px] appearance-none cursor-pointer"
                  >
                    <option value="staging">בדיקות (staging)</option>
                    <option value="production">ייצור (production)</option>
                  </select>
                  <Icon
                    name="expand_more"
                    size="sm"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground">
                  מפתח API {connection && `(נוכחי: ${connection.apiKeyFingerprint})`}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={connection ? "הכנס כדי להחליף" : "הדבק מפתח Channex"}
                  dir="ltr"
                  className="w-full bg-accent/60 border-0 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none min-h-[48px]"
                />
              </div>
            </div>

            {connection?.statusDetail && connection.status === "error" && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-xs text-destructive font-bold flex items-center gap-2">
                <Icon name="error" size="sm" />
                {connection.statusDetail}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || apiKey.trim().length === 0}
                className="btn btn-primary"
              >
                <Icon name={saving ? "hourglass_empty" : "save"} size="sm" />
                {saving ? "שומר..." : "שמור ואמת"}
              </button>
              {connection && (
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="bg-accent hover:bg-accent/80 text-foreground px-4 py-2.5 rounded-xl font-bold text-xs min-h-[44px] flex items-center gap-2 disabled:opacity-50"
                >
                  <Icon name={testing ? "hourglass_empty" : "check_circle"} size="sm" />
                  בדוק חיבור
                </button>
              )}
            </div>
          </div>

          {/* Webhook card */}
          {connection && (
            <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <h3 className="text-base font-bold">Webhook</h3>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-muted-foreground">
                  כתובת קולבק (רק לקריאה — מוגדרת ב-.env)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={webhookUrl}
                    readOnly
                    dir="ltr"
                    className="flex-1 bg-accent/60 border-0 rounded-xl px-4 py-3 text-sm font-mono min-h-[48px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl)
                      toast.success("הועתק")
                    }}
                    className="h-12 w-12 min-h-[44px] min-w-[44px] rounded-xl bg-accent hover:bg-accent/80 text-foreground flex items-center justify-center"
                    title="העתק"
                  >
                    <Icon name="content_copy" size="sm" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="bg-accent/40 rounded-xl p-3">
                  <div className="font-bold text-muted-foreground mb-1">מזהה Webhook</div>
                  <div className="font-mono" dir="ltr">
                    {connection.webhookId ?? "טרם נרשם"}
                  </div>
                </div>
                <div className="bg-accent/40 rounded-xl p-3">
                  <div className="font-bold text-muted-foreground mb-1">Secret Header</div>
                  <div className="font-mono" dir="ltr">
                    ••••{connection.webhookSecret.slice(-8)}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ה-Webhook נרשם אוטומטית בעת הסנכרון הראשוני. אם משנים סביבה
                יש לבצע סנכרון ראשוני מחדש.
              </p>
            </div>
          )}

          {/* Danger zone */}
          {connection && (
            <div className="bg-card rounded-[20px] p-5 shadow-sm border border-destructive/30 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                <h3 className="text-base font-bold text-destructive">אזור מסוכן</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                ניתוק יסיר את ה-Webhook מ-Channex, יחסום סנכרונים חדשים
                וישמור את כל הלוגים וההיסטוריה.
              </p>
              <button
                type="button"
                onClick={handleUnlink}
                disabled={unlinking}
                className="self-start border border-destructive/40 text-destructive px-4 py-2.5 rounded-xl font-bold text-xs min-h-[44px] flex items-center gap-2 hover:bg-destructive/10 disabled:opacity-50"
              >
                <Icon name={unlinking ? "hourglass_empty" : "link_off"} size="sm" />
                נתק חיבור
              </button>
            </div>
          )}
        </div>
      )}
    </ChannelsShell>
  )
}
