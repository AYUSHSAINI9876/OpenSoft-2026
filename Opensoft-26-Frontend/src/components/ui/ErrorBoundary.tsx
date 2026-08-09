import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Catches render-time crashes so a single bad panel (a chart with malformed
 * data, a null field from the API) shows a recoverable message instead of a
 * blank white page.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept as console output — swap for your error reporter (Sentry et al).
    console.error('[Oak Capital] Unhandled UI error:', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0B0E11] px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#FF4560]/30 bg-[#FF4560]/10">
          <AlertTriangle className="h-6 w-6 text-[#FF4560]" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-white">Something went wrong</h1>
        <p className="max-w-md text-sm text-gray-400">
          The interface hit an unexpected error and stopped rendering. Your account and open orders are unaffected.
        </p>
        <pre className="max-w-lg overflow-x-auto rounded-md border border-white/10 bg-black/40 p-3 text-left text-[11px] text-gray-500">
          {error.message}
        </pre>
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-2 inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-[#00C076] to-white px-5 py-2.5 text-sm font-bold text-[#0B0E14] transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C076]"
        >
          <RefreshCw className="h-4 w-4" />
          Reload the app
        </button>
      </div>
    )
  }
}
