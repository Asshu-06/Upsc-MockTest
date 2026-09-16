import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { attemptService } from '../../services/attemptService'
import { paperService } from '../../services/paperService'
import { AttemptComparisonCard } from '../../components/AttemptComparisonCard'
import { ArrowLeft, Loader2, GitCompare, RefreshCw, AlertCircle } from 'lucide-react'

export function CompareAttemptsPage() {
  const { paperId } = useParams()
  const { user } = useAuth()

  const [paper, setPaper] = useState(null)
  const [comparisonData, setComparisonData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadComparison() {
      if (!user) return
      try {
        const [paperData, comp] = await Promise.all([
          paperService.getPaperById(paperId),
          attemptService.compareLatestWithPreviousAttempt(user.id, paperId)
        ])
        setPaper(paperData)
        setComparisonData(comp)
      } catch (err) {
        console.error('Error loading attempt comparison:', err)
        setError(err.message || 'Failed to compare attempt performance.')
      } finally {
        setLoading(false)
      }
    }

    loadComparison()
  }, [paperId, user])

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Calculating consecutive attempt performance deltas...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link to="/my-attempts" className="inline-flex items-center space-x-1.5 text-xs font-semibold text-body-secondary hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Attempts</span>
        </Link>
        <Link
          to={`/papers/${paperId}`}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-colors shadow-subtle"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reattempt Paper</span>
        </Link>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-body-text">Attempt Comparison & Progress Analytics</h1>
        <p className="text-xs text-body-secondary mt-1">
          {paper?.title || 'UPSC Question Paper'} — Performance comparison against immediately preceding attempt
        </p>
      </div>

      {/* Main Comparison Component */}
      <AttemptComparisonCard comparisonData={comparisonData} />
    </div>
  )
}
