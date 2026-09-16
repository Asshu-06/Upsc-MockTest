import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { attemptService } from '../../services/attemptService'
import { questionService } from '../../services/questionService'
import { QuestionCard } from '../../components/QuestionCard'
import { Loader2, ArrowLeft, Filter, CheckCircle2, XCircle, AlertCircle, BookOpen } from 'lucide-react'

export function QuestionReviewPage() {
  const { attemptId } = useParams()

  const [attemptDetails, setAttemptDetails] = useState(null)
  const [questions, setQuestions] = useState([])
  const [userAnswersMap, setUserAnswersMap] = useState({})
  const [filter, setFilter] = useState('all') // 'all' | 'correct' | 'incorrect' | 'unanswered'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadReviewData() {
      try {
        const details = await attemptService.getAttemptDetails(attemptId)
        setAttemptDetails(details)

        if (details?.attempt?.paper_id) {
          // Fetch full questions including correct_option & explanation for REVIEW MODE
          const qList = await questionService.getQuestionsByPaperId(details.attempt.paper_id, false)
          setQuestions(qList || [])
        }

        const map = {}
        (details?.answers || []).forEach((a) => {
          map[a.question_id] = a.selected_option
        })
        setUserAnswersMap(map)

      } catch (err) {
        console.error('Error loading question review:', err)
        setError(err.message || 'Failed to load question solutions.')
      } finally {
        setLoading(false)
      }
    }

    loadReviewData()
  }, [attemptId])

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Loading question solutions & explanations...</p>
      </div>
    )
  }

  if (error || !attemptDetails?.attempt) {
    return (
      <div className="bg-white rounded-xl border border-surface-border p-8 text-center max-w-lg mx-auto my-8">
        <AlertCircle className="w-10 h-10 text-status-error mx-auto mb-3" />
        <h2 className="text-lg font-bold text-body-text">Unable to Load Review</h2>
        <p className="text-xs text-body-secondary mt-1 mb-6">{error || 'Requested attempt does not exist.'}</p>
        <Link to="/my-attempts" className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold">
          Back to My Attempts
        </Link>
      </div>
    )
  }

  const { attempt } = attemptDetails
  const paper = attempt.papers

  // Filter logic
  const filteredQuestions = questions.filter((q) => {
    const userSel = userAnswersMap[q.id]
    if (filter === 'correct') return userSel === q.correct_option
    if (filter === 'incorrect') return userSel && userSel !== q.correct_option
    if (filter === 'unanswered') return !userSel
    return true
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to={`/attempt/${attempt.id}/result`} className="inline-flex items-center space-x-1 text-xs font-semibold text-body-secondary hover:text-primary transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Score Result</span>
          </Link>
          <h1 className="text-2xl font-bold text-body-text">Question-Wise Solution & Review</h1>
          <p className="text-xs text-body-secondary mt-0.5">
            {paper?.title} — Attempt #{attempt.attempt_number}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-surface-border shadow-subtle text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'all' ? 'bg-primary text-white' : 'text-body-secondary hover:bg-slate-50'
            }`}
          >
            All ({questions.length})
          </button>
          <button
            onClick={() => setFilter('correct')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'correct' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Correct ({attempt.correct_count})
          </button>
          <button
            onClick={() => setFilter('incorrect')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'incorrect' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'
            }`}
          >
            Incorrect ({attempt.incorrect_count})
          </button>
          <button
            onClick={() => setFilter('unanswered')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'unanswered' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Unanswered ({attempt.unanswered_count})
          </button>
        </div>
      </div>

      {/* Filtered Question List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-xl border border-surface-border p-12 text-center text-body-secondary text-xs">
          No questions found for the selected filter option.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredQuestions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              totalQuestions={questions.length}
              selectedOption={userAnswersMap[q.id] || null}
              mode="review"
              correctOption={q.correct_option}
              explanation={q.explanation}
            />
          ))}
        </div>
      )}
    </div>
  )
}
