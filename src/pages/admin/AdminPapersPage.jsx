import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { paperService } from '../../services/paperService'
import { FileText, PlusCircle, Edit, Trash2, Upload, HelpCircle, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'

export function AdminPapersPage() {
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)

  const loadPapers = async () => {
    try {
      const data = await paperService.getAllPapersForAdmin()
      setPapers(data || [])
    } catch (err) {
      console.error('Failed to load papers:', err)
      setError(err.message || 'Failed to load papers list.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPapers()
  }, [])

  const handleTogglePublish = async (paperId, currentStatus) => {
    setError(null)
    setActionSuccess(null)
    const newStatus = currentStatus === 'published' ? 'draft' : 'published'

    try {
      await paperService.togglePublishStatus(paperId, newStatus)
      setActionSuccess(`Paper status changed to ${newStatus}.`)
      await loadPapers()
    } catch (err) {
      console.error('Publish error:', err)
      setError(err.message || 'Failed to update paper status.')
    }
  }

  const handleDeleteDraft = async (paperId, title) => {
    if (!window.confirm(`Are you sure you want to delete draft paper "${title}"?`)) return
    setError(null)
    setActionSuccess(null)

    try {
      await paperService.deletePaper(paperId)
      setActionSuccess(`Draft paper deleted successfully.`)
      await loadPapers()
    } catch (err) {
      console.error('Delete draft error:', err)
      setError(err.message || 'Failed to delete paper.')
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Loading paper management table...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-body-text">Question Paper Management</h1>
          <p className="text-xs text-body-secondary mt-1">Create, configure, add questions, import, and publish UPSC question papers</p>
        </div>

        <Link
          to="/admin/papers/create"
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-subtle flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create New Paper</span>
        </Link>
      </div>

      {/* Toast Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-status-success text-xs flex items-center space-x-2 font-semibold">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-surface-border shadow-card overflow-hidden">
        {papers.length === 0 ? (
          <div className="p-12 text-center text-body-secondary text-xs">
            No papers created yet. Click "Create New Paper" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-body-secondary uppercase font-semibold border-b border-surface-border">
                  <th className="py-3 px-4">Title & Details</th>
                  <th className="py-3 px-4">Year / Type</th>
                  <th className="py-3 px-4">Questions</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {papers.map((p) => {
                  const isPublished = p.status === 'published'
                  const isDraft = p.status === 'draft'

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-4 max-w-xs">
                        <div className="font-bold text-body-text text-sm truncate">{p.title}</div>
                        <div className="text-[11px] text-body-secondary">{p.exam_name} · {p.subject}</div>
                      </td>
                      <td className="py-4 px-4 font-semibold text-body-text">
                        {p.year} ({p.exam_type || 'Prelims'})
                      </td>
                      <td className="py-4 px-4 font-bold text-primary">
                        {p.total_questions || 0} Qs
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          isPublished
                            ? 'bg-emerald-100 text-emerald-800'
                            : isDraft
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            to={`/admin/papers/${p.id}/questions`}
                            className="px-2.5 py-1 bg-blue-50 text-primary hover:bg-blue-100 font-semibold rounded text-[11px] flex items-center space-x-1"
                            title="Manage Questions"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Questions</span>
                          </Link>

                          <Link
                            to={`/admin/papers/${p.id}/import`}
                            className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold rounded text-[11px] flex items-center space-x-1"
                            title="Import JSON / CSV"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Import</span>
                          </Link>

                          <Link
                            to={`/admin/papers/${p.id}/edit`}
                            className="p-1.5 text-body-secondary hover:text-primary hover:bg-slate-100 rounded"
                            title="Edit Metadata"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handleTogglePublish(p.id, p.status)}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                              isPublished
                                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-subtle'
                            }`}
                          >
                            {isPublished ? 'Unpublish' : 'Publish'}
                          </button>

                          {isDraft && (
                            <button
                              onClick={() => handleDeleteDraft(p.id, p.title)}
                              className="p-1.5 text-body-secondary hover:text-status-error hover:bg-red-50 rounded"
                              title="Delete Draft"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
