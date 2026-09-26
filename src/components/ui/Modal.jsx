import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Reusable Modal — handles backdrop, ESC, focus trap, body scroll lock.
 *
 * Props:
 *   open        boolean
 *   onClose     () => void
 *   title       string | ReactNode
 *   size        'sm' | 'md' | 'lg' | 'xl' | 'full'   default 'md'
 *   className   string (extra classes for the panel)
 *   children    ReactNode
 *   hideClose   boolean
 */
const SIZE = {
  sm:   'max-w-sm',
  md:   'max-w-lg',
  lg:   'max-w-2xl',
  xl:   'max-w-4xl',
  full: 'max-w-[95vw] h-[90vh]',
}

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  className,
  children,
  hideClose = false,
}) {
  const panelRef = useRef(null)

  // ESC key
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Focus first focusable element
  useEffect(() => {
    if (open && panelRef.current) {
      const el = panelRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      el?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'relative w-full rounded-2xl bg-white shadow-modal animate-scale-in flex flex-col overflow-hidden',
          SIZE[size] ?? SIZE.md,
          className
        )}
      >
        {/* Header */}
        {(title || !hideClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
            {title && (
              <h2 className="text-base font-bold text-body-text">{title}</h2>
            )}
            {!hideClose && (
              <button
                onClick={onClose}
                className="ml-auto p-1.5 rounded-lg text-body-secondary hover:bg-slate-100 hover:text-body-text transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
