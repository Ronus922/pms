import { Hotel } from "lucide-react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Right panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-bl from-primary to-primary-container items-center justify-center p-12">
        <div className="text-center text-primary-foreground space-y-6 max-w-md">
          <div className="w-20 h-20 rounded-[20px] bg-white/20 backdrop-blur-xl flex items-center justify-center mx-auto">
            <Hotel size={36} className="text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-extrabold font-headline tracking-tight">GuestHub</h1>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            מערכת ניהול מלונאות חכמה — לוח תפוסה, הזמנות, אורחים, ניקיון ותחזוקה. הכל במקום אחד.
          </p>
        </div>
      </div>
      {/* Left panel - form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}
