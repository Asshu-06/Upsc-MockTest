import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { paperService } from '../../services/paperService'
import { attemptService } from '../../services/attemptService'
import { PaperCard } from '../../components/PaperCard'
import { Award, BookOpen, Clock, CheckCircle2, ArrowRight, Loader2, BarChart2 } from 'lucide-react'
import { formatScore, formatDate } from '../../lib/utils'

export function UserDashboard() {
  const { profile, user } = useAuth()
  const [papers, setPapers] = useState([])
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [pubPapers, userAtts] = await Promise.all([
          paperService.getPublishedPapers({ sort: 'year_desc' }),
          user?.id ? attemptService.getUserAttempts(user.id) : []
        ])
        setPapers(pubPapers || [])
        setAttempts(userAtts || [])
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [user])

  const completedAttempts = attempts.filter(a => a.status === 'completed')
  const inProgressAttempt = attempts.find(a => a.status === 'in_progress')

  const totalCompleted = completedAttempts.length
  const avgScore = totalCompleted > 0
    ? (completedAttempts.reduce((acc, a) => acc + Number(a.score || 0), 0) / totalCompleted).toFixed(2)
    : '0.00'
  const avgAccuracy = totalCompleted > 0
    ? (completedAttempts.reduce((acc, a) => acc + Number(a.accuracy || 0), 0) / totalCompleted).toFixed(2)
    : '0.00'

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Loading your dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Hero Banner */}
      <div className="bg-gradient-to-r from-primary to-blue-900 rounded-2xl p-6 sm:p-8 text-white shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="inline-block px-3 py-1 bg-white/10 text-white rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
            Aspirant Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {profile?.full_name || 'Aspirant'}!
          </h1>
          <p className="text-sm text-blue-100 mt-1 max-w-xl">
            Sharpen your UPSC Prelims exam strategy by attempting authentic past papers in real timed mode.
          </p>
        </div>

        {inProgressAttempt && (
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4 w-full md:w-auto min-w-[240px]">
            <div className="text-xs text-amber-300 font-bold uppercase tracking-wider mb-1">Active Exam in Progress</div>
            <div className="text-sm font-semibold text-white truncate max-w-[200px]">
              {inProgressAttempt.papers?.title || `Attempt #${inProgressAttempt.attempt_number}`}
            </div>
            <Link
              to={`/exam/${inProgressAttempt.paper_id}`}
              className="mt-3 block text-center py-2 px-4 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-subtle"
            >
              Resume Active Exam →
            </Link>
          </div>
        )}
      </div>

      {/* Quick Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-surface-border shadow-card flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-50 text-primary rounded-xl flex items-center justify-center font-bold">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-body-text">{totalCompleted}</div>
            <div className="text-xs text-body-secondary font-medium">Completed Papers</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-surface-border shadow-card flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-50 text-status-success rounded-xl flex items-center justify-center font-bold">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-body-text">{avgScore}</div>
            <div className="text-xs text-body-secondary font-medium">Average Score</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-surface-border shadow-card flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-bold">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-body-text">{avgAccuracy}%</div>
            <div className="text-xs text-body-secondary font-medium">Average Accuracy</div>
          </div>
        </div>
      </div>

      {/* Recent Attempt Section */}
      {completedAttempts.length > 0 && (
        <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-surface-border pb-3">
            <h2 className="text-base font-bold text-body-text">Recent Exam Attempt</h2>
            <Link to="/my-attempts" className="text-xs font-semibold text-primary hover:underline flex items-center space-x-1">
              <span>View All Attempts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {(() => {
            const latest = completedAttempts[0]
            return (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 gap-4">
                <div>
                  <span className="px-2 py-0.5 bg-blue-100 text-primary text-[10px] font-bold rounded uppercase">
                    Attempt #{latest.attempt_number}
                  </span>
                  <h3 className="font-bold text-sm text-body-text mt-1">
                    {latest.papers?.title || 'UPSC Question Paper'}
                  </h3>
                  <p className="text-xs text-body-secondary mt-0.5">
                    Completed on {formatDate(latest.submitted_at)}
                  </p>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <span className="text-xs text-body-secondary block">Score</span>
                    <span className="text-lg font-extrabold text-primary">{formatScore(latest.score)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-body-secondary block">Accuracy</span>
                    <span className="text-lg font-extrabold text-emerald-700">{latest.accuracy}%</span>
                  </div>
                  <Link
                    to={`/attempt/${latest.id}/result`}
                    className="py-2 px-4 bg-white border border-surface-border hover:bg-slate-100 text-body-text font-semibold text-xs rounded-lg transition-colors shadow-subtle"
                  >
                    View Result
                  </Link>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Available Papers Showcase */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-body-text">Available Published Papers</h2>
            <p className="text-xs text-body-secondary">Select a paper to start practicing in exam mode</p>
          </div>
          <Link to="/papers" className="text-xs font-semibold text-primary hover:underline flex items-center space-x-1">
            <span>Explore All Papers</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {papers.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-surface-border text-center text-body-secondary text-sm">
            No published question papers available yet. Please check back soon or contact admin.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {papers.slice(0, 3).map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
