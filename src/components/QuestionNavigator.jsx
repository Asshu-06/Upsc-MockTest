import React from 'react'
import { CheckCircle2, Circle, Bookmark, HelpCircle } from 'lucide-react'

export function QuestionNavigator({
  questions = [],
  currentIndex = 0,
  onSelectQuestion,
  answers = {},
  markedForReview = {},
  onSubmitExam
}) {
  const total = questions.length
  let answeredCount = 0
  let markedCount = 0

  questions.forEach((q, idx) => {
    if (answers[q.id]) answeredCount++
    if (markedForReview[q.id]) markedCount++
  })

  const unansweredCount = total - answeredCount

  return (
    <div className="bg-white rounded-xl border border-surface-border p-5 shadow-card space-y-5">
      <h3 className="font-bold text-sm text-body-text border-b border-surface-border pb-3 flex items-center justify-between">
        <span>Question Palette</span>
        <span className="text-xs font-semibold text-body-secondary">{total} Total</span>
      </h3>

      {/* Summary Chips */}
      <div className="grid grid-cols-3 gap-2 text-[11px] font-medium text-center">
        <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-200">
          <span className="block font-bold text-sm">{answeredCount}</span>
          Answered
        </div>
        <div className="bg-amber-50 text-amber-800 p-2 rounded-lg border border-amber-200">
          <span className="block font-bold text-sm">{markedCount}</span>
          Review
        </div>
        <div className="bg-slate-100 text-slate-700 p-2 rounded-lg border border-slate-200">
          <span className="block font-bold text-sm">{unansweredCount}</span>
          Remaining
        </div>
      </div>

      {/* Grid Palette */}
      <div className="max-h-60 overflow-y-auto pr-1">
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, index) => {
            const isCurrent = currentIndex === index
            const isAnswered = !!answers[q.id]
            const isMarked = !!markedForReview[q.id]

            let btnStyle = "bg-slate-100 text-body-text hover:bg-slate-200 border-surface-border"

            if (isCurrent) {
              btnStyle = "ring-2 ring-primary ring-offset-1 font-bold bg-primary text-white"
            } else if (isMarked) {
              btnStyle = "bg-amber-400 text-white font-bold border-amber-500"
            } else if (isAnswered) {
              btnStyle = "bg-emerald-600 text-white font-bold border-emerald-700"
            }

            return (
              <button
                key={q.id || index}
                onClick={() => onSelectQuestion(index)}
                className={`h-9 w-full rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${btnStyle}`}
              >
                {index + 1}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="pt-3 border-t border-surface-border text-xs text-body-secondary space-y-1.5">
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded bg-emerald-600 inline-block"></span>
          <span>Answered</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded bg-amber-400 inline-block"></span>
          <span>Marked for Review</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded bg-slate-200 inline-block"></span>
          <span>Not Answered</span>
        </div>
      </div>

      {/* Submit Button */}
      {onSubmitExam && (
        <div className="pt-2">
          <button
            onClick={onSubmitExam}
            className="w-full py-2.5 bg-status-success hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-colors shadow-subtle flex items-center justify-center space-x-1"
          >
            <span>Submit Exam</span>
          </button>
        </div>
      )}
    </div>
  )
}
