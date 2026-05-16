"use client"

import { Font } from "@react-pdf/renderer"

let registered = false

export function registerFonts(): void {
  if (registered) return
  Font.register({
    family: "Heebo",
    fonts: [
      { src: "/fonts/Heebo/Heebo-Regular.ttf", fontWeight: 400 },
      { src: "/fonts/Heebo/Heebo-Bold.ttf",    fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((word) => [word])
  registered = true
}
