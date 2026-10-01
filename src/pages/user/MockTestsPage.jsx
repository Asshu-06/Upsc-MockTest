import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Clock, FileText, Play, Loader2, ArrowRight, BookOpen } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { paperService } from '../../services/paperService'
import { attemptService } from '../../services/attemptService'
import { useAuth } from '../../hooks/useAuth'
import { PaperCard } from '../../components/PaperCard'

export function MockTestsPage() {
  const { selectedExam, toast } = useApp()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [papers, setPapers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(null)

  useEffect(() => { loadPapers() }, [selectedExam])

  async function loadPapers() {
    setLoading(true)
    try {
      const data = await paperService.getPublishedPapers({
        sort: 'year_desc',
        examName: selectedExam,
      })
      setPapers(data)
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  async function startMock(paper) {
    setStarting(paper.id)
    try {
      const attempt = await attemptService.startOrGetAttempt(user.id, paper.id)
      navigate(`/exam/${paper.id}`)
    } catch (err) { toast.error(err.message) }
    finally { setStarting(null) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Zap className="w-6 h-6 text-tnpsc-brand" />
        <div>
          <h1 className="text-xl font-bold text-body-text">Full Mock Tests</h1>
          <p className="text-xs text-body-secondary">Timed exam simulation with detailed result analysis</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-tnpsc-brand-light rounded-2xl border border-tnpsc-brand/20 p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-tnpsc-brand shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-tnpsc-brand">Exam-Mode Simulation</p>
          <p className="text-xs text-body-secondary mt-0.5">
            Questions run in real exam conditions. Your progress is auto-saved — you can resume if you lose connection.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>
      ) : papers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-surface-border">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-body-secondary font-semibold">No papers for {selectedExam} yet</p>
          <p className="text-xs text-body-secondary mt-1">Admin needs to publish papers with exam name "{selectedExam}".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {papers.map(paper => (
            <div key={paper.id} className="bg-white rounded-2xl border border-surface-border shadow-subtle p-5 flex flex-col gap-3 hover:shadow-card transition-shadow">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-tnpsc-brand bg-tnpsc-brand-light rounded px-2 py-0.5">
                  {paper.exam_type}
                </span>
                <h3 className="text-sm font-bold text-body-text mt-2 leading-snug line-clamp-2">{paper.title}</h3>
                <p className="text-xs text-body-secondary mt-1">{paper.year} · {paper.subject}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-body-secondary">
                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {paper.total_questions}Q</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {paper.duration_minutes}m</span>
              </div>
              <div className="flex gap-2 mt-auto pt-2">
                <Link
                  to={`/papers/${paper.id}`}
                  className="flex-1 text-center py-2 border border-surface-border rounded-xl text-xs font-semibold text-body-secondary hover:bg-slate-50 transition-colors"
                >
                  Details
                </Link>
                <button
                  onClick={() => startMock(paper)}
                  disabled={starting === paper.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-tnpsc-brand text-white rounded-xl text-xs font-bold hover:bg-tnpsc-brand-hover transition-colors disabled:opacity-60"
                >
                  {starting === paper.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Start
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
