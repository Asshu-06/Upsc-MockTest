import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { attemptService } from '../../services/attemptService'
import { History, Award, CheckCircle2, XCircle, ArrowRight, GitCompare, Loader2, Play } from 'lucide-react'
import { formatScore, formatDate } from '../../lib/utils'

export function AttemptHistoryPage() {
  const { user } = useAuth()
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadHistory() {
      if (!user) return
      try {
        const data = await attemptService.getUserAttempts(user.id)
        setAttempts(data || [])
      } catch (err) {
        console.error('Error fetching attempt history:', err)
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [user])

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Fetching attempt history...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-body-text">My Exam Attempt History</h1>
        <p className="text-xs text-body-secondary mt-1">Review all your previous exam practice attempts and compare progress over time</p>
      </div>

      {attempts.length === 0 ? (
        <div className="bg-white rounded-xl border border-surface-border p-12 text-center space-y-4">
          <History className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-body-text">No Attempts Found</h3>
          <p className="text-xs text-body-secondary max-w-sm mx-auto">
            You haven't attempted any question papers yet. Browse available papers and take your first exam practice!
          </p>
          <Link to="/papers" className="inline-block px-5 py-2.5 bg-primary text-white font-bold rounded-lg text-xs shadow-subtle">
            Browse Papers Catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {attempts.map((att) => {
            const isCompleted = att.status === 'completed'
            const isInProgress = att.status === 'in_progress'

            return (
              <div
                key={att.id}
                className="bg-white rounded-xl border border-surface-border p-5 shadow-card hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Info Column */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-primary border border-blue-100">
                      Attempt #{att.attempt_number}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {att.status.replace('_', ' ')}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-body-text">
                    {att.papers?.title || 'UPSC Question Paper'}
                  </h3>

                  <p className="text-xs text-body-secondary">
                    {isCompleted ? `Submitted on ${formatDate(att.submitted_at)}` : `Started on ${formatDate(att.started_at)}`}
                  </p>
                </div>

                {/* Score & Metrics Pill */}
                {isCompleted ? (
                  <div className="flex items-center space-x-6 text-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-body-secondary uppercase font-bold block">Score</span>
                      <span className="text-lg font-extrabold text-primary">{formatScore(att.score)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-body-secondary uppercase font-bold block">Correct</span>
                      <span className="text-sm font-bold text-emerald-700">{att.correct_count}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-body-secondary uppercase font-bold block">Accuracy</span>
                      <span className="text-sm font-bold text-indigo-700">{att.accuracy}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-amber-700 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">
                    Exam currently in progress
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center space-x-2 w-full md:w-auto">
                  {isCompleted ? (
                    <>
                      <Link
                        to={`/attempt/${att.id}/result`}
                        className="flex-1 md:flex-none px-4 py-2 bg-white border border-surface-border text-body-text hover:bg-slate-50 font-semibold text-xs rounded-lg transition-colors text-center"
                      >
                        View Result
                      </Link>
                      <Link
                        to={`/compare/${att.paper_id}`}
                        className="flex-1 md:flex-none px-4 py-2 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg transition-colors text-center flex items-center justify-center space-x-1 shadow-subtle"
                      >
                        <GitCompare className="w-3.5 h-3.5" />
                        <span>Compare</span>
                      </Link>
                    </>
                  ) : (
                    <Link
                      to={`/exam/${att.paper_id}`}
                      className="w-full md:w-auto px-6 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors text-center flex items-center justify-center space-x-1 shadow-subtle"
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>Resume Exam</span>
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
