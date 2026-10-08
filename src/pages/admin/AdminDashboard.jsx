import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, HelpCircle, Users, BarChart3, Newspaper, BellRing,
  Brain, BookMarked, PlusCircle, Loader2, AlertCircle,
  CheckCircle2, Info, AlertTriangle, TrendingUp, FileJson,
} from 'lucide-react'
import { adminStatsService } from '../../services/adminService'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'

const STAT_CARDS = (s) => [
  { label: 'Total Papers',    value: s.totalPapers,    sub: `${s.publishedPapers} published · ${s.draftPapers} drafts`, icon: FileText,  color: 'text-blue-700 bg-blue-50' },
  { label: 'Questions',       value: s.totalQuestions, sub: 'In question bank',                                          icon: HelpCircle, color: 'text-indigo-700 bg-indigo-50' },
  { label: 'Current Affairs', value: s.totalAffairs,   sub: `${s.publishedAffairs} published`,                          icon: Newspaper,  color: 'text-tnpsc-brand bg-tnpsc-brand-light' },
  { label: 'Notifications',   value: s.totalNotifs,    sub: `${s.activeNotifs} active`,                                  icon: BellRing,   color: 'text-green-700 bg-green-50' },
  { label: 'Syllabus Topics', value: s.totalTopics,    sub: `${s.totalUnits} units`,                                     icon: BookMarked, color: 'text-purple-700 bg-purple-50' },
  { label: 'Recall Questions',value: s.totalRecall,    sub: `${s.activeRecall} active`,                                  icon: Brain,      color: 'text-orange-700 bg-orange-50' },
  { label: 'Total Users',     value: s.totalUsers,     sub: `${s.newUsersWeek} new this week`,                           icon: Users,      color: 'text-emerald-700 bg-emerald-50' },
  { label: 'Attempts',        value: s.totalAttempts,  sub: `${s.completedAttempts} completed · avg ${s.avgScore}%`,     icon: BarChart3,  color: 'text-slate-700 bg-slate-100' },
]

const QUICK_ACTIONS = [
  { label: '+ Current Affair',    path: '/admin/current-affairs?action=new', color: 'bg-tnpsc-brand text-white hover:bg-tnpsc-brand-hover' },
  { label: '+ Notification',      path: '/admin/notifications?action=new',   color: 'bg-green-600 text-white hover:bg-green-700' },
  { label: '+ Recall Question',   path: '/admin/recall?action=new',          color: 'bg-orange-600 text-white hover:bg-orange-700' },
  { label: '+ Syllabus Unit',     path: '/admin/syllabus',                   color: 'bg-purple-600 text-white hover:bg-purple-700' },
  { label: '+ Paper',             path: '/admin/papers/create',              color: 'bg-blue-600 text-white hover:bg-blue-700' },
  { label: 'PDF to JSON',         path: '/admin/pdf-to-json',                 color: 'bg-indigo-600 text-white hover:bg-indigo-700' },
  { label: 'Attempt Reports',     path: '/admin/attempts',                   color: 'bg-white border border-surface-border text-body-text hover:bg-slate-50' },
]

const ALERT_ICON = { error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />, warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />, info: <Info className="w-4 h-4 text-blue-500 shrink-0" /> }
const ALERT_BG  = { error: 'bg-red-50 border-red-200', warning: 'bg-amber-50 border-amber-200', info: 'bg-blue-50 border-blue-200' }

export function AdminDashboard() {
  const { profile } = useAuth()
  const { toast }   = useApp()
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setStats(await adminStatsService.getAll()) }
    catch (err) { toast.error('Failed to load stats: ' + err.message) }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-body-text">Admin Dashboard</h1>
          <p className="text-xs text-body-secondary mt-0.5">
            Welcome, {profile?.full_name ?? 'Admin'} · {profile?.admin_role ?? profile?.role}
          </p>
        </div>
        <button onClick={load} className="text-xs text-tnpsc-brand hover:underline font-semibold">Refresh</button>
      </div>

      {/* Alerts */}
      {stats?.alerts?.length > 0 && (
        <div className="space-y-2">
          {stats.alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${ALERT_BG[a.type]}`}>
              {ALERT_ICON[a.type]}
              <span className="text-body-text">{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STAT_CARDS(stats).map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-surface-border p-4 shadow-subtle">
              <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-body-text">{value ?? 0}</p>
              <p className="text-xs font-semibold text-body-text mt-0.5">{label}</p>
              <p className="text-[10px] text-body-secondary mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-surface-border shadow-subtle p-5">
        <h2 className="text-sm font-bold text-body-text mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ label, path, color }) => (
            <Link key={path} to={path}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${color}`}
            >{label}</Link>
          ))}
        </div>
      </div>

      {/* Content sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { title: 'Papers',           path: '/admin/papers',          icon: FileText,  desc: 'Create, import and publish question papers' },
          { title: 'Questions',        path: '/admin/questions',       icon: HelpCircle,desc: 'Manage the full question bank' },
          { title: 'PDF to JSON',      path: '/admin/pdf-to-json',      icon: FileJson,   desc: 'Use text_extractor OCR to create downloadable question JSON' },
          { title: 'Current Affairs',  path: '/admin/current-affairs', icon: Newspaper, desc: 'Add and publish current affairs articles' },
          { title: 'Govt Notifications',path: '/admin/notifications',  icon: BellRing,  desc: 'Manage vacancies and official notifications' },
          { title: 'Syllabus',         path: '/admin/syllabus',        icon: BookMarked,desc: 'Build the exam syllabus hierarchy' },
          { title: 'Quick Recall',     path: '/admin/recall',          icon: Brain,     desc: 'Manage recall question bank' },
          { title: 'Users',            path: '/admin/users',           icon: Users,     desc: 'View users, manage roles' },
          { title: 'Analytics',        path: '/admin/analytics',       icon: BarChart3, desc: 'Platform-wide performance analytics' },
          { title: 'Attempt Reports',  path: '/admin/attempts',        icon: TrendingUp,desc: 'Inspect all user exam attempts' },
        ].map(({ title, path, icon: Icon, desc }) => (
          <Link key={path} to={path}
            className="bg-white p-5 rounded-2xl border border-surface-border shadow-subtle hover:shadow-card hover:border-tnpsc-brand/30 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-tnpsc-brand-light flex items-center justify-center mb-3 group-hover:bg-tnpsc-brand transition-colors">
              <Icon className="w-4 h-4 text-tnpsc-brand group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-sm font-bold text-body-text group-hover:text-tnpsc-brand transition-colors">{title}</h3>
            <p className="text-xs text-body-secondary mt-1">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
