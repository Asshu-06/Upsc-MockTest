import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, HelpCircle, BookMarked, Newspaper,
  BellRing, Users, BarChart3, Brain, LogOut, Settings,
  ChevronDown, ChevronRight, BookOpen, Upload, Zap,
  ShieldCheck, ClipboardList, Menu, X,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/utils'

const SECTIONS = [
  {
    label: null,
    items: [
      { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { label: 'Papers / PYQs',   path: '/admin/papers',        icon: FileText },
      { label: 'Questions',       path: '/admin/questions',      icon: HelpCircle },
      { label: 'PDF Import',      path: '/admin/pdf-import',     icon: Upload },
      { label: 'Syllabus',        path: '/admin/syllabus',       icon: BookMarked },
      { label: 'Quick Recall',    path: '/admin/recall',         icon: Brain },
    ],
  },
  {
    label: 'LIVE CONTENT',
    items: [
      { label: 'Current Affairs',  path: '/admin/current-affairs',   icon: Newspaper },
      { label: 'Govt Notifications',path: '/admin/notifications',     icon: BellRing },
    ],
  },
  {
    label: 'PLATFORM',
    items: [
      { label: 'Users',          path: '/admin/users',      icon: Users },
      { label: 'Analytics',      path: '/admin/analytics',  icon: BarChart3 },
      { label: 'Attempts',       path: '/admin/attempts',   icon: ClipboardList },
    ],
  },
]

function NavItem({ item, collapsed }) {
  const location = useLocation()
  const active = item.exact
    ? location.pathname === item.path
    : location.pathname.startsWith(item.path)
  const Icon = item.icon

  return (
    <Link
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
        collapsed && 'justify-center px-2',
        active
          ? 'bg-tnpsc-brand text-white shadow-brand'
          : 'text-tnpsc-sidebar-text hover:bg-tnpsc-sidebar-item hover:text-white'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}

export function AdminSidebar({ mobileOpen, onMobileClose }) {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const content = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-tnpsc-card-border shrink-0',
        collapsed && 'justify-center px-2'
      )}>
        <div className="w-9 h-9 rounded-xl bg-tnpsc-brand flex items-center justify-center shadow-brand shrink-0">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-bold text-sm leading-tight">Vina AI</p>
            <p className="text-tnpsc-sidebar-text text-[10px] uppercase tracking-wider">Admin Panel</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {SECTIONS.map((section, si) => (
          <div key={si}>
            {section.label && !collapsed && (
              <p className="px-3 text-[10px] font-bold text-tnpsc-sidebar-text uppercase tracking-widest mb-1">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavItem key={item.path} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-tnpsc-card-border shrink-0">
        <div className={cn(
          'flex items-center gap-3 px-3 py-3',
          collapsed && 'justify-center'
        )}>
          <div className="w-8 h-8 rounded-full bg-tnpsc-brand/30 border border-tnpsc-brand/50 flex items-center justify-center text-white font-semibold text-xs shrink-0">
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? 'A'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{profile?.full_name ?? 'Admin'}</p>
                <p className="text-tnpsc-sidebar-text text-[10px]">{profile?.admin_role ?? profile?.role ?? 'admin'}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 rounded-md text-tnpsc-sidebar-text hover:text-red-400 hover:bg-tnpsc-sidebar-item transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
        {/* Collapse toggle desktop */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden md:flex w-full items-center justify-center py-2 text-tnpsc-sidebar-text hover:text-white border-t border-tnpsc-card-border transition-colors text-xs gap-1"
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <><ChevronDown className="w-3.5 h-3.5" /><span>Collapse</span></>
          }
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className={cn(
        'hidden md:flex flex-col bg-tnpsc-sidebar border-r border-tnpsc-card-border h-screen sticky top-0 overflow-hidden transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}>
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onMobileClose} />
          <aside className="relative w-64 bg-tnpsc-sidebar border-r border-tnpsc-card-border h-full animate-slide-in-left overflow-hidden">
            {content}
          </aside>
        </div>
      )}
    </>
  )
}
