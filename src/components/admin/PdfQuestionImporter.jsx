import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { questionService } from '../../services/questionService'
import { PdfAiExtractor } from './PdfAiExtractor'
import { FileText, CheckCircle2, AlertCircle, AlertTriangle, Loader2, Save, Trash2, Plus, RefreshCw, ChevronDown, ChevronRight, Copy, Eye, ExternalLink, Sparkles } from 'lucide-react'

export function PdfQuestionImporter({
  paperId,
  extractionResult,
  extracting,
  extractionError,
  onRetryExtraction,
  onImportSuccess
}) {
  const [activeTab, setActiveTab] = useState('ai_vision') // 'ai_vision' | 'text_parser'
  const [questions, setQuestions] = useState([])
  const [fileError, setFileError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importSuccessMsg, setImportSuccessMsg] = useState(null)

  const [showDebugText, setShowDebugText] = useState(false)
  const [showReplaceModal, setShowReplaceModal] = useState(false)
  const [existingCount, setExistingCount] = useState(0)

  // Sync questions from extractionResult
  useEffect(() => {
    if (extractionResult?.questions) {
      setQuestions(extractionResult.questions)
      if (extractionResult.questions.length === 0) {
        setShowDebugText(true)
      }
    } else {
      setQuestions([])
    }
    setFileError(extractionError || null)
    setImportSuccessMsg(null)
  }, [extractionResult, extractionError])

  // Handle inline question edits
  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions]
    const q = { ...updated[index], [field]: value }

    const errors = []
    if (!q.question_text || q.question_text.trim().length < 3) errors.push('Missing question text')
    if (!q.option_a) errors.push('Missing Option A')
    if (!q.option_b) errors.push('Missing Option B')
    if (!q.option_c) errors.push('Missing Option C')
    if (!q.option_d) errors.push('Missing Option D')

    q.isValid = errors.length === 0
    q.errors = errors

    updated[index] = q
    setQuestions(updated)
  }

  // Delete an extracted question
  const handleDeleteQuestion = (index) => {
    const updated = questions.filter((_, idx) => idx !== index)
    setQuestions(updated)
  }

  // Add a new manual question item
  const handleAddQuestion = () => {
    const nextNum = questions.length > 0
      ? Math.max(...questions.map((q) => q.question_number)) + 1
      : 1

    setQuestions([
      ...questions,
      {
        question_number: nextNum,
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: 'A',
        explanation: '',
        isValid: false,
        errors: ['Missing question text', 'Missing Option A', 'Missing Option B', 'Missing Option C', 'Missing Option D']
      }
    ])
  }

  // Initiate Import
  const handleInitiateImport = async () => {
    if (!paperId) {
      setFileError('Paper ID is missing. Please save the paper details first.')
      return
    }

    if (questions.length === 0) {
      setFileError('Cannot import 0 questions. Please extract questions or edit preview.')
      return
    }

    setFileError(null)

    try {
      const existing = await questionService.getExistingQuestionCount(paperId)
      if (existing > 0) {
        setExistingCount(existing)
        setShowReplaceModal(true)
        return
      }

      await executeImport(false)
    } catch (err) {
      console.error('Check existing count error:', err)
      await executeImport(false)
    }
  }

  // Execute Supabase batch insert
  const executeImport = async (replaceExisting) => {
    setShowReplaceModal(false)
    setImporting(true)
    setFileError(null)
    setImportSuccessMsg(null)

    try {
      const validQuestions = questions.map((q) => ({
        question_number: q.question_number,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option || null,
        explanation: q.explanation || ''
      }))

      const inserted = await questionService.saveQuestionsToSupabase(
        paperId,
        validQuestions,
        replaceExisting
      )

      setImportSuccessMsg(`Successfully imported ${inserted.length} questions. This paper is ready for the exam!`)

      if (onImportSuccess) {
        onImportSuccess(inserted.length)
      }
    } catch (err) {
      console.error('Import questions to Supabase error:', err)
      setFileError(err.message || 'Failed to import questions to database.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div id="extraction-results-section" className="space-y-6">
      {/* MODE SELECTOR TABS */}
      <div className="flex items-center space-x-2 border-b border-surface-border pb-1">
        <button
          onClick={() => setActiveTab('ai_vision')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center space-x-2 transition-colors ${
            activeTab === 'ai_vision'
              ? 'bg-primary text-white shadow-subtle'
              : 'bg-slate-100 text-body-secondary hover:bg-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Gemini AI Vision OCR (Scanned / Ticked PDFs)</span>
        </button>

        <button
          onClick={() => setActiveTab('text_parser')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center space-x-2 transition-colors ${
            activeTab === 'text_parser'
              ? 'bg-primary text-white shadow-subtle'
              : 'bg-slate-100 text-body-secondary hover:bg-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Fast Text Parser (Digital PDFs)</span>
        </button>
      </div>

      {/* TAB 1: GEMINI AI VISION OCR EXTRACTOR */}
      {activeTab === 'ai_vision' && (
        <PdfAiExtractor paperId={paperId} onImportSuccess={onImportSuccess} />
      )}

      {/* TAB 2: FAST TEXT PARSER PREVIEW */}
      {activeTab === 'text_parser' && (
        <div className="space-y-6">
          {extracting && (
            <div className="bg-white rounded-xl border border-surface-border p-8 text-center space-y-3 shadow-card">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
              <h4 className="text-sm font-bold text-body-text">Extracting questions, options, and answer keys from PDF...</h4>
              <p className="text-xs text-body-secondary">Parsing PDF text structure in-browser. Please wait...</p>
            </div>
          )}

          {!extracting && (
            <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-border pb-4 gap-2">
                <div>
                  <h3 className="text-base font-bold text-body-text flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span>Question Extraction Results</span>
                  </h3>
                  <p className="text-xs text-body-secondary mt-0.5">
                    Review page extraction metrics and text parsing results.
                  </p>
                </div>

                {onRetryExtraction && (
                  <button
                    onClick={onRetryExtraction}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-body-text font-bold rounded-lg text-xs flex items-center space-x-1.5 self-start sm:self-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Extraction</span>
                  </button>
                )}
              </div>

              {/* Errors & Alerts */}
              {fileError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold">Extraction Warning / Error:</span>
                    <p>{fileError}</p>
                  </div>
                </div>
              )}

              {/* Success Message Banner */}
              {importSuccessMsg && (
                <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-status-success space-y-3">
                  <div className="flex items-center space-x-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <span>{importSuccessMsg}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-200">
                    <Link
                      to={`/admin/papers/${paperId}/questions`}
                      className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-subtle flex items-center space-x-1.5"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Questions</span>
                    </Link>
                    <Link
                      to={`/exam/${paperId}`}
                      target="_blank"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-subtle flex items-center space-x-1.5"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Preview Exam</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              {extractionResult && (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
                    <div className="flex flex-wrap items-center gap-4">
                      <span>Pages Scanned: <strong>{extractionResult.totalPages || 0}</strong></span>
                      <span>Extracted Text Length: <strong>{extractionResult.extractedTextLength || 0} chars</strong></span>
                      <span>Questions Detected: <strong>{questions.length}</strong></span>
                    </div>
                  </div>

                  {extractionResult.warnings && extractionResult.warnings.length > 0 && (
                    <div className="text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-700" />
                      <span>{extractionResult.warnings.join(' | ')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Duplicate Replacement Modal */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-modal border border-surface-border space-y-4">
            <h3 className="text-lg font-bold text-body-text flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Replace Existing Questions?</span>
            </h3>

            <p className="text-xs text-body-secondary leading-relaxed">
              This paper already has <strong>{existingCount} questions</strong> in the database.
              Do you want to replace them with the {questions.length} newly extracted questions, or append/merge them?
            </p>

            <div className="flex flex-col space-y-2 pt-2">
              <button
                onClick={() => executeImport(true)}
                className="w-full py-2.5 bg-status-error hover:bg-red-700 text-white font-bold rounded-lg text-xs shadow-subtle"
              >
                Delete {existingCount} Existing Questions & Import New Set
              </button>
              <button
                onClick={() => executeImport(false)}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg text-xs shadow-subtle"
              >
                Upsert / Merge New Questions (Keep Existing)
              </button>
              <button
                onClick={() => setShowReplaceModal(false)}
                className="w-full py-2 border border-surface-border text-body-secondary font-semibold rounded-lg text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
