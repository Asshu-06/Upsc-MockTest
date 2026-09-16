import React, { useState } from 'react'
import { pdfQuestionParser } from '../../services/pdfQuestionParser'
import { questionService } from '../../services/questionService'
import { FileText, Upload, CheckCircle2, AlertCircle, AlertTriangle, Loader2, Save, Trash2, Plus, RefreshCw, X } from 'lucide-react'

export function PdfQuestionImporter({ paperId, onImportSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [parsingResult, setParsingResult] = useState(null)

  const [questions, setQuestions] = useState([])
  const [fileError, setFileError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState(null)

  const [showReplaceModal, setShowReplaceModal] = useState(false)
  const [existingCount, setExistingCount] = useState(0)

  // Handle PDF file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setSelectedFile(file)
    setFileError(null)
    setParsingResult(null)
    setQuestions([])
    setImportMessage(null)

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('Selected file must be a PDF document.')
      setSelectedFile(null)
      return
    }

    if (file.size > 30 * 1024 * 1024) {
      setFileError('PDF file size must not exceed 30MB.')
      setSelectedFile(null)
      return
    }
  }

  // Extract questions from PDF via PDF.js
  const handleExtract = async () => {
    if (!selectedFile) {
      setFileError('Please select a PDF file first.')
      return
    }

    setExtracting(true)
    setFileError(null)
    setImportMessage(null)

    try {
      const result = await pdfQuestionParser.parsePdf(selectedFile)

      if (result.error) {
        setFileError(result.error)
        setParsingResult(result)
        setQuestions([])
      } else {
        setParsingResult(result)
        setQuestions(result.questions || [])

        if (result.questions.length === 0) {
          setFileError('No structured questions could be detected in this PDF. Please check the formatting or import via JSON/CSV.')
        }
      }
    } catch (err) {
      console.error('PDF extraction error:', err)
      setFileError(err.message || 'Failed to extract questions from PDF.')
    } finally {
      setExtracting(false)
    }
  }

  // Handle inline question edits
  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions]
    const q = { ...updated[index], [field]: value }

    // Re-validate row
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

  // Add a new manual question item to preview
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
      setFileError('No questions to import.')
      return
    }

    setFileError(null)

    // Check if database already has questions for paper_id
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

  // Execute Supabase insert batch
  const executeImport = async (replaceExisting) => {
    setShowReplaceModal(false)
    setImporting(true)
    setFileError(null)
    setImportMessage(null)

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

      setImportMessage(`${inserted.length} questions imported successfully into Supabase!`)

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

  const validCount = questions.filter((q) => q.isValid).length
  const incompleteCount = questions.length - validCount

  return (
    <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-border pb-4 gap-2">
        <div>
          <h3 className="text-base font-bold text-body-text flex items-center space-x-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>Automatic PDF-to-Questions Workflow</span>
          </h3>
          <p className="text-xs text-body-secondary mt-0.5">
            Extract selectable text, detect 4 options and answer keys in-browser, then batch import to Supabase.
          </p>
        </div>
      </div>

      {/* File Upload & Extract Action Controls */}
      <div className="p-5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-auto flex-1">
            <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
              Select Question Paper PDF
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="text-xs text-body-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover cursor-pointer w-full"
            />
          </div>

          <button
            onClick={handleExtract}
            disabled={!selectedFile || extracting}
            className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-subtle flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {extracting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extracting questions from PDF...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Extract Questions</span>
              </>
            )}
          </button>
        </div>

        {selectedFile && (
          <p className="text-xs font-semibold text-primary">
            Selected File: <strong>{selectedFile.name}</strong> ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        )}
      </div>

      {/* Error & Warning Alerts */}
      {fileError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Extraction Warning / Error:</span>
            <p>{fileError}</p>
          </div>
        </div>
      )}

      {importMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-status-success text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{importMessage}</span>
        </div>
      )}

      {/* Post-Extraction Metadata Banner */}
      {parsingResult && !parsingResult.error && (
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
            <div className="flex items-center space-x-4">
              <span>Pages Scanned: <strong>{parsingResult.totalPages}</strong></span>
              <span>Detected Questions: <strong>{questions.length}</strong></span>
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
                parsingResult.answerKeyFound ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {parsingResult.answerKeyFound ? 'Answer Key Detected' : 'Answer Key Not Found'}
              </span>
            </div>
          </div>

          {parsingResult.warnings && parsingResult.warnings.length > 0 && (
            <div className="text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-700" />
              <span>{parsingResult.warnings.join(' | ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Questions Preview & Interactive Editor */}
      {questions.length > 0 && (
        <div className="space-y-4">
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
                disabled={importing}
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

      {/* Duplicate / Existing Question Replacement Modal */}
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
