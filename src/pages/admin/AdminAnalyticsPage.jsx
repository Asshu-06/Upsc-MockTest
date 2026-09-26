import React, { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Users, CheckCircle2, XCircle, Minus, Loader2 } from 'lucide-react'
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

      {/* Subject breakdown */}
      {data.subjects?.length > 0 && (
        <div className="bg-white rounded-2xl border border-surface-border shadow-subtle p-5">
          <h3 className="text-sm font-bold text-body-text mb-4">Subject Accuracy Breakdown</h3>
          <div className="space-y-3">
            {data.subjects.map(s => (
              <div key={s.subject}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-body-text">{s.subject}</span>
                  <span className="text-body-secondary">{s.accuracy}% · {s.attempts.toLocaleString()} attempts</span>
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

      {/* Avg score */}
      <div className="bg-tnpsc-brand-light rounded-2xl border border-tnpsc-brand/20 p-5">
        <h3 className="text-sm font-bold text-tnpsc-brand mb-1">Platform Average Score</h3>
        <p className="text-4xl font-black text-tnpsc-brand">{data.avgScore}%</p>
        <p className="text-xs text-body-secondary mt-1">Across all {data.totalAttempts} completed attempts</p>
      </div>
    </div>
  )
}
