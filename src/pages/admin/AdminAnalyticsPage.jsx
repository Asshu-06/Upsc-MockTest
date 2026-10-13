import React, { useState, useEffect } from 'react'
import {
  BarChart3, TrendingUp, Users, CheckCircle2, XCircle, Minus, Loader2,
  ChevronDown, ChevronRight, Layers, Tag, BookMarked
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { adminAnalyticsService } from '../../services/adminService'
import { useApp } from '../../contexts/AppContext'

export function AdminAnalyticsPage() {
  const { toast } = useApp()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedSubjects, setExpandedSubjects] = useState({})
  const [expandedUnits, setExpandedUnits]       = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setData(await adminAnalyticsService.get()) }
    catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>

  if (!data?.hasData) return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-tnpsc-brand" />
        <h1 className="text-xl font-bold text-body-text">Platform Analytics</h1>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-surface-border p-5 shadow-subtle">
          <p className="text-2xl font-bold text-body-text">{data?.totalUsers ?? 0}</p>
          <p className="text-sm text-body-secondary mt-1">Total Students</p>
        </div>
        <div className="bg-white rounded-xl border border-surface-border p-5 shadow-subtle">
          <p className="text-2xl font-bold text-body-text">{data?.newUsersWeek ?? 0}</p>
          <p className="text-sm text-body-secondary mt-1">New This Week</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-surface-border p-12 text-center">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-body-secondary font-semibold">No attempt data yet</p>
        <p className="text-xs text-body-secondary mt-1">Analytics will populate once students complete attempts.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-tnpsc-brand" />
          <div>
            <h1 className="text-xl font-bold text-body-text">Platform Analytics</h1>
            <p className="text-xs text-body-secondary">Based on {data.totalAttempts} completed attempts</p>
          </div>
        </div>
        <button onClick={load} className="text-xs text-tnpsc-brand hover:underline font-semibold">Refresh</button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Students',  value: data.totalUsers,     icon: Users,         color: 'text-tnpsc-brand bg-tnpsc-brand-light' },
          { label: 'New This Week',   value: data.newUsersWeek,   icon: TrendingUp,    color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Total Attempts',  value: data.totalAttempts,  icon: BarChart3,     color: 'text-blue-700 bg-blue-50' },
          { label: 'Avg Accuracy',    value: `${data.avgAccuracy}%`, icon: CheckCircle2, color: 'text-purple-700 bg-purple-50' },
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

      {/* Error breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Correct',  value: data.totalCorrect,  color: 'bg-emerald-50 border-emerald-200', textColor: 'text-emerald-700', icon: CheckCircle2 },
          { label: 'Wrong',    value: data.totalWrong,    color: 'bg-red-50 border-red-200',         textColor: 'text-red-600',     icon: XCircle },
          { label: 'Skipped',  value: data.totalSkipped,  color: 'bg-slate-50 border-slate-200',     textColor: 'text-slate-600',   icon: Minus },
        ].map(({ label, value, color, textColor, icon: Icon }) => (
          <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
            <Icon className={`w-6 h-6 mx-auto mb-2 ${textColor}`} />
            <p className="text-xl font-bold text-body-text">{value.toLocaleString()}</p>
            <p className="text-xs text-body-secondary">{label}</p>
          </div>
        ))}
      </div>

      {/* Daily trend */}
      {data.trend?.length > 1 && (
        <div className="bg-white rounded-2xl border border-surface-border shadow-subtle p-5">
          <h3 className="text-sm font-bold text-body-text mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-tnpsc-brand" /> Daily Attempt Trend (Last 14 days)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" domain={[0,100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="attempts" fill="#635BFF" opacity={0.7} name="Attempts" />
              <Line yAxisId="right" type="monotone" dataKey="accuracy" stroke="#16a34a" strokeWidth={2} dot={false} name="Accuracy %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Subject, Unit & Micro Topic Breakdown */}
      {data.subjects?.length > 0 && (
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
              Platform Topics
            </span>
          </div>

          <div className="space-y-3">
            {data.subjects.map(s => {
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
                          {s.attempts.toLocaleString()} attempts
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
                          const isUnitOpen = expandedUnits[unitKey] !== false
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

      {/* Avg score */}
      <div className="bg-tnpsc-brand-light rounded-2xl border border-tnpsc-brand/20 p-5">
        <h3 className="text-sm font-bold text-tnpsc-brand mb-1">Platform Average Score</h3>
        <p className="text-4xl font-black text-tnpsc-brand">{data.avgScore}%</p>
        <p className="text-xs text-body-secondary mt-1">Across all {data.totalAttempts} completed attempts</p>
      </div>
    </div>
  )
}
