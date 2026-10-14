import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Search, Sparkles, BookMarked, ArrowRight } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { useAuth } from '../../hooks/useAuth'
import { syllabusAnalyticsService } from '../../services/syllabusAnalyticsService'

/**
 * Standard 10-Unit TNPSC Syllabus matching reference design (media_1791895213021_25551e0d.jpg)
 * and interactive prototype (media_1791890577135_4c9ee280.html).
 */
export const SYLLABUS_UNITS = [
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
  const { user } = useAuth()
  const { selectedExam, toast } = useApp()
  const [activeUnitIdx, setActiveUnitIdx] = useState(0)
  const [unitData, setUnitData] = useState(SYLLABUS_UNITS)
  const [searchQuery, setSearchQuery] = useState('')

  // Sync with live database attempts (strictly deduplicating by unit_number)
  useEffect(() => {
    let isCancelled = false
    async function syncLiveData() {
      if (!user?.id) return
      try {
        const liveAnalytics = await syllabusAnalyticsService.getSyllabusWithAnalytics(user.id, selectedExam)
        if (isCancelled || !liveAnalytics?.units?.length) return

        setUnitData(prevUnits => {
          return prevUnits.map(unit => {
            const liveMatch = liveAnalytics.units.find(lu => lu.unit_number === unit.unit_number)
            if (!liveMatch || liveMatch.total_attempts === 0) return unit

            const liveScore = Math.round(liveMatch.accuracy_percentage || 0)
            return {
              ...unit,
              score: liveScore,
              meta: `${liveMatch.macro_topics?.length || unit.foundationTopics.length + unit.applicationTopics.length} topics · ${liveMatch.attempted_questions || 0}/${liveMatch.total_questions || 0} attempted`,
              foundationTopics: unit.foundationTopics.map((t, idx) => {
                const liveMacro = liveMatch.macro_topics?.[idx]
                if (!liveMacro || !liveMacro.total_attempts) return t
                const mScore = Number(liveMacro.accuracy_percentage || 0)
                const status = mScore >= 70 ? 'Mastered' : mScore < 50 ? 'Needs Review' : 'In Progress'
                return { ...t, status }
              }),
              applicationTopics: unit.applicationTopics.map((t, idx) => {
                const liveMacro = liveMatch.macro_topics?.[idx + 2]
                if (!liveMacro || !liveMacro.total_attempts) return t
                const mScore = Number(liveMacro.accuracy_percentage || 0)
                const status = mScore >= 70 ? 'Mastered' : mScore < 50 ? 'Needs Review' : 'In Progress'
                return { ...t, status }
              })
            }
          })
        })
      } catch (err) {
        console.warn('[InteractiveSyllabus] Live sync background note:', err)
      }
    }

    syncLiveData()
    return () => { isCancelled = true }
  }, [user?.id, selectedExam])

  const activeUnit = unitData[activeUnitIdx] || unitData[0]
  const isWeakZone = activeUnit.score < 50
  const isMastered = activeUnit.score >= 70

  // Calculate dynamic roll-up summary KPIs
  const overallMastery = Math.round(unitData.reduce((acc, u) => acc + u.score, 0) / unitData.length)
  const strongUnits = unitData.filter(u => u.score >= 65).length
  const needsRevision = unitData.filter(u => u.score < 50).length
  const unitsCovered = `${unitData.length} / ${unitData.length}`

  // Filter units by search query
  const filteredUnits = useMemo(() => {
    if (!searchQuery.trim()) return unitData
    const q = searchQuery.toLowerCase().trim()
    return unitData.filter(u =>
      u.unit_name.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      u.desc.toLowerCase().includes(q) ||
      u.foundationTopics.some(t => t.name.toLowerCase().includes(q)) ||
      u.applicationTopics.some(t => t.name.toLowerCase().includes(q))
    )
  }, [unitData, searchQuery])

  // Toggle topic status between Mastered, Needs Review, In Progress
  function toggleTopicStatus(sectionKey, topicId) {
    setUnitData(prev => prev.map((u, idx) => {
      if (idx !== activeUnitIdx) return u

      const updateList = (list) => list.map(t => {
        if (t.id !== topicId) return t
        const nextStatus = t.status === 'Mastered'
          ? 'In Progress'
          : t.status === 'In Progress'
          ? 'Needs Review'
          : 'Mastered'
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
    toast?.success?.('Status updated')
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Mastered':
        return {
          label: 'Mastered',
          badgeClass: 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]',
          iconBox: 'bg-[#d1fae5] text-[#059669]',
          icon: '✓'
        }
      case 'Needs Review':
        return {
          label: 'Needs Review',
          badgeClass: 'bg-[#fff1f2] text-[#ef4444] border border-[#fecdd3]',
          iconBox: 'bg-[#fee2e2] text-[#ef4444]',
          icon: '!'
        }
      default:
        return {
          label: 'In Progress',
          badgeClass: 'bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]',
          iconBox: 'bg-[#dbeafe] text-[#2563eb]',
          icon: '○'
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
            {/* Colorful Stacked Layers Icon matching Prototype */}
            <div className="relative w-7 h-7 shrink-0">
              <div className="absolute inset-0 bg-[#06b6d4] rounded-[6px] -rotate-6 opacity-75" />
              <div className="absolute inset-0 bg-[#ec4899] rounded-[6px] rotate-6 opacity-75" />
              <div className="absolute inset-0 bg-gradient-to-tr from-[#635bff] to-[#8b5cf6] rounded-[6px] flex items-center justify-center shadow-xs">
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

        {onClose && (
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#f1f3f7] hover:bg-[#e2e6ee] text-[#64748b] hover:text-[#172033] flex items-center justify-center transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── 2. Top Summary KPI Row (Exactly matches Image & Prototype) ─────────────────── */}
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
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-[#172033]">10 Syllabus Units</span>
            <span className="text-[11px] text-[#8994a7] font-semibold">Select a unit to inspect topics</span>
          </div>

          {/* Quick Search Input */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-[#8994a7] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search units or topics..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-[#e2e6ee] rounded-xl outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]/20 transition-all placeholder:text-[#8994a7]"
            />
          </div>

          <div className="space-y-2">
            {filteredUnits.map((unit) => {
              const originalIdx = unitData.findIndex(u => u.unit_number === unit.unit_number)
              const isSelected = originalIdx === activeUnitIdx
              const isUnitWeak = unit.score < 50

              return (
                <div
                  key={unit.unit_number}
                  onClick={() => setActiveUnitIdx(originalIdx)}
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

                  <div className="w-full h-1.5 bg-[#edf0f5] rounded-full overflow-hidden mt-2.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isUnitWeak
                          ? 'bg-gradient-to-r from-[#f59e0b] to-[#ef4444]'
                          : 'bg-gradient-to-r from-[#635bff] to-[#8b5cf6]'
                      }`}
                      style={{ width: `${Math.max(5, unit.score)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column: Selected Unit Details & Topics */}
        <div className="flex-1 p-6 sm:p-8 overflow-y-auto bg-white flex flex-col justify-between">
          <div>
            {/* Header: Unit #, Title & Generate Practice Button */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-bold text-[#635bff] uppercase tracking-wider">
                  Unit {activeUnit.unit_number}
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-[#172033] tracking-tight mt-0.5">
                  {activeUnit.displayName || activeUnit.unit_name}
                </h3>
                <p className="text-xs text-[#69758a] mt-1 max-w-xl">
                  {activeUnit.desc}
                </p>
              </div>

              <button
                onClick={() =>
                  navigate(
                    `/practice?subject=${encodeURIComponent(activeUnit.displayName || activeUnit.unit_name)}&unit=${encodeURIComponent(activeUnit.unit_number)}`
                  )
                }
                className="px-5 py-3 rounded-xl bg-[#635bff] text-white font-black text-xs hover:bg-[#4f46e5] transition-all shadow-[0_6px_16px_rgba(99,91,255,0.22)] shrink-0 flex items-center justify-center gap-1.5"
              >
                Generate Practice Set
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mastery Strip (Bold score + Progress Track + Zone Badge) */}
            <div className="flex items-center gap-4 bg-[#f8fafc] border border-[#e5e8ef] rounded-2xl p-4 sm:p-5 mb-8 shadow-2xs">
              <b className="text-2xl sm:text-3xl font-black text-[#172033] min-w-[58px]">
                {activeUnit.score}%
              </b>
              <div className="flex-1 h-2.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isWeakZone ? 'bg-[#ef4444]' : isMastered ? 'bg-[#10b981]' : 'bg-[#635bff]'
                  }`}
                  style={{ width: `${Math.max(6, activeUnit.score)}%` }}
                />
              </div>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider shrink-0 border ${
                  isWeakZone
                    ? 'bg-[#fff0f0] text-[#ef4444] border-[#fecdd3]'
                    : isMastered
                    ? 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]'
                    : 'bg-[#eef2ff] text-[#4f46e5] border-[#c7d2fe]'
                }`}
              >
                {isWeakZone ? 'WEAK ZONE' : isMastered ? 'MASTERED' : 'IN PROGRESS'}
              </span>
            </div>

            {/* Structured Topic Breakdown */}
            <div className="space-y-6">
              {/* Section 1: FOUNDATION & CORE CONCEPTS */}
              <div>
                <h4 className="text-xs font-black text-[#334155] uppercase tracking-wider pb-2 border-b border-[#e5e8ef] mb-3">
                  FOUNDATION &amp; CORE CONCEPTS
                </h4>
                <div className="space-y-2.5">
                  {activeUnit.foundationTopics.map((topic) => {
                    const badge = getStatusBadge(topic.status)
                    return (
                      <div
                        key={topic.id}
                        className="border border-[#dfe5ee] rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-white hover:border-[#c7d2fe] hover:shadow-subtle transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${badge.iconBox}`}>
                            {badge.icon}
                          </span>
                          <span className="text-xs font-bold text-[#172033] truncate">
                            {topic.name}
                          </span>
                        </div>

                        <button
                          onClick={() => toggleTopicStatus('foundation', topic.id)}
                          className={`text-xs font-black px-3 py-1 rounded-lg shrink-0 transition-transform hover:scale-105 active:scale-95 ${badge.badgeClass}`}
                          title="Click to toggle status"
                        >
                          {badge.label}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Section 2: APPLICATION & REVISION */}
              <div>
                <h4 className="text-xs font-black text-[#334155] uppercase tracking-wider pb-2 border-b border-[#e5e8ef] mb-3">
                  APPLICATION &amp; REVISION
                </h4>
                <div className="space-y-2.5">
                  {activeUnit.applicationTopics.map((topic) => {
                    const badge = getStatusBadge(topic.status)
                    return (
                      <div
                        key={topic.id}
                        className="border border-[#dfe5ee] rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-white hover:border-[#c7d2fe] hover:shadow-subtle transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${badge.iconBox}`}>
                            {badge.icon}
                          </span>
                          <span className="text-xs font-bold text-[#172033] truncate">
                            {topic.name}
                          </span>
                        </div>

                        <button
                          onClick={() => toggleTopicStatus('application', topic.id)}
                          className={`text-xs font-black px-3 py-1 rounded-lg shrink-0 transition-transform hover:scale-105 active:scale-95 ${badge.badgeClass}`}
                          title="Click to toggle status"
                        >
                          {badge.label}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Vina Insight Bottom Callout Note */}
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
      </div>
    </div>
  )
}

/**
 * Inline Tree wrapper for SyllabusPage (/syllabus)
 */
export function InteractiveSyllabusTree(props) {
  return <InteractiveSyllabusPanel isModal={false} {...props} />
}

/**
 * Modal Container for Dashboard
 */
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
