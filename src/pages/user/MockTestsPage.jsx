import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Clock, FileText, Play, Loader2, BookOpen, Sparkles, CheckCircle2, Sliders, Layers } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { paperService } from '../../services/paperService'
import { attemptService } from '../../services/attemptService'
import { testGeneratorService } from '../../services/testGeneratorService'
import { useAuth } from '../../hooks/useAuth'

export function MockTestsPage() {
  const { selectedExam, group2LanguagePref, setGroup2LanguagePref, toast } = useApp()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [papers, setPapers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(null)

  // Test Generator State
  const [generating, setGenerating] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState(group2LanguagePref || 'General Tamil')

  useEffect(() => {
    if (group2LanguagePref) setSelectedLanguage(group2LanguagePref)
  }, [group2LanguagePref])

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
    if (!user) {
      toast.error('Please log in to start a mock test.')
      navigate('/login')
      return
    }
    setStarting(paper.id)
    try {
      const attempt = await attemptService.startOrGetAttempt(user.id, paper.id)
      navigate(`/exam/${paper.id}`)
    } catch (err) { toast.error(err.message) }
    finally { setStarting(null) }
  }

  async function handleGenerateIntelligentTest() {
    if (!user) {
      toast.error('Please log in to generate an intelligent mock test.')
      navigate('/login')
      return
    }

    setGenerating(true)
    try {
      let generatedTest = null

      if (selectedExam === 'TNPSC Group 1') {
        generatedTest = await testGeneratorService.generateGroup1Test({
          quotaResolutionMode: 'normalize_to_200',
          userId: user.id,
          strict: true,
          allowFallback: false,
        })
      } else if (selectedExam === 'TNPSC Group 2/2A') {
        generatedTest = await testGeneratorService.generateGroup2Test({
          languageSpecialization: selectedLanguage,
          userId: user.id,
          strict: true,
          allowFallback: false,
        })
      } else if (selectedExam === 'TNPSC Group 4') {
        generatedTest = await testGeneratorService.generateGroup4Test({
          languageSpecialization: selectedLanguage,
          userId: user.id,
          strict: true,
          allowFallback: false,
        })
      } else {
        // Fallback test generation using Group 1 matrix standard
        generatedTest = await testGeneratorService.generateGroup1Test({
          quotaResolutionMode: 'normalize_to_200',
          userId: user.id,
          strict: true,
          allowFallback: false,
        })
      }

      toast.info('Materializing 200 questions into test session…')
      const result = await testGeneratorService.materializeGeneratedMockPaper(user.id, generatedTest)

      toast.success(`Generated 200Q test with exact quotas! Launching exam…`)
      navigate(`/exam/${result.paperId}`)
    } catch (err) {
      console.error('[MockTestsPage] Generation error:', err)
      toast.error(`Generation failed: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const isGroup1 = selectedExam === 'TNPSC Group 1'
  const isGroup2 = selectedExam === 'TNPSC Group 2/2A'
  const isGroup4 = selectedExam === 'TNPSC Group 4'

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

      {/* ─── Intelligent Test Generator Card ─────────────────────────── */}
      <div className="bg-gradient-to-br from-[#111426] via-[#1a1f3c] to-[#0f1123] rounded-2xl p-6 text-white shadow-card border border-indigo-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold tracking-wide uppercase mb-2 border border-indigo-400/30">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              Intelligent Dynamic Test Generator
            </div>
            <h2 className="text-lg font-bold tracking-tight">
              {isGroup1 && 'TNPSC Group 1 · Full 200-Question Exam Simulation'}
              {isGroup2 && 'TNPSC Group 2/2A · Specialized 200-Question Exam Simulation'}
              {isGroup4 && 'TNPSC Group 4 · Full 200-Question Exam Simulation'}
              {!isGroup1 && !isGroup2 && !isGroup4 && `${selectedExam} · 200-Question Blueprint Mock Test`}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Strictly balances official syllabus quotas and difficulty distribution (30% Easy · 50% Medium · 20% Hard) without duplicate items.
            </p>
          </div>

          <button
            onClick={handleGenerateIntelligentTest}
            disabled={generating}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs tracking-wide shadow-lg shadow-indigo-500/25 transition-all transform active:scale-[0.98] disabled:opacity-60 shrink-0"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating 200 Questions…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Generate & Start Mock (200Q)
              </>
            )}
          </button>
        </div>

        {/* Blueprint Specifications */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Left specification block */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-300 font-bold uppercase tracking-wider text-[11px]">
              <Layers className="w-4 h-4" />
              {(isGroup2 || isGroup4) ? 'Language Specialization (Part 1)' : 'Syllabus Weightage Quotas'}
            </div>

            {isGroup1 && (
              <div className="space-y-1.5 text-slate-300 text-[11px]">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Part A (General Studies · 175 Qs):</span>
                  <span className="font-mono text-white">U1(10), U2(10), U3(25), U4(40), U5(45), U6(45)</span>
                </div>
                <div className="flex justify-between">
                  <span>Part B (Aptitude & Mental Ability · 25 Qs):</span>
                  <span className="font-mono text-white">U1 (15), U2 (10)</span>
                </div>
              </div>
            )}

            {(isGroup2 || isGroup4) && (
              <div className="space-y-2">
                <p className="text-slate-300 text-[11px]">
                  Select your optional subject preference for Part 1 (Questions 1–100):
                </p>
                <div className="flex gap-2">
                  {[
                    { value: 'General Tamil', label: 'பொதுத் தமிழ் (General Tamil)' },
                    { value: 'General English', label: 'General English' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSelectedLanguage(opt.value)
                        setGroup2LanguagePref(opt.value)
                      }}
                      className={`flex-1 py-2 px-2.5 rounded-lg text-[11px] font-semibold border transition-all ${
                        selectedLanguage === opt.value
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  {isGroup4
                    ? 'Part 2 allocates 75 General Studies (SSLC Standard) + Part 3 allocates 25 Aptitude questions.'
                    : 'Part 2 automatically allocates 75 General Studies + 25 Aptitude questions.'}
                </p>
              </div>
            )}

            {!isGroup1 && !isGroup2 && !isGroup4 && (
              <div className="text-slate-300 text-[11px]">
                Stratified across General Studies (100 Qs), General Tamil/English (75 Qs), and Aptitude (25 Qs).
              </div>
            )}
          </div>

          {/* Right specification block */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-300 font-bold uppercase tracking-wider text-[11px]">
              <Sliders className="w-4 h-4" />
              Difficulty Balancing Blueprint
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                <span className="block text-[10px] uppercase font-bold text-emerald-400">Easy (30%)</span>
                <span className="text-base font-extrabold text-white">60 Qs</span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                <span className="block text-[10px] uppercase font-bold text-amber-400">Medium (50%)</span>
                <span className="text-base font-extrabold text-white">100 Qs</span>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">
                <span className="block text-[10px] uppercase font-bold text-rose-400">Hard (20%)</span>
                <span className="text-base font-extrabold text-white">40 Qs</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Total 200 Questions · 300 Marks · Standard 180 Minutes (54s per question pacing benchmark)
            </p>
          </div>
        </div>
      </div>

      {/* ─── Published Papers Grid ───────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-body-text mb-3">Published Exam Papers ({selectedExam})</h2>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>
        ) : papers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-surface-border">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-body-secondary font-semibold">No pre-published papers for {selectedExam} yet</p>
            <p className="text-xs text-body-secondary mt-1">Use the Intelligent Test Generator above to start a customized 200-question test anytime.</p>
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
    </div>
  )
}
