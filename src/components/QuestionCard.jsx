import React from 'react'
import { Bookmark, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

export function QuestionCard({
  question,
  totalQuestions,
  selectedOption,
  onSelectOption,
  onClearOption,
  isMarkedForReview,
  onToggleMarkForReview,
  mode = 'exam', // 'exam' | 'review'
  correctOption = null,
  explanation = null
}) {
  const options = [
    { key: 'A', text: question.option_a },
    { key: 'B', text: question.option_b },
    { key: 'C', text: question.option_c },
    { key: 'D', text: question.option_d }
  ]

  const isReviewMode = mode === 'review'
  const isCorrect = isReviewMode && selectedOption === correctOption
  const isUnanswered = isReviewMode && !selectedOption

  return (
    <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-surface-border pb-4">
        <div className="flex items-center space-x-3">
          <span className="w-8 h-8 rounded-lg bg-primary-light text-primary font-bold text-sm flex items-center justify-center">
            Q{question.question_number}
          </span>
          <span className="text-xs text-body-secondary font-medium">
            Question {question.question_number} of {totalQuestions}
          </span>
        </div>

        {/* Review mode status pill OR Exam mode flag button */}
        {isReviewMode ? (
          <div>
            {isUnanswered ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Unanswered
              </span>
            ) : isCorrect ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-status-success border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Correct (+2.0)
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-status-error border border-red-200">
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Incorrect (-0.66)
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={onToggleMarkForReview}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isMarkedForReview
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-slate-100 text-body-secondary hover:bg-slate-200'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isMarkedForReview ? 'fill-amber-600 text-amber-600' : ''}`} />
            <span>{isMarkedForReview ? 'Marked for Review' : 'Mark for Review'}</span>
          </button>
        )}
      </div>

      {/* Question Text */}
      <div className="text-base text-body-text font-medium leading-relaxed whitespace-pre-line">
        {question.question_text}
      </div>

      {/* Options List */}
      <div className="space-y-3 pt-2">
        {options.map((opt) => {
          const isSelected = selectedOption === opt.key
          const isThisCorrect = isReviewMode && correctOption === opt.key
          const isThisWrongSelection = isReviewMode && isSelected && !isThisCorrect

          let optionStyle = "border-surface-border bg-white text-body-text hover:border-slate-300"
          
          if (isReviewMode) {
            if (isThisCorrect) {
              optionStyle = "border-emerald-500 bg-emerald-50/70 text-emerald-950 font-semibold"
            } else if (isThisWrongSelection) {
              optionStyle = "border-red-400 bg-red-50/70 text-red-950 font-medium"
            } else {
              optionStyle = "border-slate-200 bg-slate-50/50 text-slate-500 opacity-75"
            }
          } else if (isSelected) {
            optionStyle = "border-primary bg-blue-50/80 text-primary font-semibold ring-1 ring-primary"
          }

          return (
            <label
              key={opt.key}
              onClick={() => !isReviewMode && onSelectOption(opt.key)}
              className={`flex items-start space-x-3 p-4 rounded-xl border transition-all ${
                isReviewMode ? 'cursor-default' : 'cursor-pointer'
              } ${optionStyle}`}
            >
              <span className={`w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
                isReviewMode
                  ? isThisCorrect
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : isThisWrongSelection
                    ? 'border-red-500 bg-red-500 text-white'
                    : 'border-slate-300 text-slate-500'
                  : isSelected
                  ? 'border-primary bg-primary text-white'
                  : 'border-slate-300 text-slate-600'
              }`}>
                {opt.key}
              </span>
              <span className="text-sm leading-relaxed flex-1 pt-0.5">
                {opt.text}
              </span>

              {isReviewMode && isThisCorrect && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  Correct Answer
                </span>
              )}
              {isReviewMode && isThisWrongSelection && (
                <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                  Your Choice
                </span>
              )}
            </label>
          )
        })}
      </div>

      {/* Clear Option button in Exam Mode */}
      {!isReviewMode && selectedOption && (
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClearOption}
            className="text-xs text-body-secondary hover:text-status-error hover:underline transition-colors"
          >
            Clear Selected Answer
          </button>
        </div>
      )}

      {/* Explanation Box in Review Mode */}
      {isReviewMode && (
        <div className="mt-6 pt-4 border-t border-surface-border bg-slate-50 rounded-lg p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center space-x-1">
            <AlertCircle className="w-4 h-4 text-primary" />
            <span>Explanation & Solution</span>
          </h4>
          <p className="text-xs text-body-secondary leading-relaxed whitespace-pre-line">
            {explanation || question.explanation || 'No detailed explanation provided for this question.'}
          </p>
        </div>
      )}
    </div>
  )
}
