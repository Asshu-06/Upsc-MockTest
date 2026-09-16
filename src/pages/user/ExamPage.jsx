import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { paperService } from '../../services/paperService'
import { questionService } from '../../services/questionService'
import { attemptService } from '../../services/attemptService'
import { useAuth } from '../../hooks/useAuth'
import { useTimer } from '../../hooks/useTimer'
import { QuestionCard } from '../../components/QuestionCard'
import { QuestionNavigator } from '../../components/QuestionNavigator'
import { Timer } from '../../components/Timer'
import { Loader2, ArrowLeft, ArrowRight, Send, AlertTriangle, Menu, X, ShieldAlert } from 'lucide-react'

export function ExamPage() {
  const { paperId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [paper, setPaper] = useState(null)
  const [questions, setQuestions] = useState([])
  const [attempt, setAttempt] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const [answers, setAnswers] = useState({})
  const [markedForReview, setMarkedForReview] = useState({})

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [error, setError] = useState(null)

  // Load active attempt and questions
  useEffect(() => {
    async function initExam() {
      if (!user) return

      try {
        const [paperData, attemptData] = await Promise.all([
          paperService.getPaperById(paperId),
          attemptService.startOrGetAttempt(user.id, paperId)
        ])

        if (attemptData.status === 'completed') {
          // Already completed -> redirect to result
          navigate(`/attempt/${attemptData.id}/result`, { replace: true })
          return
        }

        setPaper(paperData)
        setAttempt(attemptData)

        // Fetch questions in EXAM MODE (excludes correct_option and explanation for security)
        const qList = await questionService.getQuestionsByPaperId(paperId, true)
        setQuestions(qList || [])

        // Load existing saved answers for attempt
        const savedAnswers = await attemptService.getAttemptAnswers(attemptData.id)
        const ansMap = {}
        savedAnswers.forEach((a) => {
          if (a.selected_option) ansMap[a.question_id] = a.selected_option
        })
        setAnswers(ansMap)

      } catch (err) {
        console.error('Exam initialization error:', err)
        setError(err.message || 'Failed to initialize exam environment.')
      } finally {
        setLoading(false)
      }
    }

    initExam()
  }, [paperId, user, navigate])

  // Submit Handler
  const handleSubmitExam = useCallback(async () => {
    if (!attempt || submitting) return
    setSubmitting(true)

    try {
      const result = await attemptService.submitAttempt(attempt.id, answers)
      navigate(`/attempt/${attempt.id}/result`, { replace: true, state: { comparison: result.comparison } })
    } catch (err) {
      console.error('Submission error:', err)
      setError(err.message || 'Failed to submit exam attempt.')
      setSubmitting(false)
    }
  }, [attempt, answers, submitting, navigate])

  // Timer hook
  const { timeLeftSeconds, isExpired } = useTimer(
    attempt?.started_at,
    paper?.duration_minutes,
    handleSubmitExam
  )

  // Answer selection callback
  const handleSelectOption = (optionKey) => {
    if (!questions[currentIndex] || !attempt) return
    const currentQ = questions[currentIndex]

    const updated = { ...answers, [currentQ.id]: optionKey }
    setAnswers(updated)

    // Autosave answer to Supabase
    attemptService.saveAnswer(attempt.id, currentQ.id, optionKey)
  }

  // Clear selection callback
  const handleClearOption = () => {
    if (!questions[currentIndex] || !attempt) return
    const currentQ = questions[currentIndex]

    const updated = { ...answers }
    delete updated[currentQ.id]
    setAnswers(updated)

    attemptService.saveAnswer(attempt.id, currentQ.id, null)
  }

  // Toggle Mark for review
  const handleToggleMarkForReview = () => {
    if (!questions[currentIndex]) return
    const currentQ = questions[currentIndex]

    setMarkedForReview((prev) => ({
      ...prev,
      [currentQ.id]: !prev[currentQ.id]
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-bg">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-body-secondary font-medium text-sm">Preparing exam environment...</p>
      </div>
    )
  }

  if (error || !paper || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-bg p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-card border border-surface-border p-6 text-center">
          <ShieldAlert className="w-10 h-10 text-status-error mx-auto mb-3" />
          <h2 className="text-lg font-bold text-body-text mb-2">Exam Load Error</h2>
          <p className="text-xs text-body-secondary mb-6">{error || 'No questions available for this paper.'}</p>
          <button
            onClick={() => navigate('/papers')}
            className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold"
          >
            Return to Papers List
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col no-select">
      {/* Top Fixed Header Bar */}
      <header className="bg-white border-b border-surface-border sticky top-0 z-30 px-4 sm:px-6 py-3 shadow-subtle">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Paper Info */}
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="font-bold text-sm sm:text-base text-body-text truncate max-w-[200px] sm:max-w-xs">
                {paper.title}
              </h1>
              <span className="text-[10px] text-body-secondary font-semibold uppercase">
                Attempt #{attempt?.attempt_number}
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center space-x-3">
            <Timer secondsLeft={timeLeftSeconds} />

            <button
              onClick={() => setShowSubmitModal(true)}
              disabled={submitting}
              className="px-4 py-2 bg-status-success hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-subtle flex items-center space-x-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Submit Exam</span>
            </button>

            {/* Mobile Drawer Toggle */}
            <button
              onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              className="lg:hidden p-2 text-body-secondary hover:text-body-text border border-surface-border rounded-lg"
            >
              {mobileDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Exam Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Question Display Area */}
        <div className="lg:col-span-3 space-y-6">
          <QuestionCard
            question={currentQuestion}
            totalQuestions={questions.length}
            selectedOption={answers[currentQuestion.id] || null}
            onSelectOption={handleSelectOption}
            onClearOption={handleClearOption}
            isMarkedForReview={!!markedForReview[currentQuestion.id]}
            onToggleMarkForReview={handleToggleMarkForReview}
            mode="exam"
          />

          {/* Bottom Navigation Control Bar */}
          <div className="bg-white rounded-xl border border-surface-border p-4 shadow-card flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 border border-surface-border rounded-lg text-xs font-bold text-body-text hover:bg-slate-50 transition-colors flex items-center space-x-1 disabled:opacity-40"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs font-semibold text-body-secondary">
              Question {currentIndex + 1} of {questions.length}
            </span>

            <button
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1 disabled:opacity-40"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Sidebar Navigator (Desktop) */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-20">
            <QuestionNavigator
              questions={questions}
              currentIndex={currentIndex}
              onSelectQuestion={(idx) => setCurrentIndex(idx)}
              answers={answers}
              markedForReview={markedForReview}
              onSubmitExam={() => setShowSubmitModal(true)}
            />
          </div>
        </div>
      </div>

      {/* Mobile Drawer Question Navigator */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden flex justify-end">
          <div className="w-80 bg-white h-full p-4 overflow-y-auto shadow-modal space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-body-text">Question Palette Navigator</h3>
              <button onClick={() => setMobileDrawerOpen(false)} className="p-1 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <QuestionNavigator
              questions={questions}
              currentIndex={currentIndex}
              onSelectQuestion={(idx) => {
                setCurrentIndex(idx)
                setMobileDrawerOpen(false)
              }}
              answers={answers}
              markedForReview={markedForReview}
              onSubmitExam={() => {
                setMobileDrawerOpen(false)
                setShowSubmitModal(true)
              }}
            />
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-modal border border-surface-border space-y-4">
            <h3 className="text-lg font-bold text-body-text">Submit Exam Attempt?</h3>
            <p className="text-xs text-body-secondary leading-relaxed">
              Are you sure you want to finalize and submit your exam?
            </p>

            <div className="grid grid-cols-2 gap-3 py-2 text-center text-xs font-semibold">
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
                <span className="block text-lg font-bold">{Object.keys(answers).length}</span>
                Answered
              </div>
              <div className="p-3 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
                <span className="block text-lg font-bold">{questions.length - Object.keys(answers).length}</span>
                Unanswered
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 border border-surface-border rounded-lg text-xs font-semibold text-body-secondary hover:bg-slate-50"
              >
                Resume Exam
              </button>
              <button
                onClick={handleSubmitExam}
                disabled={submitting}
                className="px-6 py-2 bg-status-success hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-subtle flex items-center space-x-1 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Submit Attempt Now</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
