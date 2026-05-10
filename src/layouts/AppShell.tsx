'use client'

import { type ReactNode, useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────

type NavItem = {
  href: string
  label: string
  icon: ReactNode
  badge?: string | number
  children?: NavItem[]
}

type AppUser = {
  name: string
  email: string
  avatarUrl?: string
  role?: string
}

type AppShellProps = {
  children: ReactNode
  navItems: NavItem[]
  user: AppUser
  logo?: ReactNode
  onSearch?: (query: string) => void
  onNotificationClick?: () => void
  unreadCount?: number
}

// ── Component ──────────────────────────────────────────────

export function AppShell({
  children,
  navItems,
  user,
  logo,
  onSearch,
  onNotificationClick,
  unreadCount = 0,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Close mobile menu on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), [])
  const toggleMobileMenu = useCallback(
    () => setMobileMenuOpen((prev) => !prev),
    [],
  )

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div dir="rtl" className="flex h-screen overflow-hidden bg-slate-50">
      {/* ── Desktop Sidebar ── */}
      <aside
        className={`
          fixed right-0 top-0 z-30 hidden h-full flex-col border-l border-slate-200
          bg-white transition-all duration-300 lg:flex
          ${sidebarOpen ? 'w-72' : 'w-20'}
        `}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-slate-200 px-4">
          {logo ?? (
            <span className="text-lg font-bold text-slate-800">
              {sidebarOpen ? 'Dashboard' : 'D'}
            </span>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-2
                    text-sm font-medium transition-colors
                    ${
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }
                    ${!sidebarOpen ? 'justify-center px-2' : ''}
                  `}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                  {sidebarOpen && item.badge != null && (
                    <span className="mr-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User section */}
        <div className="border-t border-slate-200 p-4">
          <div
            className={`flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                user.name.charAt(0)
              )}
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {user.name}
                </p>
                {user.role && (
                  <p className="truncate text-xs text-slate-500">{user.role}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Mobile Overlay ── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Mobile Sidebar ── */}
      <aside
        className={`
          fixed right-0 top-0 z-50 h-full w-72 transform border-l border-slate-200
          bg-white transition-transform duration-300 lg:hidden
          ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          {logo ?? <span className="text-lg font-bold text-slate-800">Dashboard</span>}
          <button
            onClick={toggleMobileMenu}
            className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="סגור תפריט"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-2
                    text-sm font-medium transition-colors
                    ${
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }
                  `}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* ── Main area ── */}
      <div
        className={`
          flex flex-1 flex-col transition-all duration-300
          ${sidebarOpen ? 'lg:mr-72' : 'lg:mr-20'}
        `}
      >
        {/* TopBar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={toggleMobileMenu}
              className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="פתח תפריט"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>

            {/* Desktop toggle */}
            <button
              onClick={toggleSidebar}
              className="hidden min-h-[44px] min-w-[44px] rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:flex lg:items-center lg:justify-center"
              aria-label={sidebarOpen ? 'כווץ סרגל' : 'הרחב סרגל'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>

            {/* Search */}
            {onSearch && (
              <div className="hidden sm:block">
                <input
                  type="text"
                  placeholder="חיפוש..."
                  onChange={(e) => onSearch(e.target.value)}
                  className="h-10 w-64 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            {onNotificationClick && (
              <button
                onClick={onNotificationClick}
                className="relative min-h-[44px] min-w-[44px] rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="התראות"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -left-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
