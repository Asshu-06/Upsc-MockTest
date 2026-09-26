import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Newspaper, Search, Clock, ChevronRight, Loader2, AlertCircle, BookOpen, X, Lightbulb } from 'lucide-react'
import { currentAffairsService } from '../../services/tnpscService'
import { useApp } from '../../contexts/AppContext'
import { Drawer } from '../../components/ui/Drawer'
import { formatDate } from '../../lib/utils'

const CATEGORIES = ['all', 'TN Schemes', 'Economy', 'Polity', 'Science', 'National', 'Sports']
const CATEGORY_COLORS = {
  'TN Schemes': 'bg-green-100 text-green-800',
  'Economy':    'bg-blue-100 text-blue-800',
  'Polity':     'bg-purple-100 text-purple-800',
  'Science':    'bg-cyan-100 text-cyan-800',
  'National':   'bg-orange-100 text-orange-800',
  'Sports':     'bg-pink-100 text-pink-800',
}

export function CurrentAffairsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { language } = useApp()

  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [category, setCategory] = useState('all')
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => { fetchItems() }, [category, language])

  useEffect(() => {
    const id = searchParams.get('id')
    if (id) openById(id)
  }, [searchParams])

  async function fetchItems() {
    setLoading(true)
    setError(null)
    try {
      const data = await currentAffairsService.getAll({ category, language, search })
      setItems(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function openById(id) {
    try {
      const item = await currentAffairsService.getById(id)
      setSelected(item)
      setDrawerOpen(true)
    } catch {}
  }

  function openItem(item) {
    setSelected(item)
    setDrawerOpen(true)
    setSearchParams({ id: item.id })
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setSearchParams({})
    setSelected(null)
  }

  const filtered = items.filter(i =>
    !search || i.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Newspaper className="w-6 h-6 text-tnpsc-brand" />
        <div>
          <h1 className="text-xl font-bold text-body-text">Current Affairs</h1>
          <p className="text-xs text-body-secondary">Stay updated with TNPSC-relevant news</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-body-secondary" />
          <input
            type="text"
            placeholder="Search current affairs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-surface-border rounded-xl text-sm focus:ring-2 focus:ring-tnpsc-brand focus:border-transparent outline-none bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                category === c
                  ? 'bg-tnpsc-brand text-white'
                  : 'bg-white border border-surface-border text-body-secondary hover:text-body-text'
              }`}
            >
              {c === 'all' ? 'All Categories' : c}
            </button>
          ))}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={fetchItems} className="ml-auto text-xs text-red-700 underline">Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-surface-border">
          <Newspaper className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-body-secondary font-semibold">No current affairs found</p>
          <p className="text-xs text-body-secondary mt-1">
            {category !== 'all' ? 'Try a different category, or ' : ''} Admin can add current affairs via the database.
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(item => (
            <button
              key={item.id}
              onClick={() => openItem(item)}
              className="bg-white rounded-2xl border border-surface-border shadow-subtle p-5 text-left hover:shadow-card hover:border-tnpsc-brand/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${CATEGORY_COLORS[item.category] ?? 'bg-slate-100 text-slate-600'}`}>
                  {item.category}
                </span>
                <span className="text-[10px] text-body-secondary flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {item.read_time}m
                </span>
              </div>
              <h3 className="text-sm font-bold text-body-text line-clamp-2 leading-snug group-hover:text-tnpsc-brand transition-colors mb-2">
                {item.title}
              </h3>
              {item.summary && (
                <p className="text-xs text-body-secondary line-clamp-2 leading-relaxed">{item.summary}</p>
              )}
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-body-secondary">{formatDate(item.published_at).split(',')[0]}</span>
                <ChevronRight className="w-3.5 h-3.5 text-tnpsc-brand opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Article Drawer */}
      <Drawer open={drawerOpen} onClose={closeDrawer} title={selected?.category ?? 'Current Affairs'} width="max-w-2xl">
        {selected && (
          <div className="p-6 space-y-6">
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${CATEGORY_COLORS[selected.category] ?? 'bg-slate-100 text-slate-600'}`}>
                {selected.category}
              </span>
              <h2 className="text-xl font-bold text-body-text mt-3 leading-snug">{selected.title}</h2>
              <div className="flex items-center gap-4 mt-2 text-xs text-body-secondary">
                <span>{formatDate(selected.published_at)}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {selected.read_time} min read</span>
                {selected.source_name && <span>{selected.source_name}</span>}
              </div>
            </div>

            {selected.summary && (
              <div className="bg-slate-50 rounded-xl p-4 border border-surface-border">
                <p className="text-sm text-body-secondary leading-relaxed font-medium">{selected.summary}</p>
              </div>
            )}

            {/* AI Takeaways */}
            {Array.isArray(selected.ai_takeaways) && selected.ai_takeaways.length > 0 && (
              <div className="bg-tnpsc-brand-light rounded-xl p-4 border border-tnpsc-brand/20">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-tnpsc-brand" />
                  <span className="text-sm font-bold text-tnpsc-brand">AI Key Takeaways</span>
                </div>
                <ul className="space-y-2">
                  {selected.ai_takeaways.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-body-text">
                      <span className="w-4 h-4 rounded-full bg-tnpsc-brand text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Full content */}
            {selected.content && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-body-secondary" />
                  <span className="text-sm font-bold text-body-text">Full Article</span>
                </div>
                <div className="text-sm text-body-text leading-relaxed whitespace-pre-line">{selected.content}</div>
              </div>
            )}

            {/* Source link */}
            {selected.source_url && (
              <a
                href={selected.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-tnpsc-brand hover:underline font-semibold"
              >
                Read original source <ChevronRight className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
