import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export type Toast = {
  id: number
  title: string
  description?: string
  variant: ToastVariant
  duration: number
}

type ToastInput = {
  title: string
  description?: string
  variant?: ToastVariant
  /** 0 keeps the toast until dismissed. */
  duration?: number
}

type ToastContextValue = {
  toast: (input: ToastInput) => number
  dismiss: (id: number) => void
  success: (title: string, description?: string) => number
  error: (title: string, description?: string) => number
  info: (title: string, description?: string) => number
  warning: (title: string, description?: string) => number
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 5000
const MAX_VISIBLE = 4

const VARIANT_STYLE: Record<ToastVariant, { icon: typeof Info; accent: string; ring: string }> = {
  success: { icon: CheckCircle2, accent: '#00C076', ring: 'rgba(0, 192, 118, 0.35)' },
  error: { icon: XCircle, accent: '#FF4560', ring: 'rgba(255, 69, 96, 0.35)' },
  warning: { icon: AlertTriangle, accent: '#F5A623', ring: 'rgba(245, 166, 35, 0.35)' },
  info: { icon: Info, accent: '#4C9AFF', ring: 'rgba(76, 154, 255, 0.35)' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  // Track timers so unmounting mid-flight cannot setState on a dead tree.
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    ({ title, description, variant = 'info', duration = DEFAULT_DURATION }: ToastInput) => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, title, description, variant, duration }].slice(-MAX_VISIBLE))
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        )
      }
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, variant: 'success' }),
      error: (title, description) => toast({ title, description, variant: 'error' }),
      info: (title, description) => toast({ title, description, variant: 'info' }),
      warning: (title, description) => toast({ title, description, variant: 'warning' }),
    }),
    [toast, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null

  return (
    <div
      // `polite` so screen readers announce without interrupting the user.
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(calc(100vw-2rem),380px)] flex-col gap-2"
    >
      {toasts.map((t) => {
        const { icon: Icon, accent, ring } = VARIANT_STYLE[t.variant]
        return (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-2xl shadow-black/50 backdrop-blur-xl"
            style={{
              backgroundColor: 'rgba(20, 25, 33, 0.96)',
              borderColor: ring,
              animation: 'oak-toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold leading-tight text-white">{t.title}</div>
              {t.description && (
                <div className="mt-1 text-[12px] leading-snug text-gray-400 break-words">{t.description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label={`Dismiss notification: ${t.title}`}
              className="shrink-0 rounded p-0.5 text-gray-500 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>')
  return ctx
}
