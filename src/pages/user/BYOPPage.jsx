import React, { useState, useEffect, useRef } from 'react'
import {
  Upload, FileText, Loader2, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, Eye, Trash2, Plus, Clock,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { byopService } from '../../services/tnpscService'
import { geminiOcrService } from '../../services/geminiOcrService'
import { questionService } from '../../services/questionService'
import { paperService } from '../../services/paperService'
import { formatDate } from '../../lib/utils'

const STATUS_CONFIG = {
  uploaded:         { label: 'Uploaded',         color: 'bg-slate-100 text-slate-600',    icon: Upload },
  processing:       { label: 'Processing…',      color: 'bg-blue-100 text-blue-700',      icon: RefreshCw },
  extracted:        { label: 'Extracted',         color: 'bg-yellow-100 text-yellow-700',  icon: Eye },
  review_required:  { label: 'Review Required',   color: 'bg-orange-100 text-orange-700',  icon: AlertCircle },
  ready:            { label: 'Ready',             color: 'bg-green-100 text-green-700',    icon: CheckCircle2 },
  failed:           { label: 'Failed',            color: 'bg-red-100 text-red-700',        icon: XCircle },
}

export function BYOPPage() {
  const { user } = useAuth()
  const { toast } = useApp()
  const fileRef = useRef(null)

  const [papers, setPapers]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(null) // paper id being processed
  const [progress, setProgress] = useState('')

  useEffect(() => { if (user?.id) fetchPapers() }, [user?.id])

  async function fetchPapers() {
    setLoading(true)
    try { setPapers(await byopService.getAll(user.id)) }
    catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (!allowed.includes(file.type)) {
      toast.error('Only PDF, JPG and PNG files are supported.')
      return
    }

    setUploading(true)
    try {
      const { path } = await byopService.uploadFile(user.id, file)
      const record = await byopService.create(user.id, {
        title:             file.name.replace(/\.[^/.]+$/, ''),
        file_name:         file.name,
        storage_path:      path,
        file_type:         file.type.split('/')[1],
        file_size_bytes:   file.size,
        processing_status: 'uploaded',
      })
      setPapers(prev => [record, ...prev])
      toast.success('Paper uploaded! Click "Process" to extract questions.')
    } catch (err) {
      toast.error('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleProcess(paper) {
    setProcessing(paper.id)
    setProgress('Starting AI extraction…')

    await byopService.update(paper.id, user.id, { processing_status: 'processing' })
    setPapers(prev => prev.map(p => p.id === paper.id ? { ...p, processing_status: 'processing' } : p))

    try {
      // Get signed URL for the file
      const signedUrl = await byopService.getSignedUrl(paper.storage_path)

      const result = await geminiOcrService.processPdfWithGemini(signedUrl, (msg, cur, total) => {
        setProgress(`${msg} (${cur}%)`)
      })

      if (!result.questions || result.questions.length === 0) {
        throw new Error('No questions could be extracted from this document.')
      }

      // Create a paper entry in the main papers table
      const newPaper = await paperService.createPaper({
        title:           paper.title,
        exam_name:       'Custom Upload',
        exam_type:       'Custom',
        year:            new Date().getFullYear(),
        subject:         'General',
        description:     `Uploaded by user: ${paper.file_name}`,
        duration_minutes: 120,
        status:          'draft',
        created_by:      user.id,
      })

      // Save extracted questions
      await questionService.saveQuestionsToSupabase(newPaper.id, result.questions)

      const updated = await byopService.update(paper.id, user.id, {
        processing_status: 'ready',
        extracted_count:   result.questions.length,
        questions_json:    result.questions.slice(0, 10), // preview only
        notes:             `Extracted ${result.questions.length} questions. Paper created: ${newPaper.id}`,
      })
      setPapers(prev => prev.map(p => p.id === paper.id ? updated : p))
      toast.success(`Extracted ${result.questions.length} questions! Draft paper created.`)
    } catch (err) {
      const updated = await byopService.update(paper.id, user.id, {
        processing_status: 'failed',
        notes: err.message,
      })
      setPapers(prev => prev.map(p => p.id === paper.id ? updated : p))
      toast.error('Extraction failed: ' + err.message)
    } finally {
      setProcessing(null)
      setProgress('')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Upload className="w-6 h-6 text-tnpsc-brand" />
          <div>
            <h1 className="text-xl font-bold text-body-text">Bring Your Own Paper</h1>
            <p className="text-xs text-body-secondary">Upload PDF or images — AI extracts questions automatically</p>
          </div>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 bg-tnpsc-brand text-white rounded-xl text-sm font-bold hover:bg-tnpsc-brand-hover transition-colors shadow-brand disabled:opacity-60"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Upload Paper
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileSelect} />
      </div>

      {/* Processing progress banner */}
      {processing && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-bold text-blue-800">AI Processing in progress…</p>
            <p className="text-xs text-blue-700 mt-0.5">{progress}</p>
          </div>
        </div>
      )}

      {/* Upload drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-surface-border rounded-2xl p-8 text-center cursor-pointer hover:border-tnpsc-brand hover:bg-tnpsc-brand-light/30 transition-all group"
      >
        <Upload className="w-10 h-10 text-slate-300 group-hover:text-tnpsc-brand mx-auto mb-3 transition-colors" />
        <p className="text-sm font-semibold text-body-secondary group-hover:text-tnpsc-brand transition-colors">
          Click to upload PDF, JPG or PNG
        </p>
        <p className="text-xs text-body-secondary mt-1">Max 35MB · AI will extract all questions automatically</p>
      </div>

      {/* Papers list */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-7 h-7 animate-spin text-tnpsc-brand" /></div>
      ) : papers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-surface-border">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-body-secondary">No papers uploaded yet. Upload your first paper above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {papers.map(paper => {
            const cfg = STATUS_CONFIG[paper.processing_status] ?? STATUS_CONFIG.uploaded
            const Icon = cfg.icon
            const isProcessingThis = processing === paper.id

            return (
              <div key={paper.id} className="bg-white rounded-2xl border border-surface-border shadow-subtle p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {isProcessingThis ? 'Processing…' : cfg.label}
                      </span>
                      <span className="text-[10px] text-body-secondary">{paper.file_type?.toUpperCase()}</span>
                    </div>
                    <h3 className="text-sm font-bold text-body-text truncate">{paper.title}</h3>
                    <p className="text-xs text-body-secondary mt-0.5">
                      {paper.file_name} · {paper.extracted_count ? `${paper.extracted_count} questions extracted` : 'Not processed yet'}
                    </p>
                    {paper.notes && paper.processing_status === 'failed' && (
                      <p className="text-xs text-red-600 mt-1 line-clamp-2">{paper.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(paper.processing_status === 'uploaded' || paper.processing_status === 'failed') && (
                      <button
                        onClick={() => handleProcess(paper)}
                        disabled={!!processing}
                        className="px-3 py-1.5 bg-tnpsc-brand text-white text-xs font-bold rounded-lg hover:bg-tnpsc-brand-hover transition-colors disabled:opacity-40"
                      >
                        {paper.processing_status === 'failed' ? 'Retry' : 'Process'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 text-[10px] text-body-secondary">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(paper.created_at)}</span>
                  {paper.file_size_bytes && (
                    <span>{(paper.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
