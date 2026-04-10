"use client"

interface LanguageSwitcherProps {
  currentLanguage: string
  onLanguageChange: (lang: string) => void
  completionStatus: Record<string, "complete" | "partial" | "missing">
}

const LANGUAGES = [
  { code: "he", label: "עברית" },
  { code: "en", label: "English" },
  { code: "ar", label: "عربية" },
] as const

const STATUS_COLORS: Record<string, string> = {
  complete: "bg-green-500",
  partial: "bg-yellow-400",
  missing: "bg-red-500",
}

export function LanguageSwitcher({
  currentLanguage,
  onLanguageChange,
  completionStatus,
}: LanguageSwitcherProps) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/5">
      {LANGUAGES.map(({ code, label }) => {
        const isActive = currentLanguage === code
        const status = completionStatus[code] ?? "missing"

        return (
          <button
            key={code}
            type="button"
            onClick={() => onLanguageChange(code)}
            className={`flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors
              ${
                isActive
                  ? "bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[status]}`}
              title={status}
            />
            {label}
          </button>
        )
      })}
    </div>
  )
}
