/**
 * Shown while a lazily-loaded route chunk is downloading. Deliberately
 * lightweight (no images, no data fetching) so it paints instantly.
 */
export default function RouteFallback({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0B0E11]"
    >
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#00C076]" />
      </div>
      <span className="text-[13px] font-medium tracking-wide text-gray-500">{label}…</span>
    </div>
  )
}
