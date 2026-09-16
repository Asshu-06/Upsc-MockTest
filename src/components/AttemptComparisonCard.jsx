import React from 'react'
import { TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { formatScore } from '../lib/utils'

export function AttemptComparisonCard({ comparisonData }) {
  if (!comparisonData) return null

  if (!comparisonData.hasPrevious) {
    return (
      <div className="bg-white rounded-xl border border-surface-border p-6 text-center shadow-card space-y-4">
        <div className="w-12 h-12 bg-blue-50 text-primary rounded-full flex items-center justify-center mx-auto">
          <RefreshCw className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-body-text">First Completed Attempt</h3>
        <p className="text-sm text-body-secondary max-w-md mx-auto">
          This is your first completed attempt for this question paper. Reattempt the paper anytime to view detailed progress comparison and score analytics.
        </p>
      </div>
    )
  }

  const { currentAttempt, previousAttempt, metrics, questionTransitions } = comparisonData

  const renderDeltaPill = (val, isPositiveGood = true) => {
    const isZero = val === 0
    const isPositive = val > 0

    let colorClass = "bg-slate-100 text-slate-700"
    let Icon = Minus

    if (!isZero) {
      if ((isPositive && isPositiveGood) || (!isPositive && !isPositiveGood)) {
        colorClass = "bg-emerald-100 text-emerald-800"
        Icon = TrendingUp
      } else {
        colorClass = "bg-red-100 text-red-800"
        Icon = TrendingDown
      }
    }

    const sign = isPositive ? '+' : ''

    return (
      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold ${colorClass}`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{sign}{val}</span>
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Metrics Comparison Card */}
      <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-border pb-4 gap-2">
          <div>
            <h3 className="text-lg font-bold text-body-text">Attempt Comparison Summary</h3>
            <p className="text-xs text-body-secondary">
              Comparing Attempt #{currentAttempt.attempt_number} with Immediately Previous Attempt #{previousAttempt.attempt_number}
            </p>
          </div>
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-semibold text-xs rounded-full self-start sm:self-auto">
            Consecutive Attempt Delta
          </span>
        </div>

        {/* Side-by-Side Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-slate-50 text-xs font-semibold text-body-secondary uppercase">
                <th className="py-3 px-4">Metric</th>
                <th className="py-3 px-4">Previous (Attempt #{previousAttempt.attempt_number})</th>
                <th className="py-3 px-4">Current (Attempt #{currentAttempt.attempt_number})</th>
                <th className="py-3 px-4">Change / Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {/* Score */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3.5 px-4 font-bold text-body-text">Total Score</td>
                <td className="py-3.5 px-4 text-body-secondary font-semibold">{formatScore(previousAttempt.score)}</td>
                <td className="py-3.5 px-4 text-primary font-bold">{formatScore(currentAttempt.score)}</td>
                <td className="py-3.5 px-4">{renderDeltaPill(metrics.scoreDiff, true)}</td>
              </tr>
              {/* Accuracy */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3.5 px-4 font-bold text-body-text">Accuracy (%)</td>
                <td className="py-3.5 px-4 text-body-secondary font-semibold">{previousAttempt.accuracy}%</td>
                <td className="py-3.5 px-4 text-primary font-bold">{currentAttempt.accuracy}%</td>
                <td className="py-3.5 px-4">{renderDeltaPill(metrics.accuracyDiff, true)}</td>
              </tr>
              {/* Correct */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3.5 px-4 font-bold text-body-text">Correct Answers</td>
                <td className="py-3.5 px-4 text-body-secondary">{previousAttempt.correct_count}</td>
                <td className="py-3.5 px-4 text-emerald-700 font-bold">{currentAttempt.correct_count}</td>
                <td className="py-3.5 px-4">{renderDeltaPill(metrics.correctDiff, true)}</td>
              </tr>
              {/* Incorrect */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3.5 px-4 font-bold text-body-text">Incorrect Answers</td>
                <td className="py-3.5 px-4 text-body-secondary">{previousAttempt.incorrect_count}</td>
                <td className="py-3.5 px-4 text-red-700 font-bold">{currentAttempt.incorrect_count}</td>
                <td className="py-3.5 px-4">{renderDeltaPill(metrics.incorrectDiff, false)}</td>
              </tr>
              {/* Unanswered */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3.5 px-4 font-bold text-body-text">Unanswered</td>
                <td className="py-3.5 px-4 text-body-secondary">{previousAttempt.unanswered_count}</td>
                <td className="py-3.5 px-4 font-semibold text-slate-700">{currentAttempt.unanswered_count}</td>
                <td className="py-3.5 px-4">{renderDeltaPill(metrics.unansweredDiff, false)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Question Transitions Breakdown */}
      {questionTransitions && questionTransitions.length > 0 && (
        <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
          <h4 className="text-base font-bold text-body-text">Question-Wise Progress Transition</h4>
          <p className="text-xs text-body-secondary">
            See how your response changed for each specific question between attempt #{previousAttempt.attempt_number} and attempt #{currentAttempt.attempt_number}.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-body-secondary uppercase font-semibold border-b border-surface-border">
                  <th className="py-2.5 px-3">Q#</th>
                  <th className="py-2.5 px-3">Question Text</th>
                  <th className="py-2.5 px-3">Prev Selection</th>
                  <th className="py-2.5 px-3">Curr Selection</th>
                  <th className="py-2.5 px-3">Correct Option</th>
                  <th className="py-2.5 px-3">Status Transition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {questionTransitions.map((t) => {
                  let transitionBadge = "bg-gray-100 text-gray-700"
                  if (t.transition === 'Wrong → Correct' || t.transition === 'Unanswered → Correct') {
                    transitionBadge = "bg-emerald-100 text-emerald-800 font-bold"
                  } else if (t.transition === 'Stayed Correct') {
                    transitionBadge = "bg-blue-50 text-blue-800 font-medium"
                  } else if (t.transition === 'Correct → Wrong' || t.transition === 'Unanswered → Wrong') {
                    transitionBadge = "bg-red-100 text-red-800 font-bold"
                  } else if (t.transition === 'Still Incorrect') {
                    transitionBadge = "bg-amber-100 text-amber-800 font-medium"
                  }

                  return (
                    <tr key={t.question_id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-bold text-primary">Q{t.question_number}</td>
                      <td className="py-3 px-3 max-w-xs truncate font-medium text-body-text" title={t.question_text}>
                        {t.question_text}
                      </td>
                      <td className="py-3 px-3 text-body-secondary font-semibold">{t.prev_selected}</td>
                      <td className="py-3 px-3 text-body-text font-bold">{t.curr_selected}</td>
                      <td className="py-3 px-3 text-emerald-700 font-bold">{t.correct_option}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] ${transitionBadge}`}>
                          {t.transition}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
