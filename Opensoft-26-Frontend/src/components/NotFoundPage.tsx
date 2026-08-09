import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'

/**
 * Replaces the previous silent `<Navigate to="/" />` catch-all, which made
 * typos and dead links indistinguishable from a working redirect.
 */
export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0B0E11] px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <Compass className="h-6 w-6 text-[#00C076]" aria-hidden="true" />
      </div>
      <p className="font-mono text-5xl font-black tracking-tighter text-white">404</p>
      <h1 className="text-lg font-semibold text-white">This page doesn’t exist</h1>
      <p className="max-w-sm text-sm text-gray-400">
        The link may be outdated, or the page may have moved. Everything else on the platform is running normally.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-200 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </button>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="rounded-md bg-gradient-to-r from-[#00C076] to-white px-5 py-2.5 text-sm font-bold text-[#0B0E14] transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C076]"
        >
          Back to home
        </button>
      </div>
    </div>
  )
}
