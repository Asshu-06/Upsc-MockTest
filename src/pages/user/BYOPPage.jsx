import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileText, Loader2, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, Eye, Trash2, Plus, Clock, ChevronDown, ChevronRight,
  Layers, Zap, BookOpen, AlertTriangle, RotateCcw, X, Save, Play, Sparkles,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { supabase } from '../../lib/supabase'
import { byopService } from '../../services/tnpscService'
import { extractPdfText } from '../../services/pdfTextExtractor'
import { parseMcqQuestions } from '../../services/mcqParser'
import { extractQuestionsWithAi, blobToBase64, fetchAvailableGeminiModels } from '../../services/aiPdfService'
import { apiKeyService } from '../../services/apiKeyService'
import { questionService } from '../../services/questionService'
import { paperService } from '../../services/paperService'
import { formatDate } from '../../lib/utils'

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  uploaded:        { label: 'Uploaded',        color: 'bg-slate-100 text-slate-600',    icon: Upload },
  processing:      { label: 'Processing…',     color: 'bg-blue-100 text-blue-700',      icon: RefreshCw },
  extracted:       { label: 'Extracted',        color: 'bg-yellow-100 text-yellow-700',  icon: Eye },
  review_required: { label: 'Review Required',  color: 'bg-orange-100 text-orange-700',  icon: AlertCircle },
  ready:           { label: 'Ready',            color: 'bg-green-100 text-green-700',    icon: CheckCircle2 },
  failed:          { label: 'Failed',           color: 'bg-red-100 text-red-700',        icon: XCircle },
}

// ─── Unicode Sanitizer Utility ───────────────────────────────────────────────
function sanitizeUnicode(value) {
  if (typeof value !== 'string') {
    if (Array.isArray(value)) return value.map(sanitizeUnicode)
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, sanitizeUnicode(v)])
      )
    }
    return value
  }

  // Remove null bytes and unpaired surrogates (PostgreSQL rejects these)
  let result = ''
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)

    // Skip null bytes (U+0000)
    if (code === 0x0000) continue

    if (code >= 0xD800 && code <= 0xDBFF) {
      // High surrogate - check if followed by low surrogate
      const next = value.charCodeAt(i + 1)
      if (next >= 0xDC00 && next <= 0xDFFF) {
        result += value[i] + value[i + 1]
        i++
      } else {
        result += '\uFFFD'
      }
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      result += '\uFFFD'
    } else {
      result += value[i]
    }
  }
  return result
}

// ─── Batch progress bar ────────────────────────────────────────────────────────
function BatchProgress({ info }) {
  if (!info) return null
  const { stage, currentPage, totalPages, batchIndex, totalBatches,
          pagesProcessed, questionsFound, cachedPages, statusText } = info

  const pct = totalPages > 0 ? Math.round((pagesProcessed / totalPages) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-blue-800">{statusText ?? 'Processing…'}</span>
        <span className="text-blue-600 font-mono">{pct}%</span>
      </div>

      <div className="w-full h-2.5 bg-blue-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Pages',     value: `${pagesProcessed ?? 0} / ${totalPages ?? '?'}` },
          { label: 'Questions', value: questionsFound ?? 0 },
          { label: 'Cached',    value: cachedPages ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-blue-50 rounded-lg py-1.5">
            <p className="text-sm font-bold text-blue-800">{value}</p>
            <p className="text-[10px] text-blue-600">{label}</p>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <p className="text-[11px] text-blue-600 text-center">
          Processing page {currentPage ?? 0} of {totalPages} using local PDF.js parser
        </p>
      )}
    </div>
  )
}

// ─── Extracted questions review panel ─────────────────────────────────────────
function QuestionsPanel({ questions, onSave, saving }) {
  const [expanded, setExpanded] = useState(new Set())
  const [editedQs, setEditedQs] = useState(questions)

  // sync when questions prop changes
  useEffect(() => { setEditedQs(questions) }, [questions])

  function toggleExpand(idx) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function editQuestion(idx, field, value) {
    setEditedQs(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  }

  const valid   = editedQs.filter(q => q.isValid !== false)
  const invalid = editedQs.filter(q => q.isValid === false)

  const STATUS_BADGE = {
    complete:    'bg-emerald-100 text-emerald-700',
    partial:     'bg-amber-100  text-amber-700',
    unreadable:  'bg-red-100    text-red-700',
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-body-text">{editedQs.length} questions extracted</span>
          {invalid.length > 0 && (
            <span className="text-[11px] bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 font-semibold">
              {invalid.length} need review
            </span>
          )}
          {editedQs.filter(q => q.has_diagram).length > 0 && (
            <span className="text-[11px] bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-semibold">
              {editedQs.filter(q => q.has_diagram).length} with diagrams
            </span>
          )}
        </div>
        <button
          onClick={() => onSave(editedQs)}
          disabled={saving || editedQs.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-tnpsc-brand text-white rounded-xl text-xs font-bold hover:bg-tnpsc-brand-hover transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Saving…' : `Save ${valid.length} Questions`}
        </button>
      </div>

      {/* Question cards */}
      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {editedQs.map((q, idx) => {
          const isOpen  = expanded.has(idx)
          const badgeCls = STATUS_BADGE[q.extraction_status] ?? STATUS_BADGE.complete
          const qNum    = q.question_number ?? idx + 1

          return (
            <div
              key={idx}
              className={`rounded-xl border transition-colors ${
                q.isValid === false ? 'border-amber-300 bg-amber-50/30' : 'border-surface-border bg-white'
              }`}
            >
              {/* Card header — always visible */}
              <button
                onClick={() => toggleExpand(idx)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-7 h-7 rounded-lg bg-tnpsc-brand text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {qNum}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-body-text truncate leading-snug">
                      {q.tamil_question
                        ? q.tamil_question.slice(0, 80) + (q.tamil_question.length > 80 ? '…' : '')
                        : q.question_text?.slice(0, 80) ?? '—'}
                    </p>
                    {q.english_question && (
                      <p className="text-[10px] text-body-secondary truncate mt-0.5">
                        {q.english_question.slice(0, 80)}{q.english_question.length > 80 ? '…' : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${badgeCls}`}>
                    {q.extraction_status ?? 'complete'}
                  </span>
                  {q.has_diagram && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5 font-bold">
                      diagram
                    </span>
                  )}
                  <span className="text-[10px] text-body-secondary">p.{q.source_page ?? q.page_number}</span>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-body-secondary" />
                    : <ChevronRight className="w-4 h-4 text-body-secondary" />
                  }
                </div>
              </button>

              {/* Expanded edit view */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-border pt-3">
                  {/* Tamil question */}
                  <div>
                    <label className="block text-[10px] font-bold text-body-secondary uppercase mb-1">
                      Tamil Question
                    </label>
                    <textarea
                      rows={2}
                      value={q.question_text || q.tamil_question || ''}
                      onChange={e => { editQuestion(idx, 'question_text', e.target.value); editQuestion(idx, 'tamil_question', e.target.value) }}
                      className="w-full border border-surface-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-tnpsc-brand resize-none"
                      placeholder="Tamil text…"
                    />
                  </div>

                  {/* English question */}
                  <div>
                    <label className="block text-[10px] font-bold text-body-secondary uppercase mb-1">
                      English Question
                    </label>
                    <textarea
                      rows={2}
                      value={q.english_question ?? ''}
                      onChange={e => editQuestion(idx, 'english_question', e.target.value)}
                      className="w-full border border-surface-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-tnpsc-brand resize-none"
                      placeholder="English text…"
                    />
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-2 gap-2">
                    {['A','B','C','D'].map(opt => (
                      <div key={opt}>
                        <label className="block text-[10px] font-bold text-body-secondary uppercase mb-1">
                          Option {opt}
                          {q.correct_option === opt && (
                            <span className="ml-1 text-emerald-600">✓ Correct</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={q[`option_${opt.toLowerCase()}`] || q.options?.[opt] || ''}
                          onChange={e => { editQuestion(idx, `option_${opt.toLowerCase()}`, e.target.value); if (q.options) q.options[opt] = e.target.value }}
                          className={`w-full border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-tnpsc-brand ${
                            q.correct_option === opt
                              ? 'border-emerald-400 bg-emerald-50'
                              : 'border-surface-border'
                          }`}
                          placeholder={`Option ${opt}…`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Correct option selector */}
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-bold text-body-secondary uppercase">
                      Correct Answer:
                    </label>
                    <div className="flex gap-1.5">
                      {['A','B','C','D',null].map(opt => (
                        <button
                          key={String(opt)}
                          onClick={() => editQuestion(idx, 'correct_option', opt)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                            q.correct_option === opt
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-body-secondary hover:bg-slate-200'
                          }`}
                        >
                          {opt ?? '–'}
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-body-secondary">
                      (– = no answer key visible)
                    </span>
                  </div>

                  {/* Type badge */}
                  <div className="flex items-center gap-2 text-[10px] text-body-secondary">
                    <span>Type: <strong>{q.question_type ?? 'mcq'}</strong></span>
                    <span>Page: <strong>{q.source_page ?? q.page_number}</strong></span>
                    {q.has_diagram && <span className="text-purple-600 font-semibold">⚠ Contains diagram</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Attempt button: looks up the paper created from this upload ──────────────
// ─── Attempt button: looks up or auto-creates the paper created from this upload ──────────────
function AttemptButton({ paperId, userId }) {
  const [loading, setLoading] = useState(false)
  const { toast } = useApp()
  const navigate = useNavigate()

  async function handleAttempt() {
    setLoading(true)
    try {
      const { data: record, error: recErr } = await supabase
        .from('uploaded_papers')
        .select('*')
        .eq('id', paperId)
        .maybeSingle()

      if (recErr) throw recErr
      if (!record) {
        toast.error('Paper record not found.')
        return
      }

      // 1. Try regex from notes first: '... paper "uuid".'
      const match = record?.notes?.match(/"([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})"/)
      const targetPaperId = match?.[1]

      if (targetPaperId) {
        const { data: existingPaper } = await supabase
          .from('papers')
          .select('id, status')
          .eq('id', targetPaperId)
          .maybeSingle()

        if (existingPaper?.id) {
          if (existingPaper.status !== 'published') {
            await supabase.from('papers').update({ status: 'published' }).eq('id', existingPaper.id)
          }
          navigate(`/exam/${existingPaper.id}`)
          return
        }
      }

      // 2. Fallback: find the paper by created_by + title + exam_name === 'Custom Upload'
      const { data: papers } = await supabase
        .from('papers')
        .select('id, status')
        .eq('created_by', userId)
        .ilike('title', `%${record?.title ?? ''}%`)
        .eq('exam_name', 'Custom Upload')
        .order('created_at', { ascending: false })
        .limit(1)

      if (papers?.[0]?.id) {
        if (papers[0].status !== 'published') {
          await supabase.from('papers').update({ status: 'published' }).eq('id', papers[0].id)
        }
        await supabase
          .from('uploaded_papers')
          .update({
            notes: `${record?.notes || ''} paper "${papers[0].id}".`.trim()
          })
          .eq('id', paperId)

        navigate(`/exam/${papers[0].id}`)
        return
      }

      // 3. Fallback: Self-healing creation from record.questions_json
      let rawQuestions = []
      if (Array.isArray(record?.questions_json)) {
        rawQuestions = record.questions_json
      } else if (typeof record?.questions_json === 'string') {
        try { rawQuestions = JSON.parse(record.questions_json) } catch (e) { rawQuestions = [] }
      }

      if (rawQuestions && rawQuestions.length > 0) {
        toast.info('Preparing exam environment...')

        const newPaper = await paperService.createPaper({
          title: record.title || 'Custom Uploaded Paper',
          exam_name: 'Custom Upload',
          exam_type: 'Custom',
          year: new Date().getFullYear(),
          subject: 'General',
          description: `BYOP upload: ${record.file_name || record.title}`,
          duration_minutes: Math.max(30, Math.round(rawQuestions.length * 1.5)),
          total_questions: rawQuestions.length,
          status: 'published',
          created_by: userId,
        })

        const toSave = rawQuestions
          .filter(q => q.question_text?.trim() || q.tamil_question?.trim() || q.english_question?.trim())
          .map((q, i) => {
            const eng = (q.question_text_english || q.english_question || '').trim()
            const tam = (q.question_text_tamil || q.tamil_question || '').trim()
            let combined = (q.question_text || '').trim()

            if (eng && tam) {
              if (!combined.includes('தமிழ்:')) {
                combined = `${eng}\nதமிழ்: ${tam}`
              }
            } else if (!combined) {
              combined = eng && tam ? `${eng}\nதமிழ்: ${tam}` : (eng || tam || `Question ${i + 1}`)
            }

            const formatOpt = (engOpt, tamOpt) => {
              const e = (engOpt || '').trim()
              const t = (tamOpt || '').trim()
              if (!t || t === e) return e || t
              if (!e) return t
              if (e.includes(' / ')) return e
              return `${e} / ${t}`
            }

            return {
              question_number: parseInt(String(q.question_number), 10) || i + 1,
              question_text: combined,
              question_text_tamil: tam || null,
              option_a: formatOpt(q.option_a || q.options?.A || 'Option A', q.option_a_tamil),
              option_b: formatOpt(q.option_b || q.options?.B || 'Option B', q.option_b_tamil),
              option_c: formatOpt(q.option_c || q.options?.C || 'Option C', q.option_c_tamil),
              option_d: formatOpt(q.option_d || q.options?.D || 'Option D', q.option_d_tamil),
              option_a_tamil: q.option_a_tamil || null,
              option_b_tamil: q.option_b_tamil || null,
              option_c_tamil: q.option_c_tamil || null,
              option_d_tamil: q.option_d_tamil || null,
              correct_option: ['A','B','C','D'].includes(q.correct_option || q.correct_answer)
                ? (q.correct_option || q.correct_answer)
                : null,
              explanation: q.explanation || null,
              explanation_tamil: q.explanation_tamil || null,
            }
          })

        if (toSave.length > 0) {
          await questionService.saveQuestionsToSupabase(newPaper.id, toSave, false)
        }

        const notesMsg = `${toSave.length} questions saved to paper "${newPaper.id}".`
        await supabase
          .from('uploaded_papers')
          .update({
            notes: notesMsg,
            processing_status: 'ready',
            extracted_count: toSave.length,
          })
          .eq('id', paperId)

        toast.success('Exam ready! Starting test...')
        navigate(`/exam/${newPaper.id}`)
        return
      }

      toast.error('No extracted questions found in this paper. Please click "Process" to extract questions first.')
    } catch (err) {
      console.error('[AttemptButton] Error launching test:', err)
      toast.error('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleAttempt}
      disabled={loading}
      className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-subtle disabled:opacity-60"
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
      }
      {loading ? 'Preparing…' : 'Attempt Test'}
    </button>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function BYOPPage() {
  const { user } = useAuth()
  const { toast, hasGeminiApiKey, geminiApiKey } = useApp()
  const navigate = useNavigate()
  const fileRef   = useRef(null)

  const [papers, setPapers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  // Active processing state — keyed by paper id
  const [activeId, setActiveId]     = useState(null)
  const [progressInfo, setProgress] = useState(null)
  const [result, setResult]         = useState(null)   // local parser result
  const [showReview, setShowReview] = useState(false)
  const [reviewPaperId, setReviewPaperId] = useState(null)
  const [saving, setSaving]         = useState(false)
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash')
  const [modelsList, setModelsList] = useState([
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)' },
    { id: 'gemini-flash-latest', name: 'Gemini Flash Latest' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
  ])

  useEffect(() => {
    async function loadModels() {
      const apiKey = geminiApiKey || apiKeyService.getUserApiKey()
      if (!apiKey) return
      try {
        const list = await fetchAvailableGeminiModels(apiKey)
        if (list && list.length > 0) {
          setModelsList(list)
          if (!list.some(m => m.id === selectedModel)) {
            setSelectedModel(list[0].id)
          }
        }
      } catch (e) {
        console.warn('Error loading models in BYOP:', e)
      }
    }
    loadModels()
  }, [geminiApiKey])

  useEffect(() => { if (user?.id) fetchPapers() }, [user?.id])

  async function fetchPapers() {
    setLoading(true)
    try { setPapers(await byopService.getAll(user.id)) }
    catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported.')
      return
    }

    setUploading(true)
    try {
      const { path } = await byopService.uploadFile(user.id, file)
      const record   = await byopService.create(user.id, {
        title:             file.name.replace(/\.[^/.]+$/, ''),
        file_name:         file.name,
        storage_path:      path,
        file_type:         file.type.split('/')[1],
        file_size_bytes:   file.size,
        processing_status: 'uploaded',
      })
      setPapers(prev => [record, ...prev])
      toast.success('Paper uploaded! Click "Process" to extract questions.')
    } catch (err) {
      toast.error('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // ── Process (run full pipeline) ────────────────────────────────────────────
  async function handleProcess(paper, mode = 'ai') {
    // Generate unique processing job ID
    const processingJobId = `${paper.id}-${Date.now()}`
    
    console.log('[BYOP] ═══ PROCESS START ═══')
    console.log('[BYOP] processingJobId:', processingJobId)
    console.log('[BYOP] paperId:', paper.id)
    console.log('[BYOP] fileName:', paper.file_name)
    console.log('[BYOP] fileSize:', paper.file_size_bytes)
    console.log('[BYOP] storagePath:', paper.storage_path)
    console.log('[BYOP] timestamp:', new Date().toISOString())

    setActiveId(paper.id)
    setProgress(null)
    setResult(null)
    setShowReview(false)
    setReviewPaperId(null)

    // Mark processing in DB
    await byopService.update(paper.id, user.id, {
      processing_status: 'processing',
      batch_progress_json: [],
    })
    setPapers(prev => prev.map(p => p.id === paper.id
      ? { ...p, processing_status: 'processing' }
      : p
    ))

    try {
      const signedUrl  = await byopService.getSignedUrl(paper.storage_path)

      // Step 1: Fetch PDF blob
      console.log('[BYOP] Fetching PDF from storage...')
      const response = await fetch(signedUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
      }
      const pdfBlob = await response.blob()
      
      // Check if AI Vision extraction is requested (Best for Tamil / Scanned / Handwritten)
      if (mode === 'ai') {
        const effectiveKey = geminiApiKey || apiKeyService.getUserApiKey()
        if (!effectiveKey) {
          toast.error('Gemini API key is required for AI Vision extraction. Please configure your key in Profile & Settings.')
          setActiveId(null)
          setProgress(null)
          await byopService.update(paper.id, user.id, {
            processing_status: paper.processing_status || 'uploaded',
          })
          setPapers(prev => prev.map(p => p.id === paper.id
            ? { ...p, processing_status: paper.processing_status || 'uploaded' }
            : p
          ))
          navigate('/profile#api-key')
          return
        }

        try {
          setProgress({
            stage: 'extracting',
            currentPage: 1,
            totalPages: 1,
            pagesProcessed: 1,
            questionsFound: 0,
            statusText: 'Analyzing PDF with Gemini AI Vision...'
          })

          const base64Data = await blobToBase64(pdfBlob)
          const aiQuestions = await extractQuestionsWithAi(
            base64Data,
            selectedModel,
            (statusText) => setProgress({ stage: 'extracting', currentPage: 1, totalPages: 1, pagesProcessed: 1, questionsFound: 0, statusText }),
            effectiveKey
          )

          const questions = aiQuestions.map((q, idx) => ({
            ...q,
            question_number: q.question_number || idx + 1,
            parser_status: 'ready',
            isValid: true,
            extraction_status: 'complete',
            source_page: 1,
          }))

          setResult({
            processingJobId,
            fileName: paper.file_name,
            questions,
            totalQuestions: questions.length,
            totalPages: 1,
            processedPages: 1,
          })

          // Auto-create playable paper in central papers table so Attempt Test works immediately
          let newPaperId = null
          try {
            const newPaper = await paperService.createPaper({
              title:            paper.title || 'Custom Uploaded Paper',
              exam_name:        'Custom Upload',
              exam_type:        'Custom',
              year:             new Date().getFullYear(),
              subject:          'General',
              description:      `BYOP upload: ${paper.file_name}`,
              duration_minutes: Math.max(30, Math.round(questions.length * 1.5)),
              total_questions:  questions.length,
              status:           'published',
              created_by:       user.id,
            })
            newPaperId = newPaper.id

            const toSave = questions.map((q, i) => {
              const eng = (q.question_text_english || q.english_question || '').trim()
              const tam = (q.question_text_tamil || q.tamil_question || '').trim()
              let combined = (q.question_text || '').trim()

              if (eng && tam) {
                if (!combined.includes('தமிழ்:')) {
                  combined = `${eng}\nதமிழ்: ${tam}`
                }
              } else if (!combined) {
                combined = eng && tam ? `${eng}\nதமிழ்: ${tam}` : (eng || tam || `Question ${i + 1}`)
              }

              const formatOpt = (engOpt, tamOpt) => {
                const e = (engOpt || '').trim()
                const t = (tamOpt || '').trim()
                if (!t || t === e) return e || t
                if (!e) return t
                if (e.includes(' / ')) return e
                return `${e} / ${t}`
              }

              return {
                question_number: parseInt(String(q.question_number), 10) || i + 1,
                question_text: combined,
                question_text_tamil: tam || null,
                option_a: formatOpt(q.option_a || q.options?.A || 'Option A', q.option_a_tamil),
                option_b: formatOpt(q.option_b || q.options?.B || 'Option B', q.option_b_tamil),
                option_c: formatOpt(q.option_c || q.options?.C || 'Option C', q.option_c_tamil),
                option_d: formatOpt(q.option_d || q.options?.D || 'Option D', q.option_d_tamil),
                option_a_tamil: q.option_a_tamil || null,
                option_b_tamil: q.option_b_tamil || null,
                option_c_tamil: q.option_c_tamil || null,
                option_d_tamil: q.option_d_tamil || null,
                correct_option: ['A','B','C','D'].includes(q.correct_option || q.correct_answer)
                  ? (q.correct_option || q.correct_answer)
                  : null,
                explanation: q.explanation || null,
                explanation_tamil: q.explanation_tamil || null,
              }
            })

            await questionService.saveQuestionsToSupabase(newPaper.id, toSave, false)
          } catch (autoCreateErr) {
            console.warn('[BYOP] Auto-creating paper during AI process encountered issue:', autoCreateErr)
          }

          const notesMsg = newPaperId
            ? `${questions.length} questions extracted and saved to paper "${newPaperId}".`
            : `${questions.length} questions extracted using AI Vision.`

          const storagePayload = sanitizeUnicode({
            processing_status: 'ready',
            total_pages: 1,
            processed_pages: 1,
            extracted_count: questions.length,
            questions_json: sanitizeUnicode(questions),
            batch_progress_json: [],
            notes: notesMsg,
          })

          await byopService.update(paper.id, user.id, storagePayload)

          setPapers(prev => prev.map(p => p.id === paper.id
            ? {
                ...p,
                processing_status: 'ready',
                extracted_count: questions.length,
                notes: notesMsg,
                questions_json: questions
              }
            : p
          ))

          setReviewPaperId(paper.id)
          setShowReview(true)
          toast.success(`AI extracted ${questions.length} questions accurately! Paper is ready for test.`)
          return
        } catch (aiErr) {
          if (aiErr.message === 'NO_API_KEY_CONFIGURED' || aiErr.code === 'NO_API_KEY_CONFIGURED') {
            toast.error('Gemini API key is not configured. Please add your key in Profile & Settings.')
            setActiveId(null)
            setProgress(null)
            await byopService.update(paper.id, user.id, {
              processing_status: 'failed',
              notes: 'Gemini API key missing. Please configure your API key in Settings.',
            })
            setPapers(prev => prev.map(p => p.id === paper.id
              ? { ...p, processing_status: 'failed', notes: 'Gemini API key missing.' }
              : p
            ))
            navigate('/profile#api-key')
            return
          }
          console.warn('[BYOP] AI Vision extraction encountered issue. Cascading to Local PDF Engine...', aiErr.message)
          toast.info(`AI Vision blocked/busy (${aiErr.message?.includes('RECITATION') ? 'Recitation safety' : 'AI busy'}). Cascading to Local PDF Engine...`)
          // Fall through to Step 2 (PDF.js local text extraction)
        }
      }
      
      console.log('[BYOP] PDF Blob fetched:', {
        processingJobId,
        fileName: paper.file_name,
        blobSize: pdfBlob.size,
        blobType: pdfBlob.type
      })

      // Step 2: Extract text from PDF using PDF.js
      setProgress({ 
        stage: 'extracting', 
        currentPage: 0, 
        totalPages: 0, 
        pagesProcessed: 0,
        questionsFound: 0,
        statusText: 'Extracting text from PDF...'
      })
      
      let extractionResult
      try {
        console.log('[BYOP] Starting PDF.js extraction...')
        extractionResult = await extractPdfText(pdfBlob, (current, total) => {
          console.log(`[BYOP] Extraction progress: page ${current}/${total} (job: ${processingJobId})`)
          setProgress({
            stage: 'extracting',
            currentPage: current,
            totalPages: total,
            pagesProcessed: current,
            questionsFound: 0,
            statusText: `Extracting text from page ${current} of ${total}...`
          })
        })
        
        console.log('[BYOP] PDF.js extraction complete:', {
          processingJobId,
          fileName: paper.file_name,
          totalPages: extractionResult.totalPages,
          hasSelectableText: extractionResult.hasSelectableText,
          extractedTextLength: extractionResult.pages?.reduce((sum, p) => 
            sum + p.items.reduce((s, i) => s + (i.text?.length || 0), 0), 0)
        })
      } catch (err) {
        console.error('[BYOP] PDF.js extraction error:', {
          processingJobId,
          fileName: paper.file_name,
          error: err.message,
          stack: err.stack
        })
        const errorMsg = err.message || 'Unknown PDF extraction error'
        throw new Error(`PDF text extraction failed: ${errorMsg}`)
      }

      // Check if PDF has selectable text
      if (!extractionResult.pages || extractionResult.pages.length === 0) {
        throw new Error('PDF contains no pages or failed to extract page data.')
      }

      // Verify page count
      console.log('[BYOP] PDF IDENTITY CHECK:', {
        processingJobId,
        fileName: paper.file_name,
        expectedFileName: paper.file_name,
        extractedPages: extractionResult.totalPages,
        hasSelectableText: extractionResult.hasSelectableText
      })

      // Check if any page has text items with content
      const hasSelectableText = extractionResult.pages.some(page => 
        page.items && page.items.length > 0 && 
        page.items.some(item => item.text && item.text.trim().length > 0)
      )

      if (!hasSelectableText) {
        throw new Error('This PDF is a scanned image document with no selectable digital text. The offline local parser requires selectable text. For scanned PDFs, please use a selectable-text PDF or an OCR tool.')
      }

      // Step 3: Parse MCQ questions from extracted text
      console.log('[BYOP] Starting MCQ parsing...')
      setProgress({ 
        stage: 'parsing', 
        currentPage: extractionResult.pages.length,
        totalPages: extractionResult.pages.length,
        pagesProcessed: extractionResult.pages.length,
        questionsFound: 0,
        statusText: 'Parsing questions from text...'
      })

      console.log('[BYOP] Calling MCQ parser...')
      
      let parseResult
      try {
        parseResult = await parseMcqQuestions(extractionResult, processingJobId, paper.file_name)
      } catch (parserError) {
        console.error('[BYOP] MCQ PARSER CRASHED:', {
          processingJobId,
          error: parserError,
          message: parserError.message,
          stack: parserError.stack
        })
        throw parserError
      }
      
      const rawQuestions = parseResult.questions || []
      const questions = rawQuestions.map((q, idx) => ({
        ...q,
        question_number: q.question_number || idx + 1,
        question_text: q.question_text || q.tamil_question || `Question ${idx + 1}`,
        tamil_question: q.tamil_question || q.question_text || '',
        option_a: q.option_a || q.options?.A || '',
        option_b: q.option_b || q.options?.B || '',
        option_c: q.option_c || q.options?.C || '',
        option_d: q.option_d || q.options?.D || '',
        correct_option: q.correct_option || q.correct_answer || null,
        parser_status: q.parser_status || 'ready',
        isValid: q.isValid !== false,
      }))

      console.log('[BYOP] MCQ parsing complete:', {
        processingJobId,
        fileName: paper.file_name,
        totalQuestions: questions.length,
        validQuestions: questions.filter(q => q.parser_status === 'ready').length,
        needsReview: questions.filter(q => q.parser_status === 'needs_review').length
      })

      if (questions.length === 0) {
        console.warn('[BYOP] No questions extracted:', {
          processingJobId,
          fileName: paper.file_name,
          totalPages: extractionResult.totalPages,
          hasSelectableText: extractionResult.hasSelectableText
        })
        await byopService.update(paper.id, user.id, {
          processing_status: 'failed',
          notes: 'No questions could be extracted. The PDF may not contain MCQ questions in a recognizable format.',
          batch_progress_json: [],
        })
        setPapers(prev => prev.map(p => p.id === paper.id
          ? { ...p, processing_status: 'failed', notes: 'No questions extracted.' }
          : p
        ))
        toast.error('No questions found in this PDF.')
        console.log('[BYOP] ═══ PROCESS END (FAILED - NO QUESTIONS) ═══', { processingJobId })
        return
      }

      // Store result with processingJobId
      console.log('[BYOP] Storing extraction result...')
      setResult({
        processingJobId,
        fileName: paper.file_name,
        questions,
        totalQuestions: questions.length,
        totalPages: extractionResult.pages.length,
        processedPages: extractionResult.pages.length,
      })

      // Determine status based on validation
      const needsReview = questions.some(q => q.parser_status === 'needs_review')
      const validCount = questions.filter(q => q.parser_status === 'ready').length
      const newStatus = needsReview ? 'review_required' : 'extracted'

      console.log('[BYOP] Final status:', {
        processingJobId,
        status: newStatus,
        questionCandidates: questions.length,
        completeQuestions: parseResult.completeQuestions || 0,
        validQuestions: validCount,
        needsReview: questions.filter(q => q.parser_status === 'needs_review').length
      })

      console.log('[BYOP] Storing extraction result...')
      
      // NOTE: questionsCount = 20 is intentional preview limit for uploaded_papers.questions_json
      // Full questions will be saved to papers.questions table later when user confirms/edits
      // This prevents huge JSONB payload in uploaded_papers tracking table
      const questionsPreview = questions.slice(0, 20)
      console.log('[BYOP] Questions preview limit:', {
        totalExtracted: questions.length,
        previewCount: questionsPreview.length,
        reason: 'Intentional limit - full questions saved when user confirms extraction'
      })
      
      const sanitizedQuestions = sanitizeUnicode(questionsPreview)
      
      // Scan for malformed Unicode escape sequences
      console.log('[BYOP] Scanning for malformed Unicode sequences...')
      const scanForMalformedUnicode = (obj, path = '') => {
        const issues = []
        
        if (typeof obj === 'string') {
          // Look for literal backslash-u sequences that are NOT valid escapes
          const literalBackslashU = /\\u([0-9a-fA-F]{0,3}[^0-9a-fA-F]|[0-9a-fA-F]{0,2}$|[^0-9a-fA-F])/g
          let match
          while ((match = literalBackslashU.exec(obj)) !== null) {
            issues.push({
              path,
              index: match.index,
              sequence: obj.substring(match.index, match.index + 6),
              context: obj.substring(Math.max(0, match.index - 20), match.index + 26)
            })
          }
          
          // Also check for other suspicious backslash sequences
          const suspiciousBackslash = /\\[^"'\\/bfnrtu]/g
          while ((match = suspiciousBackslash.exec(obj)) !== null) {
            issues.push({
              path,
              index: match.index,
              sequence: obj.substring(match.index, match.index + 2),
              type: 'suspicious_backslash',
              context: obj.substring(Math.max(0, match.index - 20), match.index + 22)
            })
          }
        } else if (Array.isArray(obj)) {
          obj.forEach((item, idx) => {
            issues.push(...scanForMalformedUnicode(item, `${path}[${idx}]`))
          })
        } else if (obj && typeof obj === 'object') {
          Object.entries(obj).forEach(([key, value]) => {
            const newPath = path ? `${path}.${key}` : key
            issues.push(...scanForMalformedUnicode(value, newPath))
          })
        }
        
        return issues
      }
      
      const unicodeIssues = scanForMalformedUnicode(sanitizedQuestions)
      
      if (unicodeIssues.length > 0) {
        console.warn('[BYOP][UNICODE DEBUG] Found suspicious sequences:', unicodeIssues.slice(0, 10))
        unicodeIssues.slice(0, 10).forEach(issue => {
          console.warn(`[BYOP][UNICODE DEBUG] ${issue.path}:`, {
            index: issue.index,
            sequence: issue.sequence,
            type: issue.type || 'malformed_unicode',
            context: issue.context
          })
        })
      } else {
        console.log('[BYOP] No malformed Unicode sequences detected')
      }
      
      // Test JSON serialization BEFORE Supabase call
      let serialized
      try {
        serialized = JSON.stringify(sanitizedQuestions)
        const bytes = new TextEncoder().encode(serialized).length
        console.log('[BYOP] JSON serialization successful:', {
          processingJobId,
          paperId: paper.id,
          fileName: paper.file_name,
          questionsCount: sanitizedQuestions.length,
          payloadBytes: bytes
        })
      } catch (serErr) {
        console.error('[BYOP] JSON.stringify FAILED:', serErr)
        throw new Error(`JSON serialization failed: ${serErr.message}`)
      }
      
      // Prepare full payload with sanitization applied to ALL fields
      const storagePayload = sanitizeUnicode({
        processing_status: newStatus,
        total_pages: extractionResult.pages.length,
        processed_pages: extractionResult.pages.length,
        extracted_count: questions.length,
        questions_json: sanitizedQuestions,
        batch_progress_json: [],
        notes: needsReview
          ? `${questions.length} questions extracted. ${validCount} ready, ${questions.length - validCount} need review.`
          : `${questions.length} questions extracted from ${extractionResult.pages.length} pages.`,
      })
      
      console.log('[BYOP] STORAGE PAYLOAD DEBUG:', {
        processingJobId,
        paperId: paper.id,
        fileName: paper.file_name,
        totalQuestions: questions.length,
        validQuestions: validCount,
        needsReview: questions.length - validCount,
        payloadKeys: Object.keys(storagePayload),
        questions_json_type: typeof storagePayload.questions_json,
        questions_json_length: storagePayload.questions_json?.length,
        notes_length: storagePayload.notes?.length,
        notes_hasNullBytes: /\u0000/.test(storagePayload.notes || '')
      })
      
      // Field-by-field diagnostic test
      console.log('[BYOP] Starting field-by-field diagnostic test...')
      
      try {
        // Test 1: Status only
        console.log('[BYOP] TEST 1: Status only')
        await byopService.update(paper.id, user.id, {
          processing_status: newStatus
        })
        console.log('[BYOP] ✓ TEST 1 PASS: Status')
        
        // Test 2: Status + counts
        console.log('[BYOP] TEST 2: Status + counts')
        await byopService.update(paper.id, user.id, {
          processing_status: newStatus,
          total_pages: extractionResult.pages.length,
          processed_pages: extractionResult.pages.length,
          extracted_count: questions.length
        })
        console.log('[BYOP] ✓ TEST 2 PASS: Status + counts')
        
        // Test 3: + batch_progress_json
        console.log('[BYOP] TEST 3: + batch_progress_json')
        await byopService.update(paper.id, user.id, {
          processing_status: newStatus,
          total_pages: extractionResult.pages.length,
          processed_pages: extractionResult.pages.length,
          extracted_count: questions.length,
          batch_progress_json: []
        })
        console.log('[BYOP] ✓ TEST 3 PASS: + batch_progress_json')
        
        // Test 4: + notes
        console.log('[BYOP] TEST 4: + notes')
        await byopService.update(paper.id, user.id, {
          processing_status: newStatus,
          total_pages: extractionResult.pages.length,
          processed_pages: extractionResult.pages.length,
          extracted_count: questions.length,
          batch_progress_json: [],
          notes: storagePayload.notes
        })
        console.log('[BYOP] ✓ TEST 4 PASS: + notes')
        
        // Test 5: + questions_json (THE CRITICAL TEST)
        console.log('[BYOP] TEST 5: + questions_json [THIS IS THE CRITICAL TEST]')
        await byopService.update(paper.id, user.id, storagePayload)
        console.log('[BYOP] ✓ TEST 5 PASS: Full payload including questions_json')
        
      } catch (testErr) {
        console.error('[BYOP] ✗ FIELD TEST FAILED:', {
          processingJobId,
          message: testErr.message,
          details: testErr.details,
          hint: testErr.hint,
          code: testErr.code
        })
        throw testErr
      }
      
      console.log('[BYOP] All field tests passed, final update complete')
      
      // Supabase update
      // await byopService.update(paper.id, user.id, storagePayload)

      setPapers(prev => prev.map(p => p.id === paper.id
        ? { ...p, processing_status: newStatus, extracted_count: questions.length, questions_json: sanitizedQuestions }
        : p
      ))

      setReviewPaperId(paper.id)
      setShowReview(true)
      toast.success(`${questions.length} questions extracted!${needsReview ? ` ${validCount} ready, ${questions.length - validCount} need review.` : ''}`)
      
      console.log('[BYOP] ═══ PROCESS END (SUCCESS) ═══', { 
        processingJobId,
        fileName: paper.file_name,
        totalQuestions: questions.length,
        validQuestions: validCount
      })

    } catch (err) {
      const msg = err.message ?? 'Extraction failed'
      console.error('[BYOP] ═══ PROCESS END (ERROR) ═══', {
        processingJobId: processingJobId || 'unknown',
        fileName: paper.file_name,
        error: msg,
        stack: err.stack
      })
      await byopService.update(paper.id, user.id, {
        processing_status: 'failed',
        notes: msg,
      })
      setPapers(prev => prev.map(p => p.id === paper.id
        ? { ...p, processing_status: 'failed', notes: msg }
        : p
      ))
      toast.error('Extraction failed: ' + msg)
    } finally {
      setActiveId(null)
      setProgress(null)
    }
  }

  // ── Save questions to DB ───────────────────────────────────────────────────
  // called from within an active-paper context
  async function doSave(paper, editedQuestions) {
    setSaving(true)
    try {
      const match = paper?.notes?.match(/"([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})"/)
      let targetPaperId = match?.[1]

      if (!targetPaperId) {
        // Create a published paper entry in the central papers table
        const newPaper = await paperService.createPaper({
          title:            paper.title || 'Custom Uploaded Paper',
          exam_name:        'Custom Upload',
          exam_type:        'Custom',
          year:             new Date().getFullYear(),
          subject:          'General',
          description:      `BYOP upload: ${paper.file_name}`,
          duration_minutes: Math.max(30, Math.round(editedQuestions.length * 1.5)),
          total_questions:  editedQuestions.length,
          status:           'published',
          created_by:       user.id,
        })
        targetPaperId = newPaper.id
      } else {
        await supabase.from('papers').update({
          status: 'published',
          total_questions: editedQuestions.length,
          updated_at: new Date().toISOString()
        }).eq('id', targetPaperId)
      }

      // Save to questions table (flat schema)
      const toSave = editedQuestions
        .filter(q => q.question_text?.trim() || q.tamil_question?.trim() || q.english_question?.trim())
        .map((q, i) => {
          const eng = (q.question_text_english || q.english_question || '').trim()
          const tam = (q.question_text_tamil || q.tamil_question || '').trim()
          let combined = (q.question_text || '').trim()

          if (eng && tam) {
            if (!combined.includes('தமிழ்:')) {
              combined = `${eng}\nதமிழ்: ${tam}`
            }
          } else if (!combined) {
            combined = eng && tam ? `${eng}\nதமிழ்: ${tam}` : (eng || tam || `Question ${i + 1}`)
          }

          const formatOpt = (engOpt, tamOpt) => {
            const e = (engOpt || '').trim()
            const t = (tamOpt || '').trim()
            if (!t || t === e) return e || t
            if (!e) return t
            if (e.includes(' / ')) return e
            return `${e} / ${t}`
          }

          return {
            question_number: parseInt(String(q.question_number), 10) || i + 1,
            question_text: combined,
            question_text_tamil: tam || null,
            option_a: formatOpt(q.option_a || q.options?.A || 'Option A', q.option_a_tamil),
            option_b: formatOpt(q.option_b || q.options?.B || 'Option B', q.option_b_tamil),
            option_c: formatOpt(q.option_c || q.options?.C || 'Option C', q.option_c_tamil),
            option_d: formatOpt(q.option_d || q.options?.D || 'Option D', q.option_d_tamil),
            option_a_tamil: q.option_a_tamil || null,
            option_b_tamil: q.option_b_tamil || null,
            option_c_tamil: q.option_c_tamil || null,
            option_d_tamil: q.option_d_tamil || null,
            correct_option: ['A','B','C','D'].includes(q.correct_option || q.correct_answer)
              ? (q.correct_option || q.correct_answer)
              : null,
            explanation: q.explanation || null,
            explanation_tamil: q.explanation_tamil || null,
          }
        })

      await questionService.saveQuestionsToSupabase(targetPaperId, toSave, false)

      // Update uploaded_papers record
      const notesMsg = `${toSave.length} questions saved to paper "${targetPaperId}".`
      await byopService.update(paper.id, user.id, {
        processing_status: 'ready',
        extracted_count:   toSave.length,
        questions_json:    sanitizeUnicode(toSave),
        notes:             notesMsg,
      })

      setPapers(prev => prev.map(p => p.id === paper.id
        ? {
            ...p,
            processing_status: 'ready',
            extracted_count: toSave.length,
            notes: notesMsg,
            questions_json: toSave
          }
        : p
      ))

      setShowReview(false)
      setReviewPaperId(null)
      setResult(null)
      toast.success(`${toSave.length} questions saved! Paper is ready for test attempt.`)
    } catch (err) {
      console.error('[BYOP] doSave error:', err)
      toast.error('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">

      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Upload className="w-6 h-6 text-tnpsc-brand" />
          <div>
            <h1 className="text-xl font-bold text-body-text">Bring Your Own Paper</h1>
            <p className="text-xs text-body-secondary">
              Upload selectable-text PDF — local parser extracts questions automatically
            </p>
          </div>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !!activeId}
          className="flex items-center gap-2 px-4 py-2.5 bg-tnpsc-brand text-white rounded-xl text-sm font-bold hover:bg-tnpsc-brand-hover transition-colors shadow-brand disabled:opacity-60"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Upload Paper
        </button>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
      </div>

      {/* API Key Missing Notification Banner */}
      {!hasGeminiApiKey && !apiKeyService.hasUserApiKey() && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-subtle">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900">Personal Google Gemini API Key Required for AI Vision</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                To extract questions from Tamil, handwritten, or scanned PDFs using Gemini AI, please configure your free Gemini API key in Settings.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile#api-key')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-subtle"
          >
            Configure Key →
          </button>
        </div>
      )}

      {/* Model selector & info bar */}
      <div className="bg-white border border-surface-border rounded-2xl p-4 shadow-subtle flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-tnpsc-brand shrink-0" />
          <div>
            <p className="text-sm font-bold text-body-text">AI Vision & Local PDF Pipeline</p>
            <p className="text-xs text-body-secondary mt-0.5">
              Extract questions from Tamil, handwritten, or scanned PDFs. Switch models if any version experiences high traffic.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-body-secondary whitespace-nowrap">AI Model Version:</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-xs font-semibold border border-surface-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-tnpsc-brand bg-slate-50 text-body-text cursor-pointer"
          >
            {modelsList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active processing overlay */}
      {activeId && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
            <p className="text-sm font-bold text-blue-800">
              {progressInfo?.stage === 'extracting'  ? 'Extracting text from PDF...' :
               progressInfo?.stage === 'parsing'     ? 'Parsing MCQ questions...' :
               progressInfo?.stage === 'complete'    ? 'Finalising…' :
               'Starting extraction pipeline…'}
            </p>
          </div>
          <BatchProgress info={progressInfo} />
        </div>
      )}

      {/* Upload drop zone */}
      <div
        onClick={() => !activeId && fileRef.current?.click()}
        className="border-2 border-dashed border-surface-border rounded-2xl p-8 text-center cursor-pointer hover:border-tnpsc-brand hover:bg-tnpsc-brand-light/30 transition-all group"
      >
        <Upload className="w-10 h-10 text-slate-300 group-hover:text-tnpsc-brand mx-auto mb-3 transition-colors" />
        <p className="text-sm font-semibold text-body-secondary group-hover:text-tnpsc-brand transition-colors">
          Click to upload selectable-text PDF
        </p>
        <p className="text-xs text-body-secondary mt-1">Max 35 MB · Scanned/image-only PDFs not supported</p>
      </div>

      {/* Papers list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" />
        </div>
      ) : papers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-surface-border">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-body-secondary">No papers uploaded yet. Upload your first paper above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {papers.map(paper => {
            const cfg  = STATUS_CONFIG[paper.processing_status] ?? STATUS_CONFIG.uploaded
            const Icon = cfg.icon
            const isThis = activeId === paper.id
            const isProcessable = ['uploaded','failed'].includes(paper.processing_status)

            return (
              <div key={paper.id} className="bg-white rounded-2xl border border-surface-border shadow-subtle overflow-hidden">
                {/* Paper row */}
                <div className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {isThis ? 'Processing…' : cfg.label}
                      </span>
                      {paper.file_type && (
                        <span className="text-[10px] text-body-secondary uppercase font-medium">{paper.file_type}</span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-body-text truncate">{paper.title}</h3>
                    <p className="text-xs text-body-secondary mt-0.5">
                      {paper.file_name}
                      {paper.extracted_count ? ` · ${paper.extracted_count} questions extracted` : ''}
                      {paper.total_pages ? ` · ${paper.total_pages} pages` : ''}
                    </p>
                    {paper.notes && !['uploaded'].includes(paper.processing_status) && (
                      <p className={`text-xs mt-1 line-clamp-2 ${
                        paper.processing_status === 'failed' ? 'text-red-600' : 'text-body-secondary'
                      }`}>
                        {paper.notes}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isProcessable && (
                      
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleProcess(paper, 'ai')}
                            disabled={!!activeId}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-subtle disabled:opacity-40"
                            title="Extract questions with Gemini AI (Best for Tamil / Scanned / Handwritten PDFs)"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {paper.processing_status === 'failed' ? 'Retry (AI)' : 'Process with AI'}
                          </button>
                          <button
                            onClick={() => handleProcess(paper, 'local')}
                            disabled={!!activeId}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-body-secondary text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
                            title="Run offline PDF.js parser (For selectable-text English PDFs)"
                          >
                            Local
                          </button>
                        </div>
                      
                    )}

                    {/* Attempt Test — for READY papers */}
                    {paper.processing_status === 'ready' && (
                      <AttemptButton paperId={paper.id} userId={user.id} />
                    )}

                    {/* View / Review extracted questions */}
                    {activeId === null && (
                      (() => {
                        let qs = []
                        if (result?.processingJobId?.startsWith(paper.id) && result?.questions?.length > 0) {
                          qs = result.questions
                        } else if (Array.isArray(paper.questions_json) && paper.questions_json.length > 0) {
                          qs = paper.questions_json
                        } else if (typeof paper.questions_json === 'string' && paper.questions_json.length > 2) {
                          try { qs = JSON.parse(paper.questions_json) } catch (e) { qs = [] }
                        }
                        if (!qs || qs.length === 0) return null

                        const isReviewingThis = showReview && reviewPaperId === paper.id
                        return (
                          <button
                            onClick={() => {
                              if (isReviewingThis) {
                                setShowReview(false)
                                setReviewPaperId(null)
                              } else {
                                setReviewPaperId(paper.id)
                                setShowReview(true)
                              }
                            }}
                            className="px-3 py-1.5 bg-tnpsc-brand-light text-tnpsc-brand text-xs font-bold rounded-lg hover:bg-tnpsc-brand hover:text-white transition-colors"
                          >
                            {isReviewingThis ? 'Hide Questions' : (paper.processing_status === 'ready' ? 'View Questions' : 'Review Questions')}
                          </button>
                        )
                      })()
                    )}
                  </div>
                </div>

                {/* Batch progress details (collapsed) */}
                {paper.batch_progress_json?.length > 0 && !isThis && (
                  <div className="px-5 pb-3">
                    <div className="flex flex-wrap gap-1.5">
                      {paper.batch_progress_json.map((b, i) => (
                        <span key={i}
                          className={`text-[10px] font-semibold rounded px-2 py-0.5 ${
                            b.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            b.status === 'failed'    ? 'bg-red-100 text-red-700' :
                                                       'bg-slate-100 text-slate-600'
                          }`}
                          title={b.error ?? `Pages ${(b.pages ?? []).join('–')}`}
                        >
                          p.{(b.pages ?? []).join('–')} {b.status === 'failed' ? '✗' : '✓'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inline review panel */}
                {showReview && reviewPaperId === paper.id && activeId === null && (() => {
                  let qs = []
                  if (result?.processingJobId?.startsWith(paper.id) && result?.questions?.length > 0) {
                    qs = result.questions
                  } else if (Array.isArray(paper.questions_json) && paper.questions_json.length > 0) {
                    qs = paper.questions_json
                  } else if (typeof paper.questions_json === 'string' && paper.questions_json.length > 2) {
                    try { qs = JSON.parse(paper.questions_json) } catch (e) { qs = [] }
                  }
                  if (!qs || qs.length === 0) return null

                  return (
                    <div className="border-t border-surface-border p-5">
                      <QuestionsPanel
                        questions={qs}
                        onSave={(editedQs) => doSave(paper, editedQs)}
                        saving={saving}
                      />
                    </div>
                  )
                })()}

                {/* Footer metadata */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border bg-slate-50 text-[10px] text-body-secondary">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatDate(paper.created_at)}
                  </span>
                  {paper.file_size_bytes && (
                    <span>{(paper.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
