import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  StickyNote, Plus, Pin, Trash2, Edit2, Save, X, Loader2, Search, AlertCircle,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { notesService } from '../../services/tnpscService'
import { formatDate } from '../../lib/utils'

const NOTE_COLORS = {
  yellow: 'bg-yellow-50  border-yellow-200',
  blue:   'bg-blue-50    border-blue-200',
  green:  'bg-emerald-50 border-emerald-200',
  purple: 'bg-purple-50  border-purple-200',
  red:    'bg-red-50     border-red-200',
}

function NoteCard({ note, onEdit, onDelete, onTogglePin }) {
  const colorCls = NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow
  return (
    <div className={`rounded-2xl border p-4 space-y-2 relative group ${colorCls}`}>
      {note.is_pinned && (
        <div className="absolute -top-2 -right-2">
          <Pin className="w-4 h-4 text-tnpsc-brand fill-tnpsc-brand" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-body-text flex-1 leading-snug">{note.title || 'Untitled'}</h3>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onTogglePin(note)} className="p-1 rounded hover:bg-black/5 transition-colors" title={note.is_pinned ? 'Unpin' : 'Pin'}>
            <Pin className={`w-3.5 h-3.5 ${note.is_pinned ? 'text-tnpsc-brand fill-tnpsc-brand' : 'text-body-secondary'}`} />
          </button>
          <button onClick={() => onEdit(note)} className="p-1 rounded hover:bg-black/5 transition-colors">
            <Edit2 className="w-3.5 h-3.5 text-body-secondary" />
          </button>
          <button onClick={() => onDelete(note)} className="p-1 rounded hover:bg-black/5 transition-colors">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
      {note.content && (
        <p className="text-xs text-body-secondary leading-relaxed line-clamp-4 whitespace-pre-line">{note.content}</p>
      )}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-1.5">
          {note.subject && <span className="text-[10px] bg-white/70 rounded px-1.5 py-0.5 text-body-secondary font-medium">{note.subject}</span>}
          {note.topic   && <span className="text-[10px] bg-white/70 rounded px-1.5 py-0.5 text-body-secondary font-medium">{note.topic}</span>}
        </div>
        <span className="text-[10px] text-body-secondary">{formatDate(note.updated_at).split(',')[0]}</span>
      </div>
    </div>
  )
}

function NoteEditor({ note, onSave, onCancel }) {
  const [form, setForm] = useState({
    title:   note?.title   ?? '',
    content: note?.content ?? '',
    subject: note?.subject ?? '',
    topic:   note?.topic   ?? '',
    color:   note?.color   ?? 'yellow',
    is_pinned: note?.is_pinned ?? false,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-modal p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-body-text">{note ? 'Edit Note' : 'New Note'}</h3>
        <button onClick={onCancel}><X className="w-4 h-4 text-body-secondary" /></button>
      </div>
      <input
        type="text" placeholder="Note title…"
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand"
      />
      <textarea
        rows={5} placeholder="Note content…"
        value={form.content}
        onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
        className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand resize-none"
      />
      <div className="grid grid-cols-2 gap-3">
        <input type="text" placeholder="Subject (optional)"
          value={form.subject}
          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          className="border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand"
        />
        <input type="text" placeholder="Topic (optional)"
          value={form.topic}
          onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
          className="border border-surface-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand"
        />
      </div>
      {/* Color picker */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-body-secondary">Color:</span>
        {Object.keys(NOTE_COLORS).map(c => (
          <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
            className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
              { yellow:'bg-yellow-300', blue:'bg-blue-300', green:'bg-emerald-300', purple:'bg-purple-300', red:'bg-red-300' }[c]
            } ${form.color === c ? 'border-body-text scale-110' : 'border-transparent'}`}
          />
        ))}
        <label className="flex items-center gap-1.5 ml-2 text-xs text-body-secondary cursor-pointer">
          <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))} />
          Pin note
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving || !form.title.trim()}
          className="flex-1 py-2.5 bg-tnpsc-brand text-white rounded-xl text-sm font-bold hover:bg-tnpsc-brand-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Note'}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 bg-slate-100 text-body-secondary rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

export function NotesPage() {
  const { user } = useAuth()
  const { toast } = useApp()
  const [searchParams] = useSearchParams()

  const [notes, setNotes]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')
  const [editing, setEditing]   = useState(null)  // note | 'new' | null
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { fetchNotes() }, [user?.id])

  async function fetchNotes() {
    if (!user?.id) return
    setLoading(true); setError(null)
    try { setNotes(await notesService.getAll(user.id)) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function handleSave(form) {
    try {
      if (editing === 'new') {
        const note = await notesService.create(user.id, form)
        setNotes(n => [note, ...n])
        toast.success('Note created')
      } else {
        const note = await notesService.update(editing.id, user.id, form)
        setNotes(n => n.map(x => x.id === note.id ? note : x))
        toast.success('Note updated')
      }
      setEditing(null)
    } catch (err) { toast.error(err.message) }
  }

  async function handleDelete(note) {
    if (!window.confirm('Delete this note?')) return
    try {
      await notesService.remove(note.id, user.id)
      setNotes(n => n.filter(x => x.id !== note.id))
      toast.success('Note deleted')
    } catch (err) { toast.error(err.message) }
  }

  async function handleTogglePin(note) {
    try {
      const updated = await notesService.update(note.id, user.id, { is_pinned: !note.is_pinned })
      setNotes(n => n.map(x => x.id === updated.id ? updated : x))
    } catch (err) { toast.error(err.message) }
  }

  const filtered = notes.filter(n =>
    !search || n.title.toLowerCase().includes(search.toLowerCase()) ||
    (n.content ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const pinned   = filtered.filter(n => n.is_pinned)
  const unpinned = filtered.filter(n => !n.is_pinned)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <StickyNote className="w-6 h-6 text-yellow-500" />
          <h1 className="text-xl font-bold text-body-text">My Notes</h1>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-tnpsc-brand text-white rounded-xl text-sm font-bold hover:bg-tnpsc-brand-hover transition-colors shadow-brand"
        >
          <Plus className="w-4 h-4" /> New Note
        </button>
      </div>

      {/* Editor */}
      {editing && (
        <NoteEditor
          note={editing === 'new' ? null : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-body-secondary" />
        <input type="text" placeholder="Search notes…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-surface-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand bg-white"
        />
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-red-500" /><p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && !editing && (
        <div className="text-center py-16 bg-white rounded-2xl border border-surface-border">
          <StickyNote className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-body-secondary font-semibold">No notes yet</p>
          <button onClick={() => setEditing('new')} className="text-xs text-tnpsc-brand mt-2 hover:underline font-semibold">Create your first note →</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {pinned.length > 0 && (
            <div>
              <p className="text-xs font-bold text-body-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Pin className="w-3 h-3" /> Pinned
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinned.map(n => (
                  <NoteCard key={n.id} note={n}
                    onEdit={setEditing} onDelete={handleDelete} onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            </div>
          )}
          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && <p className="text-xs font-bold text-body-secondary uppercase tracking-wider mb-3">Other Notes</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {unpinned.map(n => (
                  <NoteCard key={n.id} note={n}
                    onEdit={setEditing} onDelete={handleDelete} onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
