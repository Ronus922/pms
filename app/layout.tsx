import type { Metadata } from "next"

import { AppProviders } from "./providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "GuestHub - Property Management System",
  description: "מערכת ניהול נכסים ומלונאות",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-body">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
