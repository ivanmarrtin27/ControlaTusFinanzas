import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { IconClose } from '@/components/layout/icons'

export type ToastTone = 'success' | 'error'

export type ToastItem = {
  id: string
  message: string
  tone: ToastTone
}

type ToastApi = {
  success: (message: string) => void
  error: (message: string) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const MAX_TOASTS = 2
const SUCCESS_MS = 2800
const ERROR_MS = 4200

function uid() {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, number>())

  const clearTimer = useCallback((id: string) => {
    const handle = timers.current.get(id)
    if (handle != null) {
      window.clearTimeout(handle)
      timers.current.delete(id)
    }
  }, [])

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id)
      setToasts((prev) => prev.filter((t) => t.id !== id))
    },
    [clearTimer],
  )

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const text = message.trim()
      if (!text) return

      setToasts((prev) => {
        const existing = prev.find((t) => t.tone === tone && t.message === text)
        if (existing) {
          clearTimer(existing.id)
          const ms = tone === 'error' ? ERROR_MS : SUCCESS_MS
          timers.current.set(
            existing.id,
            window.setTimeout(() => dismiss(existing.id), ms),
          )
          return prev
        }

        const id = uid()
        const next = [...prev, { id, message: text, tone }].slice(-MAX_TOASTS)
        const dropped = prev.filter((t) => !next.some((n) => n.id === t.id))
        for (const t of dropped) clearTimer(t.id)

        const ms = tone === 'error' ? ERROR_MS : SUCCESS_MS
        timers.current.set(
          id,
          window.setTimeout(() => dismiss(id), ms),
        )
        return next
      })
    },
    [clearTimer, dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined'
        ? createPortal(
            <div className="toast-viewport" aria-live="polite" aria-relevant="additions text">
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className={`toast toast-${toast.tone}`}
                  role={toast.tone === 'error' ? 'alert' : 'status'}
                  aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
                >
                  <p className="toast-message">{toast.message}</p>
                  <button
                    type="button"
                    className="toast-dismiss"
                    aria-label="Cerrar aviso"
                    onClick={() => dismiss(toast.id)}
                  >
                    <IconClose />
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de ToastProvider')
  }
  return ctx
}
