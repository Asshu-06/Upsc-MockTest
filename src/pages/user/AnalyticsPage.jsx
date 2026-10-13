import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3, Target, CheckCircle2, XCircle, Minus,
  TrendingUp, Loader2, AlertCircle, BookOpen, Award,
  ChevronDown, ChevronRight, Layers, Tag, BookMarked,
  Sparkles, ArrowRight
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { analyticsService } from '../../services/tnpscService'

export function AnalyticsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { selectedExam } = useApp()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [expandedSubjects, setExpandedSubjects] = useState({})
  const [expandedUnits, setExpandedUnits]       = useState({})

  useEffect(() => { if (user?.id) load() }, [user?.id, selectedExam])

  async function load() {
    setLoading(true); setError(null)
    try { setData(await analyticsService.getOverview(user.id, selectedExam)) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>
  if (error)   return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
      <AlertCircle className="w-5 h-5 text-red-500" />
      <p className="text-sm text-red-700">{error}</p>
      <button onClick={load} className="ml-auto text-xs underline text-red-700">Retry</button>
    </div>
  )

  if (!data?.hasData) return (
    <div className="text-center py-16 bg-white rounded-2xl border border-surface-border">
      <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
      <h2 className="text-lg font-bold text-body-text mb-2">No data for {selectedExam}</h2>
      <p className="text-sm text-body-secondary">Complete at least one exam attempt for {selectedExam} to see analytics here.</p>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-tnpsc-brand" />
        <div>
          <h1 className="text-xl font-bold text-body-text">Master Analytics</h1>
          <p className="text-xs text-body-secondary">Calculated from your {data.totalAttempts} completed attempts</p>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Attempts',  value: data.totalAttempts,  icon: BookOpen,      color: 'text-tnpsc-brand bg-tnpsc-brand-light' },
          { label: 'Avg Score',       value: `${data.avgScore}%`, icon: Award,         color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Avg Accuracy',    value: `${data.avgAccuracy}%`, icon: Target,     color: 'text-blue-700 bg-blue-50' },
          { label: 'Total Questions', value: data.totalQuestions, icon: BarChart3,      color: 'text-purple-700 bg-purple-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-surface-border p-4 shadow-subtle">
            <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-body-text">{value}</p>
            <p className="text-xs text-body-secondary mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Error analysis */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Correct',  value: data.totalCorrect,  icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Wrong',    value: data.totalWrong,    icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50 border-red-200' },
          { label: 'Skipped',  value: data.totalSkipped,  icon: Minus,        color: 'text-slate-500',   bg: 'bg-slate-50 border-slate-200' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border p-4 text-center ${bg}`}>
            <Icon className={`w-6 h-6 mx-auto mb-2 ${color}`} />
            <p className="text-xl font-bold text-body-text">{value}</p>
            <p className="text-xs text-body-secondary">{label}</p>
          </div>
        ))}
      </div>

      {/* Accuracy trend */}
      {data.trend?.length > 1 && (
        <div className="bg-white rounded-2xl border border-surface-border shadow-subtle p-5">
          <h3 className="text-sm font-bold text-body-text mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-tnpsc-brand" /> Accuracy Trend
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="attempt" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}%`, 'Accuracy']} />
              <Line type="monotone" dataKey="accuracy" stroke="#635BFF" strokeWidth={2} dot={{ fill: '#635BFF', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Subject, Unit & Micro Topic Breakdown */}
      {data.subjectBreakdown?.length > 0 && (
        <div className="bg-white rounded-2xl border border-surface-border shadow-subtle p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-body-text flex items-center gap-2">
                <Layers className="w-4 h-4 text-tnpsc-brand" />
                Subject & Micro Topic Breakdown
              </h3>
              <p className="text-xs text-body-secondary mt-0.5">
                Click any subject to drill down into Units (Macro Topics) and Micro Topics
              </p>
            </div>
            <span className="text-[11px] font-medium text-tnpsc-brand bg-tnpsc-brand-light px-2.5 py-1 rounded-full">
              Interactive Drill-Down
            </span>
          </div>

          <div className="space-y-3">
            {data.subjectBreakdown.map(s => {
              const isSubjOpen = Boolean(expandedSubjects[s.subject])
              const unitsCount = s.units?.length || 0

              return (
                <div key={s.subject} className="border border-surface-border rounded-xl overflow-hidden transition-all bg-white">
                  {/* Subject Header (Clickable) */}
                  <div
                    onClick={() => setExpandedSubjects(prev => ({ ...prev, [s.subject]: !prev[s.subject] }))}
                    className="flex items-center justify-between p-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-tnpsc-brand-light text-tnpsc-brand flex items-center justify-center shrink-0">
                        {isSubjOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-body-text">{s.subject}</span>
                          {unitsCount > 0 && (
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {unitsCount} {unitsCount === 1 ? 'Unit' : 'Units'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-body-secondary mt-0.5">
                          {s.attempted} questions attempted · {s.correct} correct
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                        Number(s.accuracy) >= 70 ? 'bg-emerald-50 text-emerald-700' :
                        Number(s.accuracy) >= 50 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {s.accuracy}% Accuracy
                      </span>
                    </div>
                  </div>

                  {/* Subject Overall Bar */}
                  <div className="px-3.5 pb-3">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${s.accuracy}%`,
                          background: Number(s.accuracy) >= 70 ? '#16a34a' : Number(s.accuracy) >= 50 ? '#635BFF' : '#dc2626',
                        }}
                      />
                    </div>
                  </div>

                  {/* Expanded Units & Micro Topics */}
                  {isSubjOpen && (
                    <div className="bg-slate-50/60 p-3.5 border-t border-surface-border space-y-2.5 animate-fade-in">
                      {unitsCount === 0 ? (
                        <p className="text-xs text-body-secondary italic py-1">No detailed micro-topic data available for this subject.</p>
                      ) : (
                        s.units.map(u => {
                          const unitKey = `${s.subject}-${u.unit}`
                          const isUnitOpen = expandedUnits[unitKey] !== false // Default open inside expanded subject
                          const microCount = u.microTopics?.length || 0

                          return (
                            <div key={unitKey} className="bg-white rounded-lg border border-surface-border p-3 shadow-2xs">
                              {/* Unit (Macro Topic) Row */}
                              <div
                                onClick={() => setExpandedUnits(prev => ({ ...prev, [unitKey]: !isUnitOpen }))}
                                className="flex items-center justify-between cursor-pointer hover:opacity-85 select-none"
                              >
                                <div className="flex items-center gap-2">
                                  {isUnitOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                  <BookMarked className="w-3.5 h-3.5 text-tnpsc-brand shrink-0" />
                                  <span className="text-xs font-bold text-body-text">{u.unit}</span>
                                  <span className="text-[10px] text-body-secondary">({u.attempted} qs)</span>
                                </div>
                                <span className={`text-[11px] font-bold ${
                                  Number(u.accuracy) >= 70 ? 'text-emerald-700' :
                                  Number(u.accuracy) >= 50 ? 'text-blue-700' : 'text-red-700'
                                }`}>
                                  {u.accuracy}%
                                </span>
                              </div>

                              {/* Nested Micro Topics */}
                              {isUnitOpen && (
                                <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-2 pl-5">
                                  {u.microTopics?.map(m => (
                                    <div key={m.topic} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs py-1">
                                      <div className="flex items-center gap-1.5">
                                        <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span className="font-medium text-slate-700">{m.topic}</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="text-[11px] text-body-secondary">
                                          {m.correct}/{m.attempted} correct
                                        </span>
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                          Number(m.accuracy) >= 70 ? 'bg-emerald-50 text-emerald-700' :
                                          Number(m.accuracy) >= 50 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                                        }`}>
                                          {m.accuracy}%
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Micro-Topic X-Ray Diagnostics ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-surface-border shadow-subtle p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-surface-border">
          <div>
            <h3 className="text-base font-black text-body-text flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#635bff]" />
              Micro-Topic X-Ray Diagnostics
            </h3>
            <p className="text-xs text-body-secondary mt-0.5">
              Deep chapter scan identifying which specific chapters are pulling your Macro-Topic down.
            </p>
          </div>
          <span className="text-[11px] font-bold text-[#635bff] bg-[#f0eeff] px-3 py-1 rounded-full self-start">
            AI Chapter Diagnostics
          </span>
        </div>

        {/* X-Ray Contrast Findings */}
        {data.xray?.findings?.length > 0 ? (
          <div className="space-y-3 mb-5">
            {data.xray.findings.map((f, i) => (
              <div
                key={i}
                className="bg-gradient-to-r from-[#fff5f5] via-[#faf8ff] to-[#f5f3ff] border border-[#fed7d7] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#fee2e2] text-[#ef4444] font-black flex items-center justify-center shrink-0 mt-0.5">
                    !
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#ef4444] uppercase tracking-wider block">
                      Targeted Chapter Weakness Detected
                    </span>
                    <p className="text-sm text-[#172033] font-bold mt-0.5">
                      You are strong in <span className="text-[#059669]">{f.macro} ({f.macroAccuracy}%)</span>, but failing <span className="text-[#ef4444] underline">{f.micro} ({f.microAccuracy}%)</span>.
                    </p>
                    <span className="text-[11px] text-[#64748b]">Unit: {f.unit}</span>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/practice?micro_topic=${encodeURIComponent(f.micro)}`)}
                  className="bg-[#635bff] hover:bg-[#4f46e5] text-white text-xs font-black px-4 py-2 rounded-xl shadow-xs shrink-0 flex items-center gap-1.5 transition-all self-start sm:self-center"
                >
                  Generate Practice Set →
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 mb-5 text-xs text-[#64748b]">
            Attempt more mock questions across different subjects to unlock advanced macro vs. micro contrast diagnosis.
          </div>
        )}

        {/* Chapter Priority Focus List */}
        {data.xray?.microTopics?.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-[#172033] uppercase tracking-wider mb-2.5">
              Chapter-Level Accuracy Breakdown
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {data.xray.microTopics.slice(0, 6).map(m => {
                const isWeak = m.accuracy < 50
                return (
                  <div
                    key={m.micro_topic_name}
                    className="border border-[#e2e8f0] rounded-xl p-3 bg-white hover:border-[#c7d2fe] transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-semibold text-[#8994a7] truncate">
                          {m.macro_topic_name}
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isWeak ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {m.accuracy}%
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#172033] line-clamp-2">
                        {m.micro_topic_name}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[10px]">
                      <span className="text-[#8994a7]">
                        {m.correct}/{m.attempted} correct
                      </span>
                      <button
                        onClick={() => navigate(`/practice?micro_topic=${encodeURIComponent(m.micro_topic_name)}`)}
                        className="text-[#635bff] hover:underline font-bold"
                      >
                        Practice →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* AI Study Recommendations */}
      <div className="bg-tnpsc-brand-light rounded-2xl border border-tnpsc-brand/20 p-5">
        <h3 className="text-sm font-bold text-tnpsc-brand mb-3">AI Study Recommendations</h3>
        <ul className="space-y-2">
          {data.subjectBreakdown
            ?.filter(s => Number(s.accuracy) < 60)
            .slice(0, 3)
            .map(s => (
              <li key={s.subject} className="flex items-start gap-2 text-xs text-body-text">
                <span className="w-1.5 h-1.5 rounded-full bg-tnpsc-brand mt-1.5 shrink-0" />
                Revise <strong>{s.subject}</strong> — your accuracy is only {s.accuracy}%. Focus on fundamentals and attempt targeted practice.
              </li>
            ))
          }
          {data.avgAccuracy < 60 && (
            <li className="flex items-start gap-2 text-xs text-body-text">
              <span className="w-1.5 h-1.5 rounded-full bg-tnpsc-brand mt-1.5 shrink-0" />
              Your overall accuracy ({data.avgAccuracy}%) is below 60%. Take 1 timed mock test per week to build test-taking stamina.
            </li>
          )}
          {data.totalAttempts < 5 && (
            <li className="flex items-start gap-2 text-xs text-body-text">
              <span className="w-1.5 h-1.5 rounded-full bg-tnpsc-brand mt-1.5 shrink-0" />
              You've only completed {data.totalAttempts} attempt(s). Complete at least 10 practice sets for accurate trend analysis.
            </li>
          )}
          {data.subjectBreakdown?.filter(s => Number(s.accuracy) < 60).length === 0 && data.avgAccuracy >= 60 && (
            <li className="flex items-start gap-2 text-xs text-body-text">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 mt-1.5 shrink-0" />
              Great performance! Keep attempting mock tests and focus on current affairs to maintain your score.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
