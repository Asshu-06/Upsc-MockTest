import React, { useState, useEffect, useCallback } from 'react'
import { Brain, CheckCircle2, XCircle, ArrowRight, Flame, Trophy, Loader2, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { quickRecallService } from '../../services/tnpscService'

const TOTAL = 5

const OPTION_LABELS = ['A', 'B', 'C', 'D']

/**
 * Quick Recall — full 5-question streak game as a modal overlay.
 * Props: onClose() callback
 */
export function QuickRecall({ onClose }) {
  const { user } = useAuth()
  const { selectedExam, toast } = useApp()

  const [phase, setPhase]       = useState('loading') // loading | question | reveal | result
  const [questions, setQs]      = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [index, setIndex]       = useState(0)
  const [selected, setSelected] = useState(null)
  const [streak, setStreak]     = useState(0)
  const [correct, setCorrect]   = useState(0)
  const [answers, setAnswers]   = useState([])     // { selected, correct, isCorrect }[]
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    try {
      const qs = await quickRecallService.fetchRecallQuestions(selectedExam)
      const session = await quickRecallService.createSession(
        user.id, selectedExam,
        qs.map(q => ({ id: q.id, question_text: q.question_text, correct_option: q.correct_option }))
      )
      setQs(qs)
      setSessionId(session.id)
      setPhase('question')
    } catch (err) {
      toast.error(err.message ?? 'Failed to load recall questions')
      setPhase('error')
    }
  }

  const currentQ = questions[index]

  const handleAnswer = useCallback(async (option) => {
    if (selected || phase !== 'question') return
    setSelected(option)
    setPhase('reveal')

    const isCorrect = option === currentQ.correct_option
    const newStreak = isCorrect ? streak + 1 : 0
    const newCorrect = correct + (isCorrect ? 1 : 0)

    setStreak(newStreak)
    setCorrect(newCorrect)
    setAnswers(prev => [...prev, { selected: option, correct: currentQ.correct_option, isCorrect }])

    // Persist answer
    if (sessionId) {
      await quickRecallService.saveAnswer(
        sessionId, index, currentQ.question_text,
        option, currentQ.correct_option, isCorrect
      )
    }
  }, [selected, phase, currentQ, streak, correct, sessionId, index])

  const handleNext = useCallback(async () => {
    if (index < TOTAL - 1) {
      setIndex(i => i + 1)
      setSelected(null)
      setPhase('question')
    } else {
      // Final — call server-side RPC
      setLoading(true)
      try {
        const res = await quickRecallService.finaliseSession(user.id, correct, TOTAL, sessionId)
        setResult(res)
        setPhase('result')
      } catch (err) {
        toast.error('Failed to save recall result: ' + err.message)
        setPhase('result')
        setResult({ new_streak: streak, recall_points: correct * 10 })
      } finally {
        setLoading(false)
      }
    }
  }, [index, user.id, correct, sessionId, streak, toast])

  // Keyboard navigation
  useEffect(() => {
    if (phase !== 'question') return
    const handler = (e) => {
      if (e.key === '1') handleAnswer('A')
      else if (e.key === '2') handleAnswer('B')
      else if (e.key === '3') handleAnswer('C')
      else if (e.key === '4') handleAnswer('D')
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [phase, handleAnswer])

  // Progress dots
  const ProgressDots = () => (
    <div className="flex items-center gap-2 justify-center mb-6">
      {Array.from({ length: TOTAL }).map((_, i) => {
        const ans = answers[i]
        let cls = 'w-3 h-3 rounded-full border-2 '
        if (ans?.isCorrect)  cls += 'bg-emerald-500 border-emerald-500'
        else if (ans)        cls += 'bg-red-500 border-red-500'
        else if (i === index) cls += 'bg-tnpsc-brand border-tnpsc-brand scale-125'
        else                  cls += 'bg-slate-200 border-slate-300'
        return <div key={i} className={cls} />
      })}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-modal overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-tnpsc-brand to-tnpsc-brand-dark text-white">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            <span className="font-bold">Quick Recall</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <Flame className="w-4 h-4 text-orange-300" />
              <span className="font-bold">{streak}</span>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Loading */}
          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 animate-spin text-tnpsc-brand" />
              <p className="text-sm text-body-secondary">Preparing recall questions…</p>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div className="text-center py-8">
              <p className="text-sm text-status-error font-semibold mb-4">Failed to load questions.</p>
              <p className="text-xs text-body-secondary mb-4">Please ensure published papers with questions exist.</p>
              <button onClick={onClose} className="px-4 py-2 bg-tnpsc-brand text-white rounded-lg text-sm font-semibold">
                Close
              </button>
            </div>
          )}

          {/* Question */}
          {(phase === 'question' || phase === 'reveal') && currentQ && (
            <>
              <ProgressDots />

              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-body-secondary uppercase tracking-wider">
                  Question {index + 1} of {TOTAL}
                </span>
                {streak > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    <Flame className="w-3 h-3" /> {streak} streak
                  </span>
                )}
              </div>

              <p className="text-sm font-semibold text-body-text leading-relaxed mb-5">
                {currentQ.question_text}
              </p>

              <div className="space-y-2.5">
                {OPTION_LABELS.map((label, i) => {
                  const text = currentQ[`option_${label.toLowerCase()}`]
                  if (!text) return null

                  let btnCls = 'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left '

                  if (phase === 'reveal') {
                    if (label === currentQ.correct_option) {
                      btnCls += 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    } else if (label === selected) {
                      btnCls += 'border-red-400 bg-red-50 text-red-800'
                    } else {
                      btnCls += 'border-surface-border bg-slate-50 text-body-secondary opacity-50'
                    }
                  } else {
                    btnCls += 'border-surface-border hover:border-tnpsc-brand hover:bg-tnpsc-brand-light hover:text-tnpsc-brand cursor-pointer'
                  }

                  return (
                    <button
                      key={label}
                      className={btnCls}
                      onClick={() => handleAnswer(label)}
                      disabled={phase === 'reveal'}
                    >
                      <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-bold shrink-0">
                        {label}
                      </span>
                      <span className="flex-1">{text}</span>
                      {phase === 'reveal' && label === currentQ.correct_option && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      {phase === 'reveal' && label === selected && label !== currentQ.correct_option && (
                        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>

              {phase === 'reveal' && (
                <div className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-xl ${
                  selected === currentQ.correct_option
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-red-50 text-red-800'
                }`}>
                  {selected === currentQ.correct_option
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  }
                  <span className="text-sm font-semibold flex-1">
                    {selected === currentQ.correct_option
                      ? `Correct! Streak: ${streak}`
                      : `Wrong! Correct answer: ${currentQ.correct_option} — ${currentQ[`option_${currentQ.correct_option.toLowerCase()}`]}`
                    }
                  </span>
                  <button
                    onClick={handleNext}
                    disabled={loading}
                    className="flex items-center gap-1 text-sm font-bold hover:opacity-80 transition-opacity"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : index < TOTAL - 1 ? <><span>Next</span><ArrowRight className="w-3.5 h-3.5" /></> : <span>Finish</span>}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Result screen */}
          {phase === 'result' && (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-tnpsc-brand-light flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-tnpsc-brand" />
              </div>
              <h3 className="text-xl font-bold text-body-text mb-1">Recall Complete!</h3>
              <p className="text-sm text-body-secondary mb-6">
                {correct === TOTAL ? '🎉 Perfect score!' : correct >= 3 ? '👍 Great effort!' : '📚 Keep practising!'}
              </p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: 'Score',   value: `${correct}/${TOTAL}` },
                  { label: 'Streak',  value: result?.new_streak ?? streak },
                  { label: 'Points',  value: `+${result?.recall_points ?? correct * 10}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-tnpsc-brand-light rounded-xl py-3">
                    <p className="text-xl font-black text-tnpsc-brand">{value}</p>
                    <p className="text-xs text-tnpsc-brand-dark">{label}</p>
                  </div>
                ))}
              </div>

              {/* Per-question review */}
              <div className="space-y-2 mb-6 text-left">
                {answers.map((a, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${a.isCorrect ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {a.isCorrect
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    }
                    <span className="text-xs text-body-secondary flex-1 truncate">Q{i + 1}</span>
                    {!a.isCorrect && (
                      <span className="text-xs text-red-700 font-medium">Correct: {a.correct}</span>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 bg-tnpsc-brand hover:bg-tnpsc-brand-hover text-white font-bold rounded-xl transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
