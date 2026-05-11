"use client"

import { ThemeProvider } from "next-themes"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { Toaster } from "sonner"

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
        <Toaster position="top-center" dir="rtl" richColors />
      </ThemeProvider>
    </NuqsAdapter>
  )
}
