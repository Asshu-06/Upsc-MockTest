import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Newspaper, Plus, Edit, Trash2, Eye, EyeOff, Loader2,
  Search, AlertCircle, CheckCircle2, X, Save,
} from 'lucide-react'
import { adminAffairsService } from '../../services/adminService'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { formatDate } from '../../lib/utils'

const CATEGORIES = ['TN Schemes','Economy','Polity','Science','National','Sports']
const STATUSES   = ['draft','review','published','archived']

const STATUS_COLOR = {
  published: 'bg-green-100 text-green-800',
  draft:     'bg-slate-100 text-slate-700',
  review:    'bg-yellow-100 text-yellow-800',
  archived:  'bg-red-100 text-red-700',
}

const EMPTY_FORM = {
  category: 'TN Schemes', title: '', summary: '', content: '',
  source_name: '', source_url: '', read_time: 3,
  ai_takeaways: '', language: 'en', status: 'draft', is_active: false,
}

function ArticleForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial })
  const [saving, setSaving] = useState(false)
  const { toast } = useApp()
  const { user }  = useAuth()

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.category)      { toast.error('Category is required'); return }

    setSaving(true)
    try {
      const takeaways = form.ai_takeaways
        ? form.ai_takeaways.split('\n').map(s => s.trim()).filter(Boolean)
        : []
      const payload = {
        ...form,
        ai_takeaways: takeaways,
        is_active:    form.status === 'published',
        created_by:   user?.id,
        published_at: form.status === 'published' ? new Date().toISOString() : null,
      }
      delete payload.id
      const saved = await adminAffairsService.upsert(payload, initial?.id ?? null)
      toast.success(initial?.id ? 'Article updated' : 'Article created')
      onSave(saved)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-modal overflow-y-auto animate-scale-in">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-surface-border z-10">
          <h2 className="text-base font-bold text-body-text">{initial?.id ? 'Edit Article' : 'New Current Affairs Article'}</h2>
          <button onClick={onCancel}><X className="w-5 h-5 text-body-secondary" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Category *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Language</label>
              <select value={form.language} onChange={e => set('language', e.target.value)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white">
                <option value="en">English</option>
                <option value="ta">Tamil</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Title *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Article headline..."
              className="w-full border border-surface-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Summary</label>
            <textarea rows={2} value={form.summary} onChange={e => set('summary', e.target.value)}
              placeholder="Short 1-2 sentence summary..."
              className="w-full border border-surface-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand resize-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Full Content</label>
            <textarea rows={6} value={form.content} onChange={e => set('content', e.target.value)}
              placeholder="Full article text..."
              className="w-full border border-surface-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand resize-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">
              AI Key Takeaways <span className="font-normal">(one per line)</span>
            </label>
            <textarea rows={3} value={form.ai_takeaways}
              onChange={e => set('ai_takeaways', e.target.value)}
              placeholder={"Key point 1\nKey point 2\nKey point 3"}
              className="w-full border border-surface-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand resize-none" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Source Name</label>
              <input type="text" value={form.source_name} onChange={e => set('source_name', e.target.value)}
                placeholder="The Hindu" className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
            </div>
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Source URL</label>
              <input type="url" value={form.source_url} onChange={e => set('source_url', e.target.value)}
                placeholder="https://..." className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
            </div>
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Read Time (min)</label>
              <input type="number" min={1} max={30} value={form.read_time} onChange={e => set('read_time', parseInt(e.target.value) || 3)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white">
              {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-2 border-t border-surface-border">
            <button type="submit" disabled={saving}
              className="flex-1 py-3 bg-tnpsc-brand text-white rounded-xl font-bold text-sm hover:bg-tnpsc-brand-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : (initial?.id ? 'Update Article' : 'Create Article')}
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

export function AdminCurrentAffairsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useApp()

  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [catFilter, setCatFilter]       = useState('all')
  const [editing, setEditing] = useState(null) // null | item | 'new'

  useEffect(() => { load() }, [statusFilter, catFilter])
  useEffect(() => {
    if (searchParams.get('action') === 'new') { setEditing('new'); setSearchParams({}) }
  }, [])

  async function load() {
    setLoading(true)
    try { setItems(await adminAffairsService.getAll({ status: statusFilter, category: catFilter, search })) }
    catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  async function handleTogglePublish(item) {
    try {
      const newStatus = item.status === 'published' ? 'archived' : 'published'
      const updated = await adminAffairsService.setStatus(item.id, newStatus)
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
      toast.success(`Article ${newStatus}`)
    } catch (err) { toast.error(err.message) }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Archive "${item.title}"?`)) return
    try {
      await adminAffairsService.remove(item.id)
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'archived', is_active: false } : i))
      toast.success('Article archived')
    } catch (err) { toast.error(err.message) }
  }

  const filtered = items.filter(i =>
    !search || i.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Newspaper className="w-6 h-6 text-tnpsc-brand" />
          <div>
            <h1 className="text-xl font-bold text-body-text">Current Affairs CMS</h1>
            <p className="text-xs text-body-secondary">{items.length} articles total</p>
          </div>
        </div>
        <button onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-tnpsc-brand text-white rounded-xl text-sm font-bold hover:bg-tnpsc-brand-hover transition-colors shadow-brand">
          <Plus className="w-4 h-4" /> New Article
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-body-secondary" />
          <input type="text" placeholder="Search articles…" value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            className="w-full pl-9 pr-4 py-2.5 border border-surface-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white">
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white">
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-surface-border shadow-subtle overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Newspaper className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-body-secondary">No articles found. Click "New Article" to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-surface-border text-body-secondary uppercase font-semibold">
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 max-w-xs">
                      <p className="font-semibold text-body-text truncate">{item.title}</p>
                      {item.summary && <p className="text-body-secondary truncate text-[11px] mt-0.5">{item.summary}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-tnpsc-brand-light text-tnpsc-brand text-[10px] font-bold rounded px-1.5 py-0.5">{item.category}</span>
                    </td>
                    <td className="py-3 px-4 uppercase font-semibold text-body-secondary">{item.language}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${STATUS_COLOR[item.status] ?? STATUS_COLOR.draft}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-body-secondary">{formatDate(item.created_at).split(',')[0]}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setEditing(item)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-body-secondary hover:text-body-text transition-colors" title="Edit">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleTogglePublish(item)}
                          className={`p-1.5 rounded-lg transition-colors ${item.status === 'published' ? 'hover:bg-red-50 text-red-500' : 'hover:bg-green-50 text-green-600'}`}
                          title={item.status === 'published' ? 'Archive' : 'Publish'}>
                          {item.status === 'published' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-body-secondary hover:text-red-500 transition-colors" title="Archive">
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

      {/* Form modal */}
      {editing && (
        <ArticleForm
          initial={editing === 'new' ? {} : { ...editing, ai_takeaways: (editing.ai_takeaways ?? []).join('\n') }}
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
