import React from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, HelpCircle, Award, AlertCircle, ArrowRight } from 'lucide-react'

export function PaperCard({ paper }) {
  return (
    <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card hover:shadow-md transition-shadow flex flex-col justify-between">
      <div>
        {/* Header Tags */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-primary border border-blue-100">
            {paper.exam_name} ({paper.year})
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-body-secondary">
            {paper.subject}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
            {paper.exam_type || 'Prelims'}
          </span>
        </div>

        {/* Paper Title */}
        <h3 className="text-lg font-bold text-body-text mb-2 line-clamp-2 hover:text-primary transition-colors">
          {paper.title}
        </h3>

        {/* Description snippet */}
        {paper.description && (
          <p className="text-xs text-body-secondary line-clamp-2 mb-4">
            {paper.description}
          </p>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 py-3 border-y border-surface-border text-xs text-body-secondary mb-6">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            <span><strong>{paper.total_questions || 0}</strong> Questions</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-primary" />
            <span><strong>{paper.duration_minutes || 120}</strong> Minutes</span>
          </div>
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-primary" />
            <span>Max Marks: <strong>{paper.maximum_marks || 200}</strong></span>
          </div>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-status-warning" />
            <span>Negative: <strong>-{paper.negative_marking || 0.66}</strong></span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-3 pt-2">
        <Link
          to={`/papers/${paper.id}`}
          className="flex-1 text-center py-2 px-3 border border-surface-border rounded-lg text-xs font-semibold text-body-text hover:bg-slate-50 transition-colors"
        >
          View Details
        </Link>
        <Link
          to={`/papers/${paper.id}`}
          className="flex-1 text-center py-2 px-3 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold shadow-subtle transition-colors flex items-center justify-center space-x-1"
        >
          <span>Start Exam</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}
