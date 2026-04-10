import { Icon } from "@/components/shared/Icon"

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
      <Icon name="construction" size="xl" className="opacity-30" />
      <p className="text-lg font-medium">בפיתוח</p>
    </div>
  )
}
