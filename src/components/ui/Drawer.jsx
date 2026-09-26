import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Slide-over Drawer — slides from right (default) or left.
 *
 * Props:
 *   open      boolean
 *   onClose   () => void
 *   title     string | ReactNode
 *   side      'right' | 'left'   default 'right'
 *   width     string             default 'max-w-xl'
 *   children  ReactNode
 */
export function Drawer({
  open,
  onClose,
  title,
  side = 'right',
  width = 'max-w-xl',
  children,
}) {
  // ESC
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const translateFrom = side === 'right' ? 'translate-x-full' : '-translate-x-full'

  return (
    <div
      className={cn(
        'fixed inset-0 z-[1000] flex',
        side === 'right' ? 'justify-end' : 'justify-start',
        !open && 'pointer-events-none'
      )}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'relative h-full w-full bg-white shadow-modal flex flex-col',
          'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          width,
          open ? 'translate-x-0' : translateFrom
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
          {title && <h2 className="text-base font-bold text-body-text">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-body-secondary hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
