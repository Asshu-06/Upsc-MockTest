import React, { useState, useEffect } from 'react'
import {
  BookMarked, Plus, Edit, Trash2, ChevronRight, ChevronDown,
  Loader2, X, Save, AlertCircle,
} from 'lucide-react'
import { adminSyllabusService } from '../../services/adminService'
import { useApp } from '../../contexts/AppContext'

function InlineForm({ label, initial, fields, onSave, onCancel }) {
  const [form, setForm] = useState(initial ?? {})
  const [saving, setSaving] = useState(false)
  const { toast } = useApp()

  async function handleSave() {
    setSaving(true)
    try { await onSave(form) }
    catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-tnpsc-brand-light border border-tnpsc-brand/20 rounded-xl p-4 space-y-3">
      <p className="text-sm font-bold text-tnpsc-brand">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(f => (
          <div key={f.key} className={f.full ? 'col-span-2' : ''}>
            <label className="block text-[10px] font-bold text-body-secondary mb-1 uppercase">{f.label}{f.required ? ' *' : ''}</label>
            {f.type === 'textarea' ? (
              <textarea rows={2} value={form[f.key] ?? ''} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand resize-none" />
            ) : (
              <input type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={e => setForm(v => ({ ...v, [f.key]: f.type === 'number' ? parseInt(e.target.value)||0 : e.target.value }))}
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-tnpsc-brand" />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-tnpsc-brand text-white rounded-lg text-xs font-bold hover:bg-tnpsc-brand-hover transition-colors flex items-center gap-1.5 disabled:opacity-60">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-white border border-surface-border text-body-secondary rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

export function AdminSyllabusPage() {
  const { toast } = useApp()
  const [exams, setExams]       = useState([])
  const [selectedExam, setSelectedExam] = useState(null)
  const [units, setUnits]       = useState([])
  const [topics, setTopics]     = useState({})     // unitId -> []
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading]   = useState(true)
  const [addingExam, setAddingExam] = useState(false)
  const [editingExam, setEditingExam] = useState(null)
  const [addingUnit, setAddingUnit]   = useState(false)
  const [editingUnit, setEditingUnit] = useState(null)
  const [addingTopic, setAddingTopic] = useState(null) // unitId
  const [editingTopic, setEditingTopic] = useState(null)

  useEffect(() => { loadExams() }, [])
  useEffect(() => { if (selectedExam) loadUnits(selectedExam.id) }, [selectedExam])

  async function loadExams() {
    setLoading(true)
    try {
      const data = await adminSyllabusService.getExams()
      setExams(data)
      if (!selectedExam && data.length > 0) setSelectedExam(data[0])
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  async function loadUnits(examId) {
    try { setUnits(await adminSyllabusService.getUnits(examId)) }
    catch (err) { toast.error(err.message) }
  }

  async function loadTopics(unitId) {
    try {
      const data = await adminSyllabusService.getTopics(unitId)
      setTopics(prev => ({ ...prev, [unitId]: data }))
    } catch (err) { toast.error(err.message) }
  }

  async function handleSaveExam(form) {
    if (!form.exam_name?.trim()) { throw new Error('Exam name is required') }
    const saved = await adminSyllabusService.upsertExam(form, editingExam?.id)
    await loadExams()
    setAddingExam(false); setEditingExam(null)
    toast.success(editingExam ? 'Exam updated' : 'Exam created')
  }

  async function handleSaveUnit(form) {
    if (!form.unit_name?.trim()) throw new Error('Unit name is required')
    await adminSyllabusService.upsertUnit({ ...form, exam_id: selectedExam.id }, editingUnit?.id)
    await loadUnits(selectedExam.id)
    setAddingUnit(false); setEditingUnit(null)
    toast.success(editingUnit ? 'Unit updated' : 'Unit created')
  }

  async function handleDeleteUnit(unit) {
    if (!window.confirm(`Delete unit "${unit.unit_name}" and all its topics?`)) return
    try {
      await adminSyllabusService.deleteUnit(unit.id)
      await loadUnits(selectedExam.id)
      toast.success('Unit deleted')
    } catch (err) { toast.error(err.message) }
  }

  async function handleSaveTopic(unitId, form) {
    if (!form.topic_name?.trim()) throw new Error('Topic name is required')
    await adminSyllabusService.upsertTopic({ ...form, unit_id: unitId }, editingTopic?.id)
    await loadTopics(unitId)
    setAddingTopic(null); setEditingTopic(null)
    toast.success(editingTopic ? 'Topic updated' : 'Topic created')
  }

  async function handleDeleteTopic(unitId, topic) {
    if (!window.confirm(`Delete topic "${topic.topic_name}"?`)) return
    try {
      await adminSyllabusService.deleteTopic(topic.id)
      await loadTopics(unitId)
      toast.success('Topic deleted')
    } catch (err) { toast.error(err.message) }
  }

  async function toggleUnit(unit) {
    const open = !expanded[unit.id]
    setExpanded(e => ({ ...e, [unit.id]: open }))
    if (open && !topics[unit.id]) await loadTopics(unit.id)
  }

  const EXAM_FIELDS  = [{ key:'exam_name', label:'Exam Name', required:true }, { key:'code', label:'Code' }, { key:'display_order', label:'Order', type:'number' }]
  const UNIT_FIELDS  = [{ key:'unit_name', label:'Unit Name', required:true }, { key:'unit_number', label:'Number', type:'number' }, { key:'subject', label:'Subject' }, { key:'description', label:'Description', type:'textarea', full:true }]
  const TOPIC_FIELDS = [{ key:'topic_name', label:'Topic Name', required:true }, { key:'topic_number', label:'Number', type:'number' }, { key:'description', label:'Description', type:'textarea', full:true }, { key:'description_ta', label:'Tamil Description', type:'textarea', full:true }]

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookMarked className="w-6 h-6 text-tnpsc-brand" />
          <h1 className="text-xl font-bold text-body-text">Syllabus Manager</h1>
        </div>
        <button onClick={() => setAddingExam(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-tnpsc-brand text-white rounded-xl text-sm font-bold hover:bg-tnpsc-brand-hover transition-colors shadow-brand">
          <Plus className="w-4 h-4" /> New Exam
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Exam selector */}
        <div className="bg-white rounded-2xl border border-surface-border shadow-subtle p-4 space-y-2">
          <p className="text-xs font-bold text-body-secondary uppercase tracking-wider mb-3">Exams</p>
          {exams.map(exam => (
            <button key={exam.id} onClick={() => setSelectedExam(exam)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${selectedExam?.id === exam.id ? 'bg-tnpsc-brand text-white' : 'hover:bg-slate-50 text-body-text'}`}>
              {exam.exam_name}
            </button>
          ))}
          {exams.length === 0 && <p className="text-xs text-body-secondary text-center py-4">No exams yet</p>}

          {addingExam && (
            <InlineForm label="New Exam" fields={EXAM_FIELDS}
              onSave={handleSaveExam} onCancel={() => setAddingExam(false)} />
          )}
          {editingExam && (
            <InlineForm label="Edit Exam" initial={editingExam} fields={EXAM_FIELDS}
              onSave={handleSaveExam} onCancel={() => setEditingExam(null)} />
          )}
        </div>

        {/* Units + Topics */}
        <div className="lg:col-span-3 space-y-3">
          {selectedExam ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-body-text">{selectedExam.exam_name} — Units & Topics</p>
                <button onClick={() => setAddingUnit(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-tnpsc-brand hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Add Unit
                </button>
              </div>

              {addingUnit && (
                <InlineForm label="New Unit" fields={UNIT_FIELDS}
                  onSave={handleSaveUnit} onCancel={() => setAddingUnit(false)} />
              )}

              {units.length === 0 && !addingUnit && (
                <div className="bg-white rounded-2xl border border-surface-border p-8 text-center">
                  <p className="text-sm text-body-secondary">No units yet. Click "Add Unit" to get started.</p>
                </div>
              )}

              {units.map(unit => (
                <div key={unit.id} className="bg-white rounded-2xl border border-surface-border shadow-subtle overflow-hidden">
                  {/* Unit row */}
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                    <button onClick={() => toggleUnit(unit)} className="flex items-center gap-3 flex-1 text-left">
                      {expanded[unit.id] ? <ChevronDown className="w-4 h-4 text-tnpsc-brand" /> : <ChevronRight className="w-4 h-4 text-body-secondary" />}
                      <span className="w-6 h-6 rounded-md bg-tnpsc-brand text-white text-xs font-bold flex items-center justify-center">{unit.unit_number ?? '–'}</span>
                      <span className="text-sm font-semibold text-body-text">{unit.unit_name}</span>
                      {unit.subject && <span className="text-xs text-body-secondary ml-1">({unit.subject})</span>}
                    </button>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditingUnit(unit)} className="p-1.5 hover:bg-slate-100 rounded-lg text-body-secondary hover:text-body-text transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteUnit(unit)} className="p-1.5 hover:bg-red-50 rounded-lg text-body-secondary hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  {editingUnit?.id === unit.id && (
                    <div className="px-4 pb-3">
                      <InlineForm label="Edit Unit" initial={editingUnit} fields={UNIT_FIELDS}
                        onSave={handleSaveUnit} onCancel={() => setEditingUnit(null)} />
                    </div>
                  )}

                  {/* Topics */}
                  {expanded[unit.id] && (
                    <div className="border-t border-surface-border bg-slate-50">
                      {(topics[unit.id] ?? []).map(topic => (
                        <div key={topic.id} className="flex items-center justify-between px-8 py-2.5 border-b border-surface-border last:border-0">
                          {editingTopic?.id === topic.id ? (
                            <div className="flex-1">
                              <InlineForm label="Edit Topic" initial={editingTopic} fields={TOPIC_FIELDS}
                                onSave={form => handleSaveTopic(unit.id, form)} onCancel={() => setEditingTopic(null)} />
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs text-body-secondary w-5 shrink-0">{topic.topic_number ?? '–'}.</span>
                                <span className="text-sm text-body-text truncate">{topic.topic_name}</span>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => setEditingTopic(topic)} className="p-1 hover:bg-white rounded text-body-secondary hover:text-body-text transition-colors"><Edit className="w-3 h-3" /></button>
                                <button onClick={() => handleDeleteTopic(unit.id, topic)} className="p-1 hover:bg-red-50 rounded text-body-secondary hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {addingTopic === unit.id ? (
                        <div className="px-8 py-3">
                          <InlineForm label="New Topic" fields={TOPIC_FIELDS}
                            onSave={form => handleSaveTopic(unit.id, form)} onCancel={() => setAddingTopic(null)} />
                        </div>
                      ) : (
                        <button onClick={() => setAddingTopic(unit.id)}
                          className="w-full text-left px-8 py-2.5 text-xs font-semibold text-tnpsc-brand hover:bg-tnpsc-brand-light transition-colors flex items-center gap-1.5">
                          <Plus className="w-3 h-3" /> Add Topic
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-surface-border p-12 text-center">
              <p className="text-sm text-body-secondary">Select an exam to manage its syllabus.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
