import React from 'react'
import { Link } from 'react-router-dom'
import { Award, CheckCircle2, XCircle, HelpCircle, Percent, ArrowRight, GitCompare } from 'lucide-react'
import { formatScore } from '../lib/utils'

export function ResultSummary({ attempt, paper }) {
  if (!attempt) return null

  const score = Number(attempt.score || 0)
  const correct = attempt.correct_count || 0
  const incorrect = attempt.incorrect_count || 0
  const unanswered = attempt.unanswered_count || 0
  const accuracy = attempt.accuracy || 0
  const marksPerQ = Number(paper?.marks_per_question || 2)
  const negPerQ = Number(paper?.negative_marking || 0.66)

  const positiveMarks = (correct * marksPerQ).toFixed(2)
  const negativeMarks = (incorrect * negPerQ).toFixed(2)

  return (
    <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-6">
      {/* Title Header */}
      <div className="text-center pb-4 border-b border-surface-border">
        <span className="inline-block px-3 py-1 bg-blue-50 text-primary text-xs font-bold rounded-full mb-2 uppercase tracking-wide">
          Attempt #{attempt.attempt_number} Result
        </span>
        <h2 className="text-2xl font-bold text-body-text">{paper?.title || 'Exam Result'}</h2>
        <p className="text-xs text-body-secondary mt-1">Submitted on {new Date(attempt.submitted_at || attempt.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      </div>

      {/* Main Score Hero Card */}
      <div className="bg-gradient-to-br from-primary-light to-blue-50 border border-blue-200 rounded-2xl p-6 text-center shadow-subtle">
        <div className="text-xs uppercase font-bold text-primary tracking-wider mb-1">Your Total Score</div>
        <div className="text-4xl sm:text-5xl font-extrabold text-primary my-2 tracking-tight">
          {formatScore(score)}
          <span className="text-base text-body-secondary font-medium ml-1">/ {paper?.maximum_marks || 200}</span>
        </div>
        <div className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mt-1">
          <Percent className="w-3.5 h-3.5" />
          <span>Accuracy: <strong>{accuracy}%</strong></span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Correct */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-center">
          <CheckCircle2 className="w-6 h-6 text-status-success mx-auto mb-1" />
          <div className="text-2xl font-bold text-emerald-950">{correct}</div>
          <div className="text-xs font-medium text-emerald-800">Correct Answers</div>
          <div className="text-[10px] text-emerald-700 mt-1 font-semibold">+{positiveMarks} Marks</div>
        </div>

        {/* Incorrect */}
        <div className="bg-red-50/70 border border-red-200 rounded-xl p-4 text-center">
          <XCircle className="w-6 h-6 text-status-error mx-auto mb-1" />
          <div className="text-2xl font-bold text-red-950">{incorrect}</div>
          <div className="text-xs font-medium text-red-800">Incorrect Answers</div>
          <div className="text-[10px] text-red-700 mt-1 font-semibold">-{negativeMarks} Marks</div>
        </div>

        {/* Unanswered */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <HelpCircle className="w-6 h-6 text-slate-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-slate-800">{unanswered}</div>
          <div className="text-xs font-medium text-slate-600">Unanswered</div>
          <div className="text-[10px] text-slate-500 mt-1 font-semibold">0.00 Marks</div>
        </div>

        {/* Accuracy */}
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 text-center">
          <Award className="w-6 h-6 text-indigo-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-indigo-950">{accuracy}%</div>
          <div className="text-xs font-medium text-indigo-800">Overall Accuracy</div>
          <div className="text-[10px] text-indigo-700 mt-1 font-semibold">Strike Rate</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Link
          to={`/attempt/${attempt.id}/review`}
          className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm text-center shadow-subtle transition-colors flex items-center justify-center space-x-2"
        >
          <span>Question-Wise Solution Review</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to={`/compare/${attempt.paper_id}`}
          className="flex-1 py-3 border border-primary text-primary hover:bg-primary-light rounded-xl font-bold text-sm text-center transition-colors flex items-center justify-center space-x-2"
        >
          <GitCompare className="w-4 h-4" />
          <span>Compare Progress With Previous Attempt</span>
        </Link>
      </div>
    </div>
  )
}
