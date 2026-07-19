"use client"

import { useTheme } from "next-themes"
import { Icon } from "@/components/shared/Icon"

interface TopBarProps {
  title: string
}

export function TopBar({ title }: TopBarProps) {
  const { theme, setTheme } = useTheme()

  return (
    <header
      className="sticky top-0 z-40 flex justify-between items-center px-8 py-4 glass-topbar border-b border-border/50 shadow-sm"
    >
      <div className="flex items-center gap-8">
        <h2 className="text-xl font-bold tracking-tight font-headline">{title}</h2>
        <div className="relative w-80 hidden md:block">
          <Icon name="search" size="sm" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="w-full pr-10 pl-4 py-3 bg-accent border border-border/40 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground min-h-[48px]"
            placeholder="חיפוש הזמנות, אורחים או חדרים..."
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2.5 text-muted-foreground hover:bg-accent rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} size="sm" />
        </button>

        {/* Notifications */}
        <button className="p-2.5 text-muted-foreground hover:bg-accent rounded-xl transition-colors relative min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Icon name="notifications" size="sm" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
        </button>

        {/* Language */}
        <button className="p-2.5 text-muted-foreground hover:bg-accent rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Icon name="translate" size="sm" />
        </button>

        {/* User avatar */}
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
          מ
        </div>
      </div>
    </header>
  )
}
