import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { paperSchema } from '../../lib/validations'
import { paperService } from '../../services/paperService'
import { storageService } from '../../services/storageService'
import { questionService } from '../../services/questionService'
import { pdfQuestionParser } from '../../services/pdfQuestionParser'
import { PdfQuestionImporter } from '../../components/admin/PdfQuestionImporter'
import { ArrowLeft, Save, Upload, FileCheck, AlertCircle, Loader2, CheckCircle2, HelpCircle, RefreshCw, FileText, Sparkles } from 'lucide-react'

export function CreateEditPaperPage() {
  const { paperId } = useParams()
  const isEditMode = !!paperId
  const navigate = useNavigate()

  const [createdPaperId, setCreatedPaperId] = useState(paperId || null)
  const [dbQuestionCount, setDbQuestionCount] = useState(0)

  const [loading, setLoading] = useState(isEditMode)
  const [submitting, setSubmitting] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const [pdfFile, setPdfFile] = useState(null)
  const [pdfUploadPath, setPdfUploadPath] = useState(null)
  const [extractionResult, setExtractionResult] = useState(null)

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

  // Single PDF selection handler
  const handlePdfFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setServerError(null)
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setServerError('Selected file must be a valid PDF document.')
      return
    }

    if (file.size > 30 * 1024 * 1024) {
      setServerError('PDF file size must not exceed 30MB.')
      return
    }

    setPdfFile(file)
  }

  // Primary Action: Save Paper & Extract Questions
  const onSubmit = async (formData) => {
    setServerError(null)
    setSuccessMsg(null)
    setSubmitting(true)

    let activeId = createdPaperId

    try {
      // 1. Create or Update Paper Record
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

      // 2. Upload PDF to Storage if new file selected
      let currentPath = pdfUploadPath
      if (pdfFile && activeId) {
        currentPath = await storageService.uploadPaperPdf(pdfFile, activeId)
        setPdfUploadPath(currentPath)
        await paperService.updatePaper(activeId, { pdf_path: currentPath })
      }

      setSuccessMsg('Paper details saved successfully!')

      // 3. Trigger Automatic PDF Question Extraction if PDF file/path is available
      if (pdfFile || currentPath) {
        setExtracting(true)
        let pdfInput = pdfFile

        if (!pdfInput && currentPath) {
          pdfInput = await storageService.getPdfPublicUrl(currentPath)
        }

        if (pdfInput) {
          const result = await pdfQuestionParser.parsePdf(pdfInput)
          setExtractionResult(result)

          // Scroll to extraction results section
          setTimeout(() => {
            const section = document.getElementById('extraction-results-section')
            if (section) {
              section.scrollIntoView({ behavior: 'smooth' })
            }
          }, 300)
        }
      }
    } catch (err) {
      console.error('Save paper and extract error:', err)
      setServerError(err.message || 'Failed to save paper and extract questions.')
    } finally {
      setSubmitting(false)
      setExtracting(false)
    }
  }

  // Retry Extraction handler using existing file/path
  const handleRetryExtraction = async () => {
    if (!pdfFile && !pdfUploadPath) {
      setServerError('Please select a PDF file first.')
      return
    }

    setExtracting(true)
    setServerError(null)

    try {
      let pdfInput = pdfFile
      if (!pdfInput && pdfUploadPath) {
        pdfInput = await storageService.getPdfPublicUrl(pdfUploadPath)
      }

      const result = await pdfQuestionParser.parsePdf(pdfInput)
      setExtractionResult(result)
    } catch (err) {
      console.error('Retry extraction error:', err)
      setServerError(err.message || 'Failed to extract questions from PDF.')
    } finally {
      setExtracting(false)
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

      {/* Main Integrated Form Container */}
      <div className="bg-white rounded-xl border border-surface-border p-6 sm:p-8 shadow-card space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-body-text">
            {isEditMode ? 'Edit Paper Details' : 'Create New Question Paper'}
          </h1>
          <p className="text-xs text-body-secondary mt-1">
            Fill paper metadata, upload official question paper PDF, and extract questions automatically.
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
          {/* STEP 1: Paper Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-surface-border pb-2">
              Step 1: Paper Metadata & Scoring Parameters
            </h3>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Paper Title
              </label>
              <input
                type="text"
                {...register('title')}
                placeholder="e.g. UPSC CSE Prelims 2024 General Studies Paper I"
                className="w-full px-4 py-2.5 rounded-xl border border-surface-border text-sm focus:ring-2 focus:ring-primary outline-none"
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
                rows={2}
                {...register('description')}
                placeholder="Provide syllabus context or instructions..."
                className="w-full px-4 py-2 rounded-xl border border-surface-border text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
              />
            </div>

            {/* Grid 2: Timing & Scoring Parameters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-surface-border">
              <div>
                <label className="block text-[10px] font-bold text-body-text uppercase mb-1">
                  Duration (Mins)
                </label>
                <input
                  type="number"
                  {...register('duration_minutes')}
                  className="w-full px-3 py-1.5 rounded-lg border border-surface-border text-xs bg-white focus:ring-2 focus:ring-primary outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-body-text uppercase mb-1">
                  Max Marks
                </label>
                <input
                  type="number"
                  step="0.5"
                  {...register('maximum_marks')}
                  className="w-full px-3 py-1.5 rounded-lg border border-surface-border text-xs bg-white focus:ring-2 focus:ring-primary outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-body-text uppercase mb-1">
                  Marks / Question
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('marks_per_question')}
                  className="w-full px-3 py-1.5 rounded-lg border border-surface-border text-xs bg-white focus:ring-2 focus:ring-primary outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-body-text uppercase mb-1">
                  Negative Penalty
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('negative_marking')}
                  className="w-full px-3 py-1.5 rounded-lg border border-surface-border text-xs bg-white focus:ring-2 focus:ring-primary outline-none font-semibold"
                />
              </div>
            </div>

            {/* Publication Status */}
            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-1">
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
          </div>

          {/* STEP 2: SINGLE PDF UPLOAD AREA */}
          <div className="space-y-3 pt-4 border-t border-surface-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
              Step 2: Upload Official Question Paper PDF
            </h3>

            <div className="p-5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 space-y-3">
              <label className="block text-xs font-bold text-body-text">
                Upload Official Question Paper PDF
              </label>
              <p className="text-xs text-body-secondary">
                Upload the PDF containing questions, options, and answer key. Questions will be extracted automatically.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfFileChange}
                  className="text-xs text-body-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover cursor-pointer w-full"
                />

                {(pdfFile || pdfUploadPath) && (
                  <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center space-x-1.5 whitespace-nowrap">
                    <FileCheck className="w-4 h-4 text-emerald-700" />
                    <span>{pdfFile ? pdfFile.name : 'PDF Attached'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STEP 3: PRIMARY ACTION BUTTON */}
          <div className="pt-4 border-t border-surface-border flex items-center justify-between">
            <Link
              to="/admin/papers"
              className="px-5 py-2.5 border border-surface-border text-body-secondary rounded-lg text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting || extracting}
              className="px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-card flex items-center space-x-2 disabled:opacity-50 transition-all"
            >
              {submitting || extracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{extracting ? 'Extracting questions from PDF...' : 'Saving paper details...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-white" />
                  <span>{isEditMode ? 'Update Paper & Extract Questions' : 'Save Paper & Extract Questions'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* STEPS 4, 5, 6, 7: QUESTION EXTRACTION RESULTS, PREVIEW & IMPORT */}
      {(createdPaperId || extractionResult || serverError) && (
        <PdfQuestionImporter
          paperId={createdPaperId}
          extractionResult={extractionResult}
          extracting={extracting}
          extractionError={serverError}
          onRetryExtraction={handleRetryExtraction}
          onImportSuccess={() => loadQuestionCount(createdPaperId)}
        />
      )}
    </div>
  )
}
