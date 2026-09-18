import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { geminiOcrService } from '../../services/geminiOcrService'
import { questionService } from '../../services/questionService'
import { storageService } from '../../services/storageService'
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Save,
  Trash2,
  Plus,
  RefreshCw,
  Sparkles,
  Eye,
  ExternalLink,
  HelpCircle,
  X,
  FileCheck,
  Check,
  Edit3
} from 'lucide-react'

export function PdfAiExtractor({ paperId, onImportSuccess }) {
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const [processing, setProcessing] = useState(false)
  const [progressStatus, setProgressStatus] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)

  const [extractionResult, setExtractionResult] = useState(null)
  const [questions, setQuestions] = useState([])
  const [summaryMetrics, setSummaryMetrics] = useState(null)

  const [importing, setImporting] = useState(false)
  const [importSuccessMsg, setImportSuccessMsg] = useState(null)
  const [showReplaceModal, setShowReplaceModal] = useState(false)
  const [existingDbCount, setExistingDbCount] = useState(0)

  // Validate File Selection
  const validateFile = (selectedFile) => {
    setFileError(null)
    if (!selectedFile) return false

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setFileError('Selected file must be a valid PDF document.')
      return false
    }

    if (selectedFile.size > 35 * 1024 * 1024) {
      setFileError('PDF file size must not exceed 35MB.')
      return false
    }

    return true
  }

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (validateFile(selected)) {
      setFile(selected)
      setExtractionResult(null)
      setQuestions([])
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (validateFile(droppedFile)) {
      setFile(droppedFile)
      setExtractionResult(null)
      setQuestions([])
    }
  }

  const handleClearFile = () => {
    setFile(null)
    setFileError(null)
    setExtractionResult(null)
    setQuestions([])
    setSummaryMetrics(null)
    setImportSuccessMsg(null)
  }

  // Trigger Gemini AI Multimodal PDF Processing
  const handleStartExtraction = async () => {
    if (!file) {
      setFileError('Please select a PDF question paper first.')
      return
    }

    setProcessing(true)
    setFileError(null)
    setImportSuccessMsg(null)
    setProgressPercent(0)
    setProgressStatus('Initializing PDF Reader & Gemini AI Vision Engine...')

    try {
      // 1. Process PDF with Gemini OCR Service
      const result = await geminiOcrService.processPdfWithGemini(
        file,
        (statusText, currentStep, totalSteps) => {
          setProgressStatus(statusText)
          setProgressPercent(currentStep)
        }
      )

      setExtractionResult(result)
      setQuestions(result.questions || [])
      setSummaryMetrics(result.summaryMetrics || null)

      // Upload PDF copy to Storage if paperId is active
      if (paperId) {
        try {
          const path = await storageService.uploadPaperPdf(file, paperId)
          await questionService.saveExtractedDocument({
            paperId,
            fileName: file.name,
            storagePath: path,
            totalPages: result.totalPages,
            totalQuestions: result.questions.length,
            summaryMetrics: result.summaryMetrics
          })
        } catch (stErr) {
          console.warn('Storage upload note:', stErr)
        }
      }
    } catch (err) {
      console.error('AI PDF Extraction Error:', err)
      setFileError(err.message || 'Failed to extract questions from PDF.')
    } finally {
      setProcessing(false)
    }
  }

  // Question Card Field Edits
  const handleQuestionEdit = (index, field, value) => {
    const updated = [...questions]
    const item = { ...updated[index], [field]: value, manually_edited: true }

    // If marked_answer was edited, update marked_option_index and status
    if (field === 'marked_answer') {
      if (value) {
        item.answer_status = 'marked'
        const idx = item.options.findIndex((o) => o.label === value)
        item.marked_option_index = idx !== -1 ? idx : null
      } else {
        item.answer_status = 'not_marked'
        item.marked_option_index = null
      }
    }

    updated[index] = item
    setQuestions(updated)
    recalculateMetrics(updated)
  }

  // Option Edit inside Question
  const handleOptionEdit = (qIndex, optIndex, field, value) => {
    const updated = [...questions]
    const q = { ...updated[qIndex], manually_edited: true }
    const opts = [...q.options]
    opts[optIndex] = { ...opts[optIndex], [field]: value }
    q.options = opts
    updated[qIndex] = q
    setQuestions(updated)
  }

  // Add Option to Question
  const handleAddOption = (qIndex) => {
    const updated = [...questions]
    const q = { ...updated[qIndex], manually_edited: true }
    const labels = ['A', 'B', 'C', 'D', 'E', 'F']
    const nextLabel = labels[q.options.length] || String.fromCharCode(65 + q.options.length)
    q.options = [...q.options, { label: nextLabel, text: '' }]
    updated[qIndex] = q
    setQuestions(updated)
  }

  // Remove Option from Question
  const handleRemoveOption = (qIndex, optIndex) => {
    const updated = [...questions]
    const q = { ...updated[qIndex], manually_edited: true }
    q.options = q.options.filter((_, idx) => idx !== optIndex)
    updated[qIndex] = q
    setQuestions(updated)
  }

  // Delete Entire Question Card
  const handleDeleteQuestion = (index) => {
    const updated = questions.filter((_, idx) => idx !== index)
    setQuestions(updated)
    recalculateMetrics(updated)
  }

  // Add New Empty Question Card
  const handleAddQuestion = () => {
    const nextNum = questions.length > 0 ? Math.max(...questions.map((q) => q.question_number)) + 1 : 1
    const newQ = {
      question_number: nextNum,
      question_text: '',
      options: [
        { label: 'A', text: '' },
        { label: 'B', text: '' },
        { label: 'C', text: '' },
        { label: 'D', text: '' }
      ],
      marked_answer: null,
      marked_option_index: null,
      answer_status: 'not_marked',
      confidence: 1.0,
      page_number: 1,
      extraction_notes: '',
      manually_edited: true
    }
    const updated = [...questions, newQ]
    setQuestions(updated)
    recalculateMetrics(updated)
  }

  const recalculateMetrics = (qList) => {
    const markedCount = qList.filter((q) => q.answer_status === 'marked').length
    const uncertainCount = qList.filter((q) => q.answer_status === 'uncertain').length
    const notMarkedCount = qList.filter((q) => q.answer_status === 'not_marked').length
    const multipleMarkedCount = qList.filter((q) => q.answer_status === 'multiple_marked').length
    const unreadableCount = qList.filter((q) => q.answer_status === 'unreadable').length

    setSummaryMetrics({
      markedCount,
      uncertainCount,
      notMarkedCount,
      multipleMarkedCount,
      unreadableCount,
      reviewRequiredCount: uncertainCount + multipleMarkedCount + unreadableCount
    })
  }

  // Save Extracted Questions to Supabase Database
  const handleInitiateImport = async () => {
    if (!paperId) {
      setFileError('Paper ID is missing. Please save the paper details first.')
      return
    }

    if (questions.length === 0) {
      setFileError('No questions to import. Please extract or add questions.')
      return
    }

    setFileError(null)

    try {
      const existing = await questionService.getExistingQuestionCount(paperId)
      if (existing > 0) {
        setExistingDbCount(existing)
        setShowReplaceModal(true)
        return
      }

      await executeImport(false)
    } catch (err) {
      console.error('Check existing count error:', err)
      await executeImport(false)
    }
  }

  const executeImport = async (replaceExisting) => {
    setShowReplaceModal(false)
    setImporting(true)
    setFileError(null)
    setImportSuccessMsg(null)

    try {
      // 1. Batch save questions to standard `questions` table for exam functionality
      const inserted = await questionService.saveQuestionsToSupabase(paperId, questions, replaceExisting)

      // 2. Also save to `extracted_questions` table for persistent AI record
      await questionService.saveExtractedQuestions(null, paperId, questions)

      setImportSuccessMsg(`Successfully saved ${inserted.length} AI-extracted questions & marked answers!`)

      if (onImportSuccess) {
        onImportSuccess(inserted.length)
      }
    } catch (err) {
      console.error('Save questions error:', err)
      setFileError(err.message || 'Failed to save questions to database.')
    } finally {
      setImporting(false)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'marked':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Marked Answer</span>
          </span>
        )
      case 'uncertain':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Uncertain Mark</span>
          </span>
        )
      case 'multiple_marked':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Multiple Marked</span>
          </span>
        )
      case 'unreadable':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Unreadable</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <span>Not Marked</span>
          </span>
        )
    }
  }

  return (
    <div id="ai-extraction-section" className="space-y-6">
      {/* SECTION 1: PDF FILE UPLOAD CARD */}
      <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div>
            <h3 className="text-base font-bold text-body-text flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>AI PDF Question & Marked Answer Extractor</span>
            </h3>
            <p className="text-xs text-body-secondary mt-0.5">
              Upload text-based or scanned PDF question papers containing multiple-choice questions & marked answers.
            </p>
          </div>

          {file && (
            <button
              onClick={handleClearFile}
              disabled={processing}
              className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-xs font-semibold rounded-lg text-body-secondary flex items-center space-x-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear File</span>
            </button>
          )}
        </div>

        {/* DRAG & DROP FILE ZONE */}
        {!processing && (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`p-6 rounded-xl border-2 border-dashed text-center space-y-3 transition-colors ${
              dragOver ? 'border-primary bg-primary-light/10' : 'border-slate-300 bg-slate-50/50'
            }`}
          >
            <Upload className="w-10 h-10 text-slate-400 mx-auto" />

            <div>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="pdf-ai-file-input"
              />
              <label
                htmlFor="pdf-ai-file-input"
                className="cursor-pointer px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl text-xs inline-flex items-center space-x-2 shadow-subtle"
              >
                <FileText className="w-4 h-4" />
                <span>Browse Question Paper PDF</span>
              </label>
            </div>

            <p className="text-xs text-body-secondary">
              Supports scanned PDFs, image-based papers, printed ticks (✓), circles, filled bubbles, or highlighted options.
            </p>

            {file && (
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold mt-2">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                <span>Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
              </div>
            )}
          </div>
        )}

        {/* ERROR / ALERT DISPLAY */}
        {fileError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Extraction Error / Note:</span>
              <p>{fileError}</p>
            </div>
          </div>
        )}

        {/* REAL-TIME PROCESSING LOADER & PROGRESS BAR */}
        {processing && (
          <div className="p-6 rounded-xl bg-blue-50/60 border border-blue-200 space-y-4 text-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <div>
              <h4 className="text-sm font-bold text-body-text">{progressStatus}</h4>
              <p className="text-xs text-body-secondary mt-1">
                Gemini AI Vision is rendering pages and analyzing marked options...
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden max-w-md mx-auto">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(progressPercent, 10)}%` }}
              />
            </div>
          </div>
        )}

        {/* START / RETRY EXTRACTION BUTTON */}
        {file && !processing && (
          <div className="flex justify-end pt-2">
            <button
              onClick={handleStartExtraction}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-subtle flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{extractionResult ? 'Re-run Gemini AI Extraction' : 'Start Gemini AI Extraction'}</span>
            </button>
          </div>
        )}
      </div>

      {/* SECTION 2: RESULTS SUMMARY METRICS & WARNINGS */}
      {summaryMetrics && (
        <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-border pb-3 gap-2">
            <h4 className="text-sm font-bold text-body-text uppercase tracking-wider flex items-center space-x-2">
              <FileText className="w-4 h-4 text-primary" />
              <span>AI Extraction Summary ({extractionResult?.fileName})</span>
            </h4>
            <span className="text-xs font-semibold text-body-secondary">
              Total Pages Processed: <strong>{extractionResult?.totalPages || 0}</strong>
            </span>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-slate-50 border border-surface-border rounded-xl text-center space-y-1">
              <span className="text-[10px] font-bold text-body-secondary uppercase">Extracted Questions</span>
              <p className="text-xl font-bold text-body-text">{questions.length}</p>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
              <span className="text-[10px] font-bold text-emerald-800 uppercase">Marked Answers</span>
              <p className="text-xl font-bold text-emerald-700">{summaryMetrics.markedCount}</p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-1">
              <span className="text-[10px] font-bold text-amber-800 uppercase">Uncertain Marks</span>
              <p className="text-xl font-bold text-amber-700">{summaryMetrics.uncertainCount}</p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
              <span className="text-[10px] font-bold text-slate-600 uppercase">Unanswered</span>
              <p className="text-xl font-bold text-slate-700">{summaryMetrics.notMarkedCount}</p>
            </div>

            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-center space-y-1">
              <span className="text-[10px] font-bold text-orange-800 uppercase">Multiple Marked</span>
              <p className="text-xl font-bold text-orange-700">{summaryMetrics.multipleMarkedCount}</p>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center space-y-1">
              <span className="text-[10px] font-bold text-red-800 uppercase">Review Required</span>
              <p className="text-xl font-bold text-red-700">{summaryMetrics.reviewRequiredCount}</p>
            </div>
          </div>

          {extractionResult?.warnings && extractionResult.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <span className="font-bold flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>Extraction Notes:</span>
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {extractionResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* SUCCESS BANNER POST IMPORT */}
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
              <span>View Questions List</span>
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

      {/* SECTION 3: QUESTION CARDS PREVIEW & EDITING TABLE */}
      {questions.length > 0 && (
        <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3">
            <h4 className="text-sm font-bold text-body-text uppercase tracking-wider">
              Verified Questions & Answer Preview ({questions.length} Items)
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
                onClick={handleInitiateImport}
                disabled={importing || questions.length === 0}
                className="px-5 py-1.5 bg-status-success hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-subtle flex items-center space-x-1.5 disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save {questions.length} Verified Questions</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* EDITABLE QUESTION LIST CARDS */}
          <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
            {questions.map((q, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border space-y-3 transition-colors ${
                  q.answer_status === 'marked'
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : q.answer_status === 'uncertain'
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-surface-border bg-white'
                }`}
              >
                {/* CARD HEADER */}
                <div className="flex flex-wrap items-center justify-between border-b border-surface-border pb-2 gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-bold text-body-secondary uppercase">Q#</span>
                      <input
                        type="number"
                        value={q.question_number}
                        onChange={(e) => handleQuestionEdit(index, 'question_number', e.target.value)}
                        className="w-16 px-2 py-1 border rounded text-xs font-bold text-center text-primary"
                      />
                    </div>

                    {getStatusBadge(q.answer_status)}

                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Page {q.page_number}
                    </span>

                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {Math.round((q.confidence || 0.85) * 100)}% Confidence
                    </span>

                    {q.manually_edited && (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center space-x-1">
                        <Edit3 className="w-3 h-3" />
                        <span>Manually Edited</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteQuestion(index)}
                    className="p-1 text-slate-400 hover:text-status-error hover:bg-red-50 rounded"
                    title="Delete Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* QUESTION TEXT */}
                <div>
                  <label className="block text-[10px] font-bold text-body-secondary uppercase mb-1">
                    Question Wording
                  </label>
                  <textarea
                    rows={2}
                    value={q.question_text}
                    onChange={(e) => handleQuestionEdit(index, 'question_text', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary font-medium"
                    placeholder="Enter question text..."
                  />
                </div>

                {/* DYNAMIC OPTIONS GRID */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-body-secondary uppercase">
                      Extracted Options
                    </label>
                    <button
                      onClick={() => handleAddOption(index)}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Option</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(q.options || []).map((opt, optIdx) => {
                      const isMarked = q.marked_answer === opt.label
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center space-x-2 p-2 rounded-lg border transition-colors ${
                            isMarked
                              ? 'border-emerald-500 bg-emerald-50 font-semibold'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <span
                            className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${
                              isMarked ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {opt.label}
                          </span>
                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => handleOptionEdit(index, optIdx, 'text', e.target.value)}
                            className="w-full bg-transparent border-0 outline-none text-xs font-medium"
                            placeholder={`Option ${opt.label} text...`}
                          />
                          {q.options.length > 2 && (
                            <button
                              onClick={() => handleRemoveOption(index, optIdx)}
                              className="text-slate-400 hover:text-red-500 p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* MARKED ANSWER SELECTION & EXPLANATION */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-body-secondary uppercase mb-1">
                      Detected / Marked Answer Key
                    </label>
                    <select
                      value={q.marked_answer || ''}
                      onChange={(e) => handleQuestionEdit(index, 'marked_answer', e.target.value || null)}
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-bold text-emerald-900 bg-emerald-50 outline-none"
                    >
                      <option value="">No Answer Marked (null)</option>
                      {(q.options || []).map((opt) => (
                        <option key={opt.label} value={opt.label}>
                          Option ({opt.label})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-body-secondary uppercase mb-1">
                      Extraction Notes / Rationale
                    </label>
                    <input
                      type="text"
                      value={q.extraction_notes || ''}
                      onChange={(e) => handleQuestionEdit(index, 'extraction_notes', e.target.value)}
                      placeholder="Add extraction notes or explanation..."
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REPLACE EXISTING QUESTIONS CONFIRMATION MODAL */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-modal border border-surface-border space-y-4">
            <h3 className="text-lg font-bold text-body-text flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Replace Existing Questions?</span>
            </h3>

            <p className="text-xs text-body-secondary leading-relaxed">
              This paper already contains <strong>{existingDbCount} questions</strong> in the database. Do you want to
              replace them with the {questions.length} newly extracted questions, or append/merge them?
            </p>

            <div className="flex flex-col space-y-2 pt-2">
              <button
                onClick={() => executeImport(true)}
                className="w-full py-2.5 bg-status-error hover:bg-red-700 text-white font-bold rounded-lg text-xs shadow-subtle"
              >
                Delete {existingDbCount} Existing Questions & Import New Set
              </button>
              <button
                onClick={() => executeImport(false)}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg text-xs shadow-subtle"
              >
                Upsert / Merge Questions (Keep Existing)
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
