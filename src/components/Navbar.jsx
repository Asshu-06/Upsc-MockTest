import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { BookOpen, LogOut, User, LayoutDashboard, FileText, History, Shield, Menu, X } from 'lucide-react'

export function Navbar() {
  const { user, profile, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-white border-b border-surface-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center">
            <Link to={user ? (isAdmin ? "/admin" : "/dashboard") : "/"} className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary text-white rounded-lg flex items-center justify-center font-bold shadow-subtle">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg text-primary tracking-tight block leading-tight">UPSC PrepHub</span>
                <span className="text-[10px] text-body-secondary font-medium uppercase tracking-wider block">Question Practice</span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            {user && !isAdmin && (
              <div className="hidden md:ml-8 md:flex md:space-x-4">
                <Link
                  to="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/dashboard') ? 'bg-primary-light text-primary' : 'text-body-secondary hover:text-body-text'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/papers"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/papers') ? 'bg-primary-light text-primary' : 'text-body-secondary hover:text-body-text'
                  }`}
                >
                  Question Papers
                </Link>
                <Link
                  to="/my-attempts"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/my-attempts') ? 'bg-primary-light text-primary' : 'text-body-secondary hover:text-body-text'
                  }`}
                >
                  My Attempts
                </Link>
              </div>
            )}

            {user && isAdmin && (
              <div className="hidden md:ml-8 md:flex md:space-x-4">
                <Link
                  to="/admin"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin') ? 'bg-primary-light text-primary' : 'text-body-secondary hover:text-body-text'
                  }`}
                >
                  Admin Overview
                </Link>
                <Link
                  to="/admin/papers"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/papers') ? 'bg-primary-light text-primary' : 'text-body-secondary hover:text-body-text'
                  }`}
                >
                  Manage Papers
                </Link>
                <Link
                  to="/admin/attempts"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/attempts') ? 'bg-primary-light text-primary' : 'text-body-secondary hover:text-body-text'
                  }`}
                >
                  Attempt Reports
                </Link>
              </div>
            )}
          </div>

          {/* User Menu / Actions */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-right">
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-surface-border text-primary flex items-center justify-center font-semibold text-xs">
                    {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="text-xs text-left">
                    <span className="font-semibold text-body-text block truncate max-w-[120px]">
                      {profile?.full_name || 'User'}
                    </span>
                    <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                      isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {profile?.role || 'user'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 text-body-secondary hover:text-status-error hover:bg-red-50 rounded-lg transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-body-secondary hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-subtle"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-body-secondary hover:text-body-text focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-surface-border bg-white px-4 pt-2 pb-4 space-y-2">
          {user ? (
            <>
              <div className="py-2 border-b border-surface-border mb-2 flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-slate-100 text-primary flex items-center justify-center font-bold text-sm">
                  {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-body-text">{profile?.full_name}</p>
                  <p className="text-xs text-body-secondary">{profile?.email}</p>
                </div>
              </div>
              {!isAdmin ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-body-text hover:bg-slate-50"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/papers"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-body-text hover:bg-slate-50"
                  >
                    Question Papers
                  </Link>
                  <Link
                    to="/my-attempts"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-body-text hover:bg-slate-50"
                  >
                    My Attempts
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-body-text hover:bg-slate-50"
                  >
                    Admin Overview
                  </Link>
                  <Link
                    to="/admin/papers"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-body-text hover:bg-slate-50"
                  >
                    Manage Papers
                  </Link>
                  <Link
                    to="/admin/attempts"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-body-text hover:bg-slate-50"
                  >
                    Attempt Reports
                  </Link>
                </>
              )}
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogout()
                }}
                className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-status-error hover:bg-red-50"
              >
                Sign Out
              </button>
            </>
          ) : (
            <div className="space-y-2 pt-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center w-full px-4 py-2 border border-surface-border text-body-text rounded-lg text-sm font-medium"
              >
                Log In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center w-full px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
