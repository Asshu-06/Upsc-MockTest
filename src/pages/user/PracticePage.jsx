import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain, Play, Clock, Zap, BookOpen, Loader2, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, AlertCircle, BarChart3, Timer,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { supabase } from '../../lib/supabase'
import { practiceService } from '../../services/tnpscService'
import { formatTimeRemaining } from '../../lib/utils'
import { useCountdown } from '../../hooks/useCountdown'

const Q_COUNTS    = [10, 25, 50, 100]
const TIMER_MODES = ['strict', 'untimed']
const DIFFICULTIES = ['adaptive', 'easy', 'moderate', 'hard']

// ─── Practice Builder ─────────────────────────────────────────────────────────
function PracticeBuilder({ onStart }) {
  const { selectedExam } = useApp()
  const { toast } = useApp()
  const { user }  = useAuth()

  const [subjects, setSubjects]   = useState(['All Subjects'])
  const [subjectsLoading, setSubjectsLoading] = useState(true)

  const [config, setConfig] = useState({
    subject: 'All Subjects', question_count: 25,
    timer_mode: 'strict', difficulty: 'adaptive', exam_context: selectedExam,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // Fetch subjects from syllabus_units for the selected exam
  useEffect(() => {
    setConfig(c => ({ ...c, subject: 'All Subjects', exam_context: selectedExam }))
    setError(null)
    loadSubjects()
  }, [selectedExam])

  async function loadSubjects() {
    setSubjectsLoading(true)
    try {
      // Get exam ID first
      const { data: examRow } = await supabase
        .from('syllabus_exams')
        .select('id')
        .eq('exam_name', selectedExam)
        .maybeSingle()

      if (examRow?.id) {
        const { data: units } = await supabase
          .from('syllabus_units')
          .select('unit_name, subject')
          .eq('exam_id', examRow.id)
          .order('unit_number')

        if (units && units.length > 0) {
          // Build unique subject list from unit names
          const names = ['All Subjects', ...new Set(units.map(u => u.subject || u.unit_name).filter(Boolean))]
          setSubjects(names)
          return
        }
      }
      // No syllabus data — fall back to subjects derived from published papers
      const { data: papers } = await supabase
        .from('papers')
        .select('subject')
        .eq('status', 'published')
        .eq('exam_name', selectedExam)
      
      if (papers && papers.length > 0) {
        const names = ['All Subjects', ...new Set(papers.map(p => p.subject).filter(Boolean))]
        setSubjects(names)
      } else {
        setSubjects(['All Subjects'])
      }
    } catch {
      setSubjects(['All Subjects'])
    } finally {
      setSubjectsLoading(false)
    }
  }

  async function handleGenerate() {
    setLoading(true); setError(null)
    try {
      const result = await practiceService.createSession(user.id, config)
      toast.success('Practice session created!')
      onStart(result)
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-6 h-6 text-tnpsc-brand" />
        <div>
          <h1 className="text-xl font-bold text-body-text">Custom Practice Builder</h1>
          <p className="text-xs text-body-secondary">{selectedExam}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-border shadow-subtle p-6 space-y-6">
        {/* Subject */}
        <div>
          <label className="block text-sm font-bold text-body-text mb-2">Target Subject</label>
          {subjectsLoading ? (
            <div className="flex items-center gap-2 text-xs text-body-secondary">
              <Loader2 className="w-4 h-4 animate-spin text-tnpsc-brand" />
              Loading subjects…
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => (
                <button key={s} onClick={() => setConfig(c => ({ ...c, subject: s }))}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${config.subject === s ? 'bg-tnpsc-brand text-white' : 'bg-slate-100 text-body-secondary hover:text-body-text'}`}
                >{s}</button>
              ))}
            </div>
          )}
        </div>

        {/* Question count */}
        <div>
          <label className="block text-sm font-bold text-body-text mb-2">Number of Questions</label>
          <div className="flex gap-2">
            {Q_COUNTS.map(n => (
              <button key={n} onClick={() => setConfig(c => ({ ...c, question_count: n }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${config.question_count === n ? 'bg-tnpsc-brand text-white' : 'bg-slate-100 text-body-secondary hover:text-body-text'}`}
              >{n}</button>
            ))}
          </div>
        </div>

        {/* Timer mode */}
        <div>
          <label className="block text-sm font-bold text-body-text mb-2">Timer Mode</label>
          <div className="grid grid-cols-2 gap-3">
            {TIMER_MODES.map(m => (
              <button key={m} onClick={() => setConfig(c => ({ ...c, timer_mode: m }))}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${config.timer_mode === m ? 'border-tnpsc-brand bg-tnpsc-brand-light text-tnpsc-brand' : 'border-surface-border text-body-secondary hover:border-tnpsc-brand/40'}`}
              >
                {m === 'strict' ? <><Timer className="w-4 h-4" /> Strict Countdown</> : <><Clock className="w-4 h-4" /> Untimed Practice</>}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-bold text-body-text mb-2">AI Difficulty</label>
          <div className="grid grid-cols-4 gap-2">
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => setConfig(c => ({ ...c, difficulty: d }))}
                className={`py-2 rounded-xl text-xs font-bold capitalize transition-colors ${config.difficulty === d ? 'bg-tnpsc-brand text-white' : 'bg-slate-100 text-body-secondary hover:text-body-text'}`}
              >{d}</button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3.5 bg-tnpsc-brand hover:bg-tnpsc-brand-hover text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-brand disabled:opacity-60"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Play className="w-4 h-4" /> Generate Practice Set</>}
        </button>
      </div>
    </div>
  )
}

// ─── Practice Session ─────────────────────────────────────────────────────────
function PracticeSession({ session, questions, onComplete }) {
  const { toast } = useApp()
  const [index, setIndex]   = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const totalSec = session.timer_mode === 'strict'
    ? session.question_count * 72  // ~72s per question
    : null

  const { seconds, isRunning } = useCountdown(totalSec, session.timer_mode === 'strict')

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (session.timer_mode === 'strict' && isRunning === false && seconds === 0 && !submitted) {
      handleSubmit()
    }
  }, [seconds, isRunning])

  const currentQ = questions[index]
  const OPTS = ['A', 'B', 'C', 'D']

  async function handleSubmit() {
    setSaving(true)
    try {
      // Calculate score
      let correct = 0
      questions.forEach(q => {
        if (answers[q.id] === q.correct_option) correct++
      })
      const accuracy = ((correct / questions.length) * 100).toFixed(1)
      const score = ((correct / questions.length) * 100).toFixed(2)

      const answersJson = {}
      Object.entries(answers).forEach(([qId, opt]) => { answersJson[qId] = opt })

      await practiceService.updateSession(session.id, {
        status: 'completed',
        score: parseFloat(score),
        accuracy: parseFloat(accuracy),
        answers_json: answersJson,
        time_taken_sec: totalSec ? (totalSec - seconds) : null,
        completed_at: new Date().toISOString(),
      })

      setSubmitted(true)
      onComplete({
        correct, total: questions.length,
        accuracy, score,
        answers, questions,
      })
    } catch (err) {
      toast.error('Failed to save results: ' + err.message)
    } finally { setSaving(false) }
  }

  if (submitted) return null

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 bg-white rounded-xl border border-surface-border px-4 py-3 shadow-subtle">
        <span className="text-sm font-bold text-body-text">{index + 1} / {questions.length}</span>
        {session.timer_mode === 'strict' && (
          <span className={`flex items-center gap-1.5 text-sm font-mono font-bold ${seconds < 300 ? 'text-red-600' : 'text-body-text'}`}>
            <Clock className="w-4 h-4" /> {formatTimeRemaining(seconds)}
          </span>
        )}
        <span className="text-xs text-body-secondary">{Object.keys(answers).length} answered</span>
      </div>

      {/* Question */}
      <div className="bg-white rounded-2xl border border-surface-border shadow-subtle p-6 space-y-4">
        <p className="text-sm font-semibold text-body-text leading-relaxed">{currentQ.question_text}</p>
        <div className="space-y-2.5">
          {OPTS.map(opt => {
            const text = currentQ[`option_${opt.toLowerCase()}`]
            if (!text) return null
            const isSelected = answers[currentQ.id] === opt
            return (
              <button
                key={opt}
                onClick={() => setAnswers(a => ({ ...a, [currentQ.id]: opt }))}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all ${
                  isSelected
                    ? 'border-tnpsc-brand bg-tnpsc-brand-light text-tnpsc-brand'
                    : 'border-surface-border hover:border-tnpsc-brand/40 hover:bg-slate-50'
                }`}
              >
                <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? 'border-tnpsc-brand bg-tnpsc-brand text-white' : 'border-slate-300'}`}>{opt}</span>
                {text}
              </button>
            )
          })}
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setIndex(i => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-surface-border rounded-xl text-sm font-semibold text-body-secondary hover:text-body-text disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        {index < questions.length - 1 ? (
          <button
            onClick={() => setIndex(i => i + 1)}
            className="flex items-center gap-2 px-4 py-2.5 bg-tnpsc-brand text-white rounded-xl text-sm font-bold hover:bg-tnpsc-brand-hover transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Submit
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Practice Result ──────────────────────────────────────────────────────────
function PracticeResult({ result, onRetry }) {
  const { correct, total, accuracy, questions, answers } = result
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="bg-white rounded-2xl border border-surface-border shadow-subtle p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-tnpsc-brand-light flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8 text-tnpsc-brand" />
        </div>
        <h2 className="text-xl font-bold text-body-text mb-1">Practice Complete!</h2>
        <div className="grid grid-cols-3 gap-4 my-6">
          {[
            { label: 'Score',    value: `${correct}/${total}` },
            { label: 'Accuracy', value: `${accuracy}%` },
            { label: 'Correct',  value: correct },
          ].map(({ label, value }) => (
            <div key={label} className="bg-tnpsc-brand-light rounded-xl py-3">
              <p className="text-2xl font-black text-tnpsc-brand">{value}</p>
              <p className="text-xs text-body-secondary">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick review */}
        <div className="space-y-2 text-left max-h-64 overflow-y-auto mb-6">
          {questions.map((q, i) => {
            const sel = answers[q.id]
            const isCorrect = sel === q.correct_option
            return (
              <div key={q.id} className={`flex items-start gap-2 px-3 py-2 rounded-lg ${isCorrect ? 'bg-emerald-50' : sel ? 'bg-red-50' : 'bg-slate-50'}`}>
                {isCorrect
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                }
                <div className="min-w-0">
                  <p className="text-xs font-medium text-body-text line-clamp-1">Q{i + 1}: {q.question_text}</p>
                  {!isCorrect && (
                    <p className="text-xs text-body-secondary mt-0.5">
                      Your: {sel ?? '—'} | Correct: {q.correct_option}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={onRetry} className="flex-1 py-3 bg-tnpsc-brand text-white rounded-xl font-bold text-sm hover:bg-tnpsc-brand-hover transition-colors">
            New Practice Set
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page orchestrator ────────────────────────────────────────────────────────
export function PracticePage() {
  const [phase, setPhase]   = useState('builder')  // builder | session | result
  const [sessionData, setSessionData] = useState(null)
  const [resultData, setResultData]   = useState(null)

  return (
    <div className="py-2 animate-fade-in">
      {phase === 'builder' && (
        <PracticeBuilder onStart={data => { setSessionData(data); setPhase('session') }} />
      )}
      {phase === 'session' && sessionData && (
        <PracticeSession
          session={sessionData.session}
          questions={sessionData.questions}
          onComplete={result => { setResultData(result); setPhase('result') }}
        />
      )}
      {phase === 'result' && resultData && (
        <PracticeResult
          result={resultData}
          onRetry={() => { setSessionData(null); setPhase('builder') }}
        />
      )}
    </div>
  )
}
