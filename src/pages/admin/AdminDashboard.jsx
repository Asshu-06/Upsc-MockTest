import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { paperService } from '../../services/paperService'
import { FileText, CheckCircle2, Clock, HelpCircle, Users, PlusCircle, Upload, Loader2, ArrowRight } from 'lucide-react'

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalPapers: 0,
    publishedPapers: 0,
    draftPapers: 0,
    totalQuestions: 0,
    totalAttempts: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await paperService.getAdminStats()
        setStats(data)
      } catch (err) {
        console.error('Failed to load admin stats:', err)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Loading administrative overview...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-body-text">Admin Control Dashboard</h1>
          <p className="text-xs text-body-secondary mt-1">Manage question papers, structured questions, and view user attempt analytics</p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/admin/papers/create"
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-subtle transition-colors flex items-center space-x-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Paper</span>
          </Link>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Papers */}
        <div className="bg-white p-5 rounded-xl border border-surface-border shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-body-secondary uppercase">Total Papers</span>
            <div className="w-9 h-9 bg-blue-50 text-primary rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-body-text">{stats.totalPapers}</div>
          <div className="text-[11px] text-body-secondary">
            <span className="text-emerald-700 font-bold">{stats.publishedPapers} Published</span> · <span className="text-amber-700 font-bold">{stats.draftPapers} Drafts</span>
          </div>
        </div>

        {/* Total Questions */}
        <div className="bg-white p-5 rounded-xl border border-surface-border shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-body-secondary uppercase">Total Questions</span>
            <div className="w-9 h-9 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-body-text">{stats.totalQuestions}</div>
          <div className="text-[11px] text-body-secondary">Indexed across papers</div>
        </div>

        {/* Total Attempts */}
        <div className="bg-white p-5 rounded-xl border border-surface-border shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-body-secondary uppercase">User Attempts</span>
            <div className="w-9 h-9 bg-emerald-50 text-status-success rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-body-text">{stats.totalAttempts}</div>
          <div className="text-[11px] text-body-secondary">Total exams taken</div>
        </div>

        {/* Action Shortcut */}
        <div className="bg-gradient-to-br from-primary-light to-blue-50 p-5 rounded-xl border border-blue-200 shadow-card flex flex-col justify-between">
          <div className="text-xs font-bold uppercase text-primary">Quick Import</div>
          <p className="text-xs text-body-secondary my-1">Import structured questions via JSON or CSV file</p>
          <Link
            to="/admin/papers"
            className="mt-2 text-xs font-bold text-primary hover:underline flex items-center space-x-1"
          >
            <span>Select Paper to Import →</span>
          </Link>
        </div>
      </div>

      {/* Admin Quick Nav Menu Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/admin/papers"
          className="bg-white p-6 rounded-xl border border-surface-border shadow-card hover:shadow-md transition-shadow group space-y-3"
        >
          <div className="w-10 h-10 bg-blue-50 text-primary rounded-lg flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-body-text group-hover:text-primary transition-colors">
            Paper Management
          </h3>
          <p className="text-xs text-body-secondary">
            View, edit metadata, upload PDF files, and publish or unpublish question papers.
          </p>
        </Link>

        <Link
          to="/admin/papers/create"
          className="bg-white p-6 rounded-xl border border-surface-border shadow-card hover:shadow-md transition-shadow group space-y-3"
        >
          <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center font-bold">
            <PlusCircle className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-body-text group-hover:text-primary transition-colors">
            Create New Paper
          </h3>
          <p className="text-xs text-body-secondary">
            Add a new UPSC prelims paper with custom duration, negative marking, and PDF attachments.
          </p>
        </Link>

        <Link
          to="/admin/attempts"
          className="bg-white p-6 rounded-xl border border-surface-border shadow-card hover:shadow-md transition-shadow group space-y-3"
        >
          <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-body-text group-hover:text-primary transition-colors">
            Attempt Reports
          </h3>
          <p className="text-xs text-body-secondary">
            Inspect platform-wide user exam attempts, scores, and completion statuses.
          </p>
        </Link>
      </div>
    </div>
  )
}
