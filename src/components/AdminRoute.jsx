import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Loader2, ShieldAlert } from 'lucide-react'

export function AdminRoute({ children }) {
  const { user, profile, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-bg">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-body-secondary font-medium text-sm">Authenticating admin access...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-bg p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-card border border-surface-border p-6 text-center">
          <div className="w-12 h-12 bg-red-100 text-status-error rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-body-text mb-2">Access Denied</h2>
          <p className="text-body-secondary text-sm mb-6">
            You do not have administrative privileges to access this page. Signed in as ({profile?.email || user.email}).
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Return to User Dashboard
          </a>
        </div>
      </div>
    )
  }

  return children
}
