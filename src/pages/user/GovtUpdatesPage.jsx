import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BellRing, Search, ExternalLink, Download, Loader2,
  AlertCircle, Calendar, Users, BookOpen, ChevronRight, FileText, Brain,
} from 'lucide-react'
import { govtNotificationService } from '../../services/tnpscService'
import { Drawer } from '../../components/ui/Drawer'
import { formatDate } from '../../lib/utils'

const DEPTS = ['all', 'TNPSC', 'TRB', 'TNEB', 'TNUSRB']
const STATUSES = ['all', 'active', 'upcoming', 'closed', 'results_out']

const STATUS_BADGE = {
  active:      'bg-green-100 text-green-800',
  upcoming:    'bg-blue-100 text-blue-800',
  closed:      'bg-slate-100 text-slate-600',
  results_out: 'bg-purple-100 text-purple-700',
}

export function GovtUpdatesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [dept, setDept]           = useState('all')
  const [status, setStatus]       = useState('all')
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => { fetchItems() }, [dept, status])

  useEffect(() => {
    const id = searchParams.get('id')
    if (id) openById(id)
  }, [searchParams])

  async function fetchItems() {
    setLoading(true); setError(null)
    try {
      const data = await govtNotificationService.getAll({ department: dept, status, search })
      setItems(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function openById(id) {
    try {
      const item = await govtNotificationService.getById(id)
      setSelected(item); setDrawerOpen(true)
    } catch {}
  }

  function openItem(item) {
    setSelected(item); setDrawerOpen(true)
    setSearchParams({ id: item.id })
  }

  function closeDrawer() {
    setDrawerOpen(false); setSearchParams({}); setSelected(null)
  }

  function formatShortDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const filtered = items.filter(i =>
    !search || i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.department.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <BellRing className="w-6 h-6 text-tnpsc-brand" />
        <div>
          <h1 className="text-xl font-bold text-body-text">Government Notifications</h1>
          <p className="text-xs text-body-secondary">Vacancies, recruitments & official announcements</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-body-secondary" />
          <input
            type="text"
            placeholder="Search notifications…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-surface-border rounded-xl text-sm focus:ring-2 focus:ring-tnpsc-brand outline-none bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {DEPTS.map(d => (
            <button key={d} onClick={() => setDept(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${dept === d ? 'bg-tnpsc-brand text-white' : 'bg-white border border-surface-border text-body-secondary hover:text-body-text'}`}
            >{d === 'all' ? 'All Depts' : d}</button>
          ))}
          <span className="w-px h-6 bg-surface-border self-center mx-1" />
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${status === s ? 'bg-tnpsc-brand text-white' : 'bg-white border border-surface-border text-body-secondary hover:text-body-text'}`}
            >{s === 'all' ? 'All Status' : s.replace('_', ' ')}</button>
          ))}
        </div>
      </div>

      {/* States */}
      {loading && <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={fetchItems} className="ml-auto text-xs underline text-red-700">Retry</button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-surface-border">
          <BellRing className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-body-secondary font-semibold">No notifications found</p>
          <p className="text-xs text-body-secondary mt-1">Admin can add government notifications via the database.</p>
        </div>
      )}

      {/* Cards */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(item => (
            <button
              key={item.id}
              onClick={() => openItem(item)}
              className="w-full bg-white rounded-2xl border border-surface-border shadow-subtle p-5 text-left hover:shadow-card hover:border-tnpsc-brand/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">
                      {item.department}
                    </span>
                    <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${STATUS_BADGE[item.status] ?? STATUS_BADGE.closed}`}>
                      {item.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-body-text group-hover:text-tnpsc-brand transition-colors line-clamp-2 leading-snug">
                    {item.title}
                  </h3>
                  {item.short_description && (
                    <p className="text-xs text-body-secondary mt-1 line-clamp-1">{item.short_description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {item.vacancies && (
                    <p className="text-lg font-black text-tnpsc-brand">{item.vacancies.toLocaleString()}</p>
                  )}
                  {item.vacancies && <p className="text-[10px] text-body-secondary">vacancies</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-[10px] text-body-secondary flex-wrap">
                {item.application_end && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Apply by: {formatShortDate(item.application_end)}
                  </span>
                )}
                {item.exam_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Exam: {formatShortDate(item.exam_date)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Notification Detail Drawer */}
      <Drawer open={drawerOpen} onClose={closeDrawer} title="Notification Details" width="max-w-2xl">
        {selected && (
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 rounded px-2 py-0.5">{selected.department}</span>
                <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${STATUS_BADGE[selected.status] ?? STATUS_BADGE.closed}`}>
                  {selected.status?.replace('_', ' ')}
                </span>
                {selected.notification_pdf_url && (
                  <span className="text-[10px] font-bold bg-tnpsc-brand-light text-tnpsc-brand rounded px-2 py-0.5 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Official PDF
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-body-text leading-snug">{selected.title}</h2>
            </div>

            {/* Key Details */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Department',    value: selected.department,  icon: BookOpen },
                { label: 'Post',          value: selected.post_name,   icon: Users },
                { label: 'Vacancies',     value: selected.vacancies?.toLocaleString(), icon: Users },
                { label: 'Qualification', value: selected.qualification, icon: BookOpen },
                { label: 'Apply From',    value: formatShortDate(selected.application_start), icon: Calendar },
                { label: 'Apply By',      value: formatShortDate(selected.application_end),   icon: Calendar },
                { label: 'Exam Date',     value: formatShortDate(selected.exam_date),          icon: Calendar },
              ].filter(d => d.value && d.value !== '—').map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-body-secondary mb-1">
                    <Icon className="w-3 h-3" />{label}
                  </div>
                  <p className="text-sm font-semibold text-body-text">{value}</p>
                </div>
              ))}
            </div>

            {selected.short_description && (
              <div>
                <p className="text-xs font-bold text-body-secondary uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-body-text leading-relaxed">{selected.short_description}</p>
              </div>
            )}

            {/* AI Digest */}
            {selected.ai_digest && (
              <div className="bg-tnpsc-brand-light rounded-xl p-4 border border-tnpsc-brand/20">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-tnpsc-brand" />
                  <span className="text-sm font-bold text-tnpsc-brand">AI Exam Digest</span>
                </div>
                <p className="text-xs text-body-text leading-relaxed">{selected.ai_digest}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {selected.notification_pdf_url && (
                <a
                  href={selected.notification_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center gap-2 px-4 py-2.5 bg-tnpsc-brand text-white text-sm font-semibold rounded-xl hover:bg-tnpsc-brand-hover transition-colors"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </a>
              )}
              {selected.official_url && (
                <a
                  href={selected.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-surface-border text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Official Portal
                </a>
              )}
              {selected.apply_url && (
                <a
                  href={selected.apply_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
                >
                  Apply Now <ChevronRight className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
