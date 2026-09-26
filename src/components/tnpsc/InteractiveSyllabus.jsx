import React, { useState, useEffect } from 'react'
import { BookMarked, ChevronRight, ChevronDown, Loader2, X, Target, CheckCircle2, RefreshCw, Circle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { syllabusService } from '../../services/tnpscService'

const STATUS_CONFIG = {
  completed:      { label: 'Completed',     color: 'text-emerald-700 bg-emerald-50', icon: CheckCircle2 },
  in_progress:    { label: 'In Progress',   color: 'text-blue-700 bg-blue-50',       icon: RefreshCw },
  needs_revision: { label: 'Needs Revision',color: 'text-amber-700 bg-amber-50',     icon: RefreshCw },
  not_started:    { label: 'Not Started',   color: 'text-slate-500 bg-slate-100',    icon: Circle },
}

export function InteractiveSyllabus({ onClose }) {
  const { user } = useAuth()
  const { selectedExam, toast } = useApp()

  const [loading, setLoading] = useState(true)
  const [units, setUnits]     = useState([])
  const [progress, setProgress] = useState({})
  const [expanded, setExpanded] = useState({})   // unit_id -> bool
  const [saving, setSaving]   = useState({})      // topic_id -> bool

  useEffect(() => { load() }, [selectedExam])

  async function load() {
    setLoading(true)
    try {
      const [u, p] = await Promise.all([
        syllabusService.getUnitsWithTopics(selectedExam),
        syllabusService.getUserProgress(user.id),
      ])
      setUnits(u)
      setProgress(p)
    } catch (err) {
      toast.error('Failed to load syllabus: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(topicId, newStatus) {
    setSaving(s => ({ ...s, [topicId]: true }))
    try {
      const score = newStatus === 'completed' ? 100
                  : newStatus === 'in_progress' ? 50
                  : newStatus === 'needs_revision' ? 25 : 0
      const updated = await syllabusService.upsertProgress(user.id, topicId, newStatus, score)
      setProgress(p => ({ ...p, [topicId]: updated }))
    } catch (err) {
      toast.error('Failed to update progress.')
    } finally {
      setSaving(s => ({ ...s, [topicId]: false }))
    }
  }

  // Compute mastery %
  const allTopics = units.flatMap(u => u.syllabus_topics ?? [])
  const completedCount = allTopics.filter(t => progress[t.id]?.status === 'completed').length
  const masteryPct = allTopics.length ? Math.round((completedCount / allTopics.length) * 100) : 0

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-modal flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
          <div className="flex items-center gap-3">
            <BookMarked className="w-5 h-5 text-tnpsc-brand" />
            <div>
              <h2 className="text-base font-bold text-body-text">Interactive Syllabus</h2>
              <p className="text-xs text-body-secondary">{selectedExam}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Mastery pill */}
            <div className="flex items-center gap-2 bg-tnpsc-brand-light rounded-full px-3 py-1">
              <Target className="w-3.5 h-3.5 text-tnpsc-brand" />
              <span className="text-xs font-bold text-tnpsc-brand">{masteryPct}% Mastery</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4 text-body-secondary" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-3 shrink-0 bg-slate-50 border-b border-surface-border">
          <div className="flex items-center justify-between text-xs text-body-secondary mb-1.5">
            <span>{completedCount} of {allTopics.length} topics completed</span>
            <span className="font-bold text-tnpsc-brand">{masteryPct}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-tnpsc-brand rounded-full transition-all duration-500"
              style={{ width: `${masteryPct}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" />
            </div>
          ) : units.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-body-secondary">No syllabus data available for {selectedExam}.</p>
              <p className="text-xs text-body-secondary mt-1">Admin can populate it via the database.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {units.map(unit => {
                const topics = unit.syllabus_topics ?? []
                const unitCompleted = topics.filter(t => progress[t.id]?.status === 'completed').length
                const isOpen = expanded[unit.id]

                return (
                  <div key={unit.id} className="border border-surface-border rounded-xl overflow-hidden">
                    {/* Unit header */}
                    <button
                      onClick={() => setExpanded(e => ({ ...e, [unit.id]: !e[unit.id] }))}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-tnpsc-brand text-white text-xs font-bold flex items-center justify-center">
                          {unit.unit_number ?? '–'}
                        </span>
                        <span className="text-sm font-semibold text-body-text">{unit.unit_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-body-secondary">{unitCompleted}/{topics.length}</span>
                        {isOpen
                          ? <ChevronDown className="w-4 h-4 text-body-secondary" />
                          : <ChevronRight className="w-4 h-4 text-body-secondary" />
                        }
                      </div>
                    </button>

                    {/* Unit progress bar */}
                    <div className="h-1 bg-slate-200">
                      <div
                        className="h-full bg-tnpsc-brand transition-all duration-500"
                        style={{ width: `${topics.length ? (unitCompleted / topics.length) * 100 : 0}%` }}
                      />
                    </div>

                    {/* Topics */}
                    {isOpen && (
                      <div className="divide-y divide-surface-border">
                        {topics.map(topic => {
                          const prog = progress[topic.id]
                          const status = prog?.status ?? 'not_started'
                          const cfg = STATUS_CONFIG[status]
                          const Icon = cfg.icon

                          return (
                            <div key={topic.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <Icon className={`w-4 h-4 shrink-0 ${cfg.color.split(' ')[0]}`} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-body-text truncate">{topic.topic_name}</p>
                                  {prog?.score != null && prog.score > 0 && (
                                    <p className="text-xs text-body-secondary">{prog.score}% mastery</p>
                                  )}
                                </div>
                              </div>

                              {/* Status selector */}
                              <div className="flex items-center gap-1.5 ml-3 shrink-0">
                                {saving[topic.id] ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-tnpsc-brand" />
                                ) : (
                                  <select
                                    value={status}
                                    onChange={e => handleStatusChange(topic.id, e.target.value)}
                                    className={`text-xs font-semibold rounded-full px-2 py-0.5 border-0 cursor-pointer outline-none ${cfg.color}`}
                                    aria-label={`Status for ${topic.topic_name}`}
                                  >
                                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                      <option key={k} value={k}>{v.label}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
