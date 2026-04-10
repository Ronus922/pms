"use client"

import { ThemeProvider } from "next-themes"
import { NuqsAdapter } from "nuqs/adapters/next/app"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </NuqsAdapter>
  )
}
