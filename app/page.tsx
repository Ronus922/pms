import { Icon } from "@/components/shared/Icon"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background p-8">
      <div className="flex items-center gap-3">
        <Icon name="hotel_class" size="xl" className="text-primary" />
        <h1 className="text-4xl font-bold tracking-tight">GuestHub</h1>
      </div>
      <p className="text-lg text-muted-foreground">
        מערכת ניהול נכסים ומלונאות
      </p>
      <div className="flex gap-4">
        <a
          href="/login"
          className="rounded-xl bg-primary px-6 py-3 text-primary-foreground font-medium transition-colors hover:bg-primary/90 min-h-[44px]"
        >
          כניסה למערכת
        </a>
        <a
          href="/register"
          className="rounded-xl border border-border px-6 py-3 font-medium transition-colors hover:bg-accent min-h-[44px]"
        >
          התחל ניסיון חינם
        </a>
      </div>
    </div>
  )
}
