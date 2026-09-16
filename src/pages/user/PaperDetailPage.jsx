import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { paperService } from '../../services/paperService'
import { attemptService } from '../../services/attemptService'
import { storageService } from '../../services/storageService'
import { useAuth } from '../../hooks/useAuth'
import { Clock, HelpCircle, Award, AlertCircle, FileText, Download, Play, Loader2, ArrowLeft, ShieldCheck } from 'lucide-react'

export function PaperDetailPage() {
  const { paperId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [paper, setPaper] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadPaperDetails() {
      try {
        const data = await paperService.getPaperById(paperId)
        setPaper(data)

        if (data?.pdf_path) {
          const url = await storageService.getPdfPublicUrl(data.pdf_path)
          setPdfUrl(url)
        }
      } catch (err) {
        console.error('Failed to load paper:', err)
        setError(err.message || 'Paper not found')
      } finally {
        setLoading(false)
      }
    }

    loadPaperDetails()
  }, [paperId])

  const handleStartExam = async () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/papers/${paperId}` } } })
      return
    }

    setStarting(true)
    setError(null)

    try {
      // Create new attempt or return existing active attempt
      const attempt = await attemptService.startOrGetAttempt(user.id, paperId)
      navigate(`/exam/${paperId}`)
    } catch (err) {
      console.error('Failed to initialize attempt:', err)
      setError(err.message || 'Could not start exam. Please try again.')
    } finally {
      setStarting(false)
      setShowConfirmationModal(false)
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Loading paper details...</p>
      </div>
    )
  }

  if (error || !paper) {
    return (
      <div className="bg-white rounded-xl border border-surface-border p-8 text-center max-w-lg mx-auto my-8">
        <AlertCircle className="w-10 h-10 text-status-error mx-auto mb-3" />
        <h2 className="text-lg font-bold text-body-text">Unable to Load Question Paper</h2>
        <p className="text-xs text-body-secondary mt-1 mb-6">{error || 'Requested paper does not exist.'}</p>
        <Link to="/papers" className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold">
          Back to Paper List
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <Link to="/papers" className="inline-flex items-center space-x-1.5 text-xs font-semibold text-body-secondary hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to All Papers</span>
      </Link>

      {/* Main Details Card */}
      <div className="bg-white rounded-xl border border-surface-border p-6 sm:p-8 shadow-card space-y-6">
        {/* Header Tags */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-primary border border-blue-100 uppercase">
            {paper.exam_name} ({paper.year})
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-body-secondary">
            {paper.subject}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
            {paper.exam_type || 'Prelims'}
          </span>
        </div>

        {/* Paper Title & Description */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-body-text">{paper.title}</h1>
          {paper.description && (
            <p className="text-sm text-body-secondary mt-2 leading-relaxed">{paper.description}</p>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-surface-border text-center">
          <div>
            <span className="text-[10px] text-body-secondary font-bold uppercase block">Total Questions</span>
            <span className="text-xl font-bold text-body-text">{paper.total_questions || 0}</span>
          </div>
          <div>
            <span className="text-[10px] text-body-secondary font-bold uppercase block">Duration</span>
            <span className="text-xl font-bold text-body-text">{paper.duration_minutes || 120} Mins</span>
          </div>
          <div>
            <span className="text-[10px] text-body-secondary font-bold uppercase block">Maximum Marks</span>
            <span className="text-xl font-bold text-primary">{paper.maximum_marks || 200}</span>
          </div>
          <div>
            <span className="text-[10px] text-body-secondary font-bold uppercase block">Negative Marking</span>
            <span className="text-xl font-bold text-status-warning">-{paper.negative_marking || 0.66}</span>
          </div>
        </div>

        {/* Official Rules & Instructions */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold text-body-text uppercase tracking-wider flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Official Examination Instructions</span>
          </h3>
          <ul className="text-xs text-body-secondary space-y-2 list-disc pl-5 leading-relaxed">
            <li>The timer begins immediately once you click "Confirm & Start Exam".</li>
            <li>Each question has 4 options. Correct answer carries <strong>+{paper.marks_per_question || 2.0}</strong> marks.</li>
            <li>Incorrect answer carries a negative penalty of <strong>-{paper.negative_marking || 0.66}</strong> marks.</li>
            <li>Unanswered questions carry 0 marks penalty.</li>
            <li>Closing or refreshing the browser tab will <strong>NOT</strong> pause the countdown timer. Remaining time will recalculate automatically from your start timestamp.</li>
            <li>You can reattempt this paper multiple times. Each completed attempt will be stored separately for performance tracking.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-surface-border flex flex-col sm:flex-row gap-4 items-center justify-between">
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2.5 border border-surface-border rounded-xl text-xs font-bold text-body-text hover:bg-slate-50 transition-colors shadow-subtle"
            >
              <Download className="w-4 h-4 text-primary" />
              <span>Download Original PDF</span>
            </a>
          ) : (
            <div className="text-xs text-slate-400 italic">Official PDF attachment not uploaded</div>
          )}

          <button
            onClick={() => setShowConfirmationModal(true)}
            className="w-full sm:w-auto px-8 py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-card transition-all flex items-center justify-center space-x-2"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start Practice Exam</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-modal border border-surface-border space-y-4">
            <h3 className="text-lg font-bold text-body-text">Ready to Begin Exam?</h3>
            <p className="text-xs text-body-secondary leading-relaxed">
              You are about to start <strong>{paper.title}</strong> ({paper.total_questions} Questions, {paper.duration_minutes} Minutes).
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
              Note: The countdown timer will start immediately and run continuously.
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowConfirmationModal(false)}
                className="px-4 py-2 border border-surface-border rounded-lg text-xs font-semibold text-body-secondary hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStartExam}
                disabled={starting}
                className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-subtle flex items-center space-x-1 disabled:opacity-50"
              >
                {starting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Confirm & Start Exam</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
