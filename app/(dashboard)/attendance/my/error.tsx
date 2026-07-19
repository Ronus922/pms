"use client"

export default function AttendanceMyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-bold text-rose-600">
        שגיאה בטעינת הדף
      </h2>
      <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs font-mono whitespace-pre-wrap break-all">
        <div className="font-bold mb-2">Message:</div>
        <div>{error.message}</div>
        <div className="font-bold mt-3 mb-2">Stack:</div>
        <div>{error.stack ?? "no stack"}</div>
        {error.digest && (
          <>
            <div className="font-bold mt-3 mb-2">Digest:</div>
            <div>{error.digest}</div>
          </>
        )}
      </div>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground px-4 py-2 rounded font-bold"
      >
        נסה שוב
      </button>
    </div>
  )
}
