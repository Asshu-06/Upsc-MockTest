import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, PlusCircle, Upload, BarChart3, Settings } from 'lucide-react'

export function Sidebar() {
  const location = useLocation()
  const isActive = (path) => location.pathname === path

  const navItems = [
    { label: 'Overview', path: '/admin', icon: LayoutDashboard },
    { label: 'All Papers', path: '/admin/papers', icon: FileText },
    { label: 'Create Paper', path: '/admin/papers/create', icon: PlusCircle },
    { label: 'Attempt Reports', path: '/admin/attempts', icon: BarChart3 }
  ]

  return (
    <aside className="w-64 bg-white border-r border-surface-border min-h-[calc(100vh-4rem)] p-4 hidden md:block">
      <div className="space-y-1">
        <p className="px-3 text-xs font-semibold text-body-secondary uppercase tracking-wider mb-2">
          Admin Portal
        </p>
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary text-white shadow-subtle'
                  : 'text-body-secondary hover:bg-slate-50 hover:text-body-text'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </aside>
  )
}
