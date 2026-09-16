import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { paperSchema } from '../../lib/validations'
import { paperService } from '../../services/paperService'
import { storageService } from '../../services/storageService'
import { questionService } from '../../services/questionService'
import { PdfQuestionImporter } from '../../components/admin/PdfQuestionImporter'
import { ArrowLeft, Save, Upload, FileCheck, AlertCircle, Loader2, CheckCircle2, HelpCircle } from 'lucide-react'

export function CreateEditPaperPage() {
  const { paperId } = useParams()
  const isEditMode = !!paperId
  const navigate = useNavigate()

  const [createdPaperId, setCreatedPaperId] = useState(paperId || null)
  const [dbQuestionCount, setDbQuestionCount] = useState(0)

  const [loading, setLoading] = useState(isEditMode)
  const [submitting, setSubmitting] = useState(false)
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfUploadPath, setPdfUploadPath] = useState(null)
  const [serverError, setServerError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(paperSchema),
    defaultValues: {
      title: '',
      exam_name: 'UPSC CSE Prelims',
      exam_type: 'Prelims',
      year: new Date().getFullYear(),
      subject: 'General Studies',
      description: '',
      duration_minutes: 120,
      total_questions: 100,
      maximum_marks: 200,
      marks_per_question: 2.0,
      negative_marking: 0.66,
      status: 'draft'
    }
  })

  const loadQuestionCount = async (pid) => {
    try {
      const count = await questionService.getExistingQuestionCount(pid)
      setDbQuestionCount(count)
    } catch (err) {
      console.error('Error fetching question count:', err)
    }
  }

  useEffect(() => {
    if (isEditMode) {
      async function fetchPaper() {
        try {
          const paper = await paperService.getPaperById(paperId)
          if (paper) {
            setValue('title', paper.title)
            setValue('exam_name', paper.exam_name)
            setValue('exam_type', paper.exam_type || 'Prelims')
            setValue('year', paper.year)
            setValue('subject', paper.subject || 'General Studies')
            setValue('description', paper.description || '')
            setValue('duration_minutes', paper.duration_minutes)
            setValue('total_questions', paper.total_questions)
            setValue('maximum_marks', paper.maximum_marks)
            setValue('marks_per_question', paper.marks_per_question)
            setValue('negative_marking', paper.negative_marking)
            setValue('status', paper.status)
            if (paper.pdf_path) setPdfUploadPath(paper.pdf_path)
            setCreatedPaperId(paper.id)
            await loadQuestionCount(paper.id)
          }
        } catch (err) {
          console.error('Fetch paper error:', err)
          setServerError('Failed to load paper details.')
        } finally {
          setLoading(false)
        }
      }

      fetchPaper()
    }
  }, [paperId, isEditMode, setValue])

  const onSubmit = async (formData) => {
    setServerError(null)
    setSuccessMsg(null)
    setSubmitting(true)

    try {
      let activeId = createdPaperId

      if (isEditMode || activeId) {
        await paperService.updatePaper(activeId, {
          ...formData,
          pdf_path: pdfUploadPath
        })
      } else {
        const newPaper = await paperService.createPaper({
          ...formData,
          pdf_path: pdfUploadPath
        })
        activeId = newPaper.id
        setCreatedPaperId(activeId)
      }

      // Upload PDF to Supabase Storage if file selected
      if (pdfFile && activeId) {
        const path = await storageService.uploadPaperPdf(pdfFile, activeId)
        setPdfUploadPath(path)
        await paperService.updatePaper(activeId, { pdf_path: path })
      }

      setSuccessMsg('Paper record saved successfully! You can now extract and import questions below.')
      await loadQuestionCount(activeId)
    } catch (err) {
      console.error('Save paper error:', err)
      setServerError(err.message || 'Failed to save paper metadata.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Loading paper workspace...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Navigation */}
      <Link to="/admin/papers" className="inline-flex items-center space-x-1.5 text-xs font-semibold text-body-secondary hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Papers List</span>
      </Link>

      {/* Status Badges Header */}
      {createdPaperId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* PDF Storage Status */}
          <div className="bg-white p-4 rounded-xl border border-surface-border shadow-card flex items-center justify-between">
            <div>
              <span className="text-[10px] text-body-secondary font-bold uppercase block">PDF Document Storage</span>
              <span className="text-xs font-bold text-body-text">
                {pdfUploadPath ? 'Uploaded to question-papers bucket' : 'No PDF document attached'}
              </span>
            </div>
            {pdfUploadPath ? (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded flex items-center space-x-1">
                <FileCheck className="w-3.5 h-3.5" />
                <span>Uploaded</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-bold rounded">
                Pending
              </span>
            )}
          </div>

          {/* Database Questions Status */}
          <div className="bg-white p-4 rounded-xl border border-surface-border shadow-card flex items-center justify-between">
            <div>
              <span className="text-[10px] text-body-secondary font-bold uppercase block">Database Questions Status</span>
              <span className="text-xs font-bold text-primary">
                {dbQuestionCount > 0 ? `${dbQuestionCount} questions available in database` : 'No questions imported yet'}
              </span>
            </div>
            {dbQuestionCount > 0 ? (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ready for Exam</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 text-[11px] font-bold rounded flex items-center space-x-1">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Action Required</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Metadata Form Container */}
      <div className="bg-white rounded-xl border border-surface-border p-6 sm:p-8 shadow-card space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-body-text">
            {isEditMode ? 'Edit Paper Details' : 'Create New Question Paper'}
          </h1>
          <p className="text-xs text-body-secondary mt-1">
            Configure exam title, timing rules, negative marking penalties, and attach official PDF.
          </p>
        </div>

        {serverError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-status-success text-xs font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
              Paper Title
            </label>
            <input
              type="text"
              {...register('title')}
              placeholder="e.g. UPSC CSE Prelims 2024 General Studies Paper I"
              className="w-full px-4 py-2.5 rounded-xl border border-surface-border text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
            {errors.title && <p className="mt-1 text-xs text-status-error">{errors.title.message}</p>}
          </div>

          {/* Grid 1: Exam Name, Exam Type, Year, Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Exam Name
              </label>
              <input
                type="text"
                {...register('exam_name')}
                placeholder="UPSC CSE Prelims"
                className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none"
              />
              {errors.exam_name && <p className="mt-1 text-xs text-status-error">{errors.exam_name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Exam Type
              </label>
              <select
                {...register('exam_type')}
                className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none bg-white"
              >
                <option value="Prelims">Prelims</option>
                <option value="CSAT">CSAT</option>
                <option value="Mains">Mains</option>
                <option value="Optional">Optional Subject</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Year
              </label>
              <input
                type="number"
                {...register('year')}
                className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none"
              />
              {errors.year && <p className="mt-1 text-xs text-status-error">{errors.year.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Subject
              </label>
              <input
                type="text"
                {...register('subject')}
                placeholder="General Studies"
                className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
              Description / Notes
            </label>
            <textarea
              rows={3}
              {...register('description')}
              placeholder="Provide context or syllabus details..."
              className="w-full px-4 py-2.5 rounded-xl border border-surface-border text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
            />
          </div>

          {/* Grid 2: Timing & Scoring Parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-surface-border">
            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Duration (Mins)
              </label>
              <input
                type="number"
                {...register('duration_minutes')}
                className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs bg-white focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Max Marks
              </label>
              <input
                type="number"
                step="0.5"
                {...register('maximum_marks')}
                className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs bg-white focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Marks / Question
              </label>
              <input
                type="number"
                step="0.01"
                {...register('marks_per_question')}
                className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs bg-white focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Negative Penalty
              </label>
              <input
                type="number"
                step="0.01"
                {...register('negative_marking')}
                className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs bg-white focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {/* PDF Storage Upload Section */}
          <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 space-y-2">
            <label className="block text-xs font-bold text-body-text uppercase tracking-wider">
              Attach Official Question Paper PDF
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files[0] || null)}
                className="text-xs text-body-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover cursor-pointer"
              />
              {pdfUploadPath && !pdfFile && (
                <span className="text-xs text-emerald-700 font-semibold flex items-center space-x-1">
                  <FileCheck className="w-4 h-4" />
                  <span>PDF Uploaded</span>
                </span>
              )}
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
              Publication Status
            </label>
            <select
              {...register('status')}
              className="w-full sm:w-48 px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none bg-white font-semibold"
            >
              <option value="draft">Draft (Private)</option>
              <option value="published">Published (Public)</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-surface-border flex items-center justify-between">
            <Link
              to="/admin/papers"
              className="px-5 py-2.5 border border-surface-border text-body-secondary rounded-lg text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-subtle flex items-center space-x-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEditMode ? 'Update Paper Details' : 'Save Paper Record'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* PDF Automatic Question Extraction & Importer Section */}
      {createdPaperId ? (
        <PdfQuestionImporter
          paperId={createdPaperId}
          onImportSuccess={() => loadQuestionCount(createdPaperId)}
        />
      ) : (
        <div className="bg-white rounded-xl border border-surface-border p-6 text-center text-body-secondary text-xs">
          Save the paper record above to enable automatic PDF question extraction and importing.
        </div>
      )}
    </div>
  )
}
