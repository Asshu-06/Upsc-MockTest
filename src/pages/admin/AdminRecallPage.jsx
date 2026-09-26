import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Brain, Plus, Edit, Trash2, Eye, EyeOff, Loader2, Search, X, Save } from 'lucide-react'
import { adminRecallService } from '../../services/adminService'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { formatDate } from '../../lib/utils'

const SUBJECTS    = ['General Studies','General Science','Aptitude','Tamil','Current Affairs']
const STATUSES    = ['published','draft','archived']
const DIFFICULTIES= ['easy','medium','hard']
const OPTS = ['A','B','C','D']

const EMPTY = {
  exam_context:'TNPSC Group 4', subject:'General Studies', topic:'',
  difficulty:'medium', question_text:'', question_ta:'',
  option_a:'', option_b:'', option_c:'', option_d:'', correct_option:'A',
  explanation:'', is_active:true, for_daily:false, status:'published', tags:'',
}

const STATUS_COLOR = { published:'bg-green-100 text-green-800', draft:'bg-slate-100 text-slate-700', archived:'bg-red-100 text-red-700' }

function RecallForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial, tags: (initial?.tags ?? []).join(', ') })
  const [saving, setSaving] = useState(false)
  const { toast } = useApp()
  const { user }  = useAuth()

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.question_text.trim()) { toast.error('Question text is required'); return }
    if (!form.option_a || !form.option_b || !form.option_c || !form.option_d) { toast.error('All 4 options are required'); return }
    setSaving(true)
    try {
      const payload = { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), created_by: user?.id }
      delete payload.id
      const saved = await adminRecallService.upsert(payload, initial?.id ?? null)
      toast.success(initial?.id ? 'Question updated' : 'Question created')
      onSave(saved)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-modal overflow-y-auto animate-scale-in">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-surface-border z-10">
          <h2 className="text-base font-bold text-body-text">{initial?.id ? 'Edit Recall Question' : 'New Recall Question'}</h2>
          <button onClick={onCancel}><X className="w-5 h-5 text-body-secondary" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Subject</label>
              <select value={form.subject} onChange={e => set('subject', e.target.value)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white">
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Topic</label>
              <input type="text" value={form.topic} onChange={e => set('topic', e.target.value)}
                placeholder="e.g. Indian Polity" className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
            </div>
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Difficulty</label>
              <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white">
                {DIFFICULTIES.map(d => <option key={d} className="capitalize">{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Question Text (English) *</label>
            <textarea rows={3} value={form.question_text} onChange={e => set('question_text', e.target.value)}
              placeholder="Enter the recall question..." className="w-full border border-surface-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand resize-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Question Text (Tamil — optional)</label>
            <textarea rows={2} value={form.question_ta} onChange={e => set('question_ta', e.target.value)}
              className="w-full border border-surface-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {OPTS.map(opt => (
              <div key={opt}>
                <label className="block text-xs font-bold text-body-secondary mb-1">Option {opt} *</label>
                <input type="text" value={form[`option_${opt.toLowerCase()}`]}
                  onChange={e => set(`option_${opt.toLowerCase()}`, e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand ${form.correct_option === opt ? 'border-emerald-400 bg-emerald-50' : 'border-surface-border'}`} />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Correct Answer *</label>
            <div className="flex gap-2">
              {OPTS.map(opt => (
                <button type="button" key={opt} onClick={() => set('correct_option', opt)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${form.correct_option === opt ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-surface-border text-body-secondary hover:border-emerald-400'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Explanation</label>
            <textarea rows={3} value={form.explanation} onChange={e => set('explanation', e.target.value)}
              className="w-full border border-surface-border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand resize-none" />
          </div>

          <div className="grid grid-cols-3 gap-3 items-center">
            <div>
              <label className="block text-xs font-bold text-body-secondary mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none bg-white">
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-body-text cursor-pointer mt-4">
              <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-body-text cursor-pointer mt-4">
              <input type="checkbox" checked={form.for_daily} onChange={e => set('for_daily', e.target.checked)} />
              Daily Recall
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-body-secondary mb-1">Tags (comma separated)</label>
            <input type="text" value={form.tags} onChange={e => set('tags', e.target.value)}
              placeholder="polity, article, constitution" className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
          </div>

          <div className="flex gap-3 pt-2 border-t border-surface-border">
            <button type="submit" disabled={saving}
              className="flex-1 py-3 bg-tnpsc-brand text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-tnpsc-brand-hover transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : (initial?.id ? 'Update' : 'Create Question')}
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

export function AdminRecallPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useApp()
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [subjFilter, setSubjFilter] = useState('all')
  const [editing, setEditing] = useState(null)

  useEffect(() => { load() }, [subjFilter])
  useEffect(() => {
    if (searchParams.get('action') === 'new') { setEditing('new'); setSearchParams({}) }
  }, [])

  async function load() {
    setLoading(true)
    try { setItems(await adminRecallService.getAll({ subject: subjFilter })) }
    catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  async function handleToggle(item) {
    try {
      const updated = await adminRecallService.toggle(item.id, !item.is_active)
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
      toast.success(`Question ${updated.is_active ? 'activated' : 'deactivated'}`)
    } catch (err) { toast.error(err.message) }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.question_text.slice(0,60)}…"?`)) return
    try {
      await adminRecallService.remove(item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success('Question deleted')
    } catch (err) { toast.error(err.message) }
  }

  const filtered = items.filter(i =>
    !search || i.question_text.toLowerCase().includes(search.toLowerCase()) ||
    (i.subject ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-tnpsc-brand" />
          <div>
            <h1 className="text-xl font-bold text-body-text">Quick Recall Questions</h1>
            <p className="text-xs text-body-secondary">{items.length} questions · {items.filter(i=>i.is_active).length} active</p>
          </div>
        </div>
        <button onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-tnpsc-brand text-white rounded-xl text-sm font-bold hover:bg-tnpsc-brand-hover transition-colors shadow-brand">
          <Plus className="w-4 h-4" /> New Question
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-body-secondary" />
          <input type="text" placeholder="Search questions…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-surface-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white" />
        </div>
        <select value={subjFilter} onChange={e => setSubjFilter(e.target.value)}
          className="border border-surface-border rounded-xl px-3 py-2 text-sm outline-none bg-white">
          <option value="all">All Subjects</option>
          {SUBJECTS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-surface-border shadow-subtle overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Brain className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-body-secondary">No recall questions yet. Click "New Question" to add one.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {filtered.map(item => (
              <div key={item.id} className={`px-5 py-4 hover:bg-slate-50/50 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${STATUS_COLOR[item.status]}`}>{item.status}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-medium">{item.subject}</span>
                      {item.topic && <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{item.topic}</span>}
                      <span className="text-[10px] font-semibold text-body-secondary capitalize">{item.difficulty}</span>
                      {item.for_daily && <span className="text-[10px] bg-orange-100 text-orange-700 rounded px-1.5 py-0.5 font-bold">Daily</span>}
                    </div>
                    <p className="text-sm font-medium text-body-text line-clamp-2">{item.question_text}</p>
                    <div className="flex gap-3 mt-1.5 text-xs text-body-secondary">
                      {['A','B','C','D'].map(opt => (
                        <span key={opt} className={opt === item.correct_option ? 'font-bold text-emerald-700' : ''}>
                          {opt}: {item[`option_${opt.toLowerCase()}`]?.slice(0,20)}
                          {item[`option_${opt.toLowerCase()}`]?.length > 20 ? '…' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleToggle(item)} title={item.is_active ? 'Deactivate' : 'Activate'}
                      className={`p-1.5 rounded-lg transition-colors ${item.is_active ? 'hover:bg-red-50 text-green-600 hover:text-red-500' : 'hover:bg-green-50 text-slate-400 hover:text-green-600'}`}>
                      {item.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setEditing(item)} className="p-1.5 rounded-lg hover:bg-slate-100 text-body-secondary transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 text-body-secondary hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <RecallForm
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
