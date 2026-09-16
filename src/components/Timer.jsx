import React from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import { formatTimeRemaining } from '../lib/utils'

export function Timer({ secondsLeft }) {
  const isLowTime = secondsLeft < 300 // Less than 5 minutes

  return (
    <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg border text-sm font-bold shadow-subtle transition-colors ${
      isLowTime
        ? 'bg-red-50 text-status-error border-red-300 animate-pulse'
        : 'bg-slate-50 text-primary border-surface-border'
    }`}>
      {isLowTime ? (
        <AlertTriangle className="w-4 h-4 text-status-error" />
      ) : (
        <Clock className="w-4 h-4 text-primary" />
      )}
      <span className="tabular-nums tracking-wide">
        {formatTimeRemaining(secondsLeft)}
      </span>
    </div>
  )
}
