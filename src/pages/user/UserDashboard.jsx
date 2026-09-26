import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Flame, Brain, Zap, FileText, BookMarked, Newspaper,
  BellRing, StickyNote, Upload, ArrowRight, Loader2,
  Trophy, Target, Clock, CheckCircle2, BookOpen,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { supabase } from '../../lib/supabase'
import { paperService } from '../../services/paperService'
import { attemptService } from '../../services/attemptService'
import { formatDate } from '../../lib/utils'
import { QuickRecall } from '../../components/tnpsc/QuickRecall'
import { InteractiveSyllabus } from '../../components/tnpsc/InteractiveSyllabus'

export function UserDashboard() {
  const { user, profile } = useAuth()
  const { selectedExam, t, toast } = useApp()
  const navigate = useNavigate()

  const [loading, setLoading]               = useState(true)
  const [streak, setStreak]                 = useState(null)
  const [recentAttempts, setRecentAttempts] = useState([])
  const [recentAffairs, setRecentAffairs]   = useState([])
  const [recentNotifs, setRecentNotifs]     = useState([])
  const [pinnedNotes, setPinnedNotes]       = useState([])
  const [activeSession, setActiveSession]   = useState(null)

  const [showRecall, setShowRecall]     = useState(false)
  const [showSyllabus, setShowSyllabus] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    loadAll()
  }, [user?.id])

  async function loadAll() {
    setLoading(true)
    try {
      const [
        streakRes, attemptsRes, affairsRes, notifsRes, notesRes, sessionRes,
      ] = await Promise.allSettled([
        supabase.from('user_streaks').select('*').eq('user_id', user.id).maybeSingle(),
        attemptService.getUserAttempts(user.id),
        supabase.from('current_affairs').select('id,title,category,published_at,read_time')
          .eq('is_active', true).order('published_at', { ascending: false }).limit(4),
        supabase.from('government_notifications').select('id,title,department,status,application_end')
          .order('published_at', { ascending: false }).limit(3),
        supabase.from('user_notes').select('*').eq('user_id', user.id)
          .eq('is_pinned', true).order('updated_at', { ascending: false }).limit(3),
        supabase.from('exam_sessions').select('*').eq('user_id', user.id)
          .eq('status', 'active').order('last_saved_at', { ascending: false }).limit(1),
      ])

      if (streakRes.status === 'fulfilled') setStreak(streakRes.value.data)
      if (attemptsRes.status === 'fulfilled') setRecentAttempts(attemptsRes.value.slice(0, 5))
      if (affairsRes.status === 'fulfilled')  setRecentAffairs(affairsRes.value.data ?? [])
      if (notifsRes.status === 'fulfilled')   setRecentNotifs(notifsRes.value.data ?? [])
      if (notesRes.status === 'fulfilled')    setPinnedNotes(notesRes.value.data ?? [])
      if (sessionRes.status === 'fulfilled')  setActiveSession(sessionRes.value.data?.[0] ?? null)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const completedAttempts = recentAttempts.filter(a => a.status === 'completed')
  const avgAccuracy = completedAttempts.length
    ? (completedAttempts.reduce((s, a) => s + Number(a.accuracy ?? 0), 0) / completedAttempts.length).toFixed(1)
    : '—'

  async function handleDiscardSession() {
    if (!activeSession) return
    if (!window.confirm('Discard this exam session? Your progress will be marked as abandoned.')) return
    await supabase.from('exam_sessions').update({ status: 'discarded' }).eq('id', activeSession.id)
    setActiveSession(null)
    toast.info('Exam session discarded.')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header greeting ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-body-secondary font-medium uppercase tracking-wider">{selectedExam}</p>
          <h1 className="text-2xl font-bold text-body-text mt-0.5">
            {t('welcome')}, {profile?.full_name?.split(' ')[0] ?? 'Aspirant'} 👋
          </h1>
        </div>
        {/* Streak pill */}
        <div className="flex items-center gap-2 bg-white border border-surface-border rounded-full px-4 py-2 shadow-subtle">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-body-text">{streak?.current_streak ?? 0}</span>
          <span className="text-xs text-body-secondary">day streak</span>
          <span className="w-px h-4 bg-surface-border" />
          <Trophy className="w-4 h-4 text-tnpsc-brand" />
          <span className="text-sm font-bold text-body-text">{streak?.recall_points ?? 0}</span>
          <span className="text-xs text-body-secondary">pts</span>
        </div>
      </div>

      {/* ── Resume session banner ─────────────────────────────────── */}
      {activeSession && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-900">Mock test in progress</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {Object.keys(activeSession.answers_json ?? {}).length} answered ·{' '}
                {activeSession.time_remaining_sec != null
                  ? `${Math.floor(activeSession.time_remaining_sec / 60)}m remaining`
                  : 'session saved'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => navigate(`/exam/${activeSession.paper_id}?session=${activeSession.id}`)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors"
            >
              Resume Exam →
            </button>
            <button
              onClick={handleDiscardSession}
              className="px-4 py-2 bg-white border border-amber-300 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-50 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── Quick stat cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tests Completed', value: completedAttempts.length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Avg Accuracy',    value: `${avgAccuracy}%`,         icon: Target,       color: 'text-tnpsc-brand bg-tnpsc-brand-light' },
          { label: 'Highest Streak',  value: streak?.highest_streak ?? 0, icon: Flame,     color: 'text-orange-600 bg-orange-50' },
          { label: 'Recall Points',   value: streak?.recall_points ?? 0,  icon: Trophy,    color: 'text-yellow-600 bg-yellow-50' },
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

      {/* ── Main grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-subtle">
            <h2 className="text-sm font-bold text-body-text mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Quick Recall',    icon: Brain,      action: () => setShowRecall(true),    color: 'bg-tnpsc-brand-light text-tnpsc-brand' },
                { label: 'Custom Practice', icon: BookOpen,   action: () => navigate('/practice'),  color: 'bg-emerald-50 text-emerald-700' },
                { label: 'Full Mock Test',  icon: Zap,        action: () => navigate('/mock-tests'), color: 'bg-orange-50 text-orange-700' },
                { label: 'PYQ Papers',      icon: FileText,   action: () => navigate('/papers'),    color: 'bg-blue-50 text-blue-700' },
                { label: 'Syllabus',        icon: BookMarked, action: () => setShowSyllabus(true),  color: 'bg-purple-50 text-purple-700' },
                { label: 'Upload Paper',    icon: Upload,     action: () => navigate('/my-papers'), color: 'bg-slate-100 text-slate-700' },
              ].map(({ label, icon: Icon, action, color }) => (
                <button
                  key={label}
                  onClick={action}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity ${color}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-left leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Current Affairs */}
          <div className="bg-white rounded-2xl border border-surface-border shadow-subtle overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-tnpsc-brand" />
                <h2 className="text-sm font-bold text-body-text">Current Affairs</h2>
              </div>
              <Link to="/current-affairs" className="text-xs text-tnpsc-brand font-semibold hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recentAffairs.length === 0 ? (
              <p className="text-xs text-body-secondary text-center py-8">No current affairs yet. Admin can add them.</p>
            ) : (
              <div className="divide-y divide-surface-border">
                {recentAffairs.map(a => (
                  <Link
                    key={a.id}
                    to={`/current-affairs?id=${a.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="min-w-0 mr-3">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-tnpsc-brand bg-tnpsc-brand-light rounded px-1.5 py-0.5 mb-1">
                        {a.category}
                      </span>
                      <p className="text-xs font-semibold text-body-text truncate">{a.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-body-secondary">
                      <span className="text-[10px]">{a.read_time}m</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Govt Notifications */}
          <div className="bg-white rounded-2xl border border-surface-border shadow-subtle overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-tnpsc-brand" />
                <h2 className="text-sm font-bold text-body-text">Govt Notifications</h2>
              </div>
              <Link to="/govt-updates" className="text-xs text-tnpsc-brand font-semibold hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recentNotifs.length === 0 ? (
              <p className="text-xs text-body-secondary text-center py-8">No notifications yet.</p>
            ) : (
              <div className="divide-y divide-surface-border">
                {recentNotifs.map(n => {
                  const statusColor = {
                    active:      'bg-green-100 text-green-700',
                    upcoming:    'bg-blue-100 text-blue-700',
                    closed:      'bg-slate-100 text-slate-600',
                    results_out: 'bg-purple-100 text-purple-700',
                  }[n.status] ?? 'bg-slate-100 text-slate-600'

                  return (
                    <Link
                      key={n.id}
                      to={`/govt-updates?id=${n.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="min-w-0 mr-3">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-body-secondary bg-slate-100 rounded px-1.5 py-0.5 mb-1">
                          {n.department}
                        </span>
                        <p className="text-xs font-semibold text-body-text truncate">{n.title}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 shrink-0 ${statusColor}`}>
                        {n.status?.replace('_', ' ')}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-6">

          {/* Consistency / Streak card */}
          <div className="bg-gradient-to-br from-tnpsc-brand to-tnpsc-brand-dark rounded-2xl p-5 text-white shadow-brand">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-orange-300" />
              <span className="font-bold text-sm">Your Streak</span>
            </div>
            <p className="text-4xl font-black">{streak?.current_streak ?? 0}</p>
            <p className="text-sm text-white/70 mt-1">consecutive correct answers</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="bg-white/10 rounded-xl py-2">
                <p className="text-lg font-bold">{streak?.highest_streak ?? 0}</p>
                <p className="text-[10px] text-white/70">Best streak</p>
              </div>
              <div className="bg-white/10 rounded-xl py-2">
                <p className="text-lg font-bold">{streak?.questions_answered ?? 0}</p>
                <p className="text-[10px] text-white/70">Answered</p>
              </div>
            </div>
            <button
              onClick={() => setShowRecall(true)}
              className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
            >
              Start Quick Recall →
            </button>
          </div>

          {/* Pinned Notes */}
          <div className="bg-white rounded-2xl border border-surface-border shadow-subtle overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-yellow-500" />
                <h2 className="text-sm font-bold text-body-text">Pinned Notes</h2>
              </div>
              <Link to="/notes" className="text-xs text-tnpsc-brand font-semibold hover:underline">
                All notes
              </Link>
            </div>
            {pinnedNotes.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-xs text-body-secondary">No pinned notes yet.</p>
                <Link to="/notes" className="text-xs text-tnpsc-brand font-semibold mt-2 inline-block hover:underline">
                  Create a note →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-surface-border">
                {pinnedNotes.map(n => (
                  <Link
                    key={n.id}
                    to={`/notes?id=${n.id}`}
                    className="block px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-xs font-semibold text-body-text truncate">{n.title}</p>
                    {n.content && (
                      <p className="text-[11px] text-body-secondary mt-0.5 line-clamp-2">{n.content}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent attempts */}
          <div className="bg-white rounded-2xl border border-surface-border shadow-subtle overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
              <h2 className="text-sm font-bold text-body-text">Recent Attempts</h2>
              <Link to="/my-attempts" className="text-xs text-tnpsc-brand font-semibold hover:underline">
                All
              </Link>
            </div>
            {completedAttempts.length === 0 ? (
              <p className="text-xs text-body-secondary text-center py-6">No completed attempts yet.</p>
            ) : (
              <div className="divide-y divide-surface-border">
                {completedAttempts.slice(0, 3).map(a => (
                  <Link
                    key={a.id}
                    to={`/attempt/${a.id}/result`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 mr-2">
                      <p className="text-xs font-semibold text-body-text truncate">
                        {a.papers?.title ?? 'Paper'}
                      </p>
                      <p className="text-[10px] text-body-secondary">{formatDate(a.submitted_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-tnpsc-brand">{Number(a.score ?? 0).toFixed(1)}</p>
                      <p className="text-[10px] text-body-secondary">{Number(a.accuracy ?? 0).toFixed(1)}%</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {showRecall   && <QuickRecall onClose={() => { setShowRecall(false); loadAll() }} />}
      {showSyllabus && <InteractiveSyllabus onClose={() => setShowSyllabus(false)} />}
    </div>
  )
}
