import React, { useEffect, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { attemptService } from '../../services/attemptService'
import { paperService } from '../../services/paperService'
import { ResultSummary } from '../../components/ResultSummary'
import { AttemptComparisonCard } from '../../components/AttemptComparisonCard'
import { Loader2, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react'

export function ResultPage() {
  const { attemptId } = useParams()
  const location = useLocation()

  const [attemptDetails, setAttemptDetails] = useState(null)
  const [comparisonData, setComparisonData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadResultData() {
      try {
        const data = await attemptService.getAttemptDetails(attemptId)
        setAttemptDetails(data)

        if (data?.attempt?.user_id && data?.attempt?.paper_id) {
          const comp = await attemptService.compareLatestWithPreviousAttempt(
            data.attempt.user_id,
            data.attempt.paper_id,
            data.attempt.id
          )
          setComparisonData(comp)
        }
      } catch (err) {
        console.error('Error fetching result details:', err)
        setError(err.message || 'Failed to load exam results.')
      } finally {
        setLoading(false)
      }
    }

    loadResultData()
  }, [attemptId])

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Generating score analytics...</p>
      </div>
    )
  }

  if (error || !attemptDetails?.attempt) {
    return (
      <div className="bg-white rounded-xl border border-surface-border p-8 text-center max-w-lg mx-auto my-8">
        <AlertCircle className="w-10 h-10 text-status-error mx-auto mb-3" />
        <h2 className="text-lg font-bold text-body-text">Result Not Found</h2>
        <p className="text-xs text-body-secondary mt-1 mb-6">{error || 'Requested attempt result does not exist.'}</p>
        <Link to="/my-attempts" className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold">
          View My Attempt History
        </Link>
      </div>
    )
  }

  const { attempt } = attemptDetails
  const paper = attempt.papers

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link to="/my-attempts" className="inline-flex items-center space-x-1.5 text-xs font-semibold text-body-secondary hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Attempt History</span>
        </Link>
        <Link
          to={`/papers/${attempt.paper_id}`}
          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold shadow-subtle transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reattempt Paper</span>
        </Link>
      </div>

      {/* Main Score Summary Component */}
      <ResultSummary attempt={attempt} paper={paper} />

      {/* Comparison Delta Component */}
      {comparisonData && (
        <AttemptComparisonCard comparisonData={comparisonData} />
      )}
    </div>
  )
}
