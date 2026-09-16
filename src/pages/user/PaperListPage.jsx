import React, { useEffect, useState } from 'react'
import { paperService } from '../../services/paperService'
import { PaperCard } from '../../components/PaperCard'
import { Search, Filter, Loader2, BookOpen } from 'lucide-react'

export function PaperListPage() {
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('all')
  const [examTypeFilter, setExamTypeFilter] = useState('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('year_desc')

  useEffect(() => {
    async function loadPapers() {
      setLoading(true)
      try {
        const data = await paperService.getPublishedPapers({
          search,
          year: yearFilter,
          examType: examTypeFilter,
          subject: subjectFilter,
          sort: sortOrder
        })
        setPapers(data || [])
      } catch (err) {
        console.error('Failed to load published papers:', err)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(loadPapers, 250)
    return () => clearTimeout(timer)
  }, [search, yearFilter, examTypeFilter, subjectFilter, sortOrder])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-body-text">UPSC Question Papers Catalog</h1>
        <p className="text-xs text-body-secondary mt-1">Browse published previous year question papers for Civil Services Prelims & Mains</p>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-surface-border p-4 shadow-card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search text */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search paper title..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Year Filter */}
          <div>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
            >
              <option value="all">All Years</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
              <option value="2021">2021</option>
              <option value="2020">2020</option>
            </select>
          </div>

          {/* Exam Type Filter */}
          <div>
            <select
              value={examTypeFilter}
              onChange={(e) => setExamTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
            >
              <option value="all">All Exam Types</option>
              <option value="Prelims">Prelims</option>
              <option value="CSAT">CSAT</option>
              <option value="Mains">Mains</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
            >
              <option value="year_desc">Latest Year First</option>
              <option value="year_asc">Oldest Year First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-xs text-body-secondary font-medium">Filtering question papers...</p>
        </div>
      ) : papers.length === 0 ? (
        <div className="bg-white rounded-xl border border-surface-border p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-body-text">No Published Papers Found</h3>
          <p className="text-xs text-body-secondary max-w-sm mx-auto">
            No question papers matched your search criteria. Try adjusting your filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {papers.map((paper) => (
            <PaperCard key={paper.id} paper={paper} />
          ))}
        </div>
      )}
    </div>
  )
}
