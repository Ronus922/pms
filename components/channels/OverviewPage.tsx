"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Icon } from "@/components/shared/Icon"
import { ChannelsShell } from "./ChannelsShell"
import { ConnectionStatusPill } from "./shared/StatusPills"
import {
  getChannelConnection,
  getChannexOverviewStats,
  runChannexWorkerOnce,
  triggerInitialSync,
} from "@/lib/actions/channex"
import type { ChannelConnectionRow } from "@/lib/integrations/channex/types"

interface Stats {
  mapped_room_types: number
  total_room_types: number
  pending_jobs: number
  failed_jobs: number
  unacked_revisions: number
  open_mapping_issues: number
  unack_delivery_errors: number
  recent_logs: Array<{
    id: string
    endpoint: string
    http_method: string
    response_status: number | null
    error: string | null
    duration_ms: number | null
    created_at: string
  }>
}

export function OverviewPage() {
  const [connection, setConnection] = useState<ChannelConnectionRow | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    const [conn, s] = await Promise.all([
      getChannelConnection(),
      getChannexOverviewStats(),
    ])
    setConnection(conn)
    setStats(s)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const i = setInterval(load, 10_000)
    return () => clearInterval(i)
  }, [load])

  const handleInitialSync = async () => {
    setSyncing(true)
    const res = await triggerInitialSync()
    setSyncing(false)
    if (res.success) {
      toast.success("סנכרון ראשוני הוכנס לתור")
      load()
    } else {
      toast.error(res.error)
    }
  }

  const handleRunNow = async () => {
    setRunning(true)
    const res = await runChannexWorkerOnce(50)
    setRunning(false)
    if (res.success) {
      toast.success(
        `עובדו ${res.picked} משימות (${res.done} הצליחו, ${res.failed} נכשלו, ${res.retried} נסיון חוזר)`,
      )
      load()
    } else {
      toast.error(res.error)
    }
  }

  if (loading && !connection) {
    return (
      <ChannelsShell>
        <div className="bg-card rounded-[20px] p-16 shadow-sm border border-border/20 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </ChannelsShell>
    )
  }

  return (
    <ChannelsShell>
      {/* Connection state banner */}
      <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon name="cloud" size="lg" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold">Channex.io</span>
              <ConnectionStatusPill status={connection?.status ?? null} />
            </div>
            <span className="text-xs text-muted-foreground">
              {connection
                ? `סביבה: ${
                    connection.environment === "production" ? "ייצור" : "בדיקות"
                  } · מפתח ${connection.apiKeyFingerprint} · ${
                    connection.lastTestAt
                      ? `בדיקה אחרונה: ${new Date(connection.lastTestAt).toLocaleString("he-IL")}`
                      : "טרם נבדק"
                  }`
                : "לא נוצר חיבור"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!connection && (
            <Link
              href="/channels/settings"
              className="btn btn-primary"
            >
              <Icon name="add_link" size="sm" /> חבר ל-Channex
            </Link>
          )}
          {connection && connection.status === "connected" && (
            <>
              <button
                type="button"
                onClick={handleInitialSync}
                disabled={syncing}
                className="btn btn-primary"
              >
                <Icon name={syncing ? "hourglass_empty" : "cloud_upload"} size="sm" />
                {syncing ? "טוען..." : "סנכרון ראשוני"}
              </button>
              <button
                type="button"
                onClick={handleRunNow}
                disabled={running}
                className="bg-accent hover:bg-accent/80 text-foreground px-4 py-2.5 rounded-xl font-bold text-xs min-h-[44px] flex items-center gap-2 disabled:opacity-50"
              >
                <Icon name={running ? "hourglass_empty" : "play_arrow"} size="sm" />
                הרץ worker עכשיו
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon="link"
            label="סוגי חדרים ממופים"
            value={`${stats.mapped_room_types} / ${stats.total_room_types}`}
            color="emerald"
          />
          <StatCard
            icon="schedule"
            label="משימות בתור"
            value={stats.pending_jobs}
            color="blue"
          />
          <StatCard
            icon="error"
            label="משימות שנכשלו"
            value={stats.failed_jobs}
            color="destructive"
          />
          <StatCard
            icon="inbox"
            label="הזמנות לא מאושרות"
            value={stats.unacked_revisions}
            color="amber"
          />
        </div>
      )}

      {/* Issues row */}
      {stats &&
        (stats.open_mapping_issues > 0 ||
          stats.unack_delivery_errors > 0) && (
          <div className="bg-card rounded-[20px] p-5 shadow-sm border border-amber-200 flex items-center gap-4">
            <Icon name="warning" size="md" className="text-amber-600 shrink-0" />
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="text-sm font-bold text-amber-700">
                נדרשת התערבות
              </span>
              <span className="text-xs text-muted-foreground">
                {stats.open_mapping_issues} בעיות מיפוי פתוחות ·{" "}
                {stats.unack_delivery_errors} שגיאות מסירה לא טופלו
              </span>
            </div>
            <Link
              href="/channels/bookings"
              className="text-xs font-bold text-primary hover:underline px-3 py-1.5"
            >
              פתח →
            </Link>
          </div>
        )}

      {/* Extranet CTA (we don't have WhiteLabel — operators connect OTAs manually) */}
      {connection && connection.status === "connected" && (
        <div className="bg-accent/50 rounded-[20px] p-5 border border-border/20 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Icon name="open_in_new" size="md" className="text-muted-foreground" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold">חיבור ערוצי OTA</span>
              <span className="text-xs text-muted-foreground">
                התחברות ל-Booking.com, Airbnb ו-Expedia מתבצעת ישירות ב-Extranet של Channex.
              </span>
            </div>
          </div>
          <a
            href={
              connection.environment === "production"
                ? "https://channex.io"
                : "https://staging.channex.io"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            פתח Extranet <Icon name="open_in_new" size="sm" />
          </a>
        </div>
      )}

      {/* Recent activity */}
      {stats && stats.recent_logs.length > 0 && (
        <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <h3 className="text-base font-bold">פעילות אחרונה</h3>
          </div>
          <div className="divide-y divide-border/10">
            {stats.recent_logs.map((l) => (
              <div
                key={l.id}
                className="py-2 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`inline-flex items-center justify-center h-6 w-12 rounded-full font-bold border ${
                      l.response_status && l.response_status >= 200 && l.response_status < 300
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-destructive/10 text-destructive border-destructive/30"
                    }`}
                  >
                    {l.response_status ?? "–"}
                  </span>
                  <span className="font-bold">{l.http_method}</span>
                  <span className="text-muted-foreground truncate" dir="ltr">
                    {l.endpoint}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                  <span>{l.duration_ms ? `${l.duration_ms}ms` : ""}</span>
                  <span>{new Date(l.created_at).toLocaleTimeString("he-IL")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChannelsShell>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string
  label: string
  value: string | number
  color: "emerald" | "blue" | "destructive" | "amber"
}) {
  const colorCls = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    destructive: "bg-destructive/10 text-destructive",
    amber: "bg-amber-50 text-amber-700",
  }[color]
  return (
    <div className="bg-card rounded-[20px] p-5 shadow-sm border border-border/20 flex flex-col gap-2">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorCls}`}>
        <Icon name={icon} size="md" />
      </div>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-[11px] font-bold text-muted-foreground">{label}</div>
    </div>
  )
}
