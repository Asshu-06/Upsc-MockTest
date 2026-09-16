import React, { useEffect, useState } from 'react'
import { attemptService } from '../../services/attemptService'
import { Users, Search, Filter, Loader2, Award, CheckCircle2, Calendar } from 'lucide-react'
import { formatScore, formatDate } from '../../lib/utils'

export function AdminAttemptsPage() {
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  const loadAttempts = async () => {
    setLoading(true)
    try {
      const data = await attemptService.getAllAttemptsForAdmin({ status: statusFilter })
      setAttempts(data || [])
    } catch (err) {
      console.error('Failed to load admin attempts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAttempts()
  }, [statusFilter])

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Loading user exam attempt logs...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-body-text">Platform Exam Attempt Reports</h1>
          <p className="text-xs text-body-secondary mt-1">Audit user attempt completion logs, scores, and accuracy metrics</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-surface-border text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed Only</option>
            <option value="in_progress">In Progress Only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-surface-border shadow-card overflow-hidden">
        {attempts.length === 0 ? (
          <div className="p-12 text-center text-body-secondary text-xs">
            No user attempts recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-body-secondary uppercase font-semibold border-b border-surface-border">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Paper</th>
                  <th className="py-3 px-4">Attempt #</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Accuracy</th>
                  <th className="py-3 px-4">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {attempts.map((att) => {
                  const isCompleted = att.status === 'completed'
                  const userEmail = att.profiles?.email || 'User'
                  const userName = att.profiles?.full_name || 'Aspirant'

                  return (
                    <tr key={att.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-bold text-body-text">
                        <div>{userName}</div>
                        <div className="text-[10px] text-body-secondary font-normal">{userEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-body-text max-w-xs truncate" title={att.papers?.title}>
                        {att.papers?.title || 'Question Paper'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-primary">
                        Attempt #{att.attempt_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {att.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-primary text-sm">
                        {isCompleted ? formatScore(att.score) : '—'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700">
                        {isCompleted ? `${att.accuracy}%` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-body-secondary">
                        {att.submitted_at ? formatDate(att.submitted_at) : formatDate(att.started_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
