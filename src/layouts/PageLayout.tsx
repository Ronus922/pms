'use client'

import type { ReactNode } from 'react'

type PageLayoutProps = {
  children: ReactNode
  /** Optional class overrides */
  className?: string
  /** Disable the max-width constraint */
  fluid?: boolean
}

/**
 * Standard page wrapper — consistent padding, max-width, RTL.
 * Used inside AppShell's main content area.
 */
export function PageLayout({
  children,
  className = '',
  fluid = false,
}: PageLayoutProps) {
  return (
    <div
      dir="rtl"
      className={`
        flex flex-col gap-6
        px-4 py-4
        md:px-8 md:py-6
        ${fluid ? '' : 'mx-auto max-w-[1600px]'}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
