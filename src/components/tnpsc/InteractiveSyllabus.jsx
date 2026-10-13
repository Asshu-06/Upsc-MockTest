import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Sparkles, BookMarked } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'

// Standard 10-Unit TNPSC Syllabus exactly matching the reference design
const SYLLABUS_UNITS = [
  {
    unit_number: 1,
    unit_name: 'Unit 1 — General Science',
    displayName: 'General Science',
    score: 78,
    meta: 'Science basics · 18 topics',
    desc: 'Physics, chemistry, biology and everyday science concepts commonly used in TNPSC preparation.',
    foundationTopics: [
      { id: 'u1-t1', name: 'Physics — Motion & Force', status: 'Mastered' },
      { id: 'u1-t2', name: 'Chemistry — Acids, Bases & Salts', status: 'Mastered' },
    ],
    applicationTopics: [
      { id: 'u1-t3', name: 'Biology — Human Systems', status: 'Mastered' },
      { id: 'u1-t4', name: 'Environment — Ecology Basics', status: 'Mastered' },
    ]
  },
  {
    unit_number: 2,
    unit_name: 'Unit 2 — Geography of India & Tamil Nadu',
    displayName: 'Geography of India & Tamil Nadu',
    score: 62,
    meta: 'Physical & human geography · 16 topics',
    desc: 'India and Tamil Nadu geography including resources, climate, rivers, agriculture and population.',
    foundationTopics: [
      { id: 'u2-t1', name: 'Indian Physical Geography', status: 'In Progress' },
      { id: 'u2-t2', name: 'Tamil Nadu Rivers & Resources', status: 'In Progress' },
    ],
    applicationTopics: [
      { id: 'u2-t3', name: 'Climate & Monsoon', status: 'In Progress' },
      { id: 'u2-t4', name: 'Agriculture & Minerals', status: 'In Progress' },
    ]
  },
  {
    unit_number: 3,
    unit_name: 'Unit 3 — Indian National Movement',
    displayName: 'Indian National Movement',
    score: 55,
    meta: 'Freedom movement · 14 topics',
    desc: 'Major events, organisations, leaders, acts and chronology of the Indian national movement.',
    foundationTopics: [
      { id: 'u3-t1', name: 'Early Nationalism', status: 'In Progress' },
      { id: 'u3-t2', name: 'Gandhian Era', status: 'In Progress' },
    ],
    applicationTopics: [
      { id: 'u3-t3', name: 'Acts & Constitutional Developments', status: 'Needs Review' },
      { id: 'u3-t4', name: 'Important Leaders & Events', status: 'In Progress' },
    ]
  },
  {
    unit_number: 4,
    unit_name: 'Unit 4 — Indian Culture & Heritage',
    displayName: 'Indian Culture & Heritage',
    score: 69,
    meta: 'Culture, art & literature · 12 topics',
    desc: 'Indian and Tamil culture, literature, architecture, art forms and heritage.',
    foundationTopics: [
      { id: 'u4-t1', name: 'Tamil Literature', status: 'Mastered' },
      { id: 'u4-t2', name: 'Temple Architecture', status: 'In Progress' },
    ],
    applicationTopics: [
      { id: 'u4-t3', name: 'Folk & Classical Arts', status: 'In Progress' },
      { id: 'u4-t4', name: 'Heritage Sites', status: 'Mastered' },
    ]
  },
  {
    unit_number: 5,
    unit_name: 'Unit 5 — Indian Polity',
    displayName: 'Indian Polity',
    score: 46,
    meta: 'Constitution & governance · 20 topics',
    desc: 'Constitution, fundamental rights, Parliament, judiciary, local government and constitutional bodies.',
    foundationTopics: [
      { id: 'u5-t1', name: 'Fundamental Rights & Duties', status: 'In Progress' },
      { id: 'u5-t2', name: 'Parliament & President', status: 'Needs Review' },
    ],
    applicationTopics: [
      { id: 'u5-t3', name: 'Judiciary & Constitutional Bodies', status: 'Needs Review' },
      { id: 'u5-t4', name: 'Local Government', status: 'Needs Review' },
    ]
  },
  {
    unit_number: 6,
    unit_name: 'Unit 6 — Geography & Environment',
    displayName: 'Geography & Environment',
    score: 62,
    meta: 'Environment & resources · 15 topics',
    desc: 'Environmental issues, biodiversity, natural resources, disaster management and sustainability.',
    foundationTopics: [
      { id: 'u6-t1', name: 'Biodiversity', status: 'In Progress' },
      { id: 'u6-t2', name: 'Pollution & Climate Change', status: 'In Progress' },
    ],
    applicationTopics: [
      { id: 'u6-t3', name: 'Natural Resources', status: 'In Progress' },
      { id: 'u6-t4', name: 'Disaster Management', status: 'In Progress' },
    ]
  },
  {
    unit_number: 7,
    unit_name: 'Unit 7 — Indian Economy',
    displayName: 'Indian Economy',
    score: 58,
    meta: 'Economy & development · 17 topics',
    desc: 'Basic economic concepts, public finance, banking, development indicators and Tamil Nadu economy.',
    foundationTopics: [
      { id: 'u7-t1', name: 'National Income & Growth', status: 'In Progress' },
      { id: 'u7-t2', name: 'Banking & Monetary Policy', status: 'In Progress' },
    ],
    applicationTopics: [
      { id: 'u7-t3', name: 'Government Schemes', status: 'In Progress' },
      { id: 'u7-t4', name: 'Tamil Nadu Economy', status: 'Needs Review' },
    ]
  },
  {
    unit_number: 8,
    unit_name: 'Unit 8 — History & Culture of Tamil Nadu',
    displayName: 'History & Culture of Tamil Nadu',
    score: 31,
    meta: 'Tamil history · 19 topics',
    desc: 'Ancient, medieval and modern Tamil Nadu history, social movements, leaders and cultural development.',
    foundationTopics: [
      { id: 'u8-t1', name: 'Sangam Age', status: 'Needs Review' },
      { id: 'u8-t2', name: 'Chola & Pandya Periods', status: 'Needs Review' },
    ],
    applicationTopics: [
      { id: 'u8-t3', name: 'Social Reform Movements', status: 'Needs Review' },
      { id: 'u8-t4', name: 'Justice Party & Dravidian Movement', status: 'Needs Review' },
    ]
  },
  {
    unit_number: 9,
    unit_name: 'Unit 9 — Tamil Nadu Administration & Schemes',
    displayName: 'Tamil Nadu Administration & Schemes',
    score: 74,
    meta: 'Administration & welfare · 13 topics',
    desc: 'Tamil Nadu administration, welfare schemes, social development and state institutions.',
    foundationTopics: [
      { id: 'u9-t1', name: 'State Administration', status: 'Mastered' },
      { id: 'u9-t2', name: 'Welfare Schemes', status: 'Mastered' },
    ],
    applicationTopics: [
      { id: 'u9-t3', name: 'Education & Health Initiatives', status: 'Mastered' },
      { id: 'u9-t4', name: 'Local Administration', status: 'Mastered' },
    ]
  },
  {
    unit_number: 10,
    unit_name: 'Unit 10 — Aptitude & Mental Ability',
    displayName: 'Aptitude & Mental Ability',
    score: 67,
    meta: 'Quantitative & reasoning · 18 topics',
    desc: 'Numerical ability, reasoning, data interpretation and problem-solving practice.',
    foundationTopics: [
      { id: 'u10-t1', name: 'Percentage & Ratio', status: 'Mastered' },
      { id: 'u10-t2', name: 'Time, Work & Speed', status: 'In Progress' },
    ],
    applicationTopics: [
      { id: 'u10-t3', name: 'Logical Reasoning', status: 'In Progress' },
      { id: 'u10-t4', name: 'Data Interpretation', status: 'In Progress' },
    ]
  }
]

export function InteractiveSyllabusPanel({ isModal = false, onClose }) {
  const navigate = useNavigate()
  const { selectedExam, toast } = useApp()
  const [activeUnitIdx, setActiveUnitIdx] = useState(0)
  const [unitData, setUnitData] = useState(SYLLABUS_UNITS)

  const activeUnit = unitData[activeUnitIdx] || unitData[0]
  const isWeakZone = activeUnit.score < 50

  // Calculate dynamic roll-up summary KPIs
  const overallMastery = Math.round(unitData.reduce((acc, u) => acc + u.score, 0) / unitData.length)
  const strongUnits = unitData.filter(u => u.score >= 65).length
  const needsRevision = unitData.filter(u => u.score < 50).length
  const unitsCovered = `${unitData.length} / ${unitData.length}`

  // Toggle topic status between Mastered, Needs Review, In Progress
  function toggleTopicStatus(sectionKey, topicId) {
    setUnitData(prev => prev.map((u, idx) => {
      if (idx !== activeUnitIdx) return u

      const updateList = (list) => list.map(t => {
        if (t.id !== topicId) return t
        const nextStatus = t.status === 'Mastered' ? 'In Progress' : (t.status === 'In Progress' ? 'Needs Review' : 'Mastered')
        return { ...t, status: nextStatus }
      })

      const newFoundation = sectionKey === 'foundation' ? updateList(u.foundationTopics) : u.foundationTopics
      const newApplication = sectionKey === 'application' ? updateList(u.applicationTopics) : u.applicationTopics

      // Recalculate unit score based on topics
      const allTopics = [...newFoundation, ...newApplication]
      const completedCount = allTopics.filter(t => t.status === 'Mastered').length
      const inProgressCount = allTopics.filter(t => t.status === 'In Progress').length
      const newScore = Math.round(((completedCount * 100) + (inProgressCount * 60)) / allTopics.length)

      return {
        ...u,
        score: newScore,
        foundationTopics: newFoundation,
        applicationTopics: newApplication,
      }
    }))
    toast.success('Status updated')
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Mastered':
        return {
          label: 'Mastered',
          badgeClass: 'bg-[#ecfdf5] text-[#059669]',
          iconBox: 'bg-[#d1fae5] text-[#059669]',
          icon: '✓'
        }
      case 'Needs Review':
        return {
          label: 'Needs Review',
          badgeClass: 'bg-[#fff1f2] text-[#ef4444]',
          iconBox: 'bg-[#fee2e2] text-[#ef4444]',
          icon: '!'
        }
      default:
        return {
          label: 'In Progress',
          badgeClass: 'bg-[#eff6ff] text-[#2563eb]',
          iconBox: 'bg-[#dbeafe] text-[#2563eb]',
          icon: '↻'
        }
    }
  }

  return (
    <div className={`w-full bg-white flex flex-col overflow-hidden ${
      isModal
        ? 'max-w-5xl h-[88vh] max-h-[820px] rounded-3xl shadow-2xl border border-surface-border animate-scale-in'
        : 'rounded-2xl border border-surface-border shadow-subtle min-h-[720px]'
    }`}>
      {/* ── 1. Top Header ─────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-[#edf0f5] bg-white flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#8994a7] mb-1 font-medium">
            <span>Dashboard</span>
            <span className="text-[#8994a7]">›</span>
            <span className="text-[#635bff] font-extrabold">Interactive Syllabus</span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Colorful Stacked Layers Icon */}
            <div className="relative w-7 h-7 shrink-0">
              <div className="absolute inset-0 bg-[#06b6d4] rounded-[5px] -rotate-6 opacity-75" />
              <div className="absolute inset-0 bg-[#ec4899] rounded-[5px] rotate-6 opacity-75" />
              <div className="absolute inset-0 bg-gradient-to-tr from-[#635bff] to-[#8b5cf6] rounded-[5px] flex items-center justify-center shadow-xs">
                <BookMarked className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight">
              {selectedExam || 'TNPSC Group 4'} — Interactive Syllabus
            </h2>
          </div>

          <p className="text-xs text-[#69758a] mt-1">
            Explore units → inspect micro-topics → identify your preparation level.
          </p>
        </div>

        {isModal && (
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#f1f3f7] hover:bg-[#e2e6ee] text-[#64748b] hover:text-[#172033] flex items-center justify-center transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── 2. Top Summary KPI Row (Exactly matches Image 2) ─────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-4 bg-[#fbfcfe] border-b border-[#edf0f5] shrink-0">
        <div className="bg-gradient-to-br from-[#f5f2ff] to-[#f0eeff] border border-[#ddd7ff] rounded-2xl p-4 shadow-2xs">
          <small className="block text-[10px] font-bold text-[#69758a] uppercase tracking-wider">
            OVERALL SYLLABUS MASTERY
          </small>
          <b className="block mt-1 text-2xl sm:text-3xl font-black text-[#635bff]">
            {overallMastery}%
          </b>
        </div>

        <div className="bg-white border border-[#e5e8ef] rounded-2xl p-4 shadow-2xs">
          <small className="block text-[10px] font-bold text-[#69758a] uppercase tracking-wider">
            STRONG UNITS
          </small>
          <b className="block mt-1 text-2xl sm:text-3xl font-black text-[#172033]">
            {strongUnits}
          </b>
        </div>

        <div className="bg-white border border-[#e5e8ef] rounded-2xl p-4 shadow-2xs">
          <small className="block text-[10px] font-bold text-[#69758a] uppercase tracking-wider">
            NEEDS REVISION
          </small>
          <b className="block mt-1 text-2xl sm:text-3xl font-black text-[#172033]">
            {needsRevision}
          </b>
        </div>

        <div className="bg-white border border-[#e5e8ef] rounded-2xl p-4 shadow-2xs">
          <small className="block text-[10px] font-bold text-[#69758a] uppercase tracking-wider">
            UNITS COVERED
          </small>
          <b className="block mt-1 text-2xl sm:text-3xl font-black text-[#172033]">
            {unitsCovered}
          </b>
        </div>
      </div>

      {/* ── 3. Split Body: Unit List & Tracker Detail ──────────────────────── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Left column: 10 Syllabus Units */}
        <div className="w-full md:w-[44%] lg:w-[42%] p-5 overflow-y-auto border-r border-[#edf0f5] bg-white space-y-2.5">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold text-[#172033]">10 Syllabus Units</span>
            <span className="text-[11px] text-[#8994a7] font-semibold">Example candidate data</span>
          </div>

          {unitData.map((unit, idx) => {
            const isSelected = idx === activeUnitIdx
            const isUnitWeak = unit.score < 50

            return (
              <div
                key={unit.unit_number}
                onClick={() => setActiveUnitIdx(idx)}
                className={`border rounded-2xl p-4 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-2 border-[#635bff] bg-[#f6f4ff] shadow-[0_5px_16px_rgba(99,91,255,0.08)]'
                    : 'border-[#e5e8ef] hover:border-[#c7d2fe] hover:bg-[#fafaff]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-[#172033] truncate">
                    {unit.unit_name}
                  </span>
                  <span className={`text-xs font-black ${isUnitWeak ? 'text-[#ef4444]' : 'text-[#635bff]'}`}>
                    {unit.score}%
                  </span>
                </div>

                <div className="text-[10px] text-[#8994a7] mt-1 font-medium">
                  {unit.meta}
                </div>

                <div className="h-2 bg-[#edf0f5] rounded-full overflow-hidden mt-2.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isUnitWeak
                        ? 'bg-gradient-to-r from-[#f59e0b] to-[#ef4444]'
                        : 'bg-gradient-to-r from-[#635bff] to-[#8b5cf6]'
                    }`}
                    style={{ width: `${Math.max(unit.score, 4)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Right column: Detail Tracker Panel */}
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-white">
          {activeUnit && (
            <div>
              {/* Unit Title & Generate Practice Set Button */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-[#172033] tracking-tight">
                    {activeUnit.displayName}
                  </h3>
                </div>

                <button
                  onClick={() => {
                    if (isModal && onClose) onClose()
                    navigate(`/practice?subject=${encodeURIComponent(activeUnit.unit_name)}`)
                  }}
                  className="bg-[#635bff] hover:bg-[#4f46e5] text-white font-black text-xs px-5 py-3 rounded-xl shadow-[0_6px_16px_rgba(99,91,255,0.22)] transition-all flex items-center gap-1.5 shrink-0 hover:-translate-y-0.5"
                >
                  Generate Practice Set →
                </button>
              </div>

              {/* Mastery Strip */}
              <div className="flex items-center gap-4 bg-[#f8fafc] border border-[#e5e8ef] rounded-2xl p-4 sm:p-5 mb-8">
                <b className="text-2xl sm:text-3xl font-black text-[#172033] min-w-[56px]">
                  {activeUnit.score}%
                </b>
                <div className="h-3 bg-[#e2e8f0] rounded-full overflow-hidden flex-1">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isWeakZone ? 'bg-[#ef4444]' : 'bg-[#635bff]'}`}
                    style={{ width: `${Math.max(activeUnit.score, 4)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-black px-3.5 py-1.5 rounded-lg whitespace-nowrap tracking-wider ${
                  isWeakZone ? 'bg-[#fff0f0] text-[#ef4444]' : 'bg-[#eef2ff] text-[#4f46e5]'
                }`}>
                  {isWeakZone ? 'WEAK ZONE' : 'IN PROGRESS'}
                </span>
              </div>

              {/* FOUNDATION & CORE CONCEPTS Section */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-black text-[#334155] tracking-wider uppercase mb-3">
                    FOUNDATION & CORE CONCEPTS
                  </h4>

                  <div className="space-y-2.5">
                    {activeUnit.foundationTopics.map(topic => {
                      const badge = getStatusBadge(topic.status)
                      return (
                        <div
                          key={topic.id}
                          className="border border-[#dfe5ee] hover:border-[#c7d2fe] hover:shadow-[0_4px_12px_rgba(24,39,75,0.04)] rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 bg-white transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-lg ${badge.iconBox} flex items-center justify-center font-black text-xs shrink-0`}>
                              {badge.icon}
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-[#172033] truncate">
                              {topic.name}
                            </span>
                          </div>

                          <button
                            onClick={() => toggleTopicStatus('foundation', topic.id)}
                            className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors cursor-pointer ${badge.badgeClass}`}
                          >
                            {badge.label}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* APPLICATION & REVISION Section */}
                <div>
                  <h4 className="text-xs font-black text-[#334155] tracking-wider uppercase mb-3 mt-6">
                    APPLICATION & REVISION
                  </h4>

                  <div className="space-y-2.5">
                    {activeUnit.applicationTopics.map(topic => {
                      const badge = getStatusBadge(topic.status)
                      return (
                        <div
                          key={topic.id}
                          className="border border-[#dfe5ee] hover:border-[#c7d2fe] hover:shadow-[0_4px_12px_rgba(24,39,75,0.04)] rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 bg-white transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-lg ${badge.iconBox} flex items-center justify-center font-black text-xs shrink-0`}>
                              {badge.icon}
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-[#172033] truncate">
                              {topic.name}
                            </span>
                          </div>

                          <button
                            onClick={() => toggleTopicStatus('application', topic.id)}
                            className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors cursor-pointer ${badge.badgeClass}`}
                          >
                            {badge.label}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Vina Insight Callout Box */}
              <div className="mt-8 bg-[#f5f2ff] border border-[#ddd7ff] rounded-2xl p-4 text-xs text-[#4f46e5] leading-relaxed flex items-start gap-2.5 shadow-2xs">
                <Sparkles className="w-4 h-4 text-[#635bff] shrink-0 mt-0.5" />
                <div>
                  <b>Vina insight:</b>{' '}
                  {isWeakZone
                    ? 'This unit is a weak zone. Start with the topics marked Needs Review, then complete a focused practice set.'
                    : 'Keep progressing through the pending topics and revisit any area marked Needs Review.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Modal Container
export function InteractiveSyllabus({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-[7px] flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}
    >
      <InteractiveSyllabusPanel isModal={true} onClose={onClose} />
    </div>
  )
}

export default InteractiveSyllabus
