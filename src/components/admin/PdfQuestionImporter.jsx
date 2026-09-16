import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { questionService } from '../../services/questionService'
import { FileText, CheckCircle2, AlertCircle, AlertTriangle, Loader2, Save, Trash2, Plus, RefreshCw, ChevronDown, ChevronRight, Copy, Eye, ExternalLink, ArrowLeft } from 'lucide-react'

export function PdfQuestionImporter({
  paperId,
  extractionResult,
  extracting,
  extractionError,
  onRetryExtraction,
  onImportSuccess
}) {
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

  if (extracting) {
    return (
      <div className="bg-white rounded-xl border border-surface-border p-8 text-center space-y-3 shadow-card">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        <h4 className="text-sm font-bold text-body-text">Extracting questions, options, and answer keys from PDF...</h4>
        <p className="text-xs text-body-secondary">Parsing PDF text structure in-browser. Please wait...</p>
      </div>
    )
  }

  if (!extractionResult && !fileError) {
    return null
  }

  const validCount = questions.filter((q) => q.isValid).length
  const incompleteCount = questions.length - validCount

  return (
    <div id="extraction-results-section" className="space-y-6">
      {/* Question Extraction Results Header Card */}
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

            {/* Step 7: Post-Import Navigation Actions */}
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
              <Link
                to="/admin/papers"
                className="px-4 py-2 border border-emerald-300 text-emerald-900 hover:bg-emerald-100 rounded-lg text-xs font-semibold"
              >
                Back to Papers
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

              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  {validCount} Complete
                </span>
                {incompleteCount > 0 && (
                  <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 text-[11px] font-bold">
                    {incompleteCount} Flagged Incomplete
                  </span>
                )}
                <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                  extractionResult.answerKeyFound ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {extractionResult.answerKeyFound ? 'Answer Key Detected' : 'Answer Key Not Found'}
                </span>
              </div>
            </div>

            {extractionResult.warnings && extractionResult.warnings.length > 0 && (
              <div className="text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-700" />
                <span>{extractionResult.warnings.join(' | ')}</span>
              </div>
            )}

            {/* Collapsible Debug Panel for Raw Extracted Text */}
            <div className="pt-2 border-t border-blue-200">
              <button
                onClick={() => setShowDebugText(!showDebugText)}
                className="text-xs font-bold text-primary hover:underline flex items-center space-x-1"
              >
                {showDebugText ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span>View Raw Extracted Text (Development Debugging)</span>
              </button>

              {showDebugText && (
                <div className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-700 text-[11px] text-slate-400">
                    <span>Raw Assembled Text Content ({extractionResult.extractedTextLength || 0} characters)</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(extractionResult.extractedText || '')}
                      className="flex items-center space-x-1 hover:text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </button>
                  </div>
                  {extractionResult.extractedText || 'No text extracted.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Questions Preview & Interactive Editor */}
      {questions.length > 0 && (
        <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3">
            <h4 className="text-sm font-bold text-body-text uppercase tracking-wider">
              Extracted Questions Preview & Editor ({questions.length} Items)
            </h4>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddQuestion}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-body-text font-bold rounded-lg text-xs flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>

              <button
                onClick={() => setQuestions([])}
                className="px-3 py-1.5 border border-surface-border hover:bg-slate-50 text-body-secondary rounded-lg text-xs"
              >
                Clear Preview
              </button>

              <button
                onClick={handleInitiateImport}
                disabled={importing || questions.length === 0}
                className="px-5 py-1.5 bg-status-success hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-subtle flex items-center space-x-1.5 disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Import {questions.length} Questions to Supabase</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Question List Cards */}
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {questions.map((q, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border space-y-3 transition-colors ${
                  q.isValid ? 'border-surface-border bg-white' : 'border-amber-300 bg-amber-50/30'
                }`}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-bold text-body-secondary uppercase">Q#</span>
                      <input
                        type="number"
                        value={q.question_number}
                        onChange={(e) => handleQuestionChange(index, 'question_number', e.target.value)}
                        className="w-16 px-2 py-1 border rounded text-xs font-bold text-center text-primary"
                      />
                    </div>

                    {!q.isValid && (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Incomplete: {q.errors.join(', ')}</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteQuestion(index)}
                    className="p-1 text-slate-400 hover:text-status-error hover:bg-red-50 rounded"
                    title="Remove Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Question Text */}
                <div>
                  <label className="block text-[10px] font-bold text-body-secondary uppercase mb-1">
                    Question Text
                  </label>
                  <textarea
                    rows={2}
                    value={q.question_text}
                    onChange={(e) => handleQuestionChange(index, 'question_text', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                    placeholder="Enter question text..."
                  />
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-body-secondary uppercase mb-0.5">(A) Option A</label>
                    <input
                      type="text"
                      value={q.option_a}
                      onChange={(e) => handleQuestionChange(index, 'option_a', e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-body-secondary uppercase mb-0.5">(B) Option B</label>
                    <input
                      type="text"
                      value={q.option_b}
                      onChange={(e) => handleQuestionChange(index, 'option_b', e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-body-secondary uppercase mb-0.5">(C) Option C</label>
                    <input
                      type="text"
                      value={q.option_c}
                      onChange={(e) => handleQuestionChange(index, 'option_c', e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-body-secondary uppercase mb-0.5">(D) Option D</label>
                    <input
                      type="text"
                      value={q.option_d}
                      onChange={(e) => handleQuestionChange(index, 'option_d', e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Correct Answer Dropdown & Explanation */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-body-secondary uppercase mb-1">
                      Correct Answer Key
                    </label>
                    <select
                      value={q.correct_option || ''}
                      onChange={(e) => handleQuestionChange(index, 'correct_option', e.target.value || null)}
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 outline-none"
                    >
                      <option value="">Not provided (null)</option>
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                      <option value="D">Option D</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-body-secondary uppercase mb-1">
                      Explanation / Rationale (Optional)
                    </label>
                    <input
                      type="text"
                      value={q.explanation || ''}
                      onChange={(e) => handleQuestionChange(index, 'explanation', e.target.value)}
                      placeholder="Add solution explanation..."
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
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
