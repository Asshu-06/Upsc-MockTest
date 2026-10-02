import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Papa from 'papaparse'
import { questionService } from '../../services/questionService'
import { paperService } from '../../services/paperService'
import { processPdfVision, retryFailedPages } from '../../services/pdfVisionService'
import { useApp } from '../../contexts/AppContext'
import {
  ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, Loader2,
  Save, RefreshCw, Sparkles, ChevronDown, ChevronRight, RotateCcw,
  Layers, Eye,
} from 'lucide-react'

// ─── Shared: batch progress bar (same as BYOPPage) ────────────────────────────
function BatchProgress({ info }) {
  if (!info) return null
  const { pagesProcessed = 0, totalPages = 0, batchIndex = 0,
          totalBatches = 0, questionsFound = 0, cachedPages = 0, statusText } = info
  const pct = totalPages > 0 ? Math.round((pagesProcessed / totalPages) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-blue-800">{statusText ?? 'Processing…'}</span>
        <span className="text-blue-600 font-mono">{pct}%</span>
      </div>
      <div className="w-full h-2.5 bg-blue-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Pages',     value: `${pagesProcessed}/${totalPages}` },
          { label: 'Questions', value: questionsFound },
          { label: 'Cached',    value: cachedPages },
        ].map(({ label, value }) => (
          <div key={label} className="bg-blue-50 rounded-lg py-1.5">
            <p className="text-sm font-bold text-blue-800">{value}</p>
            <p className="text-[10px] text-blue-600">{label}</p>
          </div>
        ))}
      </div>
      {totalBatches > 1 && (
        <p className="text-[11px] text-blue-600 text-center">
          Batch {batchIndex} / {totalBatches} — 2 pages per Gemini Vision request
        </p>
      )}
    </div>
  )
}

// ─── PDF Vision tab ────────────────────────────────────────────────────────────
function PdfVisionTab({ paperId, paperTitle, onImportSuccess }) {
  const { toast } = useApp()
  const fileRef    = useRef(null)

  const [file, setFile]           = useState(null)
  const [processing, setProcessing] = useState(false)
  const [progressInfo, setProgress] = useState(null)
  const [result, setResult]       = useState(null)
  const [questions, setQuestions] = useState([])
  const [expanded, setExpanded]   = useState(new Set())
  const [saving, setSaving]       = useState(false)
  const [importMsg, setImportMsg] = useState(null)
  const renderedRef = useRef(null)

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    if (f.type !== 'application/pdf') { toast.error('Please select a PDF file.'); return }
    if (f.size > 35 * 1024 * 1024)   { toast.error('PDF must be under 35 MB.'); return }
    setFile(f)
    setResult(null)
    setQuestions([])
    setImportMsg(null)
    setProgress(null)
    renderedRef.current = null
  }

  async function handleExtract() {
    if (!file) { toast.error('Select a PDF first.'); return }
    setProcessing(true)
    setProgress(null)
    setResult(null)
    setQuestions([])
    setImportMsg(null)

    try {
      const visionResult = await processPdfVision(file, {
        batchSize:  2,
        documentId: null,
        onProgress: info => setProgress({ ...info }),
      })
      renderedRef.current = visionResult.renderedPages ?? []
      setResult(visionResult)
      setQuestions(visionResult.questions ?? [])

      if (visionResult.totalQuestions === 0) {
        toast.warning('No questions extracted. Try a clearer scan.')
      } else {
        toast.success(`${visionResult.totalQuestions} questions extracted!`)
      }
    } catch (err) {
      toast.error('Extraction failed: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleRetryFailed() {
    if (!result?.failedBatches?.length) return
    const stored = renderedRef.current ?? []
    const failedNums = new Set(result.failedBatches.flatMap(fb => fb.pages ?? []))
    const pages = stored.filter(p => failedNums.has(p.pageNumber) && !p.hasError)
    if (!pages.length) { toast.error('No retryable pages in memory.'); return }

    setProcessing(true)
    setProgress({ statusText: `Retrying ${pages.length} page(s)…`, stage: 'retrying' })
    try {
      const retry = await retryFailedPages(pages, null, info => setProgress({ ...info }))
      const merged = [...questions, ...(retry.questions ?? [])]
      const seen = new Set()
      const deduped = merged.filter(q => {
        const k = String(q.question_number)
        if (seen.has(k)) return false
        seen.add(k); return true
      }).sort((a, b) => (parseInt(a.question_number)||0) - (parseInt(b.question_number)||0))
      setQuestions(deduped)
      setResult(r => ({ ...r, questions: deduped, failedBatches: [] }))
      toast.success(`${retry.questions?.length ?? 0} more questions recovered.`)
    } catch (err) {
      toast.error('Retry failed: ' + err.message)
    } finally {
      setProcessing(false)
      setProgress(null)
    }
  }

  function editQ(idx, field, value) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  }

  function toggleExpand(idx) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  async function handleSave(replaceExisting = false) {
    if (!paperId) { toast.error('No paper ID.'); return }
    if (!questions.length) { toast.error('No questions to save.'); return }
    setSaving(true)
    try {
      const toSave = questions.map((q, i) => ({
        question_number: parseInt(String(q.question_number), 10) || i + 1,
        question_text:   [q.tamil_question, q.english_question].filter(Boolean).join('\n').trim()
                         || q.question_text || `Question ${i + 1}`,
        option_a:        q.option_a || '',
        option_b:        q.option_b || '',
        option_c:        q.option_c || '',
        option_d:        q.option_d || '',
        correct_option:  q.correct_option ?? null,
        explanation:     null,
      }))

      const existing = await questionService.getExistingQuestionCount(paperId)
      if (existing > 0 && !replaceExisting) {
        if (!window.confirm(
          `This paper already has ${existing} question(s). ` +
          `Click OK to REPLACE them, or Cancel to merge/append.`
        )) {
          // User clicked Cancel → append (replaceExisting = false)
          const inserted = await questionService.saveQuestionsToSupabase(paperId, toSave, false)
          setImportMsg(`Merged ${inserted.length} questions into the paper.`)
          onImportSuccess?.(inserted.length)
          return
        }
        // User clicked OK → replace
        const inserted = await questionService.saveQuestionsToSupabase(paperId, toSave, true)
        setImportMsg(`Replaced with ${inserted.length} questions.`)
        onImportSuccess?.(inserted.length)
        return
      }

      const inserted = await questionService.saveQuestionsToSupabase(paperId, toSave, replaceExisting)
      setImportMsg(`Successfully saved ${inserted.length} questions to the paper!`)
      toast.success(`${inserted.length} questions saved to "${paperTitle}"`)
      onImportSuccess?.(inserted.length)
    } catch (err) {
      toast.error('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const STATUS_BADGE = {
    complete:   'bg-emerald-100 text-emerald-700',
    partial:    'bg-amber-100  text-amber-700',
    unreadable: 'bg-red-100    text-red-700',
  }

  return (
    <div className="space-y-5">

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Layers className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-blue-800">Vision-Only Pipeline</p>
          <p className="text-xs text-body-secondary mt-0.5">
            Pages are rendered as images and sent to Gemini Vision — no OCR text layer.
            Supports Tamil, English, bilingual questions, tables, and diagrams.
            Processed in batches of 2 pages. Results go directly into this paper's question bank.
          </p>
        </div>
      </div>

      {/* File selector */}
      <div className="bg-white rounded-xl border border-surface-border p-5 shadow-card space-y-4">
        <h3 className="text-sm font-bold text-body-text flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-tnpsc-brand" />
          Step 1 — Select PDF
        </h3>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-primary-light/10 transition-all group"
        >
          <Upload className="w-8 h-8 text-slate-400 group-hover:text-primary mx-auto mb-2 transition-colors" />
          {file ? (
            <p className="text-xs font-bold text-primary">
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          ) : (
            <p className="text-xs text-body-secondary">Click to select a TNPSC question paper PDF (max 35 MB)</p>
          )}
        </div>
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />

        {file && !processing && (
          <button
            onClick={handleExtract}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-subtle transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {result ? 'Re-extract with Gemini Vision' : 'Extract Questions with Gemini Vision'}
          </button>
        )}
      </div>

      {/* Progress */}
      {processing && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
            <p className="text-sm font-bold text-blue-800">
              {progressInfo?.stage === 'rendering'  ? 'Rendering PDF pages…'
             : progressInfo?.stage === 'extracting' ? 'Extracting via Gemini Vision…'
             : progressInfo?.stage === 'retrying'   ? 'Retrying failed pages…'
             : 'Processing…'}
            </p>
          </div>
          <BatchProgress info={progressInfo} />
        </div>
      )}

      {/* Extraction summary + retry */}
      {result && !processing && (
        <div className="bg-white rounded-xl border border-surface-border p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="bg-emerald-100 text-emerald-800 rounded-full px-3 py-1 font-bold">
                {questions.length} questions extracted
              </span>
              <span className="bg-slate-100 text-slate-700 rounded-full px-3 py-1 font-semibold">
                {result.totalPages} pages · {result.processedPages} processed · {result.cachedPages} cached
              </span>
              {result.failedBatches?.length > 0 && (
                <span className="bg-amber-100 text-amber-800 rounded-full px-3 py-1 font-semibold">
                  {result.failedBatches.length} batch(es) failed
                </span>
              )}
              {questions.filter(q => q.has_diagram).length > 0 && (
                <span className="bg-purple-100 text-purple-700 rounded-full px-3 py-1 font-semibold">
                  {questions.filter(q => q.has_diagram).length} with diagrams
                </span>
              )}
            </div>
            {result.failedBatches?.length > 0 && (
              <button
                onClick={handleRetryFailed}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg hover:bg-amber-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry {result.failedBatches.length} failed batch(es)
              </button>
            )}
          </div>

          {/* Batch dots */}
          {result.batchStatuses?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {result.batchStatuses.map((b, i) => (
                <span key={i}
                  title={b.error ?? `Pages ${(b.pages ?? []).join('–')}`}
                  className={`text-[10px] font-semibold rounded px-2 py-0.5 ${
                    b.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    b.status === 'failed'    ? 'bg-red-100 text-red-700' :
                                               'bg-slate-100 text-slate-600'
                  }`}
                >
                  p.{(b.pages ?? []).join('–')} {b.status === 'failed' ? '✗' : '✓'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Success message */}
      {importMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800">{importMsg}</p>
            <Link to={`/admin/papers/${paperId}/questions`}
              className="text-xs text-emerald-700 underline mt-0.5 inline-block">
              View questions list →
            </Link>
          </div>
        </div>
      )}

      {/* Step 2: Review + Save */}
      {questions.length > 0 && !processing && (
        <div className="bg-white rounded-xl border border-surface-border p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-body-text flex items-center gap-2">
              <Eye className="w-4 h-4 text-tnpsc-brand" />
              Step 2 — Review &amp; Save to Paper
            </h3>
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-subtle transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : `Save ${questions.length} Questions to Paper`}
            </button>
          </div>

          <p className="text-xs text-body-secondary">
            Expand a question to edit Tamil/English text, options, and the correct answer before saving.
          </p>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const isOpen  = expanded.has(idx)
              const badgeCls = STATUS_BADGE[q.extraction_status] ?? STATUS_BADGE.complete

              return (
                <div key={idx}
                  className={`rounded-xl border transition-colors ${
                    !q.option_a ? 'border-amber-300 bg-amber-50/30' : 'border-surface-border bg-white'
                  }`}
                >
                  {/* Collapsed row */}
                  <button
                    onClick={() => toggleExpand(idx)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-7 h-7 rounded-lg bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {q.question_number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-body-text truncate">
                          {(q.tamil_question || q.english_question || q.question_text || '—').slice(0, 80)}
                        </p>
                        {q.english_question && q.tamil_question && (
                          <p className="text-[10px] text-body-secondary truncate mt-0.5">
                            {q.english_question.slice(0, 80)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${badgeCls}`}>
                        {q.extraction_status ?? 'complete'}
                      </span>
                      {q.has_diagram && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5 font-bold">dia</span>
                      )}
                      {q.correct_option && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-bold">
                          Ans: {q.correct_option}
                        </span>
                      )}
                      <span className="text-[10px] text-body-secondary">p.{q.source_page ?? q.page_number}</span>
                      {isOpen
                        ? <ChevronDown className="w-4 h-4 text-body-secondary" />
                        : <ChevronRight className="w-4 h-4 text-body-secondary" />
                      }
                    </div>
                  </button>

                  {/* Expanded edit */}
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 border-t border-surface-border pt-3">
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-body-secondary uppercase mb-1">
                            Tamil Question
                          </label>
                          <textarea rows={2} value={q.tamil_question ?? ''}
                            onChange={e => editQ(idx, 'tamil_question', e.target.value)}
                            className="w-full border border-surface-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary resize-none"
                            placeholder="Tamil text…" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-body-secondary uppercase mb-1">
                            English Question
                          </label>
                          <textarea rows={2} value={q.english_question ?? ''}
                            onChange={e => editQ(idx, 'english_question', e.target.value)}
                            className="w-full border border-surface-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary resize-none"
                            placeholder="English text…" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {['A','B','C','D'].map(opt => (
                          <div key={opt}>
                            <label className="block text-[10px] font-bold text-body-secondary uppercase mb-1">
                              Option {opt}{q.correct_option === opt ? ' ✓' : ''}
                            </label>
                            <input type="text"
                              value={q[`option_${opt.toLowerCase()}`] ?? ''}
                              onChange={e => editQ(idx, `option_${opt.toLowerCase()}`, e.target.value)}
                              className={`w-full border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary ${
                                q.correct_option === opt ? 'border-emerald-400 bg-emerald-50' : 'border-surface-border'
                              }`} />
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-body-secondary uppercase">Correct:</span>
                        <div className="flex gap-1.5">
                          {['A','B','C','D',null].map(opt => (
                            <button key={String(opt)}
                              onClick={() => editQ(idx, 'correct_option', opt)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                                q.correct_option === opt
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-body-secondary hover:bg-slate-200'
                              }`}
                            >{opt ?? '–'}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function ImportQuestionsPage() {
  const { paperId } = useParams()
  const navigate    = useNavigate()
  const { toast }   = useApp()

  const [paper, setPaper]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('pdf')  // 'pdf' | 'csv'

  // CSV/JSON state (unchanged from original)
  const [parsedRows, setParsedRows]   = useState([])
  const [fileName, setFileName]       = useState('')
  const [fileError, setFileError]     = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting]     = useState(false)

  useEffect(() => {
    paperService.getPaperById(paperId)
      .then(setPaper)
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [paperId])

  // ── CSV/JSON handlers (unchanged from original) ──────────────────────────
  const validateRow = (row, index) => {
    const errors = []
    const num    = parseInt(row.question_number, 10)
    if (isNaN(num) || num <= 0) errors.push('Invalid question number')
    if (!row.question_text?.trim() || row.question_text.trim().length < 3) errors.push('Missing question text')
    if (!row.option_a) errors.push('Missing Option A')
    if (!row.option_b) errors.push('Missing Option B')
    if (!row.option_c) errors.push('Missing Option C')
    if (!row.option_d) errors.push('Missing Option D')
    const opt = row.correct_option ? String(row.correct_option).toUpperCase().trim() : ''
    if (!['A','B','C','D'].includes(opt)) errors.push('Correct option must be A, B, C, or D')
    return {
      index,
      question_number: isNaN(num) ? index + 1 : num,
      question_text:   row.question_text || '',
      option_a:        row.option_a || '',
      option_b:        row.option_b || '',
      option_c:        row.option_c || '',
      option_d:        row.option_d || '',
      correct_option:  ['A','B','C','D'].includes(opt) ? opt : 'A',
      explanation:     row.explanation || '',
      isValid:         errors.length === 0,
      errors,
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name); setFileError(null); setImportResult(null)
    const isJson = file.name.endsWith('.json')
    const isCsv  = file.name.endsWith('.csv')
    if (!isJson && !isCsv) { setFileError('Please upload a .JSON or .CSV file.'); return }
    const reader = new FileReader()
    if (isJson) {
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target.result)
          if (!Array.isArray(json)) { setFileError('JSON must be an array.'); return }
          setParsedRows(json.map((item, i) => validateRow(item, i)))
        } catch (err) { setFileError(`Invalid JSON: ${err.message}`) }
      }
      reader.readAsText(file)
    } else {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: res => setParsedRows((res.data || []).map((item, i) => validateRow(item, i))),
        error:    err => setFileError(`CSV error: ${err.message}`),
      })
    }
  }

  const handleRowChange = (index, field, value) => {
    const updated = [...parsedRows]
    updated[index] = validateRow({ ...updated[index], [field]: value }, index)
    setParsedRows(updated)
  }

  const handleSaveImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid)
    if (!validRows.length) { setFileError('No valid questions to import.'); return }
    setImporting(true); setFileError(null)
    try {
      await questionService.batchImportQuestions(paperId, validRows)
      setImportResult({ successCount: validRows.length, failedCount: parsedRows.length - validRows.length })
      setTimeout(() => navigate(`/admin/papers/${paperId}/questions`), 1500)
    } catch (err) {
      setFileError(err.message || 'Import failed.')
    } finally { setImporting(false) }
  }

  if (loading) return (
    <div className="py-12 text-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
      <p className="text-xs text-body-secondary">Loading…</p>
    </div>
  )

  const validCount   = parsedRows.filter(r => r.isValid).length
  const invalidCount = parsedRows.length - validCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to={`/admin/papers/${paperId}/questions`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-body-secondary hover:text-primary transition-colors mb-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Paper Questions
        </Link>
        <h1 className="text-2xl font-bold text-body-text">Import Questions</h1>
        <p className="text-xs text-body-secondary mt-0.5">
          Paper: <strong>{paper?.title}</strong>
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-surface-border pb-1">
        <button
          onClick={() => setActiveTab('pdf')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'pdf'
              ? 'bg-primary text-white shadow-subtle'
              : 'bg-slate-100 text-body-secondary hover:bg-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Gemini Vision (PDF)
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'csv'
              ? 'bg-primary text-white shadow-subtle'
              : 'bg-slate-100 text-body-secondary hover:bg-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          CSV / JSON
        </button>
      </div>

      {/* ── PDF Vision tab ── */}
      {activeTab === 'pdf' && (
        <PdfVisionTab
          paperId={paperId}
          paperTitle={paper?.title}
          onImportSuccess={() => setTimeout(() => navigate(`/admin/papers/${paperId}/questions`), 2000)}
        />
      )}

      {/* ── CSV/JSON tab (original, unchanged) ── */}
      {activeTab === 'csv' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
            <h3 className="text-sm font-bold text-body-text uppercase tracking-wider">
              Select Question File (.JSON or .CSV)
            </h3>
            <div className="p-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 text-center space-y-3">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <div>
                <input type="file" accept=".json,.csv" onChange={handleFileUpload}
                  className="hidden" id="file-import-input" />
                <label htmlFor="file-import-input"
                  className="cursor-pointer px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg text-xs inline-block shadow-subtle">
                  Browse JSON / CSV File
                </label>
              </div>
              {fileName && <p className="text-xs font-semibold text-primary">Selected: {fileName}</p>}
              <p className="text-[11px] text-body-secondary">
                CSV headers: <code>question_number, question_text, option_a, option_b, option_c, option_d, correct_option, explanation</code>
              </p>
            </div>
            {fileError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /><span>{fileError}</span>
              </div>
            )}
            {importResult && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-status-success text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Imported {importResult.successCount} questions! Redirecting…</span>
              </div>
            )}
          </div>

          {parsedRows.length > 0 && (
            <div className="bg-white rounded-xl border border-surface-border shadow-card p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-4">
                <div>
                  <h3 className="text-base font-bold text-body-text">Preview ({parsedRows.length} rows)</h3>
                  <p className="text-xs text-body-secondary">Review before saving</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">{validCount} Valid</span>
                  {invalidCount > 0 && <span className="text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded border border-red-200">{invalidCount} Invalid</span>}
                  <button onClick={handleSaveImport} disabled={importing || validCount === 0}
                    className="px-5 py-2 bg-status-success hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-subtle flex items-center gap-1.5 disabled:opacity-50">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /><span>Save {validCount}</span></>}
                  </button>
                </div>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {parsedRows.map((row, index) => (
                  <div key={index}
                    className={`p-4 rounded-xl border space-y-3 ${row.isValid ? 'border-surface-border bg-white' : 'border-red-300 bg-red-50/40'}`}>
                    {!row.isValid && (
                      <div className="text-xs text-status-error font-bold flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        <span>{row.errors.join(', ')}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                      <div className="sm:col-span-1">
                        <label className="block text-[10px] font-bold text-body-secondary uppercase">Q#</label>
                        <input type="number" value={row.question_number}
                          onChange={e => handleRowChange(index, 'question_number', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-xs text-center font-bold" />
                      </div>
                      <div className="sm:col-span-9">
                        <label className="block text-[10px] font-bold text-body-secondary uppercase">Question Text</label>
                        <textarea rows={2} value={row.question_text}
                          onChange={e => handleRowChange(index, 'question_text', e.target.value)}
                          className="w-full px-2.5 py-1.5 border rounded text-xs outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-body-secondary uppercase">Correct</label>
                        <select value={row.correct_option}
                          onChange={e => handleRowChange(index, 'correct_option', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-xs font-bold text-emerald-800 bg-emerald-50">
                          {['A','B','C','D'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {['a','b','c','d'].map(l => (
                        <div key={l}>
                          <span className="font-bold text-slate-500 mr-1">({l.toUpperCase()})</span>
                          <input type="text" value={row[`option_${l}`]}
                            onChange={e => handleRowChange(index, `option_${l}`, e.target.value)}
                            className="w-[calc(100%-25px)] px-2 py-1 border rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
