import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, FileText, History,
  Newspaper, BellRing, BookMarked, BarChart3,
  StickyNote, Upload, Brain, ChevronLeft, ChevronRight,
  LogOut, Settings, Zap,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { cn } from '../../lib/utils'

const NAV = [
  { label: 'Dashboard',           path: '/dashboard',       icon: LayoutDashboard },
  { label: 'Practice',            path: '/practice',        icon: Brain },
  { label: 'Mock Tests',          path: '/mock-tests',      icon: Zap },
  { label: 'Previous Year Papers',path: '/papers',          icon: FileText },
  { label: 'Syllabus',            path: '/syllabus',        icon: BookMarked },
  { label: 'Analytics',           path: '/analytics',       icon: BarChart3 },
  { label: 'Current Affairs',     path: '/current-affairs', icon: Newspaper },
  { label: 'Govt Updates',        path: '/govt-updates',    icon: BellRing },
  { label: 'My Papers (BYOP)',    path: '/my-papers',       icon: Upload },
  { label: 'My Notes',            path: '/notes',           icon: StickyNote },
  { label: 'My Attempts',         path: '/my-attempts',     icon: History },
]

export function TnpscSidebar({ mobileOpen, onMobileClose }) {
  const location = useLocation()
  const navigate  = useNavigate()
  const { profile, logout } = useAuth()
  const { t, selectedExam, setSelectedExam, language, setLanguage } = useApp()
  const [collapsed, setCollapsed] = useState(false)

  // EXAM_OPTIONS comes from context but we define it locally for safety
  const exams = ['TNPSC Group 4', 'TNPSC Group 2/2A', 'TNPSC Group 1']

  const isActive = (path) =>
    path === '/dashboard'
      ? location.pathname === path
      : location.pathname.startsWith(path)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-tnpsc-card-border shrink-0',
        collapsed && 'justify-center px-2'
      )}>
        <div className="w-9 h-9 rounded-xl bg-tnpsc-brand flex items-center justify-center shadow-brand shrink-0">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-white font-bold text-sm leading-tight">Vina AI</p>
            <p className="text-tnpsc-sidebar-text text-[10px] uppercase tracking-wider">TNPSC Prep</p>
          </div>
        )}
      </div>

      {/* Exam selector */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-tnpsc-card-border shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-tnpsc-sidebar-text mb-1.5 px-1">Exam</p>
          <select
            value={selectedExam}
            onChange={e => setSelectedExam(e.target.value)}
            className="w-full bg-tnpsc-card border border-tnpsc-card-border text-white text-xs rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-tnpsc-brand cursor-pointer"
          >
            {exams.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.map(({ label, path, icon: Icon }) => {
          const active = isActive(path)
          return (
            <Link
              key={path}
              to={path}
              onClick={onMobileClose}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                collapsed && 'justify-center px-2',
                active
                  ? 'bg-tnpsc-brand text-white shadow-brand'
                  : 'text-tnpsc-sidebar-text hover:bg-tnpsc-sidebar-item hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: profile + language + collapse */}
      <div className="border-t border-tnpsc-card-border shrink-0">
        {/* Language toggle */}
        {!collapsed && (
          <div className="px-3 py-2 flex gap-2">
            {['en','ta'].map(l => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={cn(
                  'flex-1 text-[11px] font-semibold py-1 rounded-md transition-colors',
                  language === l
                    ? 'bg-tnpsc-brand text-white'
                    : 'bg-tnpsc-card text-tnpsc-sidebar-text hover:text-white'
                )}
              >
                {l === 'en' ? 'EN' : 'தமிழ்'}
              </button>
            ))}
          </div>
        )}

        {/* Profile row */}
        <div className={cn(
          'flex items-center gap-3 px-3 py-3',
          collapsed && 'justify-center'
        )}>
          <div className="w-8 h-8 rounded-full bg-tnpsc-brand/30 border border-tnpsc-brand/50 flex items-center justify-center text-white font-semibold text-xs shrink-0">
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{profile?.full_name ?? 'User'}</p>
              <p className="text-tnpsc-sidebar-text text-[10px] truncate">{profile?.email ?? ''}</p>
            </div>
          )}
          {!collapsed && (
            <div className="flex gap-1">
              <Link
                to="/profile"
                className="p-1.5 rounded-md text-tnpsc-sidebar-text hover:text-white hover:bg-tnpsc-sidebar-item transition-colors"
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-tnpsc-sidebar-text hover:text-red-400 hover:bg-tnpsc-sidebar-item transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden md:flex w-full items-center justify-center py-2 text-tnpsc-sidebar-text hover:text-white border-t border-tnpsc-card-border transition-colors text-xs gap-1"
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <><ChevronLeft className="w-3.5 h-3.5" /><span>Collapse</span></>
          }
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden md:flex flex-col bg-tnpsc-sidebar border-r border-tnpsc-card-border h-screen sticky top-0 overflow-hidden transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}>
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onMobileClose} />
          <aside className="relative w-64 bg-tnpsc-sidebar border-r border-tnpsc-card-border h-full animate-slide-in-left overflow-hidden">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
