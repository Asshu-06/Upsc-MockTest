import React from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'

const ICONS = {
  success: <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />,
  error:   <XCircle     className="w-4 h-4 text-red-400   shrink-0" />,
  info:    <Info        className="w-4 h-4 text-blue-400  shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />,
}

const BG = {
  success: 'border-green-500/30  bg-green-950/80',
  error:   'border-red-500/30    bg-red-950/80',
  info:    'border-blue-500/30   bg-blue-950/80',
  warning: 'border-yellow-500/30 bg-yellow-950/80',
}

export function ToastContainer() {
  const { toasts, removeToast } = useApp()

  if (!toasts.length) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map(({ id, message, type }) => (
        <div
          key={id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border
            backdrop-blur-md text-white text-sm shadow-modal animate-toast-in
            ${BG[type] ?? BG.info}`}
        >
          {ICONS[type] ?? ICONS.info}
          <p className="flex-1 leading-snug">{message}</p>
          <button
            onClick={() => removeToast(id)}
            className="opacity-50 hover:opacity-100 transition-opacity mt-0.5"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
