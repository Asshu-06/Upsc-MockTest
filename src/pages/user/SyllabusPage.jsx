import React, { useState } from 'react'
import { BookMarked } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { InteractiveSyllabus } from '../../components/tnpsc/InteractiveSyllabus'

export function SyllabusPage() {
  const { selectedExam } = useApp()
  // The syllabus page simply renders the full interactive syllabus inline
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <BookMarked className="w-6 h-6 text-tnpsc-brand" />
        <div>
          <h1 className="text-xl font-bold text-body-text">Interactive Syllabus</h1>
          <p className="text-xs text-body-secondary">{selectedExam} — track your preparation topic by topic</p>
        </div>
      </div>
      {/* Render syllabus inline (not as modal) */}
      <SyllabusInline />
    </div>
  )
}

// Re-uses the InteractiveSyllabus logic but renders inline (no overlay)
function SyllabusInline() {
  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-subtle overflow-hidden">
      <InteractiveSyllabusContent />
    </div>
  )
}

// Extract just the content portion of InteractiveSyllabus for inline use
import { useEffect } from 'react'
import { syllabusService } from '../../services/tnpscService'
import { useAuth } from '../../hooks/useAuth'
import {
  ChevronRight, ChevronDown, Loader2, Target,
  CheckCircle2, RefreshCw, Circle,
} from 'lucide-react'

const STATUS_CONFIG = {
  completed:      { label: 'Completed',     color: 'text-emerald-700 bg-emerald-50', icon: CheckCircle2 },
  in_progress:    { label: 'In Progress',   color: 'text-blue-700 bg-blue-50',       icon: RefreshCw },
  needs_revision: { label: 'Needs Revision',color: 'text-amber-700 bg-amber-50',     icon: RefreshCw },
  not_started:    { label: 'Not Started',   color: 'text-slate-500 bg-slate-100',    icon: Circle },
}

function InteractiveSyllabusContent() {
  const { user }  = useAuth()
  const { selectedExam, toast } = useApp()
  const [loading, setLoading] = useState(true)
  const [units, setUnits]     = useState([])
  const [progress, setProgress] = useState({})
  const [expanded, setExpanded] = useState({})
  const [saving, setSaving]   = useState({})

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
      // Auto-expand first unit
      if (u.length > 0) setExpanded({ [u[0].id]: true })
    } catch (err) { toast.error('Failed to load syllabus') }
    finally { setLoading(false) }
  }

  async function handleStatusChange(topicId, newStatus) {
    setSaving(s => ({ ...s, [topicId]: true }))
    try {
      const score = newStatus === 'completed' ? 100 : newStatus === 'in_progress' ? 50 : newStatus === 'needs_revision' ? 25 : 0
      const updated = await syllabusService.upsertProgress(user.id, topicId, newStatus, score)
      setProgress(p => ({ ...p, [topicId]: updated }))
    } catch { toast.error('Failed to update') }
    finally { setSaving(s => ({ ...s, [topicId]: false })) }
  }

  const allTopics = units.flatMap(u => u.syllabus_topics ?? [])
  const completedCount = allTopics.filter(t => progress[t.id]?.status === 'completed').length
  const masteryPct = allTopics.length ? Math.round((completedCount / allTopics.length) * 100) : 0

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>

  return (
    <div>
      {/* Progress header */}
      <div className="px-6 py-4 border-b border-surface-border bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-tnpsc-brand" />
            <span className="text-sm font-bold text-body-text">Overall Mastery</span>
          </div>
          <span className="text-sm font-bold text-tnpsc-brand">{masteryPct}%</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-tnpsc-brand rounded-full transition-all duration-500" style={{ width: `${masteryPct}%` }} />
        </div>
        <p className="text-xs text-body-secondary mt-1">{completedCount} of {allTopics.length} topics completed</p>
      </div>

      {units.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-body-secondary">No syllabus data yet. Admin can populate it in the database.</p>
        </div>
      ) : (
        <div className="divide-y divide-surface-border">
          {units.map(unit => {
            const topics = unit.syllabus_topics ?? []
            const unitCompleted = topics.filter(t => progress[t.id]?.status === 'completed').length
            const isOpen = expanded[unit.id]
            return (
              <div key={unit.id}>
                <button
                  onClick={() => setExpanded(e => ({ ...e, [unit.id]: !e[unit.id] }))}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-tnpsc-brand text-white text-xs font-bold flex items-center justify-center">
                      {unit.unit_number ?? '–'}
                    </span>
                    <span className="text-sm font-semibold text-body-text">{unit.unit_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs font-bold text-tnpsc-brand">{topics.length ? Math.round((unitCompleted / topics.length) * 100) : 0}%</p>
                      <p className="text-[10px] text-body-secondary">{unitCompleted}/{topics.length}</p>
                    </div>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-body-secondary" /> : <ChevronRight className="w-4 h-4 text-body-secondary" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="bg-slate-50 divide-y divide-surface-border">
                    {topics.map(topic => {
                      const prog = progress[topic.id]
                      const status = prog?.status ?? 'not_started'
                      const cfg = STATUS_CONFIG[status]
                      const Icon = cfg.icon
                      return (
                        <div key={topic.id} className="flex items-center justify-between px-8 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon className={`w-4 h-4 shrink-0 ${cfg.color.split(' ')[0]}`} />
                            <p className="text-sm text-body-text truncate">{topic.topic_name}</p>
                          </div>
                          {saving[topic.id]
                            ? <Loader2 className="w-4 h-4 animate-spin text-tnpsc-brand shrink-0" />
                            : (
                              <select
                                value={status}
                                onChange={e => handleStatusChange(topic.id, e.target.value)}
                                className={`text-xs font-semibold rounded-full px-2 py-0.5 border-0 cursor-pointer outline-none shrink-0 ${cfg.color}`}
                              >
                                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                  <option key={k} value={k}>{v.label}</option>
                                ))}
                              </select>
                            )
                          }
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
  )
}
