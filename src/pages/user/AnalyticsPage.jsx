import React, { useState, useEffect } from 'react'
import {
  BarChart3, Target, CheckCircle2, XCircle, Minus,
  TrendingUp, Loader2, AlertCircle, BookOpen, Award,
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { analyticsService } from '../../services/tnpscService'

export function AnalyticsPage() {
  const { user } = useAuth()
  const { selectedExam } = useApp()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

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

      {/* Subject breakdown */}
      {data.subjectBreakdown?.length > 0 && (
        <div className="bg-white rounded-2xl border border-surface-border shadow-subtle p-5">
          <h3 className="text-sm font-bold text-body-text mb-4">Subject Breakdown</h3>
          <div className="space-y-3">
            {data.subjectBreakdown.map(s => (
              <div key={s.subject}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-body-text">{s.subject}</span>
                  <span className="text-body-secondary">{s.accuracy}% accuracy · {s.attempted} qs</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${s.accuracy}%`,
                      background: Number(s.accuracy) >= 70 ? '#16a34a' : Number(s.accuracy) >= 50 ? '#635BFF' : '#dc2626',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
