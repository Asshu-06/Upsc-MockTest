import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BellRing, Plus, Edit, Trash2, Eye, EyeOff, Loader2,
  Search, X, Save, Calendar, Users,
} from 'lucide-react'
import { adminNotifService } from '../../services/adminService'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { formatDate } from '../../lib/utils'

const DEPARTMENTS = ['TNPSC','TRB','TNEB','TNUSRB','Other']
const STATUSES    = ['upcoming','active','closed','results_out']

const STATUS_COLOR = {
  active:      'bg-green-100 text-green-800',
  upcoming:    'bg-blue-100 text-blue-800',
  closed:      'bg-slate-100 text-slate-600',
  results_out: 'bg-purple-100 text-purple-700',
}

const EMPTY = {
  department: 'TNPSC', title: '', short_description: '', post_name: '',
  qualification: '', vacancies: '', application_start: '', application_end: '',
  exam_date: '', status: 'upcoming', notification_pdf_url: '',
  official_url: '', apply_url: '', ai_digest: '',
}

function NotifForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial })
  const [saving, setSaving] = useState(false)
  const { toast } = useApp()
  const { user }  = useAuth()

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title is required'); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        vacancies: form.vacancies ? parseInt(form.vacancies) : null,
        application_start: form.application_start || null,
        application_end:   form.application_end   || null,
        exam_date:         form.exam_date         || null,
        created_by: user?.id,
      }
      delete payload.id
      const saved = await adminNotifService.upsert(payload, initial?.id ?? null)
      toast.success(initial?.id ? 'Notification updated' : 'Notification created')
      onSave(saved)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-modal overflow-y-auto animate-scale-in">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-surface-border z-10">
          <h2 className="text-base font-bold text-body-text">{initial?.id ? 'Edit Notification' : 'New Government Notification'}</h2>
          <button onClick={onCancel}><X className="w-5 h-5 text-body-secondary" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Department *</label>
              <select value={form.department} onChange={e => set('department', e.target.value)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white">
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white">
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Notification Title *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. TNPSC Group 4 Recruitment 2026"
              className="w-full border border-surface-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Short Description</label>
            <textarea rows={2} value={form.short_description} onChange={e => set('short_description', e.target.value)}
              className="w-full border border-surface-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Post Name</label>
              <input type="text" value={form.post_name} onChange={e => set('post_name', e.target.value)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
            </div>
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Vacancies</label>
              <input type="number" value={form.vacancies} onChange={e => set('vacancies', e.target.value)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Qualification</label>
            <input type="text" value={form.qualification} onChange={e => set('qualification', e.target.value)}
              placeholder="10th Pass / Graduation / etc."
              className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Application Start</label>
              <input type="date" value={form.application_start} onChange={e => set('application_start', e.target.value)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
            </div>
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Application End</label>
              <input type="date" value={form.application_end} onChange={e => set('application_end', e.target.value)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
            </div>
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Exam Date</label>
              <input type="date" value={form.exam_date} onChange={e => set('exam_date', e.target.value)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Notification PDF URL</label>
              <input type="url" value={form.notification_pdf_url} onChange={e => set('notification_pdf_url', e.target.value)}
                placeholder="https://tnpsc.gov.in/..." className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
            </div>
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Official Portal URL</label>
              <input type="url" value={form.official_url} onChange={e => set('official_url', e.target.value)}
                placeholder="https://tnpsc.gov.in" className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Apply URL</label>
            <input type="url" value={form.apply_url} onChange={e => set('apply_url', e.target.value)}
              placeholder="https://apply.tnpsc.gov.in/..." className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">AI Exam Digest (summary shown to students)</label>
            <textarea rows={4} value={form.ai_digest} onChange={e => set('ai_digest', e.target.value)}
              placeholder="Write a concise exam-relevant summary of this notification..."
              className="w-full border border-surface-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand resize-none" />
          </div>

          <div className="flex gap-3 pt-2 border-t border-surface-border">
            <button type="submit" disabled={saving}
              className="flex-1 py-3 bg-tnpsc-brand text-white rounded-xl font-bold text-sm hover:bg-tnpsc-brand-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : (initial?.id ? 'Update' : 'Create Notification')}
            </button>
            <button type="button" onClick={onCancel}
              className="px-5 py-3 bg-slate-100 text-body-secondary rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AdminNotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useApp()

  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [deptFilter, statusFilter])
  useEffect(() => {
    if (searchParams.get('action') === 'new') { setEditing('new'); setSearchParams({}) }
  }, [])

  async function load() {
    setLoading(true)
    try { setItems(await adminNotifService.getAll({ department: deptFilter, status: statusFilter, search })) }
    catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  async function handleStatusCycle(item) {
    const cycle = { upcoming: 'active', active: 'closed', closed: 'results_out', results_out: 'upcoming' }
    try {
      const updated = await adminNotifService.setStatus(item.id, cycle[item.status] ?? 'active')
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
      toast.success(`Status → ${cycle[item.status]}`)
    } catch (err) { toast.error(err.message) }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    try {
      await adminNotifService.remove(item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success('Notification deleted')
    } catch (err) { toast.error(err.message) }
  }

  const filtered = items.filter(i =>
    !search || i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.department.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BellRing className="w-6 h-6 text-tnpsc-brand" />
          <div>
            <h1 className="text-xl font-bold text-body-text">Government Notifications</h1>
            <p className="text-xs text-body-secondary">{items.length} notifications</p>
          </div>
        </div>
        <button onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-tnpsc-brand text-white rounded-xl text-sm font-bold hover:bg-tnpsc-brand-hover transition-colors shadow-brand">
          <Plus className="w-4 h-4" /> New Notification
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-body-secondary" />
          <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            className="w-full pl-9 pr-4 py-2.5 border border-surface-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white" />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="border border-surface-border rounded-xl px-3 py-2 text-sm outline-none bg-white">
          <option value="all">All Depts</option>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-surface-border rounded-xl px-3 py-2 text-sm outline-none bg-white">
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-surface-border shadow-subtle overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <BellRing className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-body-secondary">No notifications yet. Click "New Notification" to add one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-surface-border text-body-secondary uppercase font-semibold">
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Dept</th>
                  <th className="py-3 px-4">Vacancies</th>
                  <th className="py-3 px-4">Apply By</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 max-w-xs">
                      <p className="font-semibold text-body-text truncate">{item.title}</p>
                      {item.post_name && <p className="text-body-secondary truncate text-[11px]">{item.post_name}</p>}
                    </td>
                    <td className="py-3 px-4 font-bold text-body-secondary">{item.department}</td>
                    <td className="py-3 px-4 font-bold text-tnpsc-brand">{item.vacancies?.toLocaleString() ?? '—'}</td>
                    <td className="py-3 px-4 text-body-secondary">
                      {item.application_end ? new Date(item.application_end).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => handleStatusCycle(item)}
                        className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 cursor-pointer hover:opacity-80 ${STATUS_COLOR[item.status] ?? STATUS_COLOR.upcoming}`}>
                        {item.status?.replace('_',' ')}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setEditing(item)} title="Edit"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-body-secondary hover:text-body-text transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item)} title="Delete"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-body-secondary hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <NotifForm
          initial={editing === 'new' ? {} : editing}
          onSave={saved => {
            setEditing(null)
            setItems(prev => {
              const idx = prev.findIndex(i => i.id === saved.id)
              return idx >= 0 ? prev.map(i => i.id === saved.id ? saved : i) : [saved, ...prev]
            })
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
