"use client"

import { useState } from "react"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"

interface DashboardShellProps {
  children: React.ReactNode
  title: string
  tenantName?: string
}

export function DashboardShell({ children, title, tenantName }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen">
      <Sidebar
        tenantName={tenantName}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? "mr-20" : "mr-72"}`}>
        <TopBar title={title} />
        <main className="flex-1 px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
